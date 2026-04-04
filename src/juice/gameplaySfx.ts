/**
 * Lightweight procedural SFX via Web Audio (no asset files).
 * Shares the default destination with the page; keep gains modest vs music.
 */

let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) throw new Error('AudioContext not supported')
  ctx = new Ctor()
  return ctx
}

async function resumeIfNeeded(audioCtx: AudioContext): Promise<void> {
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume()
    } catch {
      /* autoplay policy — skip sound */
    }
  }
}

/** Short bright “pop” for wisp pickup. */
export async function playWispCollectPop(): Promise<void> {
  try {
    const audioCtx = getContext()
    await resumeIfNeeded(audioCtx)
    if (audioCtx.state !== 'running') return

    const t0 = audioCtx.currentTime
    const dur = 0.085
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(920, t0)
    osc.frequency.exponentialRampToValueAtTime(1480, t0 + 0.045)
    const peak = 0.11
    g.gain.setValueAtTime(0.0008, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    osc.connect(g)
    g.connect(audioCtx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  } catch {
    /* ignore */
  }
}

/** Short ascending fanfare when a room hits 100% cleanliness. */
export async function playRoomClearFanfare(): Promise<void> {
  try {
    const audioCtx = getContext()
    await resumeIfNeeded(audioCtx)
    if (audioCtx.state !== 'running') return

    const t0 = audioCtx.currentTime + 0.01
    /** Staggered major arpeggio + resolution (seconds from t0, Hz, duration). */
    const phrase: { at: number; freq: number; len: number; vol: number }[] = [
      { at: 0, freq: 392, len: 0.11, vol: 0.085 },
      { at: 0.1, freq: 523.25, len: 0.11, vol: 0.09 },
      { at: 0.2, freq: 659.25, len: 0.12, vol: 0.095 },
      { at: 0.34, freq: 783.99, len: 0.14, vol: 0.1 },
      { at: 0.52, freq: 1046.5, len: 0.38, vol: 0.11 },
    ]

    for (const n of phrase) {
      const osc = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      osc.type = 'triangle'
      const start = t0 + n.at
      const end = start + n.len
      osc.frequency.setValueAtTime(n.freq, start)
      g.gain.setValueAtTime(0.0008, start)
      g.gain.exponentialRampToValueAtTime(n.vol, start + 0.018)
      g.gain.exponentialRampToValueAtTime(0.0008, end)
      osc.connect(g)
      g.connect(audioCtx.destination)
      osc.start(start)
      osc.stop(end + 0.04)
    }
  } catch {
    /* ignore */
  }
}
