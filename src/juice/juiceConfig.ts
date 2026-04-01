/**
 * Central tuning for feel / juice. Adjust here rather than scattering magic numbers.
 */

/** Collection: base pickup (player.radius + this) */
export const PICKUP_EXTRA_RADIUS = 0.42
/** Pull pickups toward player in this outer band (world units beyond pickup reach) */
export const MAGNET_EXTRA_RADIUS = 1.15
/** How fast pickups slide on XZ toward player while in magnet band (world units / sec) */
export const MAGNET_PULL_SPEED = 5.5

/** World pickup collect pop duration (ItemWorld) */
export const COLLECT_POP_SEC = 0.22

/** Deposit flight — keep short for snappy feel */
export const DEPOSIT_FLIGHT_DURATION_SEC = 0.1
export const DEPOSIT_ARC_HEIGHT = 0.72
export const DEPOSIT_ARC_EASE = 2.15

/** Stack: new item bounce overshoot (relative to step height) */
export const STACK_ADD_BOUNCE = 0.14
export const STACK_BOUNCE_DECAY = 14

/** Camera: follow offset + stack-based pull-back */
export const CAMERA_OFFSET_BASE = { x: 0, y: 18, z: 12 }
export const CAMERA_STACK_ZOOM_Y = 0.08
export const CAMERA_STACK_ZOOM_Z = 0.055
export const CAMERA_STACK_ZOOM_MAX = 2.6
export const CAMERA_SMOOTH = 6.2

/** Money HUD count-up speed (higher = snappier) */
export const MONEY_DISPLAY_LERP = 10

/** Idle hint (seconds still, outside sources) */
export const IDLE_HINT_AFTER_SEC = 2.75
export const IDLE_SPEED_MAX = 0.18

/** Floating +1 / money pop */
export const FLOAT_TEXT_SEC = 0.85
