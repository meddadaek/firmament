import {
  Brain,
  Check,
  ChevronRight,
  Compass,
  GraduationCap,
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
import type { GameEvent } from '@/net/types'
import { useGame } from '@/state/store'
import { Learning } from './Learning'

const EVENT_ICON: Record<GameEvent['kind'], [LucideIcon, string]> = {
  day: [Sun, '#ffd27a'],
  night: [Moon, '#a9b4ff'],
  plan: [PencilRuler, '#8b7bff'],
  build: [Hammer, '#ff7b47'],
  done: [Sparkles, '#6ee7a8'],
  discover: [Compass, '#9df2ff'],
  farm: [Wheat, '#f5b53d'],
  tools: [Wrench, '#ffd27a'],
  learn: [Brain, '#c9b8ff'],
}

type Tab = 'plan' | 'learn' | 'log'
const TABS = [
  ['plan', 'City', LayoutGrid],
  ['learn', 'Learning', GraduationCap],
  ['log', 'Log', ScrollText],
] as const

/** Right-hand panel: the city, the learning curve, and the firm's event log. */
export function SidePanel() {
  const [open, setOpen] = useState(() => window.innerWidth >= 1100)
  const [tab, setTab] = useState<Tab>('plan')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass pointer-events-auto flex h-11 cursor-pointer items-center gap-2 self-start rounded-2xl px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        aria-label="Open the city, learning and log panel"
      >
        <GraduationCap size={16} className="text-violet" />
        City &amp; learning
      </button>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="glass pointer-events-auto flex max-h-full w-[min(320px,calc(100vw-24px))] flex-col self-start overflow-hidden rounded-3xl"
    >
      <header className="flex items-center gap-1 border-b border-white/10 p-2">
        {TABS.map(([id, label, Icon]) => (
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
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'plan' ? <City /> : tab === 'learn' ? <Learning /> : <FirmLog />}
      </div>
    </motion.section>
  )
}

/** What stands, what is being built, and every blueprint with its cost and requirements. */
function City() {
  const world = useGame((s) => s.world)
  const buildings = useGame((s) => s.buildings)
  const stock = useGame((s) => s.stock)
  const brain = useGame((s) => s.brain)
  if (!world) return null
  const ordered = [...buildings].sort((a, b) => a.id - b.id)
  const doneKinds = new Set(ordered.filter((b) => b.state === 'done').map((b) => b.kind))

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.12em] text-white/60 uppercase">Built by the firm</h3>
        {ordered.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.05] px-3 py-2 text-[11.5px] text-white/50">
            Nothing yet. {brain.kind === 'llm' ? 'Lina decides what to build first.' : 'The first hut is next on the list.'}
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {ordered.map((b) => {
              const bp = world.blueprints[b.kind]
              return (
                <li key={b.id} className={cn('flex items-start gap-2.5 rounded-2xl px-2.5 py-2', b.state !== 'done' && 'bg-white/[0.07]')}>
                  <span
                    className={cn(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg',
                      b.state === 'done' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/70',
                    )}
                  >
                    {b.state === 'done' ? <Check size={13} strokeWidth={3} /> : <Hammer size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-white">{bp.name}</span>
                      <span className="text-[10px] font-semibold tracking-wide text-white/45 uppercase">
                        {b.state === 'done' ? 'Built' : b.state === 'building' ? `${Math.round(b.progress * 100)}%` : 'Needs materials'}
                      </span>
                    </div>
                    {b.state === 'building' && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-aura to-violet" animate={{ width: `${b.progress * 100}%` }} />
                      </div>
                    )}
                    {b.state === 'planned' && (
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
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.12em] text-white/60 uppercase">Blueprints</h3>
        <ul className="flex flex-col gap-1">
          {Object.entries(world.blueprints).map(([kind, bp]) => {
            const missing = bp.requires.filter((r) => !doneKinds.has(r))
            return (
              <li key={kind} className={cn('rounded-2xl px-2.5 py-1.5', missing.length && 'opacity-55')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                    {missing.length > 0 && <Lock size={11} className="text-white/50" />}
                    {bp.name}
                  </span>
                  <span className="text-[10.5px] text-white/55">
                    {Object.entries(bp.cost)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(' · ')}
                  </span>
                </div>
                <p className="text-[10.5px] leading-snug text-white/45">
                  {missing.length ? `Needs ${missing.map((r) => world.blueprints[r].name).join(', ')} first. ` : ''}
                  {bp.summary}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
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
            <motion.li key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 rounded-xl px-2 py-1.5">
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
