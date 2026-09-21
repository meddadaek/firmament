/**
 * Pointy-top axial hex grid on the XZ plane.
 * three.js' 6-sided CylinderGeometry already has a vertex on +Z, which is exactly
 * a pointy-top hexagon, so tiles need no extra rotation.
 */
export const HEX_SIZE = 1
const SQRT3 = Math.sqrt(3)

export const DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const

export const key = (q: number, r: number) => `${q},${r}`

export function toWorld(q: number, r: number) {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    z: HEX_SIZE * 1.5 * r,
  }
}

export function hexDistance(aq: number, ar: number, bq = 0, br = 0) {
  const dq = aq - bq
  const dr = ar - br
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
}
