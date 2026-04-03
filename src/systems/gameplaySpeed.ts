/**
 * Player vs ghost: arcade pacing — readable speeds, small chase advantage.
 * Grid ghosts: wander < player < chase/hunt (chase ramps up over `GHOST_CHASE_RAMP_UP_SEC`).
 * All values: world units/sec (XZ).
 */

/** Default max grid / run speed (before upgrades & pulse mult). Deliberate, not slippery. */
export const PLAYER_BASE_MAX_SPEED = 8.0

/**
 * Brief multiplier when the stick goes from idle → active — keep subtle for grid control.
 */
export const PLAYER_START_BOOST_MULT = 1.05
export const PLAYER_START_BOOST_DURATION_SEC = 0.08

const P = PLAYER_BASE_MAX_SPEED

/** Hub / corridor steering (non-grid). Slower than player when roaming. */
export const GHOST_WANDER_SPEED = P * 0.68

/** Chase — a bit below base player max so grid escapes read; upgrades still widen the gap. */
export const GHOST_CHASE_SPEED = P * 0.93

/** Vision hunt — small bump over chase, still under a full sprint feel. */
export const GHOST_HUNT_SPEED = P * 0.96

/** Power mode flee — clearly below player so you can catch them. */
export const GHOST_FRIGHT_SPEED = P * 0.72

/**
 * Grid (Pac-Man-style): same ratios as steering path; primary balance for rooms.
 */
export const GHOST_GRID_WANDER_SPEED = P * 0.68
export const GHOST_GRID_CHASE_SPEED = P * 0.93
export const GHOST_GRID_HUNT_SPEED = P * 0.96
export const GHOST_GRID_FRIGHT_SPEED = P * 0.72
