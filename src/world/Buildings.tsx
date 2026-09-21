import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
} from 'three'
import type { BuildingState, TileData, WorldData } from '@/net/types'
import { sim } from '@/state/sim'
import { useGame } from '@/state/store'

/** Triangular prism along X with its ridge on top — the roof shape for boxy buildings. */
const prism = (r: number, length: number, squash: number) =>
  new CylinderGeometry(r, r, length, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, squash, 1)

const GEO = {
  hutWall: new CylinderGeometry(0.42, 0.46, 0.4, 8).translate(0, 0.2, 0),
  hutRoof: new ConeGeometry(0.62, 0.5, 8).translate(0, 0.64, 0),
  door: new BoxGeometry(0.16, 0.26, 0.04),
  window: new BoxGeometry(0.12, 0.1, 0.03),
  soil: new CylinderGeometry(0.86, 0.9, 0.07, 6).translate(0, 0.035, 0),
  row: new BoxGeometry(1.1, 0.03, 0.08),
  crop: new ConeGeometry(0.05, 0.18, 5).translate(0, 0.09, 0),
  post: new CylinderGeometry(0.022, 0.026, 0.22, 5).translate(0, 0.11, 0),
  wsBody: new BoxGeometry(0.85, 0.46, 0.62).translate(0, 0.23, 0),
  wsRoof: prism(0.42, 0.95, 0.72),
  chimney: new BoxGeometry(0.1, 0.32, 0.1),
  furnace: new BoxGeometry(0.2, 0.14, 0.02),
  anvil: new BoxGeometry(0.16, 0.08, 0.09),
  houseBody: new BoxGeometry(0.78, 0.62, 0.64).translate(0, 0.31, 0),
  band: new BoxGeometry(0.8, 0.05, 0.66),
  houseRoof: prism(0.44, 0.9, 0.82),
  hallBody: new BoxGeometry(1.15, 0.5, 0.82).translate(0, 0.25, 0),
  hallRoof: prism(0.5, 1.25, 0.62),
  tower: new BoxGeometry(0.34, 0.85, 0.34).translate(0, 0.425, 0),
  spire: new ConeGeometry(0.3, 0.46, 4).rotateY(Math.PI / 4),
  pole: new CylinderGeometry(0.012, 0.012, 0.42, 5),
  flag: new BoxGeometry(0.26, 0.14, 0.01),
  column: new CylinderGeometry(0.04, 0.045, 0.5, 8).translate(0, 0.25, 0),
  step: new BoxGeometry(0.6, 0.05, 0.14),
  blueprint: new RingGeometry(0.72, 0.82, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6),
  stake: new CylinderGeometry(0.018, 0.018, 0.3, 4).translate(0, 0.15, 0),
  scaffold: new CylinderGeometry(0.018, 0.018, 1, 4).translate(0, 0.5, 0),
  smoke: new SphereGeometry(0.06, 8, 6),
}

const std = (color: string, roughness = 0.85) => new MeshStandardMaterial({ color, roughness, flatShading: true })
const MAT = {
  wall: std('#c89b6d'),
  thatch: std('#d9b25f', 0.95),
  plaster: std('#efe3cf'),
  roofRed: std('#c0533f'),
  roofBlue: std('#3d5a99'),
  stone: std('#b9b2a4'),
  hall: std('#e3dccb'),
  wood: std('#8a5a36'),
  darkWood: std('#6d4428'),
  door: std('#4a3424'),
  soil: std('#7a5230', 1),
  furrow: std('#5e3d22', 1),
  metal: new MeshStandardMaterial({ color: '#50545e', metalness: 0.6, roughness: 0.4 }),
  window: new MeshStandardMaterial({ color: '#ffe6a8', emissive: '#ffb347', emissiveIntensity: 0.2, toneMapped: false }),
  furnace: new MeshStandardMaterial({ color: '#ff9a4a', emissive: '#ff6a1f', emissiveIntensity: 1.2, toneMapped: false }),
  blueprint: new MeshBasicMaterial({ color: '#9df2ff', transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
  scaffold: std('#b5895a'),
  flag: std('#8b7bff', 0.6),
  smoke: new MeshStandardMaterial({ color: '#eef0f6', transparent: true, opacity: 0.5, roughness: 1, depthWrite: false }),
}

const CROP_YOUNG = new Color('#7fd36b')
const CROP_RIPE = new Color('#f2c14e')

function Windows({ spots }: { spots: [number, number, number][] }) {
  return (
    <>
      {spots.map((p, i) => (
        <mesh key={i} geometry={GEO.window} material={MAT.window} position={p} />
      ))}
    </>
  )
}

function Smoke({ at }: { at: [number, number, number] }) {
  const puffs = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = puffs.current
    if (!g) return
    g.children.forEach((c, i) => {
      const life = (clock.elapsedTime * 0.35 + i / g.children.length) % 1
      c.position.set(Math.sin(life * 5 + i) * 0.05, life * 0.7, life * 0.12)
      c.scale.setScalar(0.6 + life * 1.6)
    })
    MAT.smoke.opacity = 0.35
  })
  return (
    <group ref={puffs} position={at}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={GEO.smoke} material={MAT.smoke} />
      ))}
    </group>
  )
}

