import { useEffect } from 'react'
import { Hud } from '@/hud/Hud'
import { boot } from '@/net/engine'
import { Scene } from '@/scene/Scene'

export default function App() {
  useEffect(() => {
    void boot()
  }, [])

  return (
    <main className="relative h-full w-full select-none">
      <Scene />
      <Hud />
    </main>
  )
}
