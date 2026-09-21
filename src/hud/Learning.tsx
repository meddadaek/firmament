import { Brain, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { AGENTS } from '@/agents/roster'
import { newRun } from '@/net/engine'
import type { RunResult } from '@/net/types'
import { useGame } from '@/state/store'

const W = 272
const H = 150
const PAD = { l: 30, r: 10, t: 14, b: 26 }
const LINE = '#9df2ff'

/**
 * Did they learn? One line: the day the Town Hall was finished, per run (lower is better).
 * Runs that never finished it are drawn as hollow points at the day limit.
 */
function Curve({ runs, maxDays }: { runs: RunResult[]; maxDays: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const scored = runs.filter((r) => r.outcome !== 'abandoned')
  if (scored.length === 0) {
    return (
      <div className="grid h-[150px] place-items-center rounded-2xl border border-dashed border-white/15 px-6 text-center text-[11.5px] leading-snug text-white/50">
        The first point appears when run {runs.length + 1} ends — when the Town Hall is built, or after day {maxDays}.
      </div>
    )
  }
  const n = scored.length
  const x = (i: number) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (n - 1)) * (W - PAD.l - PAD.r))
  const y = (day: number) => PAD.t + (day / maxDays) * (H - PAD.t - PAD.b)
  const pts = scored.map((r, i) => ({ r, cx: x(i), cy: y(r.townhallDay ?? maxDays), done: r.townhallDay !== null }))
  const ticks = [0, maxDays / 2, maxDays]

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Day the Town Hall was finished, per run">
        {ticks.map((d) => (
          <g key={d}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(d)} y2={y(d)} stroke="rgb(255 255 255 / 0.08)" />
            <text x={PAD.l - 6} y={y(d) + 3.5} textAnchor="end" fontSize="9" fill="rgb(255 255 255 / 0.45)" fontFamily="JetBrains Mono">
              {d}
            </text>
          </g>
        ))}
        {n > 1 && <polyline points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <g key={p.r.run} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={p.cx} cy={p.cy} r="12" fill="transparent" />
            <circle cx={p.cx} cy={p.cy} r="4.5" fill={p.done ? LINE : '#0b0f24'} stroke={p.done ? '#0b0f24' : LINE} strokeWidth="2" />
            <text x={p.cx} y={H - 8} textAnchor="middle" fontSize="9" fill="rgb(255 255 255 / 0.45)" fontFamily="JetBrains Mono">
              {p.r.run}
            </text>
          </g>
        ))}
        {n === 1 || pts.length > 0 ? (
          <text x={pts[pts.length - 1].cx} y={pts[pts.length - 1].cy - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            {pts[pts.length - 1].done ? `day ${pts[pts.length - 1].r.townhallDay}` : 'not built'}
          </text>
        ) : null}
      </svg>
      {hover !== null && (
        <div
          className="tag-pill pointer-events-none absolute z-10 w-44 rounded-xl p-2.5 text-[11px] leading-snug text-white/85"
          style={{ left: `${(pts[hover].cx / W) * 100}%`, top: `${(pts[hover].cy / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))' }}
        >
          <div className="font-bold text-white">Run {pts[hover].r.run}</div>
          <div>{pts[hover].done ? `Town Hall on day ${pts[hover].r.townhallDay}` : `No Town Hall by day ${maxDays}`}</div>
          <div className="text-white/60">
            Hungry {Math.round(pts[hover].r.hungrySeconds)}s · working {Math.round(pts[hover].r.workShare * 100)}% of waking time
          </div>
          <div className="text-white/60">{pts[hover].r.calls} AI calls</div>
        </div>
      )}
      <div className="mt-1 text-center text-[10px] text-white/40">run → · day the Town Hall was finished (lower is better)</div>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
      <div className="text-[9.5px] font-semibold tracking-[0.14em] text-white/45 uppercase">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-bold text-white">{value}</div>
      {note && <div className="text-[10px] text-white/45">{note}</div>}
    </div>
  )
}

/** The Learning tab: the curve across runs, the latest run's numbers, and what each agent has written down. */
export function Learning() {
  const runs = useGame((s) => s.runs)
  const run = useGame((s) => s.run)
  const lessons = useGame((s) => s.lessons)
  const brain = useGame((s) => s.brain)
  const [confirm, setConfirm] = useState(false)
  const last = [...runs].reverse().find((r) => r.outcome !== 'abandoned')

  if (brain.kind !== 'llm') {
    return <p className="px-2 py-6 text-center text-[12px] text-white/55">Learning needs the AI brain. The engine is running the fixed rule list, which never changes.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <Curve runs={runs} maxDays={run.maxDays} />

      <div className="grid grid-cols-3 gap-1.5">
        <Tile label="Run" value={`#${run.number}`} note={run.outcome ? 'finished' : 'in progress'} />
        <Tile label="Hungry" value={last ? `${Math.round(last.hungrySeconds)}s` : '–'} note="last run" />
        <Tile label="Working" value={last ? `${Math.round(last.workShare * 100)}%` : '–'} note="last run" />
      </div>

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-white/60 uppercase">
          <Brain size={13} /> What they've learned
        </h3>
        <ul className="flex flex-col gap-2">
          {AGENTS.map((a) => {
            const list = lessons[a.id] ?? []
            return (
              <li key={a.id} className="rounded-2xl bg-white/[0.05] px-3 py-2">
                <div className="flex items-center justify-between text-[11.5px] font-bold" style={{ color: a.color }}>
                  {a.name}
                  <span className="font-mono text-[10px] font-medium text-white/40">{list.length} lessons</span>
                </div>
                {list.length === 0 ? (
                  <p className="mt-0.5 text-[11px] text-white/40">Nothing yet — lessons are written each night.</p>
                ) : (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-white/75 marker:text-white/30">
                    {list.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => {
          if (!confirm) return setConfirm(true)
          setConfirm(false)
          void newRun()
        }}
        onBlur={() => setConfirm(false)}
        className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 text-[12px] font-bold text-white/85 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-aura/70 focus-visible:outline-none"
      >
        <RotateCcw size={14} />
        {confirm ? 'Click again to restart the island' : 'Start a new run (lessons are kept)'}
      </button>
    </div>
  )
}
