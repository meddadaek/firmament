"""What the agents remember between days and between runs.

Stored as JSON in engine/data/memory.json (git-ignored). Two things live here:
- lessons: each agent's short list of practical rules, rewritten every night by the LLM
- runs: the firm's results per run, which is how we measure whether they actually learn
"""

from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MAX_LESSONS = 6
MAX_LESSON_CHARS = 180


class Memory:
    def __init__(self, path: Path | None = DATA_DIR / "memory.json"):
        self.path = path
        self.agents: dict[str, dict] = {}
        self.runs: list[dict] = []
        self.version = 0
        if path is not None and path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            self.agents = data.get("agents", {})
            self.runs = data.get("runs", [])

    def save(self) -> None:
        self.version += 1
        if self.path is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"agents": self.agents, "runs": self.runs}, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)

    def lessons(self, agent_id: str) -> list[str]:
        return list(self.agents.get(agent_id, {}).get("lessons", []))

    def set_lessons(self, agent_id: str, lessons: list) -> list[str]:
        clean = []
        for item in lessons:
            text = " ".join(str(item).split())[:MAX_LESSON_CHARS]
            if text and text not in clean:
                clean.append(text)
        clean = clean[:MAX_LESSONS]
        self.agents.setdefault(agent_id, {})["lessons"] = clean
        self.save()
        return clean

    def add_run(self, metrics: dict) -> None:
        self.runs.append(metrics)
        self.save()

    def forget(self) -> None:
        self.agents, self.runs = {}, []
        self.save()

    def lessons_json(self) -> dict[str, list[str]]:
        return {k: v.get("lessons", []) for k, v in self.agents.items()}
