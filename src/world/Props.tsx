import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '@/lib/random'
import { WORLD, type PropInstance } from './generate'

/**
 * Wind: a tiny vertex patch on MeshStandardMaterial. Vertices sway more the higher
 * they sit above the prop's base, phase-shifted by the instance's world position.
 */
const wind = { value: 0 }

function windMaterial(opts: ConstructorParameters<typeof MeshStandardMaterial>[0], strength: number, base = 0) {
  const m = new MeshStandardMaterial({ flatShading: true, roughness: 0.9, ...opts })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
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

function useInstances(items: PropInstance[], tint = 0, extraScale: [number, number, number] = [1, 1, 1]) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    const white = new Color('#ffffff')
    items.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.rotation.set(0, p.rotY, 0)
      o.scale.set(p.scale * extraScale[0], p.scale * extraScale[1], p.scale * extraScale[2])
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(p.color).lerp(white, tint))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, tint, extraScale])
  return ref
}

function Layer({
  items,
  geometry,
  material,
  tint = 0,
  shadow = true,
}: {
  items: PropInstance[]
  geometry: BufferGeometry
  material: MeshStandardMaterial
  tint?: number
  shadow?: boolean
}) {
  const ref = useInstances(items, tint)
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadow} receiveShadow />
}

// Geometry: every piece sits on y = 0 so instances drop straight onto a tile.
const GEO = {
  trunk: new CylinderGeometry(0.045, 0.068, 0.3, 5).translate(0, 0.15, 0),
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
  trunk: new MeshStandardMaterial({ color: '#7a5236', flatShading: true, roughness: 1 }),
  pine: windMaterial({}, 0.05, 0.25),
  canopy: windMaterial({}, 0.045, 0.4),
  rock: new MeshStandardMaterial({ flatShading: true, roughness: 0.95 }),
  bush: windMaterial({}, 0.06, 0.05),
  berry: new MeshStandardMaterial({ color: '#e0364f', roughness: 0.4 }),
  flower: windMaterial({ roughness: 0.6 }, 0.35, 0),
  stem: windMaterial({ color: '#4f9a4a' }, 0.35, 0),
  grass: windMaterial({}, 0.5, 0),
}

export function Props() {
  const trunks = useMemo(() => [...WORLD.pines], [])
  const roundTrunks = useMemo(() => WORLD.roundTrees.map((t) => ({ ...t, color: '#7a5236' })), [])
  const berries = useMemo(() => {
    const rng = mulberry32(404)
    return WORLD.bushes.flatMap((b) =>
      Array.from({ length: 5 }, () => {
        const a = rng() * Math.PI * 2
        return { x: b.x + Math.cos(a) * 0.17 * b.scale, y: b.y + (0.1 + rng() * 0.1) * b.scale, z: b.z + Math.sin(a) * 0.17 * b.scale, scale: 1, rotY: 0, color: '#e0364f' }
      }),
    )
  }, [])
  const stems = useMemo(() => WORLD.flowers.map((f) => ({ ...f, color: '#4f9a4a' })), [])

  useFrame(({ clock }) => {
    wind.value = clock.elapsedTime
  })

  return (
    <group>
      <Layer items={trunks} geometry={GEO.trunk} material={MAT.trunk} />
      <Layer items={WORLD.pines} geometry={GEO.pine1} material={MAT.pine} />
      <Layer items={WORLD.pines} geometry={GEO.pine2} material={MAT.pine} tint={0.07} />
      <Layer items={WORLD.pines} geometry={GEO.pine3} material={MAT.pine} tint={0.14} />
      <Layer items={roundTrunks} geometry={GEO.roundTrunk} material={MAT.trunk} />
      <Layer items={WORLD.roundTrees} geometry={GEO.canopy} material={MAT.canopy} />
      <Layer items={WORLD.rocks} geometry={GEO.rock} material={MAT.rock} />
      <Layer items={WORLD.bushes} geometry={GEO.bush} material={MAT.bush} />
      <Layer items={berries} geometry={GEO.berry} material={MAT.berry} shadow={false} />
      <Layer items={stems} geometry={GEO.stem} material={MAT.stem} shadow={false} />
      <Layer items={WORLD.flowers} geometry={GEO.flowerHead} material={MAT.flower} shadow={false} />
      <Layer items={WORLD.grass} geometry={GEO.grass} material={MAT.grass} shadow={false} />
    </group>
  )
}
