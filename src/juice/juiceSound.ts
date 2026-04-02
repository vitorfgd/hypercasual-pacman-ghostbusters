/**
 * Optional one-shot tones via Web Audio (dev placeholder until real SFX assets).
 * Default: off (no allocation). Enable after a user gesture:
 *   `window.__juiceSoundEnabled = true`
 * Browsers may block `AudioContext` until then.
 */
export type JuiceSoundId =
  | 'pickup'
  | 'deposit_item'
  | 'deposit_complete'
  | 'money_tick'
  | 'overload_impact'
  | 'ghost_hit'
  | 'ghost_pulse'
  | 'ghost_eat'
  | 'relic_spawn'
  | 'relic_collect'

declare global {
  interface Window {
    /** When true, `playJuiceSound` plays minimal oscillator blips (see module doc). */
    __juiceSoundEnabled?: boolean
  }
}

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || window.__juiceSoundEnabled !== true) {
    return null
  }
  if (!sharedCtx) {
    sharedCtx = new AudioContext()
  }
  return sharedCtx
}

function baseFrequencyHz(id: JuiceSoundId): number {
  switch (id) {
    case 'pickup':
      return 920
    case 'deposit_item':
      return 520
    case 'deposit_complete':
      return 640
    case 'money_tick':
      return 1100
    case 'overload_impact':
      return 180
    case 'ghost_hit':
      return 140
    case 'ghost_pulse':
      return 340
    case 'ghost_eat':
      return 260
    case 'relic_spawn':
      return 480
    case 'relic_collect':
      return 720
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

export function playJuiceSound(
  id: JuiceSoundId,
  opts?: { pitch?: number },
): void {
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const pitch = opts?.pitch ?? 1
  const freq = Math.min(4800, Math.max(60, baseFrequencyHz(id) * pitch))
  const t0 = ctx.currentTime
  const dur = id === 'ghost_pulse' ? 0.06 : 0.045

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = id === 'overload_impact' || id === 'ghost_hit' ? 'square' : 'sine'
  osc.frequency.setValueAtTime(freq, t0)

  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}