function Hut() {
  return (
    <>
      <mesh geometry={GEO.hutWall} material={MAT.wall} castShadow receiveShadow />
      <mesh geometry={GEO.hutRoof} material={MAT.thatch} castShadow />
      <mesh geometry={GEO.door} material={MAT.door} position={[0, 0.13, 0.435]} />
      <Windows spots={[[0.3, 0.26, 0.31], [-0.3, 0.26, 0.31]]} />
    </>
  )
}

function Farm({ crop }: { crop: number }) {
  const crops = useRef<InstancedMesh>(null)
  const mat = useMemo(() => std('#7fd36b', 0.8), [])
  const spots = useMemo(() => {
    const out: [number, number][] = []
    for (const z of [-0.3, 0, 0.3]) for (let x = -0.45; x <= 0.451; x += 0.15) out.push([x, z])
    return out
  }, [])

  useFrame(() => {
    const m = crops.current
    if (!m) return
    const planted = crop >= 0
    const grow = planted ? 0.25 + Math.min(crop, 1) * 0.75 : 0
    const o = new Object3D()
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0.07, z)
      o.scale.setScalar(Math.max(grow, 1e-4))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    mat.color.copy(CROP_YOUNG).lerp(CROP_RIPE, Math.max(0, crop))
  })

  return (
    <>
      <mesh geometry={GEO.soil} material={MAT.soil} receiveShadow />
      {[-0.3, 0, 0.3].map((z) => (
        <mesh key={z} geometry={GEO.row} material={MAT.furrow} position={[0, 0.075, z]} />
      ))}
      <instancedMesh ref={crops} args={[GEO.crop, mat, spots.length]} castShadow />
      {Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI / 2 + (k * Math.PI) / 3
        return <mesh key={k} geometry={GEO.post} material={MAT.wood} position={[Math.cos(a) * 0.84, 0.05, Math.sin(a) * 0.84]} castShadow />
      })}
    </>
  )
}

function Workshop({ done }: { done: boolean }) {
  return (
    <>
      <mesh geometry={GEO.wsBody} material={MAT.stone} castShadow receiveShadow />
      <mesh geometry={GEO.wsRoof} material={MAT.darkWood} position-y={0.46 + 0.21 * 0.72} castShadow />
      <mesh geometry={GEO.chimney} material={MAT.stone} position={[0.25, 0.8, -0.12]} castShadow />
      <mesh geometry={GEO.furnace} material={MAT.furnace} position={[0.2, 0.14, 0.315]} />
      <mesh geometry={GEO.door} material={MAT.door} position={[-0.18, 0.13, 0.315]} />
      <mesh geometry={GEO.anvil} material={MAT.metal} position={[-0.3, 0.04, 0.5]} castShadow />
      {done && <Smoke at={[0.25, 0.98, -0.12]} />}
    </>
  )
}

function House({ done }: { done: boolean }) {
  return (
    <>
      <mesh geometry={GEO.houseBody} material={MAT.plaster} castShadow receiveShadow />
      <mesh geometry={GEO.band} material={MAT.wood} position-y={0.33} />
      <mesh geometry={GEO.houseRoof} material={MAT.roofRed} position-y={0.62 + 0.22 * 0.82} castShadow />
      <mesh geometry={GEO.chimney} material={MAT.stone} position={[-0.22, 0.98, 0.08]} castShadow />
      <mesh geometry={GEO.door} material={MAT.door} position={[0, 0.13, 0.325]} />
      <Windows spots={[[0.24, 0.45, 0.325], [-0.24, 0.45, 0.325], [0.24, 0.45, -0.325], [-0.24, 0.45, -0.325], [0.24, 0.16, 0.325]]} />
      {done && <Smoke at={[-0.22, 1.16, 0.08]} />}
    </>
  )
}

