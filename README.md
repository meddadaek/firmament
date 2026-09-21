# Firmament

A firm of six AI agents dropped on a small floating sky island with a campfire and a crate of supplies. The goal: let them survive, learn by repetition, and build a city on their own — and watch it happen like a game.

**Status: step 3 of 5.** A Python engine simulates the island (hunger, energy, day/night, wood/stone/food, fog of war, a tech tree, construction) and the agents now run on a **real LLM brain**: each agent asks the model what to do next, gets back a short plan plus an optional chat message, and the engine carries it out under the same world rules. The chat panel shows their actual conversation; the agent card shows each one's latest thought.

**Learning:** every night each agent reviews its day and rewrites up to six lessons, stored in `engine/data/memory.json` and fed back into every later decision, including in later runs. A run ends when the Town Hall stands (or after day 20); the island then restarts with the lessons kept. The Learning tab charts the day the Town Hall was finished per run, so improvement (or the lack of it) is visible.

Brain: Groq free tier, `openai/gpt-oss-120b` for decisions and `openai/gpt-oss-20b` for nightly reflections. World time pauses while an agent waits for its answer, so API latency never counts against them. Without a key the engine falls back to a fixed rule list, and the HUD says so.

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

To give the agents a brain, create `engine/.env` with a free Groq key (console.groq.com, no card needed). The file is git-ignored:

```
GROQ_API_KEY=your_key_here
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
3. ✅ Agent brains: LLM decisions, real chat, nightly lessons, learning curve across runs
4. Multi-agent cooperation and city growth
5. Optional: reinforcement-learning skills trained on free cloud GPUs
