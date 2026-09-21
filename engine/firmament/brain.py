"""The LLM brain.

Each agent asks the model what to do next, gets back a short plan (1–4 actions) plus an
optional message to the team, and the simulation carries the plan out under the same
world rules as before. Every night each agent reviews its day and rewrites a small list
of lessons, stored in memory and read back in every later decision — also in later runs,
which is what lets us measure whether the firm actually improves.

Calls never block the simulation: requests queue up here and async workers send them.
If an agent waits more than a couple of seconds for an answer, `blocking()` tells the
server to pause world time, so API latency and rate limits never count against the agents.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import defaultdict
from typing import TYPE_CHECKING

from .buildings import BLUEPRINTS
from .llm import GroqClient, LLMError, QuotaExhausted
from .memory import Memory
from .policy import build, craft, deliver, eat, explore, farm_work, gather, nearest_node, sleep, survey, wander
from .roster import ROSTER
from .sim import CARRY_CAPACITY, MAX_DAYS, Job

if TYPE_CHECKING:
    from .sim import Agent, Simulation

DECISION_MODEL = "openai/gpt-oss-120b"
REFLECTION_MODEL = "openai/gpt-oss-20b"
MAX_PLAN = 4
PAUSE_AFTER = 2.0  # real seconds an agent may wait for its answer before world time pauses

PERSONA = {
    "lina": "the Architect: calm and organised. You alone decide which building the firm puts up next.",
    "sara": "the Farmer: practical and caring. Keeping everyone fed is your job.",
    "yanis": "the Builder: energetic and proud of his work. You turn materials into buildings.",
    "karim": "the Woodcutter: quiet and strong. You know the forests.",
    "amine": "the Engineer: a curious tinkerer. You mine stone and make tools.",
    "rayan": "the Scout: restless explorer. You map the island and report what you find.",
}
NAMES = {r["id"]: r["name"] for r in ROSTER}
IDS = {r["name"].lower(): r["id"] for r in ROSTER}
ACTIONS = {"gather_wood", "gather_stone", "gather_food", "deliver", "eat", "build", "plan_building",
           "craft_tools", "farm", "explore", "rest"}


def _clean(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _hours_until_night(t: float) -> float:
    return max(0.0, (0.83 - t) * 24) if t < 0.83 else 0.0


class LLMPolicy:
    name = "llm"

    def __init__(self, client: GroqClient, memory: Memory, *, decision_model: str = DECISION_MODEL,
                 reflection_model: str = REFLECTION_MODEL):
        self.client = client
        self.memory = memory
        self.decision_model = decision_model
        self.reflection_model = reflection_model
        self.sim: Simulation | None = None
        self.generation = 0
        self.queues: dict[str, list[dict]] = defaultdict(list)
        self.results: dict[str, dict] = {}
        self.requests: dict[str, dict] = {}
        self.run_calls = 0
        self.decisions = 0
        self.invalid = 0
        self.reflections = 0

    # ── lifecycle ─────────────────────────────────────────────────────────
    def reset(self, sim: Simulation) -> None:
        """New run: forget in-flight work from the old world (answers to it are discarded)."""
        self.sim = sim
        self.generation += 1
        self.queues.clear()
        self.results.clear()
        self.requests.clear()
        self.run_calls = 0

    def stats(self) -> dict:
        return {
            "kind": "llm",
            "model": self.decision_model,
            "reflectionModel": self.reflection_model,
            **self.client.public_stats(),
            "runCalls": self.run_calls,
            "decisions": self.decisions,
            "invalid": self.invalid,
            "reflections": self.reflections,
            "queue": len(self.requests),
            "waiting": self.blocking(),
        }

    def ready(self, agent_id: str) -> bool:
        return agent_id in self.results

    def blocking(self) -> bool:
        now = time.monotonic()
        return any(r["kind"] == "decide" and now - r["since"] > PAUSE_AFTER for r in self.requests.values())

    # ── decisions ─────────────────────────────────────────────────────────
    def choose(self, sim: Simulation, a: Agent) -> Job | None:
        if sim.bedtime or a.energy < 0.08:
            self.queues[a.id].clear()
            a.plan = []
            return sleep(sim, a)
        if a.id in self.results:
            self._apply(sim, a, self.results.pop(a.id))

        queue = self.queues[a.id]
        # Starving overrides a plan that does not start with food: ask again with the new situation.
        if a.hunger < 0.12 and queue and queue[0]["do"] != "eat":
            queue.clear()
        while queue:
            step = queue.pop(0)
            a.plan = [s["do"] for s in queue]
            job = self._to_job(sim, a, step)
            if job is not None:
                return job
        a.plan = []
        if a.id not in self.requests:
            self.requests[a.id] = {
                "kind": "decide", "agent": a.id, "gen": self.generation, "state": "queued",
                "since": time.monotonic(), "messages": self._decision_messages(sim, a),
            }
        return Job("think", None, label="thinking…", travel="thinking…")

    def _apply(self, sim: Simulation, a: Agent, res: dict) -> None:
        if "error" in res:
            a.thought = f"(no answer from my brain: {res['error']})"
            self.queues[a.id] = [{"do": "rest"}]
            return
        a.thought = _clean(res.get("thought"))[:240]
        steps: list[dict] = []
        for raw in (res.get("plan") or [])[:MAX_PLAN]:
            step = {"do": raw} if isinstance(raw, str) else raw if isinstance(raw, dict) else {}
            do = _clean(step.get("do")).lower()
            if do not in ACTIONS:
                self.invalid += 1
                continue
            steps.append({"do": do, "building": _clean(step.get("building")).lower().replace(" ", "") or None})
        if not steps:
            self.invalid += 1
            steps = [{"do": "rest"}]
        self.queues[a.id] = steps
        a.plan = [s["do"] for s in steps]
        self.decisions += 1

        say = _clean(res.get("say"))[:240]
        if say:
            to = _clean(res.get("to")).lower()
            to_id = "all" if to in ("", "all", "everyone", "team") else IDS.get(to, to if to in NAMES else "all")
            sim.chat.say(a.id, say, to_id)

    def _note(self, sim: Simulation, a: Agent, text: str) -> None:
        sim.log(a, f"tried to {text}")

    def _to_job(self, sim: Simulation, a: Agent, step: dict) -> Job | None:
        do = step["do"]
        if do.startswith("gather_"):
            res = do.split("_", 1)[1]
            if a.carry_n and (a.carry_kind != res or a.carry_n >= CARRY_CAPACITY):
                self.queues[a.id].insert(0, step)  # unload first, then come back to this step
                return deliver(sim, a)
            job = gather(sim, a, res)
            if job is None:
                self._note(sim, a, f"gather {res}, but none was reachable")
            return job
        if do == "deliver":
            return deliver(sim, a) if a.carry_n else None
        if do == "eat":
            job = eat(sim, a)
            if job is None:
                self._note(sim, a, "eat, but there was no food in the crate or on the bushes")
            return job
        if do == "build":
            site = sim.active_site()
            if site is None:
                self._note(sim, a, "build, but no building was planned")
                return None
            if site.state != "building":
                need = ", ".join(f"{max(0, v - sim.stock[k])} {k}" for k, v in site.blueprint.cost.items() if v > sim.stock[k])
                self._note(sim, a, f"build the {site.blueprint.name}, but its materials were not in the crate yet (missing {need})")
                return None
            return build(sim, a, site)
        if do == "plan_building":
            kind = step.get("building")
            if a.role != "architect":
                self._note(sim, a, "plan a building, but only Lina the architect can do that")
                return None
            if kind not in BLUEPRINTS:
                self._note(sim, a, f"plan an unknown building '{kind}'")
                return None
            if not sim.can_place(kind):
                why = "another site is still unfinished" if sim.active_site() else "its requirements are not built yet"
                self._note(sim, a, f"plan a {BLUEPRINTS[kind].name}, but {why}")
                return None
            job = survey(sim, a, kind)
            if job is None:
                self._note(sim, a, f"plan a {BLUEPRINTS[kind].name}, but found no free flat spot")
            return job
        if do == "craft_tools":
            workshop = sim.done("workshop")
            if workshop is None or sim.tools:
                self._note(sim, a, "craft tools, but " + ("tools already exist" if sim.tools else "there is no workshop yet"))
                return None
            return craft(sim, a, workshop)
        if do == "farm":
            farm = next((b for b in sim.buildings.values() if b.kind == "farm" and b.state == "done" and (b.crop < 0 or b.crop >= 1)), None)
            if farm is None:
                self._note(sim, a, "farm, but no farm needed planting or harvesting")
                return None
            return farm_work(sim, a, farm)
        if do == "explore":
            job = explore(sim, a)
            if job is None:
                self._note(sim, a, "explore, but the whole island is already mapped")
            return job
        return wander(sim, a)

    # ── prompts ───────────────────────────────────────────────────────────
    def _system(self, a: Agent) -> str:
        return (
            f"You are {a.name}, {PERSONA[a.id]} You are one of six founders of a small firm stranded on a floating "
            "sky island: Lina (architect), Sara (farmer), Yanis (builder), Karim (woodcutter), Amine (engineer), Rayan (scout).\n"
            "Shared goal: survive and build the Town Hall as early as possible. The island is the same every run, so "
            "experience pays off.\n"
            "World rules you cannot change: every task takes time; you get hungry and tired; everyone sleeps at night; "
            "a planned building only starts once all its materials are in the camp crate; only one construction site "
            "exists at a time; only Lina can plan a new building; you carry at most 5 units.\n"
            "You are a team: coordinate out loud. Say something when your plan changes, when you need a teammate "
            "(ask them by name), when you find something, and always answer a teammate who spoke to you. Only stay "
            "silent when you would just repeat yourself. Messages under 25 words, natural and specific.\n"
            'Reply with JSON only: {"thought": "one sentence on why", "plan": [{"do": "<action>"}, ...1-4 steps], '
            '"say": "", "to": "all" or a teammate name}. For plan_building add "building": "<type>".'
        )

    def _decision_messages(self, sim: Simulation, a: Agent) -> list[dict]:
        s = sim
        stock = s.stock
        site = s.active_site()
        if site is None:
            site_line = "No construction site right now."
        elif site.state == "planned":
            missing = ", ".join(f"{v - stock[k]} {k}" for k, v in site.blueprint.cost.items() if v > stock[k])
            site_line = f"{site.blueprint.name} is planned but waiting for materials (still missing {missing})."
        else:
            site_line = f"{site.blueprint.name} is under construction, {int(site.progress * 100)}% done: builders needed."
        done = [b.blueprint.name for b in s.buildings.values() if b.state == "done"]
        beds = sum(len(b.sleepers) for b in s.buildings.values() if b.state == "done")
        blueprints = []
        done_kinds = {b.kind for b in s.buildings.values() if b.state == "done"}
        for kind, bp in BLUEPRINTS.items():
            cost = ", ".join(f"{v} {k}" for k, v in bp.cost.items())
            missing = [BLUEPRINTS[r].name for r in bp.requires if r not in done_kinds]
            status = f"needs {', '.join(missing)} first" if missing else "available"
            beds_txt = f"; {bp.beds} beds" if bp.beds else ""
            blueprints.append(f"{bp.name} [{kind}] ({cost}{beds_txt}) {status}")

        def near(res: str) -> str:
            n = nearest_node(s, a, res)
            return f"{s.world.distance(a.tile, n.tile)} tiles away" if n else "none known"

        mates = [f"{o.name}: {o.label}" for o in s.agents if o.id != a.id]
        chat = [f"{NAMES.get(m['from'], m['from'])} to {NAMES.get(m['to'], 'all') if m['to'] else 'all'}: {m['text']}"
                for m in list(s.chat.log)[-8:]]
        lessons = self.memory.lessons(a.id)
        carrying = f"{a.carry_n} {a.carry_kind}" if a.carry_n else "nothing"

        actions = [
            f"gather_wood: chop the nearest tree ({near('wood')})",
            f"gather_stone: mine the nearest rock ({near('stone')})",
            f"gather_food: pick berries ({near('food')}); returns with up to 5 food for the crate",
            "deliver: bring what you carry to the crate at camp",
            f"eat: eat at the crate ({stock['food']} food there) or from berries",
        ]
        if site is not None and site.state == "building":
            actions.append(f"build: help build the {site.blueprint.name}")
        if a.role == "architect" and site is None:
            actions.append("plan_building: mark out a new building; add \"building\": one of the available types above")
        if a.role == "engineer" and s.done("workshop") and not s.tools:
            actions.append("craft_tools: make stone tools at the workshop (everyone gathers 50% faster)")
        if any(b.kind == "farm" and b.state == "done" and (b.crop < 0 or b.crop >= 1) for b in s.buildings.values()):
            actions.append("farm: plant or harvest the farm (a harvest gives 10 food)")
        actions += ["explore: walk to the edge of the known land and reveal more", "rest: take a short break"]

        user = "\n".join(
            [
                f"Run {s.run_number}, day {s.day} of max {MAX_DAYS}, {s.clock_string()}. Night in about {_hours_until_night(s.t):.1f} hours.",
                f"You: food {int(a.hunger * 100)}%, energy {int(a.energy * 100)}%, carrying {carrying}.",
                f"Camp crate: {stock['wood']} wood, {stock['stone']} stone, {stock['food']} food. Tools: {'stone tools' if s.tools else 'none'}.",
                site_line,
                f"Built so far: {', '.join(done) or 'nothing yet'}. Beds for {beds} of 6 people.",
                "Blueprints: " + "; ".join(blueprints) + ".",
                f"Explored {int(len(s.discovered) / len(s.world.tiles) * 100)}% of the island.",
                "Teammates now: " + "; ".join(mates) + ".",
                "Recent chat:\n" + ("\n".join(f"- {c}" for c in chat) if chat else "- (silence)"),
                "Your lessons from experience:\n" + ("\n".join(f"- {x}" for x in lessons) if lessons else "- (none yet)"),
                "What you did earlier today:\n" + ("\n".join(f"- {x}" for x in a.day_log[-6:]) if a.day_log else "- (nothing yet)"),
                "Actions you can take now:\n" + "\n".join(f"- {x}" for x in actions),
            ]
        )
        return [{"role": "system", "content": self._system(a)}, {"role": "user", "content": user}]

    # ── nightly reflection ────────────────────────────────────────────────
    def on_evening(self, sim: Simulation) -> None:
        for a in sim.agents:
            self.requests[f"reflect:{a.id}"] = {
                "kind": "reflect", "agent": a.id, "gen": self.generation, "state": "queued",
                "since": time.monotonic(), "messages": self._reflection_messages(sim, a),
            }

    def _reflection_messages(self, sim: Simulation, a: Agent) -> list[dict]:
        awake = sum(v for k, v in a.day_time.items() if k != "sleep") or 1.0
        share = {k: int(a.day_time.get(k, 0) / awake * 100) for k in ("work", "walk", "idle", "think", "eat")}
        runs = [
            f"Run {r['run']}: {'Town Hall on day ' + str(r['townhallDay']) if r.get('townhallDay') else 'no Town Hall'}, "
            f"hungry {int(r['hungrySeconds'])}s total, work {int(r['workShare'] * 100)}% of waking time"
            for r in self.memory.runs[-3:]
        ]
        done = [b.blueprint.name for b in sim.buildings.values() if b.state == "done"]
        system = (
            f"You are {a.name}, {PERSONA[a.id]} It is night. Review your day and keep a short list of practical lessons "
            "that will make you and the firm faster next time. The island map is identical every run and your lessons "
            "carry over between days and between runs.\n"
            "Keep at most 6 lessons, each under 25 words, concrete (where, what order, how much, what to avoid). Keep "
            "lessons that still hold, rewrite or drop ones that proved wrong, add new ones from today.\n"
            'Reply with JSON only: {"lessons": ["..."], "tomorrow": "one short sentence you will tell the team (or empty)"}'
        )
        user = "\n".join(
            [
                f"Run {sim.run_number}, day {sim.day} of max {MAX_DAYS} just ended.",
                f"Your time today: working {share['work']}%, walking {share['walk']}%, idle {share['idle']}%, "
                f"waiting to think {share['think']}%, eating {share['eat']}%. You were hungry for {int(a.day_hungry)} seconds.",
                "What you did (time, action, duration):\n" + ("\n".join(f"- {x}" for x in a.day_log[-25:]) or "- nothing logged"),
                f"Firm status: crate {sim.stock['wood']} wood, {sim.stock['stone']} stone, {sim.stock['food']} food; "
                f"built: {', '.join(done) or 'nothing yet'}.",
                "Earlier runs:\n" + ("\n".join(f"- {x}" for x in runs) if runs else "- this is the first run"),
                "Your current lessons:\n" + ("\n".join(f"- {x}" for x in self.memory.lessons(a.id)) or "- (none)"),
            ]
        )
        return [{"role": "system", "content": system}, {"role": "user", "content": user}]

    def _apply_reflection(self, sim: Simulation, agent_id: str, res: dict) -> None:
        name = NAMES.get(agent_id, agent_id)
        if "error" in res:
            sim.emit("learn", f"{name} could not reflect tonight ({res['error']}).", agent_id)
            return
        lessons = res.get("lessons") if isinstance(res.get("lessons"), list) else []
        kept = self.memory.set_lessons(agent_id, lessons)
        self.reflections += 1
        sim.emit("learn", f"{name} reflected on the day and now keeps {len(kept)} lessons.", agent_id)
        tomorrow = _clean(res.get("tomorrow"))[:240]
        if tomorrow:
            sim.chat.say(agent_id, tomorrow, "all")

    # ── the network side ──────────────────────────────────────────────────
    def _next_request(self) -> str | None:
        queued = [(k, r) for k, r in self.requests.items() if r["state"] == "queued"]
        if not queued:
            return None
        # Decisions first (someone is standing still waiting), oldest first.
        queued.sort(key=lambda kr: (kr[1]["kind"] != "decide", kr[1]["since"]))
        return queued[0][0]

    async def worker(self) -> None:
        while True:
            if not await self.process_once():
                await asyncio.sleep(0.05)

    async def process_once(self) -> bool:
        """Send the most urgent queued request and apply its answer. False when nothing is queued."""
        key = self._next_request()
        if key is None:
            return False
        req = self.requests[key]
        req["state"] = "inflight"
        decide = req["kind"] == "decide"
        try:
            data, _ = await self.client.complete_json(
                req["messages"],
                prefer=self.decision_model if decide else self.reflection_model,
                max_tokens=700 if decide else 900,
            )
            self.run_calls += 1
            result = data
        except QuotaExhausted:
            result = {"error": "daily AI quota used up"}
        except LLMError as e:
            result = {"error": str(e)[:120]}
        except Exception as e:  # never let one bad reply kill the worker
            result = {"error": type(e).__name__}
        if self.requests.get(key) is req:
            del self.requests[key]
        if req["gen"] != self.generation or self.sim is None:
            return True  # the run was reset while this was in flight; drop the stale answer
        if decide:
            self.results[req["agent"]] = result
        else:
            self._apply_reflection(self.sim, req["agent"], result)
        return True
