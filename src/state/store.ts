import { create } from 'zustand'

export type Speed = 0 | 1 | 3 | 10
export type Activity = 'idle' | 'walking' | 'resting'

interface GameState {
  speed: Speed
  lastSpeed: Exclude<Speed, 0>
  setSpeed: (speed: Speed) => void
  togglePause: () => void

  selectedId: string | null
  hoveredId: string | null
  select: (id: string | null) => void
  toggleSelect: (id: string) => void
  hover: (id: string | null) => void

  activity: Record<string, Activity>
  setActivity: (id: string, activity: Activity) => void

  ready: boolean
  setReady: () => void
  lowPower: boolean
  setLowPower: () => void
}

export const useGame = create<GameState>((set, get) => ({
  speed: 1,
  lastSpeed: 1,
  setSpeed: (speed) => set(speed === 0 ? { speed } : { speed, lastSpeed: speed }),
  togglePause: () => {
    const { speed, lastSpeed } = get()
    set({ speed: speed === 0 ? lastSpeed : 0 })
  },

  selectedId: null,
  hoveredId: null,
  select: (id) => set({ selectedId: id }),
  toggleSelect: (id) => set({ selectedId: get().selectedId === id ? null : id }),
  hover: (id) => set({ hoveredId: id }),

  activity: {},
  setActivity: (id, activity) => set((s) => ({ activity: { ...s.activity, [id]: activity } })),

  ready: false,
  setReady: () => set({ ready: true }),
  lowPower: false,
  setLowPower: () => set({ lowPower: true }),
}))
