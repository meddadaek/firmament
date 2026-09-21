"""The simulation: time, needs, resources, construction and movement.

The sim owns the agents' *bodies* and the rules of the world. What an agent decides to
do next comes from a Policy (policy.py). Today that is a rule-based placeholder; in the
next phase an LLM brain implements the same `choose(sim, agent) -> Job | None` call.
"""

from __future__ import annotations

import math
import random
from collections import deque
from dataclasses import dataclass, field

from .buildings import BLUEPRINTS, BUILD_ORDER, Building
from .chat import Chatter
from .hexgrid import STEP
from .roster import ROSTER
from .world import World, generate_world

DAY_SECONDS = 240.0
WALK_SPEED = 1.15  # world units per sim-second
MAX_STEP_HEIGHT = 0.45
CARRY_CAPACITY = 5
HUNGER_DAYS = 0.9  # a full belly lasts this many days
ENERGY_DAYS = 1.25
FOOD_PER_MEAL = 0.34
TREE_REGROW_DAYS = 1.5
BUSH_REGROW_PER_DAY = 3.0
FARM_GROW_DAYS = 0.9
FARM_YIELD = 10
TOOL_BONUS = 1.5
GATHER_RATE = {"wood": 0.22, "stone": 0.16, "food": 0.45}  # units per sim-second
REVEAL_RADIUS = 1
SCOUT_REVEAL_RADIUS = 2
START_STOCK = {"wood": 0, "stone": 0, "food": 14}


def _smoothstep(a: float, b: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


@dataclass
class Job:
    kind: str
    dest: int | None  # tile to walk to; None = act where you stand
    target: int | None = None  # node id, building id or tile, depending on kind
    resource: str | None = None
    work: float = 0.0  # seconds of action for timed jobs
    label: str = ""  # shown while acting
    travel: str = ""  # shown while walking
    face: tuple[float, float] | None = None  # world (x, z) to face while acting


@dataclass
class Agent:
    id: str
    name: str
    role: str
    tile: int
    home: int
    x: float
    y: float
    z: float
    yaw: float = 0.0
    hunger: float = 1.0
    energy: float = 1.0
    carry_kind: str | None = None
    carry_n: int = 0
    job: Job | None = None
    path: list[int] = field(default_factory=list)
    seg: float = 0.0
    act: str = "idle"  # idle | walk | work | eat | sleep
    hidden: bool = False  # inside a building
    bed: int | None = None
    jobs_done: int = 0
    cooldown: float = 0.0
    accum: float = 0.0
    stats: dict[str, int] = field(default_factory=lambda: {"wood": 0, "stone": 0, "food": 0, "built": 0})

    @property
    def label(self) -> str:
        if self.job is None:
            return "idle"
        return self.job.travel if self.path else self.job.label

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "x": round(self.x, 3), "y": round(self.y, 3), "z": round(self.z, 3), "yaw": round(self.yaw, 3),
            "act": self.act, "label": self.label, "tile": self.tile,
            "hunger": round(self.hunger, 3), "energy": round(self.energy, 3),
            "carry": [self.carry_kind, self.carry_n] if self.carry_n else None,
            "hidden": self.hidden, "jobs": self.jobs_done, "stats": self.stats,
            "task": self.job.kind if self.job else None,
        }


