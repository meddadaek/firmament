import {
  Check,
  ChevronRight,
  Compass,
  Hammer,
  LayoutGrid,
  Lock,
  Moon,
  PencilRuler,
  ScrollText,
  Sparkles,
  Sun,
  Wheat,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { BuildingState, GameEvent } from '@/net/types'
import { useGame } from '@/state/store'

const EVENT_ICON: Record<GameEvent['kind'], [LucideIcon, string]> = {
  day: [Sun, '#ffd27a'],
  night: [Moon, '#a9b4ff'],
  plan: [PencilRuler, '#8b7bff'],
  build: [Hammer, '#ff7b47'],
  done: [Sparkles, '#6ee7a8'],
  discover: [Compass, '#9df2ff'],
  farm: [Wheat, '#f5b53d'],
  tools: [Wrench, '#ffd27a'],
}

type Tab = 'plan' | 'log'

/** Right-hand panel: the city plan (tech tree progress) and the firm's event log. */
export function SidePanel() {
  const [open, setOpen] = useState(() => window.innerWidth >= 1100)
  const [tab, setTab] = useState<Tab>('plan')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass pointer-events-auto flex h-11 cursor-pointer items-center gap-2 self-start rounded-2xl px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        aria-label="Open the city plan and log"
      >
        <LayoutGrid size={16} className="text-violet" />
        City plan
      </button>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="glass pointer-events-auto flex max-h-full w-[min(310px,calc(100vw-24px))] flex-col self-start overflow-hidden rounded-3xl"
    >
      <header className="flex items-center gap-1 border-b border-white/10 p-2">
        {(
          [
            ['plan', 'City plan', LayoutGrid],
            ['log', 'Firm log', ScrollText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              'relative flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[12px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none',
              tab === id ? 'text-white' : 'text-white/50 hover:text-white/80',
            )}
          >
            {tab === id && <motion.span layoutId="side-tab" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
            <Icon size={14} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse the panel"
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        >
          <ChevronRight size={16} />
        </button>
      </header>
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto p-3">{tab === 'plan' ? <CityPlan /> : <FirmLog />}</div>
    </motion.section>
  )
}

function CityPlan() {
  const world = useGame((s) => s.world)
  const buildings = useGame((s) => s.buildings)
  const planIndex = useGame((s) => s.planIndex)
  const stock = useGame((s) => s.stock)
  if (!world) return null
  const ordered = [...buildings].sort((a, b) => a.id - b.id)
  const doneKinds = new Set(ordered.filter((b) => b.state === 'done').map((b) => b.kind))

  return (
    <ol className="flex flex-col gap-1.5">
      {world.buildOrder.map((kind, i) => {
        const bp = world.blueprints[kind]
        const b = ordered[i] as BuildingState | undefined
        const locked = !b && bp.requires.some((r) => !doneKinds.has(r))
        const isNext = !b && i === planIndex
        const state: BuildingState['state'] | 'next' | 'locked' | 'later' = b?.state ?? (isNext ? (locked ? 'locked' : 'next') : 'later')
        const cost = Object.entries(bp.cost)
          .map(([k, v]) => `${v} ${k}`)
          .join(' · ')
        return (
          <li
            key={i}
            className={cn(
              'flex items-start gap-2.5 rounded-2xl px-2.5 py-2',
              state === 'building' || state === 'planned' ? 'bg-white/[0.07]' : '',
              state === 'later' ? 'opacity-45' : '',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold',
                state === 'done' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/70',
              )}
            >
              {state === 'done' ? <Check size={13} strokeWidth={3} /> : state === 'locked' ? <Lock size={11} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-white">{bp.name}</span>
                <span className="text-[10px] font-semibold tracking-wide text-white/45 uppercase">
                  {state === 'done' ? 'Built' : state === 'building' ? `${Math.round(b!.progress * 100)}%` : state === 'planned' ? 'Needs materials' : state === 'next' ? 'Next' : state === 'locked' ? `Needs ${bp.requires.map((r) => world.blueprints[r].name).join(', ')}` : ''}
                </span>
              </div>
              {state === 'building' && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-aura to-violet" animate={{ width: `${b!.progress * 100}%` }} />
                </div>
              )}
              {(state === 'planned' || state === 'next' || state === 'locked') && (
                <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-white/55">
                  {Object.entries(bp.cost).map(([k, v]) => {
                    const have = stock[k as keyof typeof stock]
                    return (
                      <span key={k} className={have >= (v ?? 0) ? 'text-emerald-300' : ''}>
                        {Math.min(have, v ?? 0)}/{v} {k}
                      </span>
                    )
                  })}
                </div>
              )}
              {state === 'later' && <div className="mt-0.5 text-[11px] text-white/55">{cost}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function FirmLog() {
  const events = useGame((s) => s.events)
  const recent = [...events].reverse().slice(0, 40)
  return (
    <ul className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {recent.map((e) => {
          const [Icon, tint] = EVENT_ICON[e.kind] ?? [ScrollText, '#ffffff']
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-xl px-2 py-1.5"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `${tint}1f`, color: tint }}>
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-white/85">{e.text}</p>
                <span className="font-mono text-[10px] text-white/35">
                  Day {e.day} · {e.time}
                </span>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
