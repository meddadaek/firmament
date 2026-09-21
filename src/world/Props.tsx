import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '@/lib/random'
import { live } from '@/net/engine'
import type { NodeData, WorldData } from '@/net/types'
import { buildDecor } from './decor'
import { fogTint } from './fog'

/**
 * Wind: a tiny vertex patch on MeshStandardMaterial. Vertices sway more the higher
 * they sit above the prop's base, phase-shifted by the instance's world position.
 */
const wind = { value: 0 }

function windMaterial(opts: ConstructorParameters<typeof MeshStandardMaterial>[0], strength: number, base = 0) {
  const m = new MeshStandardMaterial({ flatShading: true, roughness: 0.9, ...opts })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float lift = max(position.y - ${base.toFixed(3)}, 0.0);
      float sway = sin(uWind * 1.7 + ip.x * 0.8 + ip.z * 0.6) * ${strength.toFixed(3)} * lift;
      transformed.x += sway;
      transformed.z += sway * 0.55;`,
    )
  }
  return m
}

interface Item {
  x: number
  y: number
  z: number
  scale: number
  rotY: number
  color: string
  tile: number
  node?: number
  capacity?: number
}

type Visibility = 'always' | 'present' | 'depleted' | 'shrink' | 'threshold'

/**
 * One instanced layer. It re-applies matrices when node amounts change (a tree is cut,
 * a rock mined) and colours when the fog of war lifts. Both are rare, so this is cheap.
 */
function Layer({
  items,
  geometry,
  material,
  tint = 0,
  shadow = true,
  visibility = 'always',
}: {
  items: Item[]
  geometry: BufferGeometry
  material: Material
  tint?: number
  shadow?: boolean
  visibility?: Visibility
}) {
  const ref = useRef<InstancedMesh>(null)
  const versions = useRef({ nodes: -1, fog: -1 })
  const o = useMemo(() => new Object3D(), [])
  const c = useMemo(() => new Color(), [])
  const white = useMemo(() => new Color('#ffffff'), [])

  useFrame(() => {
    const m = ref.current
    if (!m) return
    const v = versions.current
    if (v.nodes !== live.nodesVersion) {
      v.nodes = live.nodesVersion
      items.forEach((p, i) => {
        const amount = p.node === undefined ? 1 : (live.nodeAmounts.get(p.node) ?? p.capacity ?? 1)
        let s = p.scale
        if (visibility === 'present' && amount < 1) s = 0
        if (visibility === 'depleted' && amount >= 1) s = 0
        if (visibility === 'threshold' && amount < (p.capacity ?? 1)) s = 0
        if (visibility === 'shrink') s = amount < 1 ? 0 : p.scale * (0.55 + 0.45 * (amount / (p.capacity ?? 1)))
        o.position.set(p.x, p.y, p.z)
        o.rotation.set(0, p.rotY, 0)
        o.scale.setScalar(Math.max(s, 1e-4))
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      })
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    if (v.fog !== live.discoveredVersion) {
      v.fog = live.discoveredVersion
      items.forEach((p, i) => m.setColorAt(i, fogTint(c.set(p.color).lerp(white, tint), live.discovered.has(p.tile))))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })

  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadow} receiveShadow />
}

// Geometry: every piece sits on y = 0 so instances drop straight onto a tile.
const GEO = {
  trunk: new CylinderGeometry(0.045, 0.068, 0.3, 5).translate(0, 0.15, 0),
  stump: new CylinderGeometry(0.06, 0.075, 0.08, 6).translate(0, 0.04, 0),
  pine1: new ConeGeometry(0.34, 0.46, 7).translate(0, 0.39, 0),
  pine2: new ConeGeometry(0.26, 0.4, 7).translate(0, 0.61, 0),
  pine3: new ConeGeometry(0.17, 0.32, 7).translate(0, 0.81, 0),
  roundTrunk: new CylinderGeometry(0.05, 0.078, 0.44, 6).translate(0, 0.22, 0),
  canopy: mergeGeometries([
    new IcosahedronGeometry(0.34, 0).translate(0, 0.64, 0),
    new IcosahedronGeometry(0.22, 0).translate(0.16, 0.84, 0.05),
    new IcosahedronGeometry(0.2, 0).translate(-0.15, 0.78, -0.08),
  ]),
  rock: new DodecahedronGeometry(0.2, 0).scale(1, 0.62, 1).translate(0, 0.07, 0),
  bush: mergeGeometries([
    new IcosahedronGeometry(0.2, 0).scale(1, 0.78, 1).translate(0, 0.13, 0),
    new IcosahedronGeometry(0.14, 0).translate(0.13, 0.1, 0.06),
  ]),
  berry: new SphereGeometry(0.03, 6, 5),
  flowerHead: new OctahedronGeometry(0.036, 0).translate(0, 0.085, 0),
  stem: new CylinderGeometry(0.006, 0.006, 0.08, 3).translate(0, 0.04, 0),
  grass: mergeGeometries(
    [-0.5, 0, 0.55].map((tilt, i) =>
      new ConeGeometry(0.028, 0.15 - i * 0.015, 3)
        .translate(0, 0.075, 0)
        .rotateZ(tilt * 0.5)
        .translate(i * 0.03 - 0.03, 0, i % 2 ? 0.02 : -0.01),
    ),
  ),
}

const MAT = {
  trunk: new MeshStandardMaterial({ flatShading: true, roughness: 1 }),
  pine: windMaterial({}, 0.05, 0.25),
  canopy: windMaterial({}, 0.045, 0.4),
  rock: new MeshStandardMaterial({ flatShading: true, roughness: 0.95 }),
  bush: windMaterial({}, 0.06, 0.05),
  berry: new MeshStandardMaterial({ roughness: 0.4 }),
  flower: windMaterial({ roughness: 0.6 }, 0.35, 0),
  stem: windMaterial({}, 0.35, 0),
  grass: windMaterial({}, 0.5, 0),
}

const fromNode = (n: NodeData, color = n.color): Item => ({
  x: n.x, y: n.y, z: n.z, scale: n.scale, rotY: n.rot, color, tile: n.tile, node: n.id, capacity: n.capacity,
})

export function Props({ world }: { world: WorldData }) {
  const sets = useMemo(() => {
    const pines = world.nodes.filter((n) => n.kind === 'pine')
    const trees = world.nodes.filter((n) => n.kind === 'tree')
    const bushes = world.nodes.filter((n) => n.kind === 'bush')
    const rocks = world.nodes.filter((n) => n.kind === 'rock')
    const rng = mulberry32(404)
    // Each berry is its own "node view": berry k is shown while the bush holds more than k food.
    const berries: Item[] = bushes.flatMap((b) =>
      Array.from({ length: 4 }, (_, k) => {
        const a = rng() * Math.PI * 2
        return {
          x: b.x + Math.cos(a) * 0.17 * b.scale,
          y: b.y + (0.1 + rng() * 0.1) * b.scale,
          z: b.z + Math.sin(a) * 0.17 * b.scale,
          scale: 1, rotY: 0, color: '#e0364f', tile: b.tile, node: b.id, capacity: k + 1,
        }
      }),
    )
    const decor = buildDecor(world.tiles)
    return {
      pines: pines.map((n) => fromNode(n)),
      pineTrunks: pines.map((n) => fromNode(n, '#7a5236')),
      trees: trees.map((n) => fromNode(n)),
      treeTrunks: trees.map((n) => fromNode(n, '#7a5236')),
      stumps: [...pines, ...trees].map((n) => fromNode(n, '#9a7048')),
      bushes: bushes.map((n) => fromNode(n)),
      rocks: rocks.map((n) => fromNode(n)),
      berries,
      flowers: decor.flowers,
      stems: decor.flowers.map((f) => ({ ...f, color: '#4f9a4a' })),
      grass: decor.grass,
    }
  }, [world])

  useFrame(({ clock }) => {
    wind.value = clock.elapsedTime
  })

  return (
    <group>
      <Layer items={sets.pineTrunks} geometry={GEO.trunk} material={MAT.trunk} visibility="present" />
      <Layer items={sets.pines} geometry={GEO.pine1} material={MAT.pine} visibility="present" />
      <Layer items={sets.pines} geometry={GEO.pine2} material={MAT.pine} tint={0.07} visibility="present" />
      <Layer items={sets.pines} geometry={GEO.pine3} material={MAT.pine} tint={0.14} visibility="present" />
      <Layer items={sets.treeTrunks} geometry={GEO.roundTrunk} material={MAT.trunk} visibility="present" />
      <Layer items={sets.trees} geometry={GEO.canopy} material={MAT.canopy} visibility="present" />
      <Layer items={sets.stumps} geometry={GEO.stump} material={MAT.trunk} visibility="depleted" />
      <Layer items={sets.rocks} geometry={GEO.rock} material={MAT.rock} visibility="shrink" />
      <Layer items={sets.bushes} geometry={GEO.bush} material={MAT.bush} />
      <Layer items={sets.berries} geometry={GEO.berry} material={MAT.berry} shadow={false} visibility="threshold" />
      <Layer items={sets.stems} geometry={GEO.stem} material={MAT.stem} shadow={false} />
      <Layer items={sets.flowers} geometry={GEO.flowerHead} material={MAT.flower} shadow={false} />
      <Layer items={sets.grass} geometry={GEO.grass} material={MAT.grass} shadow={false} />
    </group>
  )
}
