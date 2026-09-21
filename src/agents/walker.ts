import { Vector3 } from 'three'
import { mulberry32, range, type Rng } from '@/lib/random'
import { neighboursOf, WORLD } from '@/world/generate'
import { hexDistance } from '@/world/hex'
import type { Activity } from '@/state/store'

/**
 * DEMO MOVEMENT ONLY. Agents wander between tiles and sleep by the fire at night.
 * This is a placeholder until the backend brains drive decisions; it is honest
 * about that in the HUD ("brains offline").
 */

const WALK_SPEED = 0.85 // world units per sim-second
const STEP_LENGTH = Math.sqrt(3)
const MAX_STEP_HEIGHT = 0.4

/** Tiles someone is standing on or heading to, so two agents never pick the same spot. */
const reserved = new Set<number>()

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

type Mode = 'idle' | 'walk' | 'rest'

export class Walker {
  readonly position = new Vector3()
  yaw = 0
  mode: Mode = 'idle'

  private tile: number
  private readonly home: number
  private path: number[] = []
  private from = 0
  private to = 0
  private progress = 0
  private wait: number
  private targetYaw = 0
  private readonly rng: Rng

  constructor(home: number, seed: number) {
    this.home = home
    this.tile = home
    this.rng = mulberry32(seed)
    this.wait = range(this.rng, 0.8, 4.5)
    reserved.add(home)
    const t = WORLD.tiles[home]
    this.position.set(t.x, t.h, t.z)
    this.yaw = this.faceFire()
    this.targetYaw = this.yaw
  }

  get activity(): Activity {
    return this.mode === 'walk' ? 'walking' : this.mode === 'rest' ? 'resting' : 'idle'
  }

  update(dt: number, night: number) {
    if (dt <= 0) return
    const bedtime = night > 0.62

    if (this.mode === 'rest') {
      if (!bedtime) {
        this.mode = 'idle'
        this.wait = range(this.rng, 0.5, 5)
      }
    } else if (this.mode === 'idle') {
      if (bedtime) {
        if (this.tile === this.home) {
          this.mode = 'rest'
          this.targetYaw = this.faceFire()
        } else {
          this.startTrip(this.home)
        }
      } else {
        this.wait -= dt
        if (this.wait <= 0) this.wander()
      }
    }

    if (this.mode === 'walk') this.step(dt)

    this.yaw += wrapAngle(this.targetYaw - this.yaw) * (1 - Math.exp(-9 * dt))
  }

  private faceFire() {
    const t = WORLD.tiles[this.tile]
    return Math.atan2(-t.x, -t.z)
  }

  private wander() {
    const here = WORLD.tiles[this.tile]
    const options = WORLD.tiles.filter(
      (t) =>
        t.walkable &&
        !reserved.has(t.index) &&
        hexDistance(t.q, t.r, here.q, here.r) <= 4 &&
        hexDistance(t.q, t.r, here.q, here.r) >= 1,
    )
    for (let attempt = 0; attempt < 6 && options.length; attempt++) {
      const target = options[Math.floor(this.rng() * options.length)]
      if (this.startTrip(target.index)) return
    }
    this.wait = range(this.rng, 1, 3)
  }

  private startTrip(target: number) {
    const path = findPath(this.tile, target)
    if (!path || path.length < 2) {
      this.wait = range(this.rng, 1, 3)
      return false
    }
    if (this.tile !== this.home) reserved.delete(this.tile)
    reserved.add(target)
    this.path = path
    this.from = path[0]
    this.to = path[1]
    this.progress = 0
    this.mode = 'walk'
    return true
  }

  private step(dt: number) {
    this.progress += (dt * WALK_SPEED) / STEP_LENGTH
    while (this.progress >= 1) {
      this.progress -= 1
      this.path.shift()
      this.tile = this.path[0]
      if (this.path.length < 2) {
        this.arrive()
        return
      }
      this.from = this.path[0]
      this.to = this.path[1]
    }

    const a = WORLD.tiles[this.from]
    const b = WORLD.tiles[this.to]
    const p = this.progress
    const climb = Math.abs(b.h - a.h) > 0.04 ? 0.12 : 0
    const hop = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.3) / 0.4))) * climb
    this.position.set(
      a.x + (b.x - a.x) * p,
      a.h + (b.h - a.h) * smoothstep(0.35, 0.65, p) + hop,
      a.z + (b.z - a.z) * p,
    )
    this.targetYaw = Math.atan2(b.x - a.x, b.z - a.z)
  }

  private arrive() {
    const t = WORLD.tiles[this.tile]
    this.position.set(t.x, t.h, t.z)
    this.progress = 0
    this.mode = 'idle'
    this.wait = range(this.rng, 2, 6.5)
  }
}

function findPath(start: number, goal: number): number[] | null {
  const prev = new Map<number, number>([[start, -1]])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()!
    if (current === goal) break
    const ch = WORLD.tiles[current].h
    for (const n of neighboursOf(WORLD, current)) {
      if (prev.has(n)) continue
      const t = WORLD.tiles[n]
      if (!t.walkable && n !== goal) continue
      if (Math.abs(t.h - ch) > MAX_STEP_HEIGHT) continue
      prev.set(n, current)
      queue.push(n)
    }
  }
  if (!prev.has(goal)) return null
  const path: number[] = []
  for (let n = goal; n !== -1; n = prev.get(n)!) path.unshift(n)
  return path
}
