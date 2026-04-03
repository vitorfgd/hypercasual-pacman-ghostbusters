/**
 * Player vs ghost: base speed is tuned so open-field kiting is possible while wandering.
 * Ghost **chase** (relic / vision hunt) is intentionally faster than the player — threat is
 * avoidance and LOS, not footraces.
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
export const GHOST_WANDER_SPEED = 3.55 * 1.08

/** Ghost chase when pursuing relic carrier — well above player max (hard to outrun in the open). */
export const GHOST_CHASE_SPEED = 23.5

/** Vision-cone hunt burst — very fast commitment after spotting the player. */
export const GHOST_HUNT_SPEED = 28.5

/** Ghost flee speed in FRIGHTENED (power mode) — slightly slower than chase, still readable */
export const GHOST_FRIGHT_SPEED = 5.15 * 1.08
