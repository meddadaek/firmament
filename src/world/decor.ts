import { mulberry32, pick, range } from '@/lib/random'
import type { TileData } from '@/net/types'

export interface DecorInstance {
  x: number
  y: number
  z: number
  scale: number
  rotY: number
  color: string
  tile: number
}

const FLOWER = ['#ffffff', '#ffe066', '#ff9ec4', '#b89cff', '#ff7a6b']
const GRASS = ['#5fae55', '#6dbb5d', '#78c463']

/** Purely cosmetic grass and flowers. Gameplay resources come from the engine. */
export function buildDecor(tiles: TileData[]) {
  const rng = mulberry32(7)
  const flowers: DecorInstance[] = []
  const grass: DecorInstance[] = []
  const scatter = (t: TileData, lo: number, hi: number) => {
    const a = rng() * Math.PI * 2
    const d = range(rng, lo, hi)
    return { x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d }
  }
  for (const t of tiles) {
    if (t.biome === 'water' || t.biome === 'stone' || t.biome === 'sand') continue
    const nFlowers = t.biome === 'forest' ? 0 : t.biome === 'plaza' ? Math.floor(rng() * 2) : Math.floor(rng() * 4)
    for (let i = 0; i < nFlowers; i++) {
      flowers.push({ ...scatter(t, 0.3, 0.78), y: t.h, scale: range(rng, 0.8, 1.3), rotY: rng() * 6.28, color: pick(rng, FLOWER), tile: t.i })
    }
    const nGrass = t.biome === 'forest' ? 2 : 2 + Math.floor(rng() * 3)
    for (let i = 0; i < nGrass; i++) {
      grass.push({ ...scatter(t, 0.22, 0.8), y: t.h, scale: range(rng, 0.7, 1.3), rotY: rng() * 6.28, color: pick(rng, GRASS), tile: t.i })
    }
  }
  return { flowers, grass }
}
