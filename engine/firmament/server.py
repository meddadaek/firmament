"""HTTP + WebSocket front door for the simulation.

GET  /api/world      static map, blueprints and roster (fetched once by the frontend)
GET  /api/health     liveness + which brain is driving the agents
POST /api/run/new    end the current run and start a fresh island (memories are kept)
WS   /ws             full state on connect, then ~10 deltas per second; accepts {"type": "speed", "value": 0|1|3|10}

Brain selection: with GROQ_API_KEY in engine/.env the agents run on the LLM brain;
without it (or with FIRMAMENT_BRAIN=rules) they fall back to the fixed rule list, and
the HUD says which one is active.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .buildings import BLUEPRINTS, BUILD_ORDER
from .llm import GroqClient, load_env
from .memory import Memory
from .policy import RulePolicy
from .roster import ROSTER
from .sim import DAY_SECONDS, Simulation

ALLOWED_SPEEDS = {0, 1, 3, 10}
BROADCAST_EVERY = 0.1
RESTART_AFTER = 8.0  # real seconds to admire a finished run before the next one starts

load_env()
_key = os.environ.get("GROQ_API_KEY")
_mode = os.environ.get("FIRMAMENT_BRAIN", "llm" if _key else "rules")

if _mode == "llm" and _key:
    from .brain import DECISION_MODEL, REFLECTION_MODEL, LLMPolicy

    memory = Memory()
    policy = LLMPolicy(GroqClient(_key, [DECISION_MODEL, REFLECTION_MODEL]), memory)
else:
    memory = Memory(path=None)  # rule runs are not learning, so they are not recorded
    policy = RulePolicy()

sim = Simulation(policy=policy, memory=memory)
clients: set[WebSocket] = set()
control = {"restart": False}


def world_payload() -> dict:
    payload = sim.world.to_json()
    payload["blueprints"] = {
        k: {"name": b.name, "cost": b.cost, "work": b.work, "beds": b.beds, "requires": list(b.requires), "summary": b.summary}
        for k, b in BLUEPRINTS.items()
    }
    payload["buildOrder"] = list(BUILD_ORDER)
    payload["roster"] = list(ROSTER)
    payload["daySeconds"] = DAY_SECONDS
    payload["brain"] = sim.policy.name
    return payload


async def broadcast(payload: dict) -> None:
    if not clients:
        return
    message = json.dumps(payload, separators=(",", ":"))
    for ws in list(clients):
        try:
            await ws.send_text(message)
        except Exception:
            clients.discard(ws)


async def run_loop() -> None:
    last = time.perf_counter()
    since_broadcast = 0.0
    restart_at: float | None = None
    while True:
        await asyncio.sleep(0.05)
        now = time.perf_counter()
        real = min(now - last, 0.25)
        last = now

        # World time stops while someone waits on the LLM, and after a run has ended.
        waiting = getattr(sim.policy, "blocking", lambda: False)()
        if sim.run_outcome is None and not waiting:
            sim.advance(real * sim.speed)

        if sim.run_outcome is not None and restart_at is None:
            restart_at = now + RESTART_AFTER
        if control["restart"] or (restart_at is not None and now >= restart_at):
            if sim.run_outcome is None:
                sim._end_run("abandoned")
            control["restart"] = False
            restart_at = None
            sim.new_run()
            await broadcast(sim.full_snapshot())
            continue

        since_broadcast += real
        if since_broadcast >= BROADCAST_EVERY:
            since_broadcast = 0.0
            await broadcast(sim.delta_snapshot())  # always drained, even with nobody watching


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    tasks = [asyncio.create_task(run_loop())]
    if hasattr(sim.policy, "worker"):
        tasks += [asyncio.create_task(sim.policy.worker()) for _ in range(2)]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Firmament engine", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict:
    brain = sim.policy.stats() if hasattr(sim.policy, "stats") else {"kind": "rules"}
    return {"ok": True, "run": sim.run_number, "day": sim.day, "speed": sim.speed, "brain": brain}


@app.get("/api/world")
def world() -> dict:
    return world_payload()


@app.post("/api/run/new")
def new_run() -> dict:
    control["restart"] = True
    return {"ok": True}


@app.websocket("/ws")
async def stream(ws: WebSocket) -> None:
    await ws.accept()
    await ws.send_text(json.dumps(sim.full_snapshot(), separators=(",", ":")))
    clients.add(ws)
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            if msg.get("type") == "speed" and msg.get("value") in ALLOWED_SPEEDS:
                sim.speed = msg["value"]
    except (WebSocketDisconnect, json.JSONDecodeError, RuntimeError):
        pass
    finally:
        clients.discard(ws)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8040, log_level="warning")


if __name__ == "__main__":
    main()
