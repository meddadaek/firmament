import { ChevronLeft, MessagesSquare } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { agentById } from '@/agents/roster'
import { cn } from '@/lib/cn'
import type { ChatMessage } from '@/net/types'
import { useGame } from '@/state/store'
import { ROLE_ICON } from './AgentDock'

/**
 * The firm's group chat, docked on the left. Every line comes from the engine and is
 * triggered by something that really happened in the sim. Until the LLM brain is wired,
 * the wording is scripted — the header says so.
 */
export function ChatPanel() {
  const chat = useGame((s) => s.chat)
  const brain = useGame((s) => s.brain)
  const [open, setOpen] = useState(() => window.innerWidth >= 520)
  const list = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat.length, open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass pointer-events-auto flex h-11 cursor-pointer items-center gap-2 self-start rounded-2xl px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        aria-label="Open the firm chat"
      >
        <MessagesSquare size={16} className="text-aura" />
        Firm chat
        <span className="rounded-full bg-aura/20 px-1.5 py-0.5 font-mono text-[10px] text-aura">{chat.length}</span>
      </button>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="glass pointer-events-auto flex max-h-full w-[min(340px,calc(100vw-24px))] flex-col self-start overflow-hidden rounded-3xl"
      aria-label="Firm chat"
    >
      <header className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-aura/15 text-aura">
          <MessagesSquare size={16} />
        </div>
        <div className="min-w-0 flex-1 leading-none">
          <div className="font-display text-[13px] font-bold tracking-wide text-white">Firm chat</div>
          {brain.kind === 'llm' ? (
            <div className="mt-1 truncate text-[10.5px] font-medium text-emerald-300/90" title="Every message is written by the language model as part of the agent's decision.">
              Written live by {brain.model}
            </div>
          ) : (
            <div className="mt-1 truncate text-[10.5px] font-medium text-amber-200/80" title="Lines are triggered by real events in the simulation, but the wording is scripted.">
              Scripted lines · AI brain not connected
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse the chat"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        >
          <ChevronLeft size={16} />
        </button>
      </header>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        className="scroll-fade flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
      >
        {chat.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-white/45">Waiting for the firm to say something…</p>}
        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}

function Message({ m }: { m: ChatMessage }) {
  const from = agentById(m.from)
  const to = m.to && m.to !== 'all' ? agentById(m.to) : null
  const select = useGame((s) => s.select)
  if (!from) return null
  const Icon = ROLE_ICON[from.role]

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="flex gap-2.5"
    >
      <button
        type="button"
        onClick={() => select(from.id)}
        aria-label={`Follow ${from.name}`}
        className="mt-0.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-xl text-white transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
        style={{ background: `linear-gradient(145deg, ${from.color}, ${from.color}88)` }}
      >
        <Icon size={15} strokeWidth={2.2} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[11px] leading-none">
          <span className="font-bold" style={{ color: from.color }}>
            {from.name}
          </span>
          <span className="text-white/40">→</span>
          <span className={cn('font-semibold', to ? '' : 'text-white/55')} style={to ? { color: to.color } : undefined}>
            {to ? to.name : 'everyone'}
          </span>
          <span className="ml-auto font-mono text-[10px] text-white/35">
            D{m.day} {m.time}
          </span>
        </div>
        <p className="mt-1.5 rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2 text-[12.5px] leading-snug text-white/90">{m.text}</p>
      </div>
    </motion.article>
  )
}
