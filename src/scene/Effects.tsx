import { Bloom, EffectComposer, SMAA, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useGame } from '@/state/store'

/**
 * Post stack. Tilt-shift is what sells the "living diorama" look; bloom lets the
 * fire, crystals and goggles glow at night. On weak GPUs the monitor drops tilt-shift.
 */
export function Effects() {
  const lowPower = useGame((s) => s.lowPower)
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.92} luminanceSmoothing={0.15} radius={0.7} />
      {lowPower ? <></> : <TiltShift2 blur={0.08} taper={0.6} start={[0, 0.5]} end={[1, 0.5]} samples={8} />}
      <Vignette offset={0.3} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  )
}
