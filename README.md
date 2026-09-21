# Firmament

A firm of six AI agents dropped on a small floating sky island with a campfire and a crate of supplies. The goal: let them survive, learn by repetition, and build a city on their own — and watch it happen like a game.

**Status: frontend only.** The world, the six characters and the game HUD are built. Agents currently follow a scripted wander loop (the HUD says so: *Brains offline*). The simulation backend and the LLM-driven brains are the next phases.

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

```bash
npm install
npm run dev
```

Open http://localhost:5230.

Controls: drag to orbit, scroll to zoom, click an agent (or the dock) to follow, `Space` to pause, `1`–`3` for speed, `Esc` to release the camera.

## Stack

React 19 · React Three Fiber · drei · postprocessing · Tailwind CSS 4 · Motion · zustand. The island is generated from a fixed seed on a hex grid; everything is procedural geometry — no downloaded models.

## Roadmap

1. ✅ World + characters + HUD (this)
2. Simulation engine (Python): resources, needs, day/night, building
3. Agent brains: LLM planner + skill library + memory, measured learning curves
4. Multi-agent cooperation and city growth
5. Optional: reinforcement-learning skills trained on free cloud GPUs
