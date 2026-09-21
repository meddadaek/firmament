import { useFrame } from '@react-three/fiber'
import { poses, sim } from '@/state/sim'
import { useGame, type Activity } from '@/state/store'
import { WORLD } from '@/world/generate'
import { Character } from './Character'
import { AGENTS } from './roster'
import { Walker } from './walker'

// One walker per agent, created once at module load so React re-renders never reset them.
const walkers = AGENTS.map((_, i) => new Walker(WORLD.homeTiles[i], 1000 + i * 97))
const last: Activity[] = AGENTS.map(() => 'idle')

AGENTS.forEach((a, i) => poses.set(a.id, { position: walkers[i].position, yaw: walkers[i].yaw }))

export function Agents() {
  useFrame(() => {
    const setActivity = useGame.getState().setActivity
    walkers.forEach((w, i) => {
      w.update(sim.dt, sim.night)
      poses.get(AGENTS[i].id)!.yaw = w.yaw
      const activity = w.activity
      if (activity !== last[i]) {
        last[i] = activity
        setActivity(AGENTS[i].id, activity)
      }
    })
  })

  return (
    <>
      {AGENTS.map((def, i) => (
        <Character key={def.id} def={def} walker={walkers[i]} seed={i * 1.7} />
      ))}
    </>
  )
}
