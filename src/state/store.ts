import { create } from 'zustand'
import type { AgentState, BrainStats, BuildingState, ChatMessage, GameEvent, Resource, RunResult, WorldData } from '@/net/types'

export type Speed = 0 | 1 | 3 | 10
export type EngineStatus = 'connecting' | 'live' | 'offline'

/**
 * React-facing game state, refreshed a few times per second by net/engine.ts.
 * Per-frame values (positions, the clock) live in net/engine.ts `live` and state/sim.ts instead.
 */
interface GameState {
  world: WorldData | null
  engine: EngineStatus
  speed: Speed
  stock: Record<Resource, number>
  tools: number
  discovered: number
  totalTiles: number
  planIndex: number
  buildings: BuildingState[]
  agents: Record<string, AgentState>
  events: GameEvent[]
  chat: ChatMessage[]
  brain: BrainStats
  run: { number: number; outcome: string | null; maxDays: number }
  lessons: Record<string, string[]>
  runs: RunResult[]

  selectedId: string | null
  hoveredId: string | null
  select: (id: string | null) => void
  toggleSelect: (id: string) => void
  hover: (id: string | null) => void

  ready: boolean
  setReady: () => void
  lowPower: boolean
  setLowPower: () => void
}

export const useGame = create<GameState>((set, get) => ({
  world: null,
  engine: 'connecting',
  speed: 1,
  stock: { wood: 0, stone: 0, food: 0 },
  tools: 0,
  discovered: 0,
  totalTiles: 1,
  planIndex: 0,
  buildings: [],
  agents: {},
  events: [],
  chat: [],
  brain: { kind: 'rules', model: null },
  run: { number: 1, outcome: null, maxDays: 20 },
  lessons: {},
  runs: [],

  selectedId: null,
  hoveredId: null,
  select: (id) => set({ selectedId: id }),
  toggleSelect: (id) => set({ selectedId: get().selectedId === id ? null : id }),
  hover: (id) => set({ hoveredId: id }),

  ready: false,
  setReady: () => set({ ready: true }),
  lowPower: false,
  setLowPower: () => set({ lowPower: true }),
}))
