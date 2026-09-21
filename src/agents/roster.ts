export type Look = 'ponytail' | 'braid-hat' | 'hardhat' | 'beanie-beard' | 'goggles' | 'cap-backpack'

export interface AgentDef {
  id: string
  name: string
  gender: 'female' | 'male'
  role: string
  /** Role colour: clothing, UI accents, selection ring. */
  color: string
  pants: string
  skin: string
  hair: string
  look: Look
  bio: string
}

/** The founding firm: two women, four men. */
export const AGENTS: AgentDef[] = [
  {
    id: 'lina',
    name: 'Lina',
    gender: 'female',
    role: 'Architect',
    color: '#8b7bff',
    pants: '#3a3560',
    skin: '#f3cfb3',
    hair: '#3b2418',
    look: 'ponytail',
    bio: 'Sketches the city long before a single stone is laid.',
  },
  {
    id: 'sara',
    name: 'Sara',
    gender: 'female',
    role: 'Farmer',
    color: '#f5b53d',
    pants: '#5b4a33',
    skin: '#c98d63',
    hair: '#1f140e',
    look: 'braid-hat',
    bio: 'Keeps the firm fed. Plants first, asks questions later.',
  },
  {
    id: 'yanis',
    name: 'Yanis',
    gender: 'male',
    role: 'Builder',
    color: '#ff7b47',
    pants: '#34405a',
    skin: '#e8b48f',
    hair: '#2a1a12',
    look: 'hardhat',
    bio: 'If it is still standing tomorrow, Yanis built it.',
  },
  {
    id: 'karim',
    name: 'Karim',
    gender: 'male',
    role: 'Woodcutter',
    color: '#3fc27f',
    pants: '#3d3a33',
    skin: '#a86b45',
    hair: '#1a100b',
    look: 'beanie-beard',
    bio: 'Knows every tree on the island by its bark.',
  },
  {
    id: 'amine',
    name: 'Amine',
    gender: 'male',
    role: 'Engineer',
    color: '#39b9ff',
    pants: '#2e3448',
    skin: '#f0c29e',
    hair: '#4a2c1a',
    look: 'goggles',
    bio: 'Turns wood and stone into tools the others did not know they needed.',
  },
  {
    id: 'rayan',
    name: 'Rayan',
    gender: 'male',
    role: 'Scout',
    color: '#ff5c8d',
    pants: '#3a3244',
    skin: '#7a4a2e',
    hair: '#0f0a07',
    look: 'cap-backpack',
    bio: 'Walks the island edge to edge and reports what he finds.',
  },
]

export const agentById = (id: string | null) => AGENTS.find((a) => a.id === id) ?? null
