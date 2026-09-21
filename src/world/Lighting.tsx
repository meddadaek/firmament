import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight, HemisphereLight } from 'three'
import { sim } from '@/state/sim'
import { tod } from './timeOfDay'

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * One shadow-casting key light that is the sun by day and the moon by night.
 * Its intensity dips to zero at the horizon, which hides the swap between the two.
 */
export function Lighting() {
  const key = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)

  useFrame(() => {
    const l = key.current
    const h = hemi.current
    if (!l || !h) return
    const up = sim.sunDir.y >= 0
    const sign = up ? 1 : -1
    l.position.set(sim.sunDir.x * 50 * sign, sim.sunDir.y * 50 * sign, sim.sunDir.z * 50 * sign)
    l.color.copy(tod.sun)
    l.intensity = tod.sunI * smoothstep(0.02, 0.2, Math.abs(sim.sunDir.y))
    h.color.copy(tod.hemiSky)
    h.groundColor.copy(tod.hemiGround)
    h.intensity = tod.hemiI
  })

  return (
    <>
      <hemisphereLight ref={hemi} intensity={1} />
      <directionalLight
        ref={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
    </>
  )
}
