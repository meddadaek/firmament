import { Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sim } from '@/state/sim'
import { clockString, phaseOf, type Phase } from '@/world/timeOfDay'

const ICON = { Night: Moon, Dawn: Sunrise, Day: Sun, Dusk: Sunset }
const TINT = { Night: '#a9b4ff', Dawn: '#ffb38a', Day: '#ffd27a', Dusk: '#ff8d6b' }

/** Reads the frame-rate sim clock through refs; only the phase change touches React state. */
export function Clock() {
  const time = useRef<HTMLSpanElement>(null)
  const day = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>(phaseOf(sim.t))

  useEffect(() => {
    let raf = 0
    let lastPhase = phase
    const tick = () => {
      if (time.current) time.current.textContent = clockString(sim.t)
      if (day.current) day.current.textContent = String(sim.day)
      if (bar.current) bar.current.style.transform = `scaleX(${sim.t})`
      const p = phaseOf(sim.t)
      if (p !== lastPhase) {
        lastPhase = p
        setPhase(p)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Icon = ICON[phase]
  return (
    <div className="glass relative flex items-center gap-3 overflow-hidden rounded-2xl py-2 pr-4 pl-2.5">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl transition-colors duration-700"
        style={{ background: `${TINT[phase]}22`, color: TINT[phase], boxShadow: `inset 0 0 0 1px ${TINT[phase]}44` }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-[10px] tracking-[0.2em] text-white/55 uppercase">
          Day <span ref={day}>1</span> · {phase}
        </span>
        <span ref={time} className="mt-1 font-mono text-lg font-bold tracking-wide text-white tabular-nums">
          07:12
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/8">
        <div
          ref={bar}
          className="h-full origin-left"
          style={{ background: 'linear-gradient(90deg, #6f7dff, #ffb38a 30%, #ffd27a 50%, #ff8d6b 72%, #6f7dff)' }}
        />
      </div>
    </div>
  )
}
