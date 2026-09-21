import { Vector3 } from 'three'
import { live } from '@/net/engine'

/** Real seconds for one in-game day at 1× speed (mirrors the engine's DAY_SECONDS). */
export const DAY_SECONDS = 240

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const wrap = (t: number) => ((t % 1) + 1) % 1

/**
 * Per-frame clock. The engine is the authority; between its 10 Hz updates the clock is
 * extrapolated locally and gently pulled back toward the server so the sky never jumps.
 */
export const sim = {
  t: 0.3,
  day: 1,
  night: 0,
  sunDir: new Vector3(),
  /** Scaled delta of the current frame (0 while paused). */
  dt: 0,
}

export function advance(realDt: number) {
  const dt = Math.min(realDt, 0.1) * live.speed
  sim.dt = dt
  const since = Math.min(0.5, (performance.now() - live.receivedAt) / 1000)
  const target = wrap(live.t + (since * live.speed) / DAY_SECONDS)
  let diff = target - sim.t
  if (diff > 0.5) diff -= 1
  if (diff < -0.5) diff += 1
  sim.t = Math.abs(diff) > 0.05 ? target : wrap(sim.t + dt / DAY_SECONDS + diff * 0.15)
  sim.day = live.day
  const a = (sim.t - 0.25) * Math.PI * 2
  const elevation = Math.sin(a)
  sim.sunDir.set(Math.cos(a), elevation, 0.45).normalize()
  sim.night = 1 - smoothstep(-0.12, 0.14, elevation)
}

advance(0)

export interface AgentPose {
  position: Vector3
}

/** Smoothed on-screen agent positions, read by the camera to follow one. */
export const poses = new Map<string, AgentPose>()
