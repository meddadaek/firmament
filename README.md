# Firmament

A firm of six AI agents dropped on a small floating sky island with a campfire and a crate of supplies. The goal: let them survive, learn by repetition, and build a city on their own — and watch it happen like a game.

**Status: step 2 of 5.** A Python engine simulates the island: hunger, energy, day/night, wood/stone/food, exploration (fog of war), a tech tree and construction. The frontend renders it live over a WebSocket: agents chop, mine, forage, haul, build and sleep, and a chat panel shows them coordinating.

Honest limits right now: each agent's decisions come from a **rule-based policy**, not an AI model, and the chat lines are **scripted templates** triggered by real sim events. The HUD labels both. Plugging an LLM into the same `Policy.choose()` interface is step 3.

## The firm

| Agent | Role |
| --- | --- |
| Lina | Architect |
| Sara | Farmer |
| Yanis | Builder |
| Karim | Woodcutter |
| Amine | Engineer |
| Rayan | Scout |

## Run it

One-time setup (Python 3.11+ for the engine):

```bash
npm install
python -m venv engine/.venv
engine/.venv/Scripts/python -m pip install -r engine/requirements.txt
```

Then, in two terminals:

```bash
npm run engine
npm run dev
```

Open http://localhost:5230. Engine tests: `npm run test:engine`.

Controls: drag to orbit, scroll to zoom, click an agent (or the dock) to follow, `Space` to pause, `1`–`3` for speed, `Esc` to release the camera.

## Stack

React 19 · React Three Fiber · drei · postprocessing · Tailwind CSS 4 · Motion · zustand. The island is generated from a fixed seed on a hex grid; everything is procedural geometry — no downloaded models.

## Roadmap

1. ✅ World + characters + HUD
2. ✅ Simulation engine (Python): resources, needs, day/night, building, chat
3. Agent brains: LLM planner + skill library + memory, measured learning curves
4. Multi-agent cooperation and city growth
5. Optional: reinforcement-learning skills trained on free cloud GPUs
