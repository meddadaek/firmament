import { Character } from './Character'
import { AGENTS } from './roster'

/** The six founders. Their bodies are drawn here; where they go and what they do comes from the engine. */
export function Agents() {
  return (
    <>
      {AGENTS.map((def, i) => (
        <Character key={def.id} def={def} seed={i * 1.7} />
      ))}
    </>
  )
}
