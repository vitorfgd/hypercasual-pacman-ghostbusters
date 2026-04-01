/**
 * Automatic Ghostbuster-style pulse: no pickup — timed cycle only.
 * Interval / duration scale with shop upgrades (see `upgradeConfig.ts`).
 */

/** Starting seconds between pulse *starts* (level 0). */
export const BASE_GHOST_PULSE_INTERVAL_SEC = 10

/** Minimum interval after max frequency upgrades (hard floor). */
export const GHOST_PULSE_INTERVAL_MIN_SEC = 5.25

/** Seconds trimmed from interval per frequency upgrade level. */
export const GHOST_PULSE_INTERVAL_STEP_SEC = 0.42

/** Starting active window per cycle (level 0). */
export const BASE_GHOST_PULSE_DURATION_SEC = 2.75

/** Seconds added per duration upgrade level. */
export const GHOST_PULSE_DURATION_STEP_SEC = 0.22

/** Cap so pulse + upgrades cannot dominate the whole cycle. */
export const GHOST_PULSE_DURATION_MAX_SEC = 4.75

/** Slight speed boost while the pulse is active. */
export const GHOST_PULSE_SPEED_MULTIPLIER = 1.12

export type GhostPulsePhase = {
  /** Pulse window active — ghosts flee, player can eat them, strong glow. */
  active: boolean
  /** Seconds left in the current pulse (0 if idle). */
  remainingSec: number
  /** Seconds until the next pulse *starts* (0 while active). */
  timeUntilNextPulseSec: number
}

/**
 * Cycle: pulse for `durationSec`, then idle until `intervalSec` elapses from phase start.
 * `durationSec` should stay &lt; `intervalSec` (callers clamp via upgrade helpers).
 */
export function computeGhostPulsePhase(
  elapsedSec: number,
  intervalSec: number,
  durationSec: number,
): GhostPulsePhase {
  const safeDur = Math.min(durationSec, intervalSec * 0.92)
  const cycle = elapsedSec % intervalSec
  const active = cycle < safeDur
  const remainingSec = active ? safeDur - cycle : 0
  const timeUntilNextPulseSec = active ? 0 : intervalSec - cycle
  return { active, remainingSec, timeUntilNextPulseSec }
}
