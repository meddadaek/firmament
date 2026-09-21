import { createNoise2D } from 'simplex-noise'
import { mulberry32, pick, range, type Rng } from '@/lib/random'
import { DIRECTIONS, hexDistance, key, toWorld } from './hex'

export type Biome = 'plaza' | 'meadow' | 'forest' | 'sand' | 'water' | 'stone'

export interface Tile {
  index: number
  q: number
  r: number
  x: number
  z: number
  /** Height of the walkable top surface. */
  h: number
  biome: Biome
  walkable: boolean
  /** Hex distance from the island centre. */
  ring: number
  capColor: string
  bodyColor: string
}

export interface PropInstance {
  x: number
  y: number
  z: number
  scale: number
  rotY: number
  color: string
}

export interface World {
  radius: number
  tiles: Tile[]
  lookup: Map<string, number>
  pines: PropInstance[]
  roundTrees: PropInstance[]
  rocks: PropInstance[]
  bushes: PropInstance[]
  flowers: PropInstance[]
  grass: PropInstance[]
  waterfall: { x: number; y: number; z: number; dirX: number; dirZ: number }
  /** The six tiles around the campfire — where the firm sleeps. */
  homeTiles: number[]
}

export const WATER_SURFACE = 0.36
const RADIUS = 7

const PALETTE = {
  plaza: ['#b6d987', '#bddd8c'],
  meadow: ['#7cc56b', '#86cc6f', '#72bb63', '#8fd174'],
  forest: ['#4f9a58', '#56a15c', '#478f51'],
  sand: ['#ecd9a0', '#e6d094', '#f0dea8'],
  stone: ['#a3a7b3', '#9aa0ad', '#b1b4be'],
  water: ['#3fa7d6'],
  soil: ['#8a6a52', '#7f6049', '#94735a'],
  rockBody: ['#8c8f9a', '#80838f'],
  pine: ['#2f7d4a', '#3a8f55', '#2a6b44', '#468f52'],
  leafy: ['#6cbf5a', '#7fc95c', '#5daf52'],
  blossom: ['#f59bb8', '#f7b3c8'],
  autumn: ['#f0a04b', '#e8873e'],
  rock: ['#9ea3ae', '#b4b7c0', '#8d929e'],
  bush: ['#4f9f4f', '#5aad55'],
  flower: ['#ffffff', '#ffe066', '#ff9ec4', '#b89cff', '#ff7a6b'],
  grass: ['#5fae55', '#6dbb5d', '#78c463'],
}

const LAKE = { q: -3, r: 2 }
const RIVER_DIR = DIRECTIONS[3] // (-1, 0): flows toward -X and pours off the edge
const HILL = { q: 4, r: -3 }
const GROVE = { q: 1, r: 4 }

const quantize = (v: number, step: number) => Math.round(v / step) * step

function scatter(rng: Rng, tile: Tile, minR: number, maxR: number) {
  const a = rng() * Math.PI * 2
  const d = range(rng, minR, maxR)
  return { x: tile.x + Math.cos(a) * d, z: tile.z + Math.sin(a) * d }
}

