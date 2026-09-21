import { Color } from 'three'

const FOG = new Color('#2a3358')

/** Unexplored land: darker and cooler, but still readable as terrain. */
export function fogTint(c: Color, known: boolean) {
  return known ? c : c.multiplyScalar(0.42).lerp(FOG, 0.3)
}
