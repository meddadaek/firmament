"""Seeded island generation. The engine is the single source of truth for the map;
the frontend fetches it from GET /api/world and only adds decorative grass and flowers."""

import math
import random
from dataclasses import dataclass, field

from .hexgrid import DIRECTIONS, hex_distance, to_world
from .noise import Noise2D

RADIUS = 12
WATER_SURFACE = 0.36

PALETTE = {
    "plaza": ("#b6d987", "#bddd8c"),
    "meadow": ("#7cc56b", "#86cc6f", "#72bb63", "#8fd174"),
    "forest": ("#4f9a58", "#56a15c", "#478f51"),
    "sand": ("#ecd9a0", "#e6d094", "#f0dea8"),
    "stone": ("#a3a7b3", "#9aa0ad", "#b1b4be"),
    "water": ("#cdb57f",),
    "soil": ("#8a6a52", "#7f6049", "#94735a"),
    "rockBody": ("#8c8f9a", "#80838f"),
    "pine": ("#2f7d4a", "#3a8f55", "#2a6b44", "#468f52"),
    "leafy": ("#6cbf5a", "#7fc95c", "#5daf52"),
    "blossom": ("#f59bb8", "#f7b3c8"),
    "autumn": ("#f0a04b", "#e8873e"),
    "rock": ("#9ea3ae", "#b4b7c0", "#8d929e"),
    "bush": ("#4f9f4f", "#5aad55"),
}

LAKES = (((-5, 3), 1), ((5, 3), 1))
RIVER_FROM = (-5, 3)
RIVER_DIR = DIRECTIONS[3]  # (-1, 0): flows west and pours off the edge
HILLS = (((7, -6), 0.38), ((-4, -6), 0.3))
GROVES = ((2, 7), (-9, 7), (8, 0), (-2, -9))


@dataclass
class Tile:
    i: int
    q: int
    r: int
    x: float
    z: float
    h: float
    biome: str
    ring: int
    walkable: bool = False
    cap: str = ""
    body: str = ""

    def to_json(self) -> dict:
        return {
            "i": self.i, "q": self.q, "r": self.r,
            "x": round(self.x, 4), "z": round(self.z, 4), "h": round(self.h, 4),
            "biome": self.biome, "ring": self.ring, "walkable": self.walkable,
            "cap": self.cap, "body": self.body,
        }


@dataclass
class Node:
    """A harvestable resource: a tree (wood), a rock (stone) or a berry bush (food)."""

    id: int
    kind: str  # pine | tree | rock | bush
    tile: int
    x: float
    y: float
    z: float
    scale: float
    rot: float
    color: str
    resource: str
    capacity: float
    amount: float = 0.0
    regrow_at: float | None = None  # sim-clock time when a depleted tree grows back

    def to_json(self) -> dict:
        return {
            "id": self.id, "kind": self.kind, "tile": self.tile,
            "x": round(self.x, 4), "y": round(self.y, 4), "z": round(self.z, 4),
            "scale": round(self.scale, 3), "rot": round(self.rot, 3), "color": self.color,
            "resource": self.resource, "capacity": self.capacity,
        }


@dataclass
class World:
    radius: int
    tiles: list[Tile]
    lookup: dict[tuple[int, int], int]
    nodes: list[Node]
    waterfall: dict
    camp_tile: int
    home_tiles: list[int]
    _neighbours: dict[int, list[int]] = field(default_factory=dict)

    def neighbours(self, i: int) -> list[int]:
        if i not in self._neighbours:
            t = self.tiles[i]
            self._neighbours[i] = [
                j for dq, dr in DIRECTIONS if (j := self.lookup.get((t.q + dq, t.r + dr))) is not None
            ]
        return self._neighbours[i]

    def distance(self, a: int, b: int) -> int:
        ta, tb = self.tiles[a], self.tiles[b]
        return hex_distance(ta.q, ta.r, tb.q, tb.r)

    def to_json(self) -> dict:
        return {
            "radius": self.radius,
            "waterSurface": WATER_SURFACE,
            "tiles": [t.to_json() for t in self.tiles],
            "nodes": [n.to_json() for n in self.nodes],
            "waterfall": self.waterfall,
            "campTile": self.camp_tile,
            "homeTiles": self.home_tiles,
        }


def _quantize(v: float, step: float) -> float:
    return round(v / step) * step


