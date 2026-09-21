import { Apple, BedDouble, Map, Pickaxe, TreePine, Wrench, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { AGENTS } from '@/agents/roster'
import { useGame } from '@/state/store'

function Stat({ icon: Icon, value, label, tint }: { icon: LucideIcon; value: string | number; label: string; tint: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5" title={label}>
      <Icon size={15} strokeWidth={2.2} style={{ color: tint }} />
      <motion.span
        key={String(value)}
        initial={{ scale: 1.35, color: tint }}
        animate={{ scale: 1, color: '#ffffff' }}
        transition={{ duration: 0.5 }}
        className="font-mono text-[13px] font-bold tabular-nums"
      >
        {value}
      </motion.span>
      <span className="hidden text-[10.5px] font-semibold tracking-wide text-white/45 uppercase lg:inline">{label}</span>
    </div>
  )
}

/** The firm's stockpile and progress, straight from the engine. */
export function ResourceBar() {
  const stock = useGame((s) => s.stock)
  const tools = useGame((s) => s.tools)
  const discovered = useGame((s) => s.discovered)
  const total = useGame((s) => s.totalTiles)
  const buildings = useGame((s) => s.buildings)
  const world = useGame((s) => s.world)
  const beds = buildings
    .filter((b) => b.state === 'done')
    .reduce((n, b) => n + (world?.blueprints[b.kind]?.beds ?? 0), 0)

  return (
    <div className="glass pointer-events-auto flex flex-wrap items-center justify-center divide-x divide-white/10 rounded-2xl">
      <Stat icon={TreePine} value={stock.wood} label="Wood" tint="#6fcf7f" />
      <Stat icon={Pickaxe} value={stock.stone} label="Stone" tint="#b8c0d6" />
      <Stat icon={Apple} value={stock.food} label="Food" tint="#ff7a7a" />
      <Stat icon={Wrench} value={tools ? 'Stone' : 'None'} label="Tools" tint="#ffd27a" />
      <Stat icon={BedDouble} value={`${Math.min(beds, AGENTS.length)}/${AGENTS.length}`} label="Beds" tint="#a9b4ff" />
      <Stat icon={Map} value={`${Math.round((discovered / total) * 100)}%`} label="Explored" tint="#9df2ff" />
    </div>
  )
}
