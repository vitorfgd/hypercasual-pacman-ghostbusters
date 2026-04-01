/**
 * Pac-Man–style speed relationships: player must outrun ghosts in a straight line;
 * threat comes from positioning and corners, not raw ghost speed.
 * All values: world units/sec (XZ).
 */

/** Default max horizontal speed at full stick (before upgrades & pulse mult). */
export const PLAYER_BASE_MAX_SPEED = 10.5

/**
 * Brief multiplier when the stick goes from idle → active (tighter initial response).
 */
export const PLAYER_START_BOOST_MULT = 1.14
export const PLAYER_START_BOOST_DURATION_SEC = 0.12

/** Ghost patrol speed (NORMAL wander) — slower, calmer roam */
export const GHOST_WANDER_SPEED = 3.55

/** Ghost chase speed in NORMAL (must stay < PLAYER_BASE_MAX_SPEED) */
export const GHOST_CHASE_SPEED = 6.25

/** Ghost flee speed in FRIGHTENED (power mode) — slightly slower than chase, still readable */
export const GHOST_FRIGHT_SPEED = 5.15
