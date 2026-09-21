import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { setSpeed, togglePause } from '@/net/engine'
import { useGame, type Speed } from '@/state/store'
import { AgentCard } from './AgentCard'
import { AgentDock } from './AgentDock'
import { ChatPanel } from './ChatPanel'
import { Clock } from './Clock'
import { ResourceBar } from './ResourceBar'
import { SidePanel } from './SidePanel'
import { SpeedControl } from './SpeedControl'

function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="fm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9df2ff" />
          <stop offset="1" stopColor="#8b7bff" />
        </linearGradient>
      </defs>
      <path d="M32 4 56 18v28L32 60 8 46V18Z" fill="#0d1230" stroke="url(#fm-g)" strokeWidth="3" />
      <path d="M16 30h32l-6 7H22Z" fill="#5fd08a" />
      <path d="M22 37h20l-10 14Z" fill="#8a6a52" />
      <circle cx="44" cy="19" r="4" fill="#ffd27a" />
    </svg>
  )
}

function Brand() {
  return (
    <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pr-4 pl-2">
      <Logo />
      <div className="leading-none">
        <div className="font-display text-[15px] font-extrabold tracking-[0.18em] text-white">FIRMAMENT</div>
        <div className="mt-1 text-[10.5px] font-semibold tracking-[0.12em] text-white/50 uppercase">Agent firm · Sky isle 01</div>
      </div>
    </div>
  )
}

/** Honest status: which brain is deciding, and whether its calls are actually going through. */
function EngineStatus() {
  const engine = useGame((s) => s.engine)
  const brain = useGame((s) => s.brain)
  const llm = brain.kind === 'llm'
  const trouble = llm && (brain.status === 'error' || brain.status === 'quota')
  const color =
    engine !== 'live' ? (engine === 'connecting' ? 'bg-sky-300' : 'bg-rose-400') : trouble ? 'bg-rose-400' : brain.status === 'rate-limited' ? 'bg-amber-300' : 'bg-emerald-300'
  return (
    <div className="glass group pointer-events-auto relative flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${color}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
      </span>
      <div className="leading-none">
        <div className="text-[12px] font-bold text-white">
          {engine !== 'live' ? (engine === 'connecting' ? 'Connecting…' : 'Engine offline') : llm ? 'AI brain live' : 'Engine live'}
        </div>
        {llm ? (
          <div className={`mt-1 font-mono text-[10.5px] font-medium ${trouble ? 'text-rose-300' : 'text-emerald-300/90'}`}>
            {brain.model?.split('/').pop()} · {brain.calls ?? 0} calls{brain.avgMs ? ` · ${brain.avgMs}ms` : ''}
          </div>
        ) : (
          <div className="mt-1 text-[10.5px] font-medium text-amber-200/80">Rule-based brains · no AI yet</div>
        )}
      </div>
      <div className="tag-pill pointer-events-none absolute top-full right-0 z-30 mt-2 w-72 rounded-xl p-3 text-[11.5px] leading-snug text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {llm ? (
          <>
            Every decision and chat line comes from <b>{brain.model}</b> on Groq; nightly reflections use {brain.reflectionModel}.
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 font-mono text-[10.5px] text-white/65">
              <span>calls {brain.calls ?? 0}</span>
              <span>errors {brain.errors ?? 0}</span>
              <span>decisions {brain.decisions ?? 0}</span>
              <span>invalid {brain.invalid ?? 0}</span>
              <span>reflections {brain.reflections ?? 0}</span>
              <span>tokens {brain.tokens ?? 0}</span>
            </div>
            {brain.lastError && <div className="mt-1.5 text-rose-300">Last error: {brain.lastError}</div>}
            <div className="mt-1.5 text-white/55">World time pauses while an agent waits for its answer, so API speed never counts against them.</div>
          </>
        ) : (
          <>
            The engine simulates hunger, energy, resources and construction; decisions come from a fixed rule list. Add a Groq key to
            engine/.env to switch on the AI brain.
          </>
        )}
      </div>
    </div>
  )
}

function Loader() {
  const ready = useGame((s) => s.ready)
  const world = useGame((s) => s.world)
  const engine = useGame((s) => s.engine)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready || !world) return
    const t = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(t)
  }, [ready, world])

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div className="absolute inset-0 z-50 grid place-items-center bg-ink px-6" exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }}>
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <motion.div animate={{ rotate: [0, 8, -8, 0], y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Logo size={64} />
            </motion.div>
            <div className="font-display text-sm font-bold tracking-[0.4em] text-white/80">FIRMAMENT</div>
            {engine === 'offline' && !world ? (
              <div className="glass rounded-2xl p-4 text-left text-[12.5px] leading-relaxed text-white/75">
                <div className="mb-1 font-bold text-rose-300">The simulation engine isn't running.</div>
                Start it from the project folder, then this page connects on its own:
                <code className="mt-2 block rounded-lg bg-black/40 px-3 py-2 font-mono text-[12px] text-aura">npm run engine</code>
                <div className="mt-2 text-[11px] text-white/45">Retrying every 2 seconds…</div>
              </div>
            ) : (
              <div className="text-xs text-white/40">{world ? 'Raising the island…' : 'Connecting to the engine…'}</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Shown while world time is paused because an agent is waiting for the model's answer. */
function BrainWait() {
  const waiting = useGame((s) => s.brain.waiting)
  const status = useGame((s) => s.brain.status)
  return (
    <AnimatePresence>
      {waiting && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-violet"
        >
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-violet"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </span>
          {status === 'rate-limited' ? 'Waiting for the AI rate limit · time paused' : 'Agents are thinking · time paused'}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const KEY_SPEEDS: Record<string, Speed> = { '1': 1, '2': 3, '3': 10 }

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'Escape') {
        useGame.getState().select(null)
      } else if (KEY_SPEEDS[e.key]) {
        setSpeed(KEY_SPEEDS[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const enter = (delay: number) => ({
  initial: { opacity: 0, y: -14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
})

export function Hud() {
  const ready = useGame((s) => s.ready)
  const world = useGame((s) => s.world)
  useShortcuts()

  return (
    <>
      {ready && world && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-3 sm:p-4">
          <header className="flex flex-wrap items-start justify-between gap-2.5">
            <motion.div {...enter(1.2)}>
              <Brand />
            </motion.div>
            <motion.div
              {...enter(1.35)}
              className="pointer-events-auto order-3 flex w-full flex-col items-center gap-2 lg:absolute lg:top-4 lg:left-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2"
            >
              <div className="flex items-center gap-2">
                <Clock />
                <SpeedControl />
              </div>
              <ResourceBar />
              <BrainWait />
            </motion.div>
            <motion.div {...enter(1.5)}>
              <EngineStatus />
            </motion.div>
          </header>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7, duration: 0.6 }}
            className="flex min-h-0 flex-1 items-start justify-between gap-3 lg:pt-24"
          >
            <ChatPanel />
            <SidePanel />
          </motion.div>

          <footer className="flex flex-col items-center gap-3">
            <AgentCard />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.85, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-w-full justify-center"
            >
              <AgentDock />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.3 }}
              className="hidden text-[11px] font-medium tracking-wide text-white/55 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] md:block"
            >
              Drag to orbit · Scroll to zoom · Click an agent to follow · Space to pause · 1–3 for speed
            </motion.p>
          </footer>
        </div>
      )}
      <Loader />
    </>
  )
}
