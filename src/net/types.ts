/** Shapes served by the Python engine (engine/firmament/server.py). */

export type Biome = 'plaza' | 'meadow' | 'forest' | 'sand' | 'water' | 'stone'
export type Resource = 'wood' | 'stone' | 'food'

export interface TileData {
  i: number
  q: number
  r: number
  x: number
  z: number
  h: number
  biome: Biome
  ring: number
  walkable: boolean
  cap: string
  body: string
}

export interface NodeData {
  id: number
  kind: 'pine' | 'tree' | 'rock' | 'bush'
  tile: number
  x: number
  y: number
  z: number
  scale: number
  rot: number
  color: string
  resource: Resource
  capacity: number
}

export interface Blueprint {
  name: string
  cost: Partial<Record<Resource, number>>
  work: number
  beds: number
  requires: string[]
  summary: string
}

export interface WorldData {
  radius: number
  waterSurface: number
  tiles: TileData[]
  nodes: NodeData[]
  waterfall: { x: number; y: number; z: number; dirX: number; dirZ: number }
  campTile: number
  homeTiles: number[]
  blueprints: Record<string, Blueprint>
  buildOrder: string[]
  roster: { id: string; name: string; role: string }[]
  daySeconds: number
  brain: string
}

export type Act = 'idle' | 'walk' | 'work' | 'eat' | 'sleep' | 'think'

export interface AgentState {
  id: string
  x: number
  y: number
  z: number
  yaw: number
  act: Act
  label: string
  tile: number
  hunger: number
  energy: number
  carry: [Resource, number] | null
  hidden: boolean
  jobs: number
  stats: { wood: number; stone: number; food: number; built: number }
  task: string | null
  thought: string
  plan: string[]
}

export interface BuildingState {
  id: number
  kind: string
  tile: number
  state: 'planned' | 'building' | 'done'
  progress: number
  crop: number
  sleepers: string[]
}

export interface GameEvent {
  id: number
  day: number
  time: string
  kind: 'day' | 'night' | 'plan' | 'build' | 'done' | 'discover' | 'farm' | 'tools' | 'learn'
  text: string
  agent: string | null
}

export interface ChatMessage {
  id: number
  day: number
  time: string
  from: string
  to: string | null
  text: string
}

export interface BrainStats {
  kind: 'llm' | 'rules'
  model: string | null
  reflectionModel?: string
  calls?: number
  errors?: number
  tokens?: number
  avgMs?: number | null
  status?: 'ok' | 'rate-limited' | 'quota' | 'error'
  lastError?: string | null
  runCalls?: number
  decisions?: number
  invalid?: number
  reflections?: number
  queue?: number
  waiting?: boolean
}

export interface RunResult {
  run: number
  outcome: 'complete' | 'timeout' | 'abandoned'
  finished: string
  brain: string
  townhallDay: number | null
  days: number
  buildings: number
  hungrySeconds: number
  workShare: number
  walkShare: number
  idleShare: number
  wood: number
  stone: number
  food: number
  calls: number
}

export interface Snapshot {
  type: 'state' | 'tick'
  t: number
  day: number
  speed: number
  night: number
  clock: number
  stock: Record<Resource, number>
  tools: number
  discovered: number
  totalTiles: number
  planIndex: number
  agents: AgentState[]
  buildings: BuildingState[]
  nodes: [number, number][]
  revealed: number[]
  events: GameEvent[]
  chat: ChatMessage[]
  run: { number: number; outcome: string | null; maxDays: number }
  brain: BrainStats
  memory?: { lessons: Record<string, string[]>; runs: RunResult[] }
}
