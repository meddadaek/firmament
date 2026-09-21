import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { poses } from '@/state/sim'
import { useGame } from '@/state/store'

const HOME = new Vector3(0, 0.4, 0)
const OVERVIEW_DISTANCE = 46
const FOLLOW_DISTANCE = 9

const goal = new Vector3()
const before = new Vector3()
const offset = new Vector3()

/**
 * Orbit camera with three jobs: a cinematic fly-in on load, a slow idle drift,
 * and following a selected agent while keeping whatever angle the player chose.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const state = useRef({ intro: 0, lastTouch: -100, zoomUntil: 0, zoomTo: OVERVIEW_DISTANCE })
  const selectedId = useGame((s) => s.selectedId)

  useEffect(() => {
    const s = state.current
    s.zoomUntil = performance.now() / 1000 + 1.8
    s.zoomTo = selectedId ? FOLLOW_DISTANCE : Math.max(OVERVIEW_DISTANCE * 0.8, camera.position.distanceTo(HOME))
  }, [selectedId, camera])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    const s = state.current
    const now = performance.now() / 1000
    const dt = Math.min(delta, 0.1)

    // Fly-in: dolly from far away down to the overview distance.
    if (s.intro < 1) {
      s.intro = Math.min(1, s.intro + dt / 3.4)
      const e = 1 - Math.pow(1 - s.intro, 3)
      offset.copy(camera.position).sub(c.target).normalize()
      camera.position.copy(c.target).addScaledVector(offset, 120 + (OVERVIEW_DISTANCE - 120) * e)
    }

    const id = useGame.getState().selectedId
    const pose = id ? poses.get(id) : undefined
    goal.copy(pose ? pose.position : HOME)
    if (pose) goal.y += 0.35

    // Move the target and drag the camera along by the same amount, so the view angle is preserved.
    before.copy(c.target)
    c.target.lerp(goal, 1 - Math.exp(-4.5 * dt))
    camera.position.add(before.sub(c.target).negate())

    if (now < s.zoomUntil && s.intro >= 1) {
      offset.copy(camera.position).sub(c.target)
      const d = offset.length()
      offset.setLength(d + (s.zoomTo - d) * (1 - Math.exp(-3 * dt)))
      camera.position.copy(c.target).add(offset)
    }

    c.autoRotate = !id && now - s.lastTouch > 9 && s.intro >= 1
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[HOME.x, HOME.y, HOME.z]}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={5}
      maxDistance={85}
      minPolarAngle={0.2}
      maxPolarAngle={1.52}
      autoRotateSpeed={0.35}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      onStart={() => {
        state.current.lastTouch = performance.now() / 1000
        state.current.intro = 1
        state.current.zoomUntil = 0
      }}
      onEnd={() => {
        state.current.lastTouch = performance.now() / 1000
      }}
    />
  )
}
