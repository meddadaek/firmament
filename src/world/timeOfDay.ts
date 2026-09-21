import { Color } from 'three'

/**
 * Colour keys across one in-game day. t = 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset.
 * Everything is interpolated into one shared, reused object so nothing allocates per frame.
 */
const RAW = [
  { t: 0.0, skyTop: '#060a1e', skyBottom: '#151c42', sun: '#8fa4ff', sunI: 0.5, hemiSky: '#3a4a8f', hemiGround: '#0d1024', hemiI: 0.6 },
  { t: 0.2, skyTop: '#101845', skyBottom: '#2e2c66', sun: '#9aa0ff', sunI: 0.45, hemiSky: '#46509a', hemiGround: '#141630', hemiI: 0.6 },
  { t: 0.265, skyTop: '#4a5aa6', skyBottom: '#ffae8c', sun: '#ffb38a', sunI: 1.5, hemiSky: '#ffc7a8', hemiGround: '#4a3a52', hemiI: 0.75 },
  { t: 0.34, skyTop: '#62aaea', skyBottom: '#ffe3c8', sun: '#ffe6c4', sunI: 2.5, hemiSky: '#d8ecff', hemiGround: '#6a5a4a', hemiI: 0.95 },
  { t: 0.5, skyTop: '#4d9ff0', skyBottom: '#d3ecff', sun: '#fff7ea', sunI: 3.0, hemiSky: '#e4f2ff', hemiGround: '#6f6250', hemiI: 1.05 },
  { t: 0.66, skyTop: '#5891e0', skyBottom: '#ffe2c4', sun: '#ffe3b8', sunI: 2.5, hemiSky: '#e0ecff', hemiGround: '#6a5a4a', hemiI: 0.95 },
  { t: 0.74, skyTop: '#4c3f92', skyBottom: '#ff8e6a', sun: '#ff8d5c', sunI: 1.5, hemiSky: '#ffb09a', hemiGround: '#4a3050', hemiI: 0.75 },
  { t: 0.82, skyTop: '#1b2258', skyBottom: '#5b3a7c', sun: '#a58cff', sunI: 0.5, hemiSky: '#5a4a9a', hemiGround: '#141630', hemiI: 0.6 },
  { t: 1.0, skyTop: '#060a1e', skyBottom: '#151c42', sun: '#8fa4ff', sunI: 0.5, hemiSky: '#3a4a8f', hemiGround: '#0d1024', hemiI: 0.6 },
]

const KEYS = RAW.map((k) => ({
  t: k.t,
  skyTop: new Color(k.skyTop),
  skyBottom: new Color(k.skyBottom),
  sun: new Color(k.sun),
  sunI: k.sunI,
  hemiSky: new Color(k.hemiSky),
  hemiGround: new Color(k.hemiGround),
  hemiI: k.hemiI,
}))

export const tod = {
  skyTop: new Color(),
  skyBottom: new Color(),
  sun: new Color(),
  sunI: 1,
  hemiSky: new Color(),
  hemiGround: new Color(),
  hemiI: 1,
}

export function sampleTimeOfDay(t: number) {
  let i = 0
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const raw = (t - a.t) / (b.t - a.t)
  const f = raw * raw * (3 - 2 * raw)
  tod.skyTop.copy(a.skyTop).lerp(b.skyTop, f)
  tod.skyBottom.copy(a.skyBottom).lerp(b.skyBottom, f)
  tod.sun.copy(a.sun).lerp(b.sun, f)
  tod.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, f)
  tod.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, f)
  tod.sunI = a.sunI + (b.sunI - a.sunI) * f
  tod.hemiI = a.hemiI + (b.hemiI - a.hemiI) * f
  return tod
}

export type Phase = 'Night' | 'Dawn' | 'Day' | 'Dusk'

export function phaseOf(t: number): Phase {
  if (t < 0.22 || t >= 0.83) return 'Night'
  if (t < 0.31) return 'Dawn'
  if (t < 0.71) return 'Day'
  return 'Dusk'
}

export function clockString(t: number) {
  const minutes = Math.floor(t * 1440)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}
