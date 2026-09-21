import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
} from 'three'
import { createNoise3D } from 'simplex-noise'
import { mulberry32, range } from '@/lib/random'
import { sim } from '@/state/sim'
import { WORLD } from './generate'

const BASE = -1.1
const CAP = 0.1

const capGeo = new CylinderGeometry(0.925, 0.975, CAP, 6).translate(0, -CAP / 2, 0)
const bodyGeo = new CylinderGeometry(0.975, 0.975, 1, 6).translate(0, -0.5, 0)
const tileMat = new MeshStandardMaterial({ flatShading: true, roughness: 0.95 })
const bodyMat = new MeshStandardMaterial({ flatShading: true, roughness: 1 })

function Tiles() {
  const caps = useRef<InstancedMesh>(null)
  const bodies = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const o = new Object3D()
    const c = new Color()
    const rng = mulberry32(77)
    WORLD.tiles.forEach((t, i) => {
      const cap = t.biome === 'water' ? '#cdb57f' : t.capColor
      o.position.set(t.x, t.h, t.z)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      caps.current!.setMatrixAt(i, o.matrix)
      caps.current!.setColorAt(i, c.set(cap))

      // Rim tiles hang lower so the island edge reads as a ragged cliff.
      const bottom = BASE - (t.ring >= WORLD.radius - 1 ? range(rng, 0, 0.7) : 0)
      const top = t.h - CAP
      o.position.set(t.x, top, t.z)
      o.scale.set(1, top - bottom, 1)
      o.updateMatrix()
      bodies.current!.setMatrixAt(i, o.matrix)
      bodies.current!.setColorAt(i, c.set(t.biome === 'water' ? '#b59a6a' : t.bodyColor))
    })
    for (const m of [caps.current!, bodies.current!]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [])

  const n = WORLD.tiles.length
  return (
    <>
      <instancedMesh ref={caps} args={[capGeo, tileMat, n]} receiveShadow castShadow />
      <instancedMesh ref={bodies} args={[bodyGeo, bodyMat, n]} receiveShadow castShadow />
    </>
  )
}

/** The inverted rocky mountain the island floats on, with crystals that glow at night. */
function Underside() {
  const crystalsMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#b9f6ff',
        emissive: '#48d6ff',
        emissiveIntensity: 0.4,
        flatShading: true,
        roughness: 0.2,
        toneMapped: false,
      }),
    [],
  )

  const { rock, crystals, stalactites } = useMemo(() => {
    const noise = createNoise3D(mulberry32(9))
    const g = new ConeGeometry(10.2, 8, 18, 8, true)
    g.rotateX(Math.PI)
    g.translate(0, BASE - 4 + 0.05, 0)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const top = new Color('#8a6a52')
    const mid = new Color('#6b5058')
    const bottom = new Color('#3b2f4d')
    const c = new Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const depth = (BASE - y) / 8 // 0 at the top rim, 1 at the tip
      const n = noise(x * 0.35, y * 0.35, z * 0.35)
      const push = 1 + n * 0.16 * (1 - depth * 0.3)
      pos.setXYZ(i, x * push, y + n * 0.35 * depth, z * push)
      if (depth < 0.5) c.copy(top).lerp(mid, depth * 2)
      else c.copy(mid).lerp(bottom, (depth - 0.5) * 2)
      c.multiplyScalar(0.9 + n * 0.1)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.computeVertexNormals()

    const rng = mulberry32(31)
    const crystals = Array.from({ length: 14 }, () => {
      const depth = range(rng, 0.12, 0.75)
      const a = rng() * Math.PI * 2
      const r = 10.2 * (1 - depth) * 0.97
      return {
        position: [Math.cos(a) * r, BASE - depth * 8, Math.sin(a) * r] as const,
        rotation: [range(rng, -0.4, 0.4), a, Math.PI / 2 + range(rng, -0.5, 0.2)] as const,
        scale: range(rng, 0.25, 0.55),
      }
    })
    const stalactites = Array.from({ length: 7 }, () => {
      const a = rng() * Math.PI * 2
      const r = range(rng, 2.5, 6.5)
      return {
        position: [Math.cos(a) * r, BASE - 8 * (1 - r / 10.2) - 0.6, Math.sin(a) * r] as const,
        scale: range(rng, 0.6, 1.2),
      }
    })
    return { rock: g, crystals, stalactites }
  }, [])

  const rockMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), [])
  const crystalGeo = useMemo(() => new OctahedronGeometry(0.5, 0).scale(0.7, 2, 0.7), [])
  const spikeGeo = useMemo(() => new ConeGeometry(0.6, 2.4, 6).rotateX(Math.PI), [])

  useFrame(() => {
    crystalsMat.emissiveIntensity = 0.35 + sim.night * 2.6
  })

  return (
    <group>
      <mesh geometry={rock} material={rockMat} receiveShadow />
      {stalactites.map((s, i) => (
        <mesh key={i} geometry={spikeGeo} material={rockMat} position={s.position} scale={s.scale} />
      ))}
      {crystals.map((c, i) => (
        <mesh key={i} geometry={crystalGeo} material={crystalsMat} position={c.position} rotation={c.rotation} scale={c.scale} />
      ))}
    </group>
  )
}

/** Small rock islets drifting around the main island. */
function Islets() {
  const group = useRef<Group>(null)
  const items = useMemo(() => {
    const rng = mulberry32(55)
    const noise = createNoise3D(mulberry32(56))
    return Array.from({ length: 6 }, (_, i) => {
      const g = new IcosahedronGeometry(1, 1)
      const p = g.attributes.position
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v)
        const y = p.getY(v)
        const z = p.getZ(v)
        const k = 1 + noise(x * 1.3 + i, y * 1.3, z * 1.3) * 0.25
        p.setXYZ(v, x * k, y > 0.2 ? 0.3 + y * 0.15 : y * k * 1.5, z * k)
      }
      g.computeVertexNormals()
      const a = (i / 6) * Math.PI * 2 + range(rng, -0.3, 0.3)
      const r = range(rng, 15, 20)
      return {
        geometry: g,
        position: [Math.cos(a) * r, range(rng, -3.5, 1.5), Math.sin(a) * r] as const,
        scale: range(rng, 0.55, 1.1),
        grass: rng() > 0.35,
        phase: rng() * 6,
      }
    })
  }, [])
  const refs = useRef<(Group | null)[]>([])
  const rockMat = useMemo(() => new MeshStandardMaterial({ color: '#7d6272', flatShading: true, roughness: 1 }), [])
  const grassMat = useMemo(() => new MeshStandardMaterial({ color: '#7cc56b', flatShading: true, roughness: 1 }), [])
  const grassGeo = useMemo(() => new CylinderGeometry(0.95, 1.0, 0.18, 6), [])

  useFrame(({ clock }, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.012
    const t = clock.elapsedTime
    items.forEach((it, i) => {
      const g = refs.current[i]
      if (g) g.position.y = it.position[1] + Math.sin(t * 0.5 + it.phase) * 0.35
    })
  })

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={it.position}
          scale={it.scale}
        >
          <mesh geometry={it.geometry} material={rockMat} castShadow />
          {it.grass && <mesh geometry={grassGeo} material={grassMat} position-y={0.42} />}
        </group>
      ))}
    </group>
  )
}

export function Island() {
  return (
    <group>
      <Tiles />
      <Underside />
      <Islets />
    </group>
  )
}
