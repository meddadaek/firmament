"""Decision making: what an agent does next.

`Policy.choose(sim, agent)` returns a Job (or None). The sim then walks the agent there
and performs it. RulePolicy is a hand-written placeholder: it does not learn. The LLM
brain in the next phase implements the same interface and builds Jobs with the same
helpers below, so the world rules stay identical when the brain changes.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Protocol

from .buildings import BLUEPRINTS, Building
from .sim import Job

if TYPE_CHECKING:
    from .sim import Agent, Simulation

CAMP = (0.0, 0.0)
GATHER_LABELS = {
    "wood": ("going to chop wood", "chopping wood"),
    "stone": ("going to mine stone", "mining stone"),
    "food": ("going to pick berries", "picking berries"),
}


class Policy(Protocol):
    name: str

    def choose(self, sim: Simulation, agent: Agent) -> Job | None: ...


# ── job builders (shared by every policy) ─────────────────────────────────
def nearest_node(sim: Simulation, a: Agent, resource: str):
    best, best_d = None, math.inf
    for n in sim.world.nodes:
        if n.resource != resource or n.amount < 1 or n.id in sim.claims:
            continue
        if n.tile not in sim.discovered or not sim.passable(n.tile):
            continue
        d = sim.world.distance(a.tile, n.tile)
        if d < best_d:
            best, best_d = n, d
    return best


def gather(sim: Simulation, a: Agent, resource: str) -> Job | None:
    n = nearest_node(sim, a, resource)
    if n is None:
        return None
    sim.claims[n.id] = a.id
    travel, label = GATHER_LABELS[resource]
    return Job("gather", n.tile, n.id, resource, label=label, travel=travel, face=(n.x, n.z))


def forage(sim: Simulation, a: Agent) -> Job | None:
    n = nearest_node(sim, a, "food")
    if n is None:
        return None
    sim.claims[n.id] = a.id
    return Job("forage", n.tile, n.id, "food", label="eating berries", travel="looking for berries", face=(n.x, n.z))


def camp_tile(sim: Simulation, a: Agent) -> int:
    return min(sim.world.home_tiles, key=lambda t: sim.world.distance(t, a.tile))


def deliver(sim: Simulation, a: Agent) -> Job:
    what = f"{a.carry_n} {a.carry_kind}"
    return Job("deliver", camp_tile(sim, a), work=1.0, label=f"unloading {a.carry_kind}", travel=f"hauling {what}", face=CAMP)


def eat(sim: Simulation, a: Agent) -> Job | None:
    if sim.stock["food"] >= 1:
        return Job("eat", camp_tile(sim, a), label="eating", travel="going to eat", face=CAMP)
    return forage(sim, a)


def sleep(sim: Simulation, a: Agent) -> Job:
    bed: Building | None = sim.buildings.get(a.bed) if a.bed else None
    if bed is not None and bed.state == "done":
        stand = sim.stand_tile(a, bed.tile)
        if stand is not None:
            t = sim.world.tiles[bed.tile]
            name = bed.blueprint.name
            return Job("sleep", stand, bed.id, label=f"sleeping in the {name}", travel="going to bed", face=(t.x, t.z))
    return Job("sleep", a.home, None, label="resting by the fire", travel="going back to the campfire", face=CAMP)


def build(sim: Simulation, a: Agent, site: Building) -> Job | None:
    stand = sim.stand_tile(a, site.tile)
    if stand is None:
        return None
    t = sim.world.tiles[site.tile]
    name = site.blueprint.name
    return Job("build", stand, site.id, label=f"building the {name}", travel=f"going to build the {name}", face=(t.x, t.z))


def survey(sim: Simulation, a: Agent) -> Job | None:
    kind = sim.next_blueprint()
    tile = sim.pick_site(kind) if kind else None
    if tile is None:
        return None
    stand = sim.stand_tile(a, tile)
    if stand is None:
        return None
    t = sim.world.tiles[tile]
    name = BLUEPRINTS[kind].name
    return Job("survey", stand, tile, work=4.0, label=f"planning a {name}", travel="scouting a building site", face=(t.x, t.z))


def craft(sim: Simulation, a: Agent, workshop: Building) -> Job | None:
    stand = sim.stand_tile(a, workshop.tile)
    if stand is None:
        return None
    t = sim.world.tiles[workshop.tile]
    return Job("craft", stand, workshop.id, work=30.0, label="crafting tools", travel="heading to the workshop", face=(t.x, t.z))


def farm_work(sim: Simulation, a: Agent, farm: Building) -> Job | None:
    stand = sim.stand_tile(a, farm.tile)
    if stand is None:
        return None
    t = sim.world.tiles[farm.tile]
    if farm.crop < 0:
        return Job("plant", stand, farm.id, work=10.0, label="planting crops", travel="going to the farm", face=(t.x, t.z))
    return Job("harvest", stand, farm.id, work=6.0, label="harvesting", travel="going to harvest", face=(t.x, t.z))


def explore(sim: Simulation, a: Agent) -> Job | None:
    frontier = [
        t.i for t in sim.world.tiles
        if t.i in sim.discovered and sim.passable(t.i)
        and any(n not in sim.discovered for n in sim.world.neighbours(t.i))
    ]
    if not frontier:
        return None
    tile = min(frontier, key=lambda i: sim.world.distance(i, a.tile) + sim.rng.random() * 2)
    return Job("explore", tile, work=0.6, label="surveying the land", travel="exploring")


def wander(sim: Simulation, a: Agent) -> Job | None:
    options = [
        t.i for t in sim.world.tiles
        if t.i in sim.discovered and sim.passable(t.i) and 1 <= sim.world.distance(t.i, a.tile) <= 3
    ]
    if not options:
        return None
    return Job("wander", sim.rng.choice(options), work=sim.rng.uniform(2, 5), label="taking a break", travel="wandering")


# ── the placeholder brain ─────────────────────────────────────────────────
class RulePolicy:
    """Fixed priorities per role. Predictable, and deliberately not intelligent."""

    name = "rule-based"

    def choose(self, sim: Simulation, a: Agent) -> Job | None:
        if sim.bedtime or a.energy < 0.1:
            return sleep(sim, a)
        if a.hunger < 0.35:
            sim.chat.hungry(a.id)
            if sim.stock["food"] < 6:
                sim.chat.food_low()
            job = eat(sim, a)
            if job:
                return job
        if a.carry_n > 0:
            return deliver(sim, a)

        need = sim.needed()
        want = max(need, key=need.get) if need else None
        site = sim.active_site()
        site = site if site is not None and site.state == "building" else None
        job: Job | None = None

        if a.role == "architect":
            if sim.can_plan():
                job = survey(sim, a)
            job = job or (site and build(sim, a, site)) or gather(sim, a, want or "wood")
        elif a.role == "builder":
            job = (site and build(sim, a, site)) or gather(sim, a, want or "wood")
        elif a.role == "woodcutter":
            job = gather(sim, a, "wood")
        elif a.role == "engineer":
            workshop = sim.done("workshop")
            if workshop and not sim.tools:
                job = craft(sim, a, workshop)
            job = job or gather(sim, a, "stone") or gather(sim, a, "wood")
        elif a.role == "farmer":
            farm = next(
                (b for b in sim.buildings.values() if b.kind == "farm" and b.state == "done" and (b.crop < 0 or b.crop >= 1)),
                None,
            )
            if farm:
                job = farm_work(sim, a, farm)
            elif sim.stock["food"] < 40:
                job = gather(sim, a, "food")
            job = job or gather(sim, a, want or "wood")
        elif a.role == "scout":
            job = explore(sim, a) or gather(sim, a, want or "stone")

        return job or wander(sim, a)
