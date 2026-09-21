import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Agents } from '@/agents/Agents'
import { advance } from '@/state/sim'
import { useGame } from '@/state/store'
import { Buildings } from '@/world/Buildings'
import { Campfire } from '@/world/Campfire'
import { Island } from '@/world/Island'
import { Lighting } from '@/world/Lighting'
import { Props } from '@/world/Props'
import { Sky } from '@/world/Sky'
import { Water } from '@/world/Water'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'

function SimClock() {
  useFrame((_, delta) => advance(delta))
  return null
}

export function Scene() {
  const world = useGame((s) => s.world)
  const lowPower = useGame((s) => s.lowPower)
  const setLowPower = useGame((s) => s.setLowPower)
  const setReady = useGame((s) => s.setReady)

  return (
    <Canvas
      className="!absolute inset-0"
      shadows
      dpr={lowPower ? 1 : [1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 32, position: [70, 58, 70], near: 0.1, far: 600 }}
      onCreated={() => setReady()}
    >
      <PerformanceMonitor onDecline={setLowPower} flipflops={2} />
      <SimClock />
      <Sky />
      <Lighting />
      {world && (
        <>
          <Island world={world} />
          <Props world={world} />
          <Water world={world} />
          <Campfire height={world.tiles[world.campTile].h} />
          <Buildings world={world} />
          <Agents />
        </>
      )}
      <CameraRig />
      <Effects />
    </Canvas>
  )
}
