import { Apple, BedDouble, Brain, Hammer, ListChecks, Package, Pickaxe, TreePine, X, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { agentById } from '@/agents/roster'
import { useGame } from '@/state/store'
import { ROLE_ICON } from './AgentDock'

// A stable empty list: a fresh [] inside a zustand selector re-renders forever.
const NO_LESSONS: string[] = []

function Need({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: number; color: string }) {
  const low = value < 0.3
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className={low ? 'text-rose-300' : 'text-white/60'} />
      <span className="w-12 text-[10.5px] font-semibold tracking-wide text-white/55 uppercase">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.4 }}
          style={{ background: low ? '#fb7185' : color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10.5px] text-white/60">{Math.round(value * 100)}</span>
    </div>
  )
}

/** Card for the followed agent: live needs, what they carry and what they have done so far. */
export function AgentCard() {
  const selectedId = useGame((s) => s.selectedId)
  const select = useGame((s) => s.select)
  const state = useGame((s) => (s.selectedId ? s.agents[s.selectedId] : undefined))
  const bed = useGame((s) => {
    const b = s.buildings.find((x) => s.selectedId && x.sleepers.includes(s.selectedId))
    return b ? s.world?.blueprints[b.kind]?.name : undefined
  })
  const agent = agentById(selectedId)
  const lessons = useGame((s) => (s.selectedId ? (s.lessons[s.selectedId] ?? NO_LESSONS) : NO_LESSONS))
  const llm = useGame((s) => s.brain.kind === 'llm')

  return (
    <AnimatePresence mode="wait">
      {agent && (
        <motion.section
          key={agent.id}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="glass pointer-events-auto w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-3xl"
          aria-label={`${agent.name} details`}
        >
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${agent.color}, transparent)` }} />
          <div className="flex items-start gap-3 p-4 pb-3">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}88)`, boxShadow: `0 0 24px ${agent.color}66` }}
            >
              {(() => {
                const Icon = ROLE_ICON[agent.role]
                return <Icon size={21} strokeWidth={2.2} />
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-tight text-white">{agent.name}</h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: `${agent.color}26`, color: agent.color }}>
                  {agent.role}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug font-semibold text-white/85 first-letter:uppercase">{state?.label ?? 'idle'}</p>
            </div>
            <button
              type="button"
              onClick={() => select(null)}
              aria-label="Stop following"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-3">
            <Need icon={Apple} label="Food" value={state?.hunger ?? 1} color="#6ee7a8" />
            <Need icon={Zap} label="Energy" value={state?.energy ?? 1} color="#9df2ff" />
          </div>

          {llm && (
            <div className="mx-4 mb-3 rounded-2xl bg-violet/10 px-3 py-2 ring-1 ring-violet/25">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-violet uppercase">
                <Brain size={12} /> {state?.act === 'think' ? 'Thinking…' : 'Last thought'}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-white/85 italic">{state?.thought || 'No decision yet.'}</p>
              {state && state.plan.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <ListChecks size={12} className="text-white/45" />
                  {state.plan.map((p, i) => (
                    <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">
                      {p.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-px border-t border-white/10 bg-white/10 text-center">
            {(
              [
                [TreePine, state?.stats.wood ?? 0, 'wood'],
                [Pickaxe, state?.stats.stone ?? 0, 'stone'],
                [Apple, state?.stats.food ?? 0, 'food'],
                [Hammer, state?.stats.built ?? 0, 'built'],
              ] as const
            ).map(([Icon, v, k]) => (
              <div key={k} className="bg-[#0b0f24]/60 px-2 py-2" title={`${k} gathered so far`}>
                <Icon size={13} className="mx-auto text-white/50" />
                <div className="mt-1 font-mono text-[15px] font-bold text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11.5px] text-white/65">
            <span className="flex items-center gap-1.5">
              <Package size={13} />
              {state?.carry ? `Carrying ${state.carry[1]} ${state.carry[0]}` : 'Hands free'}
            </span>
            <span className="flex items-center gap-1.5">
              <BedDouble size={13} />
              {bed ?? 'By the campfire'}
            </span>
          </div>
          {llm && lessons.length > 0 && (
            <details className="border-t border-white/10 px-4 py-2 text-[11.5px] text-white/70">
              <summary className="cursor-pointer font-semibold text-white/80 select-none">Lessons learned ({lessons.length})</summary>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 leading-snug marker:text-white/30">
                {lessons.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
