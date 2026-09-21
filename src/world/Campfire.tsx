import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
} from 'three'
import { mulberry32 } from '@/lib/random'
import { sim } from '@/state/sim'

const EMBERS = 28

/** The firm's starting point: a fire, and a crate of starter supplies. */
export function Campfire({ height: h }: { height: number }) {
  const flames = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const embers = useRef<Points>(null)

  const parts = useMemo(() => {
    const stone = new DodecahedronGeometry(0.075, 0)
    const log = new CylinderGeometry(0.035, 0.04, 0.42, 6)
    const outer = new ConeGeometry(0.13, 0.36, 8).translate(0, 0.18, 0)
    const inner = new ConeGeometry(0.085, 0.27, 8).translate(0, 0.135, 0)
    const core = new ConeGeometry(0.045, 0.16, 6).translate(0, 0.08, 0)
    const rng = mulberry32(12)
    const emberGeo = new BufferGeometry()
    const seeds = new Float32Array(EMBERS * 3)
    for (let i = 0; i < EMBERS; i++) seeds.set([rng(), rng(), rng()], i * 3)
    emberGeo.setAttribute('position', new BufferAttribute(new Float32Array(EMBERS * 3), 3))
    return { stone, log, outer, inner, core, emberGeo, seeds }
  }, [])

  const mats = useMemo(
    () => ({
      stone: new MeshStandardMaterial({ color: '#8e929c', flatShading: true, roughness: 1 }),
      log: new MeshStandardMaterial({ color: '#6b4428', flatShading: true, roughness: 1 }),
      outer: new MeshBasicMaterial({ color: '#ff6a1f', toneMapped: false, transparent: true, opacity: 0.92 }),
      inner: new MeshBasicMaterial({ color: '#ffb23d', toneMapped: false }),
      core: new MeshBasicMaterial({ color: '#fff1b8', toneMapped: false }),
      ember: new PointsMaterial({ color: '#ffb35c', size: 0.05, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      crate: new MeshStandardMaterial({ color: '#b07a48', flatShading: true, roughness: 0.9 }),
      band: new MeshStandardMaterial({ color: '#6d4a2c', flatShading: true, roughness: 0.9 }),
      sack: new MeshStandardMaterial({ color: '#d9c08a', roughness: 1 }),
    }),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 0.85 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 23) * 0.03
    if (flames.current) {
      flames.current.children.forEach((c, i) => {
        c.scale.set(1 + Math.sin(t * 9 + i) * 0.06, flicker + Math.sin(t * 11 + i * 2) * 0.08, 1)
      })
    }
    if (light.current) light.current.intensity = (0.6 + sim.night * 5.5) * flicker
    if (embers.current) {
      const pos = embers.current.geometry.attributes.position as BufferAttribute
      for (let i = 0; i < EMBERS; i++) {
        const a = parts.seeds[i * 3] * Math.PI * 2
        const life = (t * (0.35 + parts.seeds[i * 3 + 1] * 0.3) + parts.seeds[i * 3 + 2]) % 1
        const r = 0.05 + life * 0.18
        pos.setXYZ(i, Math.cos(a + life * 2) * r, 0.15 + life * 1.1, Math.sin(a + life * 2) * r)
      }
      pos.needsUpdate = true
      mats.ember.opacity = 0.4 + sim.night * 0.6
    }
  })

  return (
    <group position={[0, h, 0]}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        return <mesh key={i} geometry={parts.stone} material={mats.stone} position={[Math.cos(a) * 0.27, 0.03, Math.sin(a) * 0.27]} rotation-y={a} castShadow />
      })}
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={parts.log} material={mats.log} position-y={0.1} rotation={[0, (i / 3) * Math.PI * 2, 0.75]} castShadow />
      ))}
      <group ref={flames} position-y={0.05}>
        <mesh geometry={parts.outer} material={mats.outer} />
        <mesh geometry={parts.inner} material={mats.inner} />
        <mesh geometry={parts.core} material={mats.core} />
      </group>
      <points ref={embers} geometry={parts.emberGeo} material={mats.ember} />
      <pointLight ref={light} color="#ff9447" position-y={0.45} distance={7} decay={1.6} />

      <group position={[0.62, 0, -0.34]} rotation-y={0.4}>
        <mesh geometry={box(0.28, 0.24, 0.28)} material={mats.crate} position-y={0.12} castShadow receiveShadow />
        <mesh geometry={box(0.3, 0.035, 0.3)} material={mats.band} position-y={0.2} />
        <mesh geometry={box(0.3, 0.035, 0.3)} material={mats.band} position-y={0.05} />
      </group>
      <mesh geometry={sack} material={mats.sack} position={[-0.5, 0.1, 0.46]} scale={[1, 0.85, 0.9]} castShadow />
    </group>
  )
}

const boxes = new Map<string, BoxGeometry>()
function box(x: number, y: number, z: number) {
  const k = `${x},${y},${z}`
  if (!boxes.has(k)) boxes.set(k, new BoxGeometry(x, y, z))
  return boxes.get(k)!
}
const sack = new SphereGeometry(0.13, 12, 10)
