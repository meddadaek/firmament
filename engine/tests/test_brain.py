"""The LLM brain, tested offline with a fake model that answers from a script."""

import asyncio
import json

from firmament.brain import LLMPolicy
from firmament.memory import Memory
from firmament.sim import DAY_SECONDS, Simulation


class FakeClient:
    def __init__(self, reply):
        self.reply = reply
        self.calls: list[list[dict]] = []

    async def complete_json(self, messages, *, prefer=None, max_tokens=700):
        self.calls.append(messages)
        return self.reply(messages), prefer or "fake"

    def public_stats(self):
        return {"calls": len(self.calls), "errors": 0, "tokens": 0, "avgMs": 1, "status": "ok", "lastError": None, "model": "fake"}


def who(messages) -> str:
    return messages[0]["content"].split(",", 1)[0].removeprefix("You are ").lower()


def drive(sim: Simulation, policy: LLMPolicy, seconds: float) -> None:
    """Advance the world, answering every queued brain request between steps (no network)."""

    async def go():
        elapsed = 0.0
        while elapsed < seconds:
            while await policy.process_once():
                pass
            sim.advance(0.5)
            elapsed += 0.5

    asyncio.run(go())


def make(reply, memory=None):
    memory = memory or Memory(path=None)
    policy = LLMPolicy(FakeClient(reply), memory)
    return Simulation(policy=policy, memory=memory), policy


def test_agents_follow_the_plan_the_model_gives_and_talk():
    def reply(messages):
        name = who(messages)
        if name == "karim":
            return {"thought": "Wood first.", "plan": [{"do": "gather_wood"}, {"do": "deliver"}], "say": "Bringing wood to camp.", "to": "all"}
        if name == "lina":
            return {"thought": "We need shelter.", "plan": [{"do": "plan_building", "building": "hut"}], "say": "", "to": "all"}
        return {"thought": "Waiting.", "plan": [{"do": "rest"}], "say": ""}

    sim, policy = make(reply)
    drive(sim, policy, 90)
    karim = sim.agent("karim")
    assert karim.stats["wood"] > 0, "Karim never chopped"
    assert any(m["text"] == "Bringing wood to camp." and m["from"] == "karim" for m in sim.chat.log)
    assert any(b.kind == "hut" for b in sim.buildings.values()), "Lina's plan_building was not executed"
    assert karim.thought == "Wood first."
    # No scripted template lines leak into an LLM run.
    assert all(m["from"] in ("karim",) for m in sim.chat.log)


def test_nonsense_replies_do_not_crash_and_are_counted():
    sim, policy = make(lambda m: {"plan": [{"do": "fly to the moon"}], "say": 42})
    drive(sim, policy, 30)
    assert policy.invalid > 0
    json.dumps(sim.full_snapshot())


def test_only_the_architect_can_plan():
    sim, policy = make(lambda m: {"plan": [{"do": "plan_building", "building": "hut"}]} if who(m) == "karim" else {"plan": [{"do": "rest"}]})
    drive(sim, policy, 30)
    assert not sim.buildings
    assert any("only Lina" in line for line in sim.agent("karim").day_log)


def test_nightly_reflection_rewrites_lessons_and_persists(tmp_path):
    path = tmp_path / "memory.json"

    def reply(messages):
        if "It is night" in messages[0]["content"]:
            return {"lessons": ["Chop the pines closest to camp first.", "Deliver before dark."], "tomorrow": "Early start tomorrow."}
        return {"plan": [{"do": "gather_wood"}, {"do": "deliver"}]}

    sim, policy = make(reply, Memory(path=path))
    drive(sim, policy, DAY_SECONDS * 0.6)  # past sunset
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["agents"]["karim"]["lessons"][0] == "Chop the pines closest to camp first."
    assert policy.reflections == 6
    # Lessons are fed back into the next decision prompt.
    assert "Chop the pines closest to camp first." in policy._decision_messages(sim, sim.agent("karim"))[1]["content"]


def test_runs_are_recorded_and_memory_survives_a_new_run(tmp_path):
    memory = Memory(path=tmp_path / "memory.json")
    memory.set_lessons("sara", ["Plant the farm early."])
    sim, _ = make(lambda m: {"plan": [{"do": "rest"}]}, memory)
    sim._end_run("complete")
    assert memory.runs[0]["outcome"] == "complete" and memory.runs[0]["run"] == 1
    sim.new_run()
    assert sim.run_number == 2 and sim.day == 1 and not sim.buildings
    assert memory.lessons("sara") == ["Plant the farm early."]
