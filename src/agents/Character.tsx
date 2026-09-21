import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { sim } from '@/state/sim'
import { useGame } from '@/state/store'
import type { AgentDef } from './roster'
import type { Walker } from './walker'

/* Shared geometry — built once, reused by all six characters. */
const G = {
  leg: new CapsuleGeometry(0.042, 0.075, 4, 10),
  shoe: new SphereGeometry(0.048, 12, 8),
  torso: new CapsuleGeometry(0.09, 0.08, 6, 14),
  dress: new CylinderGeometry(0.086, 0.14, 0.16, 18),
  arm: new CapsuleGeometry(0.032, 0.09, 4, 8),
  hand: new SphereGeometry(0.036, 10, 8),
  head: new SphereGeometry(0.13, 28, 20),
  eye: new SphereGeometry(0.019, 12, 8),
  glint: new SphereGeometry(0.0068, 6, 4),
  blush: new SphereGeometry(0.024, 10, 8),
  mouth: new TorusGeometry(0.022, 0.0058, 6, 14, Math.PI),
  hairCap: new SphereGeometry(0.139, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  hairBack: new SphereGeometry(0.134, 22, 14),
  ball: new SphereGeometry(1, 14, 10),
  domeHat: new SphereGeometry(0.148, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  brim: new CylinderGeometry(0.168, 0.168, 0.014, 30),
  strawBrim: new CylinderGeometry(0.25, 0.25, 0.016, 30),
  strawCrown: new CylinderGeometry(0.118, 0.138, 0.09, 22),
  strawBand: new CylinderGeometry(0.141, 0.141, 0.026, 22),
  visor: new CylinderGeometry(0.1, 0.1, 0.012, 20, 1, false, -Math.PI / 2, Math.PI),
  beanie: new SphereGeometry(0.143, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  beanieBand: new TorusGeometry(0.14, 0.022, 8, 28),
  beard: new SphereGeometry(0.105, 20, 14),
  mustache: new CapsuleGeometry(0.014, 0.05, 4, 8),
  strap: new TorusGeometry(0.134, 0.011, 6, 36),
  lens: new CylinderGeometry(0.032, 0.032, 0.026, 18),
  lensRim: new TorusGeometry(0.033, 0.008, 6, 18),
  ponyTail: new CapsuleGeometry(0.042, 0.12, 6, 10),
  tie: new TorusGeometry(0.03, 0.01, 6, 14),
  belt: new TorusGeometry(0.092, 0.017, 6, 26),
  pack: new BoxGeometry(0.15, 0.17, 0.08),
  bedroll: new CylinderGeometry(0.036, 0.036, 0.17, 12),
  handle: new CylinderGeometry(0.012, 0.012, 0.32, 6),
  axeHead: new BoxGeometry(0.075, 0.055, 0.016),
  tablet: new BoxGeometry(0.1, 0.072, 0.008),
  screen: new BoxGeometry(0.086, 0.058, 0.002),
  holo: new IcosahedronGeometry(0.045, 0),
  ring: new RingGeometry(0.21, 0.255, 44),
  hitbox: new CylinderGeometry(0.22, 0.22, 0.75, 8),
}

const M = {
  eye: new MeshStandardMaterial({ color: '#15131f', roughness: 0.25 }),
  glint: new MeshBasicMaterial({ color: '#ffffff' }),
  blush: new MeshStandardMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.55, roughness: 1 }),
  mouth: new MeshStandardMaterial({ color: '#5a2a2a', roughness: 0.8 }),
  shoe: new MeshStandardMaterial({ color: '#2a2530', roughness: 0.8 }),
  metal: new MeshStandardMaterial({ color: '#c7ccd6', metalness: 0.7, roughness: 0.3 }),
  wood: new MeshStandardMaterial({ color: '#8a5a36', roughness: 0.9 }),
  leather: new MeshStandardMaterial({ color: '#7a4e32', roughness: 0.85 }),
  straw: new MeshStandardMaterial({ color: '#e9c46a', roughness: 0.95 }),
  hardhat: new MeshStandardMaterial({ color: '#ffc93c', roughness: 0.35 }),
  strap: new MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.7 }),
  lens: new MeshStandardMaterial({ color: '#8ff0ff', emissive: '#39b9ff', emissiveIntensity: 1.6, toneMapped: false }),
  tabletBody: new MeshStandardMaterial({ color: '#23263a', roughness: 0.4, metalness: 0.3 }),
  screen: new MeshBasicMaterial({ color: '#9df2ff', toneMapped: false }),
  holo: new MeshBasicMaterial({ color: '#9df2ff', wireframe: true, toneMapped: false, transparent: true, opacity: 0.9 }),
  hitbox: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  bedroll: new MeshStandardMaterial({ color: '#3fa7a0', roughness: 0.8 }),
  ribbon: new MeshStandardMaterial({ color: '#d9534f', roughness: 0.6 }),
  beanie: new MeshStandardMaterial({ color: '#c0392b', roughness: 0.9 }),
  beanieBand: new MeshStandardMaterial({ color: '#a93226', roughness: 0.9 }),
  pompom: new MeshStandardMaterial({ color: '#f4efe6', roughness: 1 }),
}

