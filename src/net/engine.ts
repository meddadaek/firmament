import { useGame, type Speed } from '@/state/store'
import type { AgentState, Snapshot, WorldData } from './types'

/**
 * Per-frame mirror of the engine state. The 3D scene reads this directly every frame;
 * the React HUD gets a throttled copy through the zustand store.
 */
export const live = {
  t: 0.3,
  day: 1,
  speed: 1,
  receivedAt: 0,
  agents: new Map<string, AgentState>(),
  nodeAmounts: new Map<number, number>(),
  nodesVersion: 0,
  discovered: new Set<number>(),
  discoveredVersion: 0,
}

const HUD_INTERVAL = 250
const MAX_FEED = 60
let socket: WebSocket | null = null
let lastPush = 0
let latest: Snapshot | null = null
let lastSpeed: Exclude<Speed, 0> = 1

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let booted = false

export async function boot() {
  if (booted) return // React StrictMode runs effects twice in dev
  booted = true
  for (;;) {
    try {
      const res = await fetch('/api/world')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const world = (await res.json()) as WorldData
      useGame.setState({ world, totalTiles: world.tiles.length })
      break
    } catch {
      useGame.setState({ engine: 'offline' })
      await wait(2000)
    }
  }
  connect()
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  socket = new WebSocket(`${proto}://${location.host}/ws`)
  socket.onopen = () => useGame.setState({ engine: 'live' })
  socket.onmessage = (e) => apply(JSON.parse(e.data) as Snapshot)
  socket.onclose = () => {
    useGame.setState({ engine: 'offline' })
    setTimeout(connect, 1500)
  }
}

function apply(s: Snapshot) {
  const full = s.type === 'state'
  if (full) {
    live.nodeAmounts.clear()
    live.discovered.clear()
  }
  live.t = s.t
  live.day = s.day
  live.speed = s.speed
  live.receivedAt = performance.now()
  for (const a of s.agents) live.agents.set(a.id, a)
  if (s.nodes.length || full) {
    for (const [id, amount] of s.nodes) live.nodeAmounts.set(id, amount)
    live.nodesVersion++
  }
  if (s.revealed.length || full) {
    for (const i of s.revealed) live.discovered.add(i)
    live.discoveredVersion++
  }

  const g = useGame.getState()
  const events = full ? s.events.slice(-MAX_FEED) : s.events.length ? [...g.events, ...s.events].slice(-MAX_FEED) : g.events
  const chat = full ? s.chat.slice(-MAX_FEED * 2) : s.chat.length ? [...g.chat, ...s.chat].slice(-MAX_FEED * 2) : g.chat
  if (s.events.length || s.chat.length || full) useGame.setState({ events, chat })
  if (s.memory) useGame.setState({ lessons: s.memory.lessons, runs: s.memory.runs })

  latest = s
  const now = performance.now()
  if (full || now - lastPush > HUD_INTERVAL) {
    lastPush = now
    pushHud()
  }
}

function pushHud() {
  if (!latest) return
  const s = latest
  const agents: Record<string, AgentState> = {}
  for (const a of s.agents) agents[a.id] = a
  useGame.setState({
    speed: s.speed as Speed,
    stock: s.stock,
    tools: s.tools,
    discovered: s.discovered,
    totalTiles: s.totalTiles,
    planIndex: s.planIndex,
    buildings: s.buildings,
    agents,
    brain: s.brain,
    run: s.run,
  })
}

export function setSpeed(value: Speed) {
  if (value !== 0) lastSpeed = value
  useGame.setState({ speed: value })
  live.speed = value
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'speed', value }))
}

/** End the current run and start the island over; the agents keep their lessons. */
export async function newRun() {
  await fetch('/api/run/new', { method: 'POST' })
}

export function togglePause() {
  setSpeed(useGame.getState().speed === 0 ? lastSpeed : 0)
}
