import { Axe, Cog, Compass, Hammer, PencilRuler, Wheat, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AGENTS, type AgentDef } from '@/agents/roster'
import { cn } from '@/lib/cn'
import { useGame } from '@/state/store'

export const ROLE_ICON: Record<string, LucideIcon> = {
  Architect: PencilRuler,
  Farmer: Wheat,
  Builder: Hammer,
  Woodcutter: Axe,
  Engineer: Cog,
  Scout: Compass,
}

const ACTIVITY = { idle: 'Idle', walking: 'Exploring', resting: 'Resting' } as const

/**
 * The firm roster. Adapted from the 21st.dev "Dock": a glass bar tilted back in
 * perspective, spring tilt + scale on hover, a glow ring and an active dot.
 */
export function AgentDock() {
  const [hovered, setHovered] = useState<string | null>(null)
  const selectedId = useGame((s) => s.selectedId)
  const toggleSelect = useGame((s) => s.toggleSelect)
  const hover = useGame((s) => s.hover)

  return (
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      className="glass pointer-events-auto flex max-w-full items-end gap-1.5 overflow-x-auto rounded-3xl px-3 pt-3 pb-2 sm:gap-2.5 sm:px-4"
      style={{ transform: 'perspective(700px) rotateX(10deg)', scrollbarWidth: 'none' }}
    >
      {AGENTS.map((a) => (
        <DockItem
          key={a.id}
          agent={a}
          active={selectedId === a.id}
          hovered={hovered === a.id}
          onHover={(on) => {
            setHovered(on ? a.id : null)
            hover(on ? a.id : null)
          }}
          onClick={() => toggleSelect(a.id)}
        />
      ))}
    </motion.div>
  )
}

function DockItem({
  agent,
  active,
  hovered,
  onHover,
  onClick,
}: {
  agent: AgentDef
  active: boolean
  hovered: boolean
  onHover: (on: boolean) => void
  onClick: () => void
}) {
  const Icon = ROLE_ICON[agent.role]
  const activity = useGame((s) => s.activity[agent.id] ?? 'idle')

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={`${agent.name}, ${agent.role}. ${active ? 'Stop following' : 'Follow'}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onClick={onClick}
      animate={{ scale: hovered ? 1.14 : 1, rotate: hovered ? -4 : 0, y: hovered ? -4 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      className="relative flex w-[62px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl pt-1 pb-0.5 outline-none focus-visible:ring-2 focus-visible:ring-aura/70 sm:w-[70px]"
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="tag-pill pointer-events-none absolute -top-11 left-1/2 z-20 -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white"
          >
            {agent.role} · {active ? 'click to release' : 'click to follow'}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="relative grid h-11 w-11 place-items-center rounded-2xl text-white sm:h-12 sm:w-12"
        style={{
          background: `linear-gradient(145deg, ${agent.color}, ${agent.color}88)`,
          boxShadow: active || hovered ? `0 0 22px ${agent.color}99, inset 0 1px 0 #ffffff55` : `inset 0 1px 0 #ffffff44`,
        }}
      >
        <Icon size={20} strokeWidth={2.2} />
        {(hovered || active) && (
          <motion.span
            layoutId={active ? `ring-${agent.id}` : undefined}
            className="absolute -inset-1 rounded-[18px] border"
            style={{ borderColor: `${agent.color}aa` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
        <span
          className={cn('absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#0b0f24]')}
          style={{ background: activity === 'walking' ? '#6ee7a8' : activity === 'resting' ? '#a9b4ff' : '#ffd27a' }}
          title={ACTIVITY[activity]}
        />
      </div>
      <span className="text-[11px] leading-none font-bold text-white">{agent.name}</span>
      <span className="text-[9.5px] leading-none font-medium text-white/50">{ACTIVITY[activity]}</span>
      {active && <motion.span layoutId="dock-dot" className="mt-0.5 h-1 w-1 rounded-full" style={{ background: agent.color, boxShadow: `0 0 8px ${agent.color}` }} />}
    </motion.button>
  )
}
