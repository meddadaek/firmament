import { Vector3 } from 'three'

/** Real seconds for one in-game day at 1× speed. */
export const DAY_SECONDS = 240

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Per-frame simulation state. Lives outside React on purpose: it changes every
 * frame, and putting it in React state would re-render the whole tree at 60 Hz.
 */
export const sim = {
  /** Day progress, 0 = midnight, 0.5 = noon. */
  t: 0.3,
  day: 1,
  /** 0 in daylight → 1 in deep night. */
  night: 0,
  /** Unit vector toward the sun (below the horizon at night). */
  sunDir: new Vector3(),
  /** Scaled delta of the current frame (0 while paused). */
  dt: 0,
}

export function advance(realDt: number, speed: number) {
  const dt = Math.min(realDt, 0.1) * speed
  sim.dt = dt
  sim.t += dt / DAY_SECONDS
  if (sim.t >= 1) {
    sim.t -= 1
    sim.day += 1
  }
  const a = (sim.t - 0.25) * Math.PI * 2
  const elevation = Math.sin(a)
  sim.sunDir.set(Math.cos(a), elevation, 0.45).normalize()
  sim.night = 1 - smoothstep(-0.12, 0.14, elevation)
}

advance(0, 1)

export interface AgentPose {
  position: Vector3
  yaw: number
}

/** Live world positions of every agent, read by the camera to follow one. */
export const poses = new Map<string, AgentPose>()
