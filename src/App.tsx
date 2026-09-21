import { Hud } from '@/hud/Hud'
import { Scene } from '@/scene/Scene'

export default function App() {
  return (
    <main className="relative h-full w-full select-none">
      <Scene />
      <Hud />
    </main>
  )
}
