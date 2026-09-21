import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { agentById } from '@/agents/roster'
import { useGame } from '@/state/store'
import { ROLE_ICON } from './AgentDock'

const ACTIVITY = { idle: 'Standing by', walking: 'Exploring the island', resting: 'Resting by the fire' } as const

/** Card for the followed agent. Level / XP / skills are the true starting values: nobody has learned anything yet. */
export function AgentCard() {
  const selectedId = useGame((s) => s.selectedId)
  const select = useGame((s) => s.select)
  const activity = useGame((s) => (s.selectedId ? (s.activity[s.selectedId] ?? 'idle') : 'idle'))
  const agent = agentById(selectedId)

  return (
    <AnimatePresence mode="wait">
      {agent && (
        <motion.section
          key={agent.id}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="glass pointer-events-auto w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-3xl"
          aria-label={`${agent.name} details`}
        >
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${agent.color}, transparent)` }} />
          <div className="flex items-start gap-3 p-4 pb-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}88)`, boxShadow: `0 0 24px ${agent.color}66` }}
            >
              {(() => {
                const Icon = ROLE_ICON[agent.role]
                return <Icon size={22} strokeWidth={2.2} />
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-tight text-white">{agent.name}</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                  style={{ background: `${agent.color}26`, color: agent.color }}
                >
                  {agent.role}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-white/65">{agent.bio}</p>
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

          <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
            {[
              ['Level', '1'],
              ['XP', '0'],
              ['Skills', '0'],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#0b0f24]/60 px-3 py-2.5">
                <div className="text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">{k}</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]">
            <span className="flex items-center gap-2 text-white/75">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: agent.color }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: agent.color }} />
              </span>
              {ACTIVITY[activity]}
            </span>
            <span className="font-mono text-[10.5px] text-white/40">Esc to release</span>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