class Simulation:
    def __init__(self, seed: int = 20260921, policy=None):
        from .policy import RulePolicy

        self.world: World = generate_world(seed)
        self.policy = policy or RulePolicy()
        self.rng = random.Random(seed + 99)
        self.clock = 0.0
        self.t = 0.3
        self.day = 1
        self.speed = 1
        self.stock = dict(START_STOCK)
        self.tools = 0
        self.buildings: dict[int, Building] = {}
        self.blocked: dict[int, int] = {}  # tile -> building id
        self.plan_index = 0
        self._next_bid = 1
        self._event_id = 0
        self.claims: dict[int, str] = {}  # node id -> agent id
        self.discovered: set[int] = {t.i for t in self.world.tiles if t.ring <= 3}
        self.events: deque[dict] = deque(maxlen=80)
        self._pending_events: list[dict] = []
        self._changed_nodes: set[int] = set()
        self._revealed: list[int] = []
        self._milestone = 0
        self._bedtime = self.bedtime
        self._seen_biomes = {self.world.tiles[i].biome for i in self.discovered}

        self.agents: list[Agent] = []
        for spec, home in zip(ROSTER, self.world.home_tiles):
            t = self.world.tiles[home]
            a = Agent(spec["id"], spec["name"], spec["role"], home, home, t.x, t.h, t.z)
            a.yaw = math.atan2(-t.x, -t.z)
            a.cooldown = self.rng.uniform(0.3, 3.0)
            self.agents.append(a)
        self.chat = Chatter(self)
        self.emit("day", "Day 1. Six founders wake up by a campfire with a crate of supplies.")
        self.chat.morning()

    def agent(self, agent_id: str) -> Agent:
        return next(a for a in self.agents if a.id == agent_id)

    @staticmethod
    def blueprint_name(kind: str | None) -> str:
        return BLUEPRINTS[kind].name if kind else ""

    # ── time ──────────────────────────────────────────────────────────────
    @property
    def night(self) -> float:
        return 1 - _smoothstep(-0.12, 0.14, math.sin((self.t - 0.25) * math.tau))

    @property
    def bedtime(self) -> bool:
        return self.night > 0.62

    def clock_string(self) -> str:
        minutes = int(self.t * 1440)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    def advance(self, dt: float) -> None:
        while dt > 1e-9:
            step = min(dt, 0.1)
            self.step(step)
            dt -= step

    def step(self, dt: float) -> None:
        self.clock += dt
        self.t += dt / DAY_SECONDS
        if self.t >= 1:
            self.t -= 1
            self.day += 1
            self.emit("day", f"Day {self.day} begins.")
        bedtime = self.bedtime
        if bedtime and not self._bedtime:
            self.emit("night", "Night falls. The firm heads to bed.")
            self.chat.evening()
        elif not bedtime and self._bedtime:
            self.chat.morning()
        self._bedtime = bedtime
        self._update_world(dt)
        for a in self.agents:
            self._update_agent(a, dt)
        self.chat.update()

    # ── events ────────────────────────────────────────────────────────────
    def emit(self, kind: str, text: str, agent: str | None = None) -> None:
        self._event_id += 1
        e = {"id": self._event_id, "day": self.day, "time": self.clock_string(), "kind": kind, "text": text, "agent": agent}
        self.events.append(e)
        self._pending_events.append(e)

    # ── world upkeep ──────────────────────────────────────────────────────
    def _update_world(self, dt: float) -> None:
        for n in self.world.nodes:
            if n.kind in ("pine", "tree") and n.amount <= 0 and n.regrow_at is not None and self.clock >= n.regrow_at:
                n.amount, n.regrow_at = n.capacity, None
                self._changed_nodes.add(n.id)
            elif n.kind == "bush" and n.amount < n.capacity:
                before = int(n.amount)
                n.amount = min(n.capacity, n.amount + BUSH_REGROW_PER_DAY * dt / DAY_SECONDS)
                if int(n.amount) != before:
                    self._changed_nodes.add(n.id)

        for b in self.buildings.values():
            if b.state == "planned" and all(self.stock[k] >= v for k, v in b.blueprint.cost.items()):
                for k, v in b.blueprint.cost.items():
                    self.stock[k] -= v
                b.state = "building"
                self.emit("build", f"Materials are in. Construction of the {b.blueprint.name} has started.")
                self.chat.construction_started(b.kind)
            if b.kind == "farm" and b.state == "done" and 0 <= b.crop < 1:
                b.crop = min(1.0, b.crop + dt / (FARM_GROW_DAYS * DAY_SECONDS))
                if b.crop >= 1:
                    self.emit("farm", "The farm's crop is ripe.")
                    self.chat.ripe()

    # ── agents ────────────────────────────────────────────────────────────
    def _update_agent(self, a: Agent, dt: float) -> None:
        sleeping = a.act == "sleep"
        a.hunger = max(0.0, a.hunger - dt / (HUNGER_DAYS * DAY_SECONDS) * (0.5 if sleeping else 1.0))
        if sleeping:
            a.energy = min(1.0, a.energy + dt / ((0.3 if a.hidden else 0.45) * DAY_SECONDS))
        else:
            drain = 1.4 if a.act == "work" else 1.0
            a.energy = max(0.0, a.energy - dt / (ENERGY_DAYS * DAY_SECONDS) * drain)

        job = a.job
        if job is not None:
            if self.bedtime and job.kind not in ("sleep", "eat", "forage"):
                self._drop(a)
            elif a.hunger < 0.12 and job.kind not in ("eat", "forage", "sleep"):
                self._drop(a)

        if a.job is None:
            a.act = "idle"
            if a.cooldown > 0:
                a.cooldown -= dt
                return
            job = self.policy.choose(self, a)
            if job is None or not self._route(a, job):
                a.cooldown = 1.5
                return
            a.job = job

        if a.path:
            a.act = "walk"
            self._walk(a, dt)
            return
        self._act(a, a.job, dt)

    def _drop(self, a: Agent) -> None:
        self._release(a)
        a.job, a.path, a.seg, a.hidden = None, [], 0.0, False
        self._snap(a)

    def _release(self, a: Agent) -> None:
        for nid in [k for k, v in self.claims.items() if v == a.id]:
            del self.claims[nid]

    def _finish(self, a: Agent, productive: bool = False) -> None:
        self._release(a)
        a.job = None
        a.act = "idle"
        a.accum = 0.0
        if productive:
            a.jobs_done += 1

    def _snap(self, a: Agent) -> None:
        t = self.world.tiles[a.tile]
        a.x, a.y, a.z = t.x, t.h, t.z

    # ── movement ──────────────────────────────────────────────────────────
    def passable(self, i: int) -> bool:
        return self.world.tiles[i].walkable and i not in self.blocked

    def find_path(self, start: int, goal: int) -> list[int] | None:
        if start == goal:
            return [start]
        prev = {start: -1}
        queue = deque([start])
        tiles = self.world.tiles
        while queue:
            cur = queue.popleft()
            if cur == goal:
                break
            h = tiles[cur].h
            for n in self.world.neighbours(cur):
                if n in prev or not self.passable(n) or abs(tiles[n].h - h) > MAX_STEP_HEIGHT:
                    continue
                prev[n] = cur
                queue.append(n)
        if goal not in prev:
            return None
        path = []
        n = goal
        while n != -1:
            path.append(n)
            n = prev[n]
        return path[::-1]

    def _route(self, a: Agent, job: Job) -> bool:
        if job.dest is None or job.dest == a.tile:
            a.path = []
            return True
        path = self.find_path(a.tile, job.dest)
        if path is None:
            self._release(a)
            return False
        a.path = path[1:]
        a.seg = 0.0
        return True

    def _walk(self, a: Agent, dt: float) -> None:
        if not self.passable(a.path[0]):  # a building went up on the route
            if a.job is None or not self._route(a, a.job):
                return self._drop(a)
            if not a.path:
                return
        speed = WALK_SPEED * (0.65 if a.hunger <= 0 else 1.0)
        a.seg += dt * speed / STEP
        while a.seg >= 1 and a.path:
            a.seg -= 1
            a.tile = a.path.pop(0)
            self._reveal(a)
        if not a.path:
            a.seg = 0.0
            self._snap(a)
            return
        ta, tb = self.world.tiles[a.tile], self.world.tiles[a.path[0]]
        p = a.seg
        climb = 0.12 if abs(tb.h - ta.h) > 0.04 else 0.0
        hop = math.sin(math.pi * min(1.0, max(0.0, (p - 0.3) / 0.4))) * climb
        a.x = ta.x + (tb.x - ta.x) * p
        a.z = ta.z + (tb.z - ta.z) * p
        a.y = ta.h + (tb.h - ta.h) * _smoothstep(0.35, 0.65, p) + hop
        a.yaw = math.atan2(tb.x - ta.x, tb.z - ta.z)

    def _reveal(self, a: Agent) -> None:
        radius = SCOUT_REVEAL_RADIUS if a.role == "scout" else REVEAL_RADIUS
        t = self.world.tiles[a.tile]
        for n in self.world.tiles:
            if n.i in self.discovered:
                continue
            if abs(n.q - t.q) <= radius and abs(n.r - t.r) <= radius and self.world.distance(n.i, t.i) <= radius:
                self.discovered.add(n.i)
                self._revealed.append(n.i)
                if n.biome not in self._seen_biomes:
                    self._seen_biomes.add(n.biome)
                    what = {"stone": "a rocky hill full of stone", "forest": "a pine forest", "water": "fresh water",
                            "sand": "a sandy shore", "meadow": "open meadows"}.get(n.biome, n.biome)
                    self.emit("discover", f"{a.name} discovered {what}.", a.id)
                    self.chat.discovered(a.id, n.biome, (n.x, n.z))
        share = len(self.discovered) / len(self.world.tiles)
        for mark in (0.25, 0.5, 0.75, 1.0):
            if share >= mark and self._milestone < mark:
                self._milestone = mark
                self.emit("discover", f"{int(mark * 100)}% of the island has been explored.", a.id)
                self.chat.explored(int(mark * 100))

    # ── actions ───────────────────────────────────────────────────────────
    def _face(self, a: Agent, job: Job) -> None:
        if job.face:
            fx, fz = job.face
            if abs(fx - a.x) + abs(fz - a.z) > 1e-3:
                a.yaw = math.atan2(fx - a.x, fz - a.z)

    def _act(self, a: Agent, job: Job, dt: float) -> None:
        self._face(a, job)
        slow = 0.5 if a.hunger <= 0 else 1.0
        kind = job.kind

        if kind == "gather":
            node = self.world.nodes[job.target]
            if node.amount < 1 or a.carry_n >= CARRY_CAPACITY:
                return self._finish(a)
            a.act = "work"
            a.accum += GATHER_RATE[node.resource] * (TOOL_BONUS if self.tools else 1.0) * slow * dt
            while a.accum >= 1 and node.amount >= 1 and a.carry_n < CARRY_CAPACITY:
                a.accum -= 1
                node.amount -= 1
                a.carry_kind, a.carry_n = node.resource, a.carry_n + 1
                a.stats[node.resource] += 1
                self._changed_nodes.add(node.id)
                if node.kind in ("pine", "tree") and node.amount < 1:
                    node.amount, node.regrow_at = 0, self.clock + TREE_REGROW_DAYS * DAY_SECONDS
            if node.amount < 1 or a.carry_n >= CARRY_CAPACITY:
                self._finish(a)

        elif kind == "deliver":
            a.act = "work"
            job.work -= dt
            if job.work <= 0:
                if a.carry_kind and a.carry_n:
                    self.stock[a.carry_kind] += a.carry_n
                a.carry_kind, a.carry_n = None, 0
                self._finish(a, productive=True)

        elif kind == "eat":
            a.act = "eat"
            a.accum += dt
            if a.accum >= 1.5:
                a.accum = 0
                if self.stock["food"] >= 1:
                    self.stock["food"] -= 1
                    a.hunger = min(1.0, a.hunger + FOOD_PER_MEAL)
                else:
                    return self._finish(a)
            if a.hunger >= 0.85:
                self._finish(a)

        elif kind == "forage":
            node = self.world.nodes[job.target]
            a.act = "eat"
            a.accum += dt
            if a.accum >= 1.6:
                a.accum = 0
                if node.amount >= 1:
                    node.amount -= 1
                    a.hunger = min(1.0, a.hunger + FOOD_PER_MEAL)
                    self._changed_nodes.add(node.id)
                else:
                    return self._finish(a)
            if a.hunger >= 0.85:
                self._finish(a)

        elif kind == "build":
            b = self.buildings.get(job.target)
            if b is None or b.state != "building":
                return self._finish(a)
            a.act = "work"
            b.work_done += dt * slow
            if b.work_done >= b.blueprint.work:
                self._complete(b, a)
                self._finish(a, productive=True)

        elif kind == "survey":
            a.act = "work"
            job.work -= dt
            if job.work <= 0:
                kind_to_build = BUILD_ORDER[self.plan_index] if self.plan_index < len(BUILD_ORDER) else None
                if kind_to_build and self.can_plan() and job.target not in self.blocked:
                    self._place(kind_to_build, job.target, a)
                self._finish(a, productive=True)

        elif kind == "craft":
            a.act = "work"
            job.work -= dt * slow
            if job.work <= 0:
                self.tools = 1
                self.emit("tools", f"{a.name} crafted stone tools. Everyone now gathers 50% faster.", a.id)
                self.chat.tools(a.id)
                self._finish(a, productive=True)

        elif kind in ("plant", "harvest"):
            b = self.buildings.get(job.target)
            if b is None or b.state != "done":
                return self._finish(a)
            a.act = "work"
            job.work -= dt * slow
            if job.work <= 0:
                if kind == "plant":
                    b.crop = 0.0
                    self.emit("farm", f"{a.name} planted the farm.", a.id)
                else:
                    b.crop = -1.0
                    self.stock["food"] += FARM_YIELD
                    a.stats["food"] += FARM_YIELD
                    self.emit("farm", f"{a.name} harvested {FARM_YIELD} food.", a.id)
                    self.chat.harvested(FARM_YIELD)
                self._finish(a, productive=True)

        elif kind == "sleep":
            a.act = "sleep"
            a.hidden = job.target is not None
            if not self.bedtime and self.night < 0.35 and a.energy > 0.5:
                a.hidden = False
                self._finish(a)
            elif not self.bedtime and a.energy >= 0.95:
                a.hidden = False
                self._finish(a)

        else:  # explore, wander
            a.act = "idle"
            job.work -= dt
            if job.work <= 0:
                self._finish(a)

    # ── construction ──────────────────────────────────────────────────────
    def active_site(self) -> Building | None:
        return next((b for b in self.buildings.values() if b.state != "done"), None)

    def done(self, kind: str) -> Building | None:
        return next((b for b in self.buildings.values() if b.kind == kind and b.state == "done"), None)

    def next_blueprint(self) -> str | None:
        return BUILD_ORDER[self.plan_index] if self.plan_index < len(BUILD_ORDER) else None

    def can_plan(self) -> bool:
        kind = self.next_blueprint()
        if kind is None or self.active_site() is not None:
            return False
        return all(self.done(req) for req in BLUEPRINTS[kind].requires)

    def needed(self) -> dict[str, int]:
        """Materials still missing for the active site, or for the next blueprint."""
        site = self.active_site()
        if site is not None and site.state == "planned":
            cost = site.blueprint.cost
        else:
            kind = self.next_blueprint()
            cost = BLUEPRINTS[kind].cost if kind else {}
        return {k: v - self.stock[k] for k, v in cost.items() if v > self.stock[k]}

    def pick_site(self, kind: str) -> int | None:
        tiles = self.world.tiles
        home = set(self.world.home_tiles)
        with_nodes = {n.tile for n in self.world.nodes if n.amount >= 1}
        best, best_score = None, math.inf
        for t in tiles:
            if (
                t.i not in self.discovered or not self.passable(t.i) or t.i in home or t.i in with_nodes
                or t.biome not in ("plaza", "meadow") or not 2 <= t.ring <= 7
            ):
                continue
            free = [n for n in self.world.neighbours(t.i) if self.passable(n)]
            if len(free) < 3:
                continue
            # Never cut a neighbour off from the rest of the island.
            if any(sum(1 for m in self.world.neighbours(n) if m != t.i and self.passable(m)) < 1 for n in free):
                continue
            water = any(tiles[n].biome == "water" for n in self.world.neighbours(t.i))
            score = t.ring + abs(t.h - 0.55) * 5 + self.rng.random() * 0.8
            if kind == "farm" and water:
                score -= 2.5
            if kind == "townhall":
                score -= 1.5 if t.ring <= 3 else 0
            if score < best_score:
                best, best_score = t.i, score
        return best

    def _place(self, kind: str, tile: int, by: Agent) -> None:
        b = Building(self._next_bid, kind, tile)
        self._next_bid += 1
        self.buildings[b.id] = b
        self.blocked[tile] = b.id
        self.plan_index += 1
        cost = ", ".join(f"{v} {k}" for k, v in b.blueprint.cost.items())
        self.emit("plan", f"{by.name} marked out a {b.blueprint.name} ({cost}).", by.id)
        t = self.world.tiles[tile]
        self.chat.planned(by.id, kind, (t.x, t.z), b.blueprint.cost)
        # Anyone standing on the new site steps aside.
        for other in self.agents:
            if other.tile == tile:
                spot = next((n for n in self.world.neighbours(tile) if self.passable(n)), None)
                if spot is not None:
                    other.tile = spot
                    self._drop(other)

    def _complete(self, b: Building, by: Agent) -> None:
        b.state, b.work_done = "done", b.blueprint.work
        by.stats["built"] += 1
        self.emit("done", f"The {b.blueprint.name} is finished!", by.id)
        self.chat.completed(b.kind, by.id)
        if b.blueprint.beds:
            for a in self.agents:
                if a.bed is None and len(b.sleepers) < b.blueprint.beds:
                    a.bed = b.id
                    b.sleepers.append(a.id)
            names = ", ".join(self._name(i) for i in b.sleepers)
            if names:
                self.emit("done", f"{names} will sleep in the new {b.blueprint.name}.")
                self.chat.beds([self._name(i) for i in b.sleepers], b.kind)
        if b.kind == "townhall":
            self.emit("done", "The Town Hall stands. The camp is officially a city.")

    def _name(self, agent_id: str) -> str:
        return next(a.name for a in self.agents if a.id == agent_id)

    def stand_tile(self, a: Agent, target_tile: int) -> int | None:
        """Nearest free tile next to a building (buildings block their own tile)."""
        options = [n for n in self.world.neighbours(target_tile) if self.passable(n)]
        if not options:
            return None
        return min(options, key=lambda n: self.world.distance(n, a.tile))

    # ── snapshots ─────────────────────────────────────────────────────────
    def _state(self) -> dict:
        return {
            "t": round(self.t, 5), "day": self.day, "speed": self.speed, "night": round(self.night, 3),
            "clock": round(self.clock, 2),
            "stock": dict(self.stock), "tools": self.tools,
            "discovered": len(self.discovered), "totalTiles": len(self.world.tiles),
            "planIndex": self.plan_index,
            "agents": [a.to_json() for a in self.agents],
            "buildings": [
                {"id": b.id, "kind": b.kind, "tile": b.tile, "state": b.state,
                 "progress": round(b.progress, 3), "crop": round(b.crop, 3), "sleepers": b.sleepers}
                for b in self.buildings.values()
            ],
        }

    def full_snapshot(self) -> dict:
        s = self._state()
        s["type"] = "state"
        s["nodes"] = [[n.id, int(n.amount)] for n in self.world.nodes]
        s["revealed"] = sorted(self.discovered)
        s["events"] = list(self.events)
        s["chat"] = list(self.chat.log)
        return s

    def delta_snapshot(self) -> dict:
        s = self._state()
        s["type"] = "tick"
        s["nodes"] = [[i, int(self.world.nodes[i].amount)] for i in sorted(self._changed_nodes)]
        s["revealed"] = self._revealed
        s["events"] = self._pending_events
        s["chat"] = self.chat.drain()
        self._changed_nodes = set()
        self._revealed = []
        self._pending_events = []
        return s