def generate_world(seed: int = 20260921) -> World:
    rng = random.Random(seed)
    noise = Noise2D(seed + 1)
    forest_noise = Noise2D(seed + 2)

    river: set[tuple[int, int]] = set()
    for k in range(2, RADIUS + 1):
        q, r = RIVER_FROM[0] + RIVER_DIR[0] * k, RIVER_FROM[1] + RIVER_DIR[1] * k
        if hex_distance(q, r) > RADIUS:
            break
        river.add((q, r))

    tiles: list[Tile] = []
    lookup: dict[tuple[int, int], int] = {}
    for q in range(-RADIUS, RADIUS + 1):
        for r in range(-RADIUS, RADIUS + 1):
            ring = hex_distance(q, r)
            if ring > RADIUS:
                continue
            # Ragged outer rim so the island reads as organic rather than a perfect hexagon.
            if ring == RADIUS and (q, r) not in river and noise(q * 0.9, r * 0.9) < 0.15:
                continue
            x, z = to_world(q, r)
            if (q, r) in river or any(hex_distance(q, r, *c) <= rad for c, rad in LAKES):
                biome, h = "water", 0.3
            elif (hill := next(((c, lift) for c, lift in HILLS if hex_distance(q, r, *c) <= 2), None)):
                d = hex_distance(q, r, *hill[0])
                biome, h = "stone", 0.85 + (2 - d) * hill[1] + noise(x * 0.4, z * 0.4) * 0.06
            elif ring <= 2:
                biome, h = "plaza", 0.55
            else:
                grove = max(max(0.0, 1 - hex_distance(q, r, *g) / 3.2) for g in GROVES)
                f = forest_noise(x * 0.13, z * 0.13) + grove * 0.95
                biome = "forest" if f > 0.5 else "meadow"
                h = 0.55 + _quantize(noise(x * 0.11, z * 0.11) * 0.28, 0.05)
            lookup[(q, r)] = len(tiles)
            tiles.append(Tile(len(tiles), q, r, x, z, h, biome, ring))

    world = World(RADIUS, tiles, lookup, [], {}, lookup[(0, 0)], [])

    # Beaches around the water.
    for t in tiles:
        if t.biome in ("water", "stone") or t.ring <= 1:
            continue
        if any(tiles[j].biome == "water" for j in world.neighbours(t.i)):
            t.biome, t.h = "sand", 0.44

    nodes: list[Node] = []

    def add(kind: str, t: Tile, lo: float, hi: float, resource: str, capacity: float, color: str, scale: float, angle: float | None = None):
        a = rng.random() * math.tau if angle is None else angle
        d = lo + rng.random() * (hi - lo)
        nodes.append(Node(
            len(nodes), kind, t.i, t.x + math.cos(a) * d, t.h, t.z + math.sin(a) * d,
            scale, rng.random() * math.tau, color, resource, capacity, capacity,
        ))

    for t in tiles:
        t.cap = rng.choice(PALETTE[t.biome])
        t.body = rng.choice(PALETTE["rockBody"] if t.biome == "stone" else PALETTE["soil"])
        t.walkable = t.biome != "water" and t.i != world.camp_tile

        # Resources sit 0.3–0.55 from the tile centre so an agent can stand in the middle.
        if t.biome == "forest":
            count = 2 if rng.random() < 0.55 else 1
            base = rng.random() * math.tau
            for k in range(count):
                add("pine", t, 0.3, 0.52, "wood", 5, rng.choice(PALETTE["pine"]), 0.85 + rng.random() * 0.5, base + k * math.pi)
        elif t.biome == "meadow" and t.ring >= 3:
            roll = rng.random()
            if roll < 0.11:
                tone = rng.random()
                color = rng.choice(PALETTE["blossom"] if tone < 0.25 else PALETTE["autumn"] if tone < 0.4 else PALETTE["leafy"])
                add("tree", t, 0.3, 0.45, "wood", 4, color, 0.9 + rng.random() * 0.35)
            elif roll < 0.19:
                add("bush", t, 0.3, 0.45, "food", 4, rng.choice(PALETTE["bush"]), 0.85 + rng.random() * 0.35)
        elif t.biome == "stone":
            for _ in range(1 + (rng.random() < 0.5)):
                scale = 0.7 + rng.random() * 0.8
                add("rock", t, 0.28, 0.55, "stone", 9 if scale > 1.15 else 6, rng.choice(PALETTE["rock"]), scale)
        elif t.biome == "sand" and rng.random() < 0.2:
            add("rock", t, 0.3, 0.55, "stone", 2, rng.choice(PALETTE["rock"]), 0.45 + rng.random() * 0.3)

    river_end = max((tiles[lookup[k]] for k in river), key=lambda t: t.ring)
    dx, dz = to_world(*RIVER_DIR)
    length = math.hypot(dx, dz)
    world.waterfall = {
        "x": round(river_end.x + dx / length * 0.84, 4),
        "y": WATER_SURFACE,
        "z": round(river_end.z + dz / length * 0.84, 4),
        "dirX": round(dx / length, 4),
        "dirZ": round(dz / length, 4),
    }
    world.nodes = nodes
    world.home_tiles = [lookup[d] for d in DIRECTIONS]
    return world