function TownHall() {
  const flag = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.35
  })
  return (
    <>
      <mesh geometry={GEO.hallBody} material={MAT.hall} castShadow receiveShadow />
      <mesh geometry={GEO.hallRoof} material={MAT.roofBlue} position-y={0.5 + 0.25 * 0.62} castShadow />
      <mesh geometry={GEO.tower} material={MAT.hall} position-y={0.45} castShadow />
      <mesh geometry={GEO.spire} material={MAT.roofBlue} position-y={1.53} castShadow />
      <mesh geometry={GEO.pole} material={MAT.metal} position-y={1.95} />
      <group ref={flag} position={[0, 2.07, 0]}>
        <mesh geometry={GEO.flag} material={MAT.flag} position-x={0.13} />
      </group>
      {[-0.42, -0.18, 0.18, 0.42].map((x) => (
        <mesh key={x} geometry={GEO.column} material={MAT.hall} position={[x, 0, 0.46]} castShadow />
      ))}
      <mesh geometry={GEO.step} material={MAT.stone} position={[0, 0.025, 0.5]} />
      <mesh geometry={GEO.door} material={MAT.door} position={[0, 0.14, 0.415]} scale={[1.3, 1.1, 1]} />
      <Windows spots={[[0.36, 0.3, 0.415], [-0.36, 0.3, 0.415], [0, 0.66, 0.175], [0.36, 0.3, -0.415], [-0.36, 0.3, -0.415]]} />
    </>
  )
}

function Model({ kind, crop, done }: { kind: string; crop: number; done: boolean }) {
  switch (kind) {
    case 'hut':
      return <Hut />
    case 'farm':
      return <Farm crop={crop} />
    case 'workshop':
      return <Workshop done={done} />
    case 'house':
      return <House done={done} />
    case 'townhall':
      return <TownHall />
    default:
      return null
  }
}

function Label({ text, progress }: { text: string; progress?: number }) {
  return (
    <Html position={[0, 1.55, 0]} center distanceFactor={11} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag-pill min-w-28 rounded-xl px-2.5 py-1.5 text-center text-[11px] leading-tight font-semibold whitespace-nowrap text-white">
        {text}
        {progress !== undefined && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-gradient-to-r from-aura to-violet" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    </Html>
  )
}

function BuildingView({ b, tile, name, missing }: { b: BuildingState; tile: TileData; name: string; missing: string }) {
  const body = useRef<Group>(null)
  const yaw = Math.round(Math.atan2(-tile.x, -tile.z) / (Math.PI / 3)) * (Math.PI / 3)
  const target = b.state === 'done' ? 1 : b.state === 'building' ? 0.06 + b.progress * 0.94 : 0

  useFrame((_, delta) => {
    const g = body.current
    if (!g) return
    g.scale.y += (target - g.scale.y) * (1 - Math.exp(-6 * delta))
    g.visible = g.scale.y > 0.01
  })

  return (
    <group position={[tile.x, tile.h, tile.z]} rotation-y={yaw}>
      {b.state !== 'done' && (
        <>
          <mesh geometry={GEO.blueprint} material={MAT.blueprint} position-y={0.02} />
          {[0, 2, 4].map((k) => {
            const a = Math.PI / 2 + (k * Math.PI) / 3
            return <mesh key={k} geometry={GEO.stake} material={MAT.wood} position={[Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74]} />
          })}
        </>
      )}
      {b.state === 'building' &&
        [[-0.46, -0.38], [0.46, -0.38], [-0.46, 0.38], [0.46, 0.38]].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={GEO.scaffold} material={MAT.scaffold} position={[x, 0, z]} scale={[1, 0.25 + b.progress * 0.9, 1]} castShadow />
        ))}
      <group ref={body} scale={[1, 0, 1]}>
        <Model kind={b.kind} crop={b.crop} done={b.state === 'done'} />
      </group>
      {b.state === 'planned' && <Label text={`${name} · needs ${missing}`} />}
      {b.state === 'building' && <Label text={`${name} · ${Math.round(b.progress * 100)}%`} progress={b.progress} />}
    </group>
  )
}

export function Buildings({ world }: { world: WorldData }) {
  const buildings = useGame((s) => s.buildings)
  const stock = useGame((s) => s.stock)

  useFrame(() => {
    MAT.window.emissiveIntensity = 0.15 + sim.night * 2.4
    MAT.blueprint.opacity = 0.35 + Math.sin(performance.now() / 400) * 0.2
  })

  return (
    <>
      {buildings.map((b) => {
        const bp = world.blueprints[b.kind]
        const missing = Object.entries(bp.cost)
          .map(([k, v]) => [k, Math.max(0, (v ?? 0) - stock[k as keyof typeof stock])] as const)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${v} ${k}`)
          .join(', ')
        return <BuildingView key={b.id} b={b} tile={world.tiles[b.tile]} name={bp.name} missing={missing || 'materials'} />
      })}
    </>
  )
}