const std = (color: string, roughness = 0.75) => new MeshStandardMaterial({ color, roughness })

interface Props {
  def: AgentDef
  walker: Walker
  seed: number
}

export function Character({ def, walker, seed }: Props) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const holo = useRef<Mesh>(null)
  const anim = useRef({ phase: seed, walk: 0, rest: 0, idle: seed * 3 })

  const mat = useMemo(
    () => ({
      skin: std(def.skin, 0.6),
      shirt: std(def.color, 0.7),
      pants: std(def.pants, 0.8),
      hair: std(def.hair, 0.55),
      ring: new MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, toneMapped: false, side: DoubleSide, depthWrite: false }),
    }),
    [def],
  )

  const toggleSelect = useGame((s) => s.toggleSelect)
  const hover = useGame((s) => s.hover)

  useFrame(({ clock }) => {
    const dt = sim.dt
    const a = anim.current
    const g = root.current
    if (!g || !body.current || !head.current || !legL.current || !legR.current || !armL.current || !armR.current) return

    g.position.copy(walker.position)
    g.rotation.y = walker.yaw

    const k = 1 - Math.exp(-7 * dt)
    a.walk += ((walker.mode === 'walk' ? 1 : 0) - a.walk) * k
    a.rest += ((walker.mode === 'rest' ? 1 : 0) - a.rest) * k
    a.phase += dt * 9.5 * a.walk
    a.idle += dt

    const swing = Math.sin(a.phase) * 0.7 * a.walk
    const stand = 1 - a.rest
    legL.current.rotation.x = swing * stand - 1.4 * a.rest
    legR.current.rotation.x = -swing * stand - 1.4 * a.rest
    armL.current.rotation.x = -swing * 0.85 - 0.55 * a.rest
    armR.current.rotation.x = swing * 0.85 - 0.55 * a.rest

    const breathe = Math.sin(a.idle * 2.1) * 0.006 * (1 - a.walk)
    body.current.position.y = Math.abs(Math.cos(a.phase)) * 0.026 * a.walk - a.rest * 0.125 + breathe
    body.current.rotation.x = 0.09 * a.walk
    head.current.rotation.y = Math.sin(a.idle * 0.55) * 0.4 * (1 - a.walk)
    head.current.rotation.x = Math.sin(a.idle * 0.8) * 0.05 + a.rest * 0.12

    if (holo.current) {
      holo.current.rotation.y += dt * 1.6
      holo.current.position.y = -0.24 + Math.sin(clock.elapsedTime * 2) * 0.012
    }

    if (ring.current) {
      const { selectedId, hoveredId } = useGame.getState()
      const selected = selectedId === def.id
      const target = selected ? 0.95 : hoveredId === def.id ? 0.7 : 0.18 * sim.night
      mat.ring.opacity += (target - mat.ring.opacity) * 0.15
      const pulse = selected ? 1 + Math.sin(clock.elapsedTime * 4) * 0.06 : 1
      ring.current.scale.setScalar(pulse)
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hover(def.id)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    hover(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    toggleSelect(def.id)
  }

  const female = def.gender === 'female'

  return (
    <group ref={root}>
      <mesh
        geometry={G.hitbox}
        material={M.hitbox}
        position={[0, 0.37, 0]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      />
      <mesh ref={ring} geometry={G.ring} material={mat.ring} rotation-x={-Math.PI / 2} position-y={0.015} />

      <group ref={body}>
        {/* Legs pivot at the hip so they can swing and fold for sitting. */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.05, 0.16, 0]}>
            <mesh geometry={G.leg} material={mat.pants} position-y={-0.078} castShadow />
            <mesh geometry={G.shoe} material={M.shoe} position={[0, -0.152, 0.018]} scale={[1, 0.6, 1.35]} castShadow />
          </group>
        ))}

        <mesh geometry={G.torso} material={mat.shirt} position-y={0.285} scale={[1, 1, 0.86]} castShadow />
        {female && <mesh geometry={G.dress} material={mat.shirt} position-y={0.205} castShadow />}
        {def.look === 'hardhat' && <mesh geometry={G.belt} material={M.leather} position-y={0.2} rotation-x={Math.PI / 2} />}

        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.118, 0.372, 0]} rotation-z={side * 0.14}>
            <mesh geometry={G.arm} material={mat.shirt} position-y={-0.072} castShadow />
            <mesh geometry={G.hand} material={mat.skin} position-y={-0.152} />
            {def.look === 'ponytail' && side > 0 && (
              <group position={[0, -0.17, 0.05]} rotation-x={-1.05}>
                <mesh geometry={G.tablet} material={M.tabletBody} />
                <mesh geometry={G.screen} material={M.screen} position-z={0.005} />
                <mesh ref={holo} geometry={G.holo} material={M.holo} position={[0, -0.24, 0.06]} rotation-x={1.05} />
              </group>
            )}
          </group>
        ))}

        {/* Back gear */}
        {def.look === 'cap-backpack' && (
          <group position={[0, 0.3, -0.118]}>
            <mesh geometry={G.pack} material={M.leather} castShadow />
            <mesh geometry={G.bedroll} material={M.bedroll} position-y={0.1} rotation-z={Math.PI / 2} castShadow />
          </group>
        )}
        {def.look === 'beanie-beard' && (
          <group position={[0, 0.31, -0.105]} rotation-z={0.6}>
            <mesh geometry={G.handle} material={M.wood} castShadow />
            <mesh geometry={G.axeHead} material={M.metal} position={[0.035, 0.13, 0]} castShadow />
          </group>
        )}

        <group ref={head} position-y={0.53}>
          <mesh geometry={G.head} material={mat.skin} castShadow />
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh geometry={G.eye} material={M.eye} position={[side * 0.047, 0.004, 0.118]} scale={[1, 1.25, 0.6]} />
              <mesh geometry={G.glint} material={M.glint} position={[side * 0.047 + 0.006, 0.013, 0.128]} />
              <mesh geometry={G.blush} material={M.blush} position={[side * 0.073, -0.03, 0.098]} scale={[1, 0.6, 0.35]} />
            </group>
          ))}
          {def.look !== 'beanie-beard' && (
            <mesh geometry={G.mouth} material={M.mouth} position={[0, -0.045, 0.121]} rotation-z={Math.PI} />
          )}
          <Hair def={def} hair={mat.hair} shirt={mat.shirt} />
        </group>
      </group>

      <NameTag def={def} />
    </group>
  )
}

