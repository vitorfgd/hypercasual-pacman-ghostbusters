/**
 * Player vs ghost: arcade pacing — readable speeds, small chase advantage.
 * Grid ghosts: wander < player < chase/hunt (chase ramps up over `GHOST_CHASE_RAMP_UP_SEC`).
 * All values: world units/sec (XZ).
 */

/** Default move speed (before upgrades & pulse mult). Tuned for analog movement. */
export const PLAYER_BASE_MAX_SPEED = 7.7

/**
 * Brief multiplier when the stick goes from idle → active — keep subtle for grid control.
 */
export const PLAYER_START_BOOST_MULT = 1.1
export const PLAYER_START_BOOST_DURATION_SEC = 0.1

const P = PLAYER_BASE_MAX_SPEED

/** Hub / corridor steering. Slower than player when roaming, but not harmless. */
export const GHOST_WANDER_SPEED = P * 0.5

/** Chase sits close to player speed so line choice matters. */
export const GHOST_CHASE_SPEED = P * 0.91

/** Vision hunt gets a slight edge, forcing smarter cornering and routing. */
export const GHOST_HUNT_SPEED = P * 0.98

/** Power mode flee — clearly below player so you can catch them. */
export const GHOST_FRIGHT_SPEED = P * 0.78

/**
 * Grid (Pac-Man-style): same ratios as steering path; primary balance for rooms.
 */
export const GHOST_GRID_WANDER_SPEED = P * 0.5
export const GHOST_GRID_CHASE_SPEED = P * 0.91
export const GHOST_GRID_HUNT_SPEED = P * 0.98
export const GHOST_GRID_FRIGHT_SPEED = P * 0.78
