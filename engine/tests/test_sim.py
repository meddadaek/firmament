import json
import time
from collections import deque

from firmament.sim import DAY_SECONDS, MAX_STEP_HEIGHT, Simulation
from firmament.world import generate_world


def test_world_is_deterministic_and_bigger():
    a, b = generate_world(), generate_world()
    assert json.dumps(a.to_json()) == json.dumps(b.to_json())
    assert 380 <= len(a.tiles) <= 469  # radius 12
    assert len(a.home_tiles) == 6
    assert not a.tiles[a.camp_tile].walkable
    kinds = {n.kind for n in a.nodes}
    assert {"pine", "tree", "rock", "bush"} <= kinds


def test_almost_all_land_is_reachable_from_camp():
    w = generate_world()
    start = w.home_tiles[0]
    seen = {start}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        for n in w.neighbours(cur):
            t = w.tiles[n]
            if n not in seen and t.walkable and abs(t.h - w.tiles[cur].h) <= MAX_STEP_HEIGHT:
                seen.add(n)
                queue.append(n)
    land = [t for t in w.tiles if t.walkable]
    assert len(seen) / len(land) > 0.97


def test_snapshots_are_json_serialisable():
    sim = Simulation()
    json.dumps(sim.full_snapshot())
    sim.advance(5)
    json.dumps(sim.delta_snapshot())


def test_the_firm_survives_and_builds_over_several_days():
    sim = Simulation()
    started = time.perf_counter()
    sim.advance(DAY_SECONDS * 5)
    elapsed = time.perf_counter() - started

    done = [b for b in sim.buildings.values() if b.state == "done"]
    assert done, "nothing was built in five days"
    assert any(b.kind == "hut" for b in done)
    assert sum(a.stats["wood"] for a in sim.agents) > 20
    assert sum(a.stats["stone"] for a in sim.agents) > 5
    assert len(sim.discovered) > 100
    assert all(0 <= a.hunger <= 1 and 0 <= a.energy <= 1 for a in sim.agents)
    assert min(a.hunger for a in sim.agents) > 0, "someone is starving"
    assert sim.day == 6
    assert elapsed < 20, f"five sim days took {elapsed:.1f}s"
    print(
        f"\n5 days in {elapsed:.2f}s | built: {[b.kind for b in done]} | stock: {sim.stock} | "
        f"tools: {sim.tools} | explored: {len(sim.discovered)}/{len(sim.world.tiles)}"
    )