function Hair({ def, hair, shirt }: { def: AgentDef; hair: MeshStandardMaterial; shirt: MeshStandardMaterial }) {
  const longBack = def.gender === 'female'
  const back = (
    <mesh
      geometry={G.hairBack}
      material={hair}
      position={[0, longBack ? -0.012 : 0.012, -0.03]}
      scale={[1, longBack ? 0.92 : 0.8, 0.92]}
      castShadow
    />
  )
  const cap = <mesh geometry={G.hairCap} material={hair} position-y={0.005} rotation-x={-0.35} castShadow />

  switch (def.look) {
    case 'ponytail':
      return (
        <>
          {cap}
          {back}
          <mesh geometry={G.ball} material={hair} position={[0, 0.06, -0.148]} scale={0.056} castShadow />
          <mesh geometry={G.tie} material={shirt} position={[0, 0.03, -0.158]} rotation-x={0.3} />
          <mesh geometry={G.ponyTail} material={hair} position={[0, -0.055, -0.178]} rotation-x={0.28} castShadow />
        </>
      )
    case 'braid-hat':
      return (
        <>
          {cap}
          {back}
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              geometry={G.ball}
              material={hair}
              position={[0.1 + i * 0.006, -0.1 - i * 0.058, 0.02 + i * 0.016]}
              scale={0.036 - i * 0.003}
              castShadow
            />
          ))}
          <mesh geometry={G.tie} material={shirt} position={[0.114, -0.245, 0.054]} rotation-x={Math.PI / 2} scale={0.8} />
          <group position-y={0.085} rotation-x={-0.1}>
            <mesh geometry={G.strawBrim} material={M.straw} castShadow />
            <mesh geometry={G.strawCrown} material={M.straw} position-y={0.05} castShadow />
            <mesh geometry={G.strawBand} material={M.ribbon} position-y={0.02} />
          </group>
        </>
      )
    case 'hardhat':
      return (
        <>
          {back}
          <group rotation-x={-0.12} position-y={0.018}>
            <mesh geometry={G.domeHat} material={M.hardhat} castShadow />
            <mesh geometry={G.brim} material={M.hardhat} position-y={0.004} castShadow />
          </group>
        </>
      )
    case 'beanie-beard':
      return (
        <>
          {back}
          <group rotation-x={-0.3} position-y={0.012}>
            <mesh geometry={G.beanie} material={M.beanie} castShadow />
            <mesh geometry={G.beanieBand} material={M.beanieBand} position-y={-0.012} rotation-x={Math.PI / 2} />
            <mesh geometry={G.ball} material={M.pompom} position-y={0.158} scale={0.034} castShadow />
          </group>
          <mesh geometry={G.beard} material={hair} position={[0, -0.07, 0.045]} scale={[1.12, 0.78, 0.8]} castShadow />
          <mesh geometry={G.mustache} material={hair} position={[0, -0.028, 0.124]} rotation-z={Math.PI / 2} />
        </>
      )
    case 'goggles':
      return (
        <>
          {cap}
          {back}
          <mesh geometry={G.strap} material={M.strap} position-y={0.05} rotation-x={Math.PI / 2 - 0.25} />
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.046, 0.078, 0.102]} rotation-x={Math.PI / 2 - 0.55}>
              <mesh geometry={G.lens} material={M.lens} />
              <mesh geometry={G.lensRim} material={M.strap} rotation-x={Math.PI / 2} position-y={0.012} />
            </group>
          ))}
        </>
      )
    case 'cap-backpack':
      return (
        <>
          {back}
          <group rotation-x={-0.15} position-y={0.02}>
            <mesh geometry={G.domeHat} material={shirt} castShadow />
            <mesh geometry={G.visor} material={shirt} position={[0, 0.006, 0.1]} castShadow />
          </group>
        </>
      )
  }
}

const ACTIVITY_LABEL = { idle: 'idle', walking: 'exploring', resting: 'resting' } as const

function NameTag({ def }: { def: AgentDef }) {
  const activity = useGame((s) => s.activity[def.id] ?? 'idle')
  const focused = useGame((s) => s.selectedId === def.id || s.hoveredId === def.id)

  return (
    <Html position={[0, 0.98, 0]} center distanceFactor={9} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className="tag-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap text-white transition-transform duration-300"
        style={{ transform: `scale(${focused ? 1.12 : 1})`, boxShadow: focused ? `0 0 0 1px ${def.color}, 0 0 18px ${def.color}66` : undefined }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: def.color, boxShadow: `0 0 8px ${def.color}` }} />
        {def.name}
        <span className="font-medium text-white/55">{focused ? def.role : ACTIVITY_LABEL[activity]}</span>
      </div>
    </Html>
  )
}