export function generateWorld(seed = 20260921): World {
  const rng = mulberry32(seed)
  const noise = createNoise2D(mulberry32(seed + 1))
  const forestNoise = createNoise2D(mulberry32(seed + 2))

  // River: walk from the lake toward the edge.
  const river = new Set<string>()
  for (let k = 2; k <= RADIUS; k++) {
    const q = LAKE.q + RIVER_DIR[0] * k
    const r = LAKE.r + RIVER_DIR[1] * k
    if (hexDistance(q, r) > RADIUS) break
    river.add(key(q, r))
  }

  const tiles: Tile[] = []
  const lookup = new Map<string, number>()

  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      const ring = hexDistance(q, r)
      if (ring > RADIUS) continue
      const k = key(q, r)
      // Ragged outer rim so the island reads as organic, not a perfect hexagon.
      if (ring === RADIUS && !river.has(k) && noise(q * 0.9, r * 0.9) < 0.2) continue

      const { x, z } = toWorld(q, r)
      const lakeD = hexDistance(q, r, LAKE.q, LAKE.r)
      const hillD = hexDistance(q, r, HILL.q, HILL.r)
      const groveD = hexDistance(q, r, GROVE.q, GROVE.r)

      let biome: Biome
      let h: number
      if (lakeD <= 1 || river.has(k)) {
        biome = 'water'
        h = 0.3
      } else if (hillD <= 2) {
        biome = 'stone'
        h = 0.85 + (2 - hillD) * 0.38 + noise(x * 0.4, z * 0.4) * 0.06
      } else if (ring <= 2) {
        biome = 'plaza'
        h = 0.55
      } else {
        const f = forestNoise(x * 0.16, z * 0.16) + Math.max(0, 1 - groveD / 3) * 0.9
        biome = f > 0.5 ? 'forest' : 'meadow'
        h = 0.55 + quantize(noise(x * 0.14, z * 0.14) * 0.22, 0.05)
      }

      lookup.set(k, tiles.length)
      tiles.push({
        index: tiles.length,
        q,
        r,
        x,
        z,
        h,
        biome,
        walkable: false,
        ring,
        capColor: '',
        bodyColor: '',
      })
    }
  }

  const neighbours = (t: Tile) =>
    DIRECTIONS.map(([dq, dr]) => lookup.get(key(t.q + dq, t.r + dr))).filter(
      (i): i is number => i !== undefined,
    )

  // Beaches around the water.
  for (const t of tiles) {
    if (t.biome === 'water' || t.biome === 'stone' || t.ring <= 1) continue
    if (neighbours(t).some((i) => tiles[i].biome === 'water')) {
      t.biome = 'sand'
      t.h = 0.44
    }
  }

  const pines: PropInstance[] = []
  const roundTrees: PropInstance[] = []
  const rocks: PropInstance[] = []
  const bushes: PropInstance[] = []
  const flowers: PropInstance[] = []
  const grass: PropInstance[] = []

  for (const t of tiles) {
    t.capColor = pick(rng, PALETTE[t.biome])
    t.bodyColor = pick(rng, t.biome === 'stone' ? PALETTE.rockBody : PALETTE.soil)
    t.walkable = t.biome === 'plaza' || t.biome === 'meadow' || t.biome === 'sand'
    if (t.biome === 'stone' && hexDistance(t.q, t.r, HILL.q, HILL.r) === 2) t.walkable = true
    if (t.q === 0 && t.r === 0) t.walkable = false // campfire

    if (t.biome === 'forest') {
      const count = rng() < 0.55 ? 2 : 1
      for (let i = 0; i < count; i++) {
        const p = scatter(rng, t, count === 1 ? 0 : 0.28, count === 1 ? 0.2 : 0.5)
        pines.push({ ...p, y: t.h, scale: range(rng, 0.85, 1.35), rotY: rng() * 6.28, color: pick(rng, PALETTE.pine) })
      }
      for (let i = 0; i < 2; i++) {
        const p = scatter(rng, t, 0.2, 0.7)
        grass.push({ ...p, y: t.h, scale: range(rng, 0.8, 1.2), rotY: rng() * 6.28, color: pick(rng, PALETTE.grass) })
      }
    }

    if (t.biome === 'meadow') {
      const roll = rng()
      if (t.ring >= 3 && roll < 0.13) {
        const tone = rng()
        const color =
          tone < 0.25 ? pick(rng, PALETTE.blossom) : tone < 0.4 ? pick(rng, PALETTE.autumn) : pick(rng, PALETTE.leafy)
        const p = scatter(rng, t, 0, 0.25)
        roundTrees.push({ ...p, y: t.h, scale: range(rng, 0.9, 1.25), rotY: rng() * 6.28, color })
        t.walkable = false
      } else if (t.ring >= 3 && roll < 0.19) {
        const p = scatter(rng, t, 0, 0.3)
        bushes.push({ ...p, y: t.h, scale: range(rng, 0.85, 1.2), rotY: rng() * 6.28, color: pick(rng, PALETTE.bush) })
        t.walkable = false
      }
    }

    if (t.biome === 'meadow' || t.biome === 'plaza') {
      const nFlowers = t.biome === 'plaza' ? Math.floor(rng() * 2) : Math.floor(rng() * 4)
      for (let i = 0; i < nFlowers; i++) {
        const p = scatter(rng, t, 0.25, 0.75)
        flowers.push({ ...p, y: t.h, scale: range(rng, 0.8, 1.3), rotY: rng() * 6.28, color: pick(rng, PALETTE.flower) })
      }
      const nGrass = 2 + Math.floor(rng() * 3)
      for (let i = 0; i < nGrass; i++) {
        const p = scatter(rng, t, 0.2, 0.78)
        grass.push({ ...p, y: t.h, scale: range(rng, 0.7, 1.3), rotY: rng() * 6.28, color: pick(rng, PALETTE.grass) })
      }
    }

    if (t.biome === 'stone') {
      const count = 1 + Math.floor(rng() * 2)
      for (let i = 0; i < count; i++) {
        const p = scatter(rng, t, 0.1, 0.55)
        rocks.push({ ...p, y: t.h, scale: range(rng, 0.7, 1.5), rotY: rng() * 6.28, color: pick(rng, PALETTE.rock) })
      }
    }

    if (t.biome === 'sand' && rng() < 0.2) {
      const p = scatter(rng, t, 0.3, 0.6)
      rocks.push({ ...p, y: t.h, scale: range(rng, 0.45, 0.75), rotY: rng() * 6.28, color: pick(rng, PALETTE.rock) })
    }
  }

  // Waterfall pours off the outer side of the last river tile.
  const riverEnd = [...river].map((k) => tiles[lookup.get(k)!]).sort((a, b) => b.ring - a.ring)[0]
  const dir = toWorld(RIVER_DIR[0], RIVER_DIR[1])
  const len = Math.hypot(dir.x, dir.z)
  const waterfall = {
    x: riverEnd.x + (dir.x / len) * 0.84,
    y: WATER_SURFACE,
    z: riverEnd.z + (dir.z / len) * 0.84,
    dirX: dir.x / len,
    dirZ: dir.z / len,
  }

  const homeTiles = DIRECTIONS.map(([dq, dr]) => lookup.get(key(dq, dr))!)

  return { radius: RADIUS, tiles, lookup, pines, roundTrees, rocks, bushes, flowers, grass, waterfall, homeTiles }
}

export const WORLD = generateWorld()

export function neighboursOf(world: World, index: number) {
  const t = world.tiles[index]
  return DIRECTIONS.map(([dq, dr]) => world.lookup.get(key(t.q + dq, t.r + dr))).filter(
    (i): i is number => i !== undefined,
  )
}
