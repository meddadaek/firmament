"""HTTP + WebSocket front door for the simulation.

GET  /api/world   static map, blueprints and roster (fetched once by the frontend)
GET  /api/health  liveness + which brain is driving the agents
WS   /ws          full state on connect, then ~10 deltas per second; accepts {"type": "speed", "value": 0|1|3|10}
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .buildings import BLUEPRINTS, BUILD_ORDER
from .roster import ROSTER
from .sim import DAY_SECONDS, Simulation

ALLOWED_SPEEDS = {0, 1, 3, 10}
BROADCAST_EVERY = 0.1

sim = Simulation()
clients: set[WebSocket] = set()


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


async def run_loop() -> None:
    last = time.perf_counter()
    since_broadcast = 0.0
    while True:
        await asyncio.sleep(0.05)
        now = time.perf_counter()
        real = min(now - last, 0.25)
        last = now
        sim.advance(real * sim.speed)
        since_broadcast += real
        if since_broadcast >= BROADCAST_EVERY:
            since_broadcast = 0.0
            delta = sim.delta_snapshot()  # always drain, even with nobody watching
            if clients:
                message = json.dumps(delta, separators=(",", ":"))
                for ws in list(clients):
                    try:
                        await ws.send_text(message)
                    except Exception:
                        clients.discard(ws)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(run_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Firmament engine", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "day": sim.day, "speed": sim.speed, "brain": sim.policy.name}


@app.get("/api/world")
def world() -> dict:
    return world_payload()


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
