import { Pause } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useGame, type Speed } from '@/state/store'

const OPTIONS: { value: Speed; label: string }[] = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1×' },
  { value: 3, label: '3×' },
  { value: 10, label: '10×' },
]

/**
 * Game-speed segmented control. Adapted from the 21st.dev "Segmented Tabs"
 * pattern: a sliding selected pill plus a fluid hover highlight.
 */
export function SpeedControl() {
  const speed = useGame((s) => s.speed)
  const setSpeed = useGame((s) => s.setSpeed)
  const [hovered, setHovered] = useState<Speed | null>(null)

  return (
    <div
      role="radiogroup"
      aria-label="Simulation speed"
      className="glass relative flex items-center gap-0.5 rounded-2xl p-1"
      onMouseLeave={() => setHovered(null)}
    >
      {OPTIONS.map((o) => {
        const active = speed === o.value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.value === 0 ? 'Pause' : `Speed ${o.label}`}
            onClick={() => setSpeed(o.value)}
            onMouseEnter={() => setHovered(o.value)}
            className={cn(
              'relative grid h-9 min-w-11 cursor-pointer place-items-center rounded-xl px-2.5 font-mono text-[13px] font-bold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-aura/70',
              active ? 'text-ink' : 'text-white/70 hover:text-white',
            )}
          >
            {hovered === o.value && !active && (
              <motion.span layoutId="speed-hover" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
            )}
            {active && (
              <motion.span
                layoutId="speed-active"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #d9fbff, #9df2ff 45%, #b6a9ff)', boxShadow: '0 0 18px rgb(157 242 255 / 0.45)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{o.value === 0 ? <Pause size={15} strokeWidth={2.6} /> : o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
