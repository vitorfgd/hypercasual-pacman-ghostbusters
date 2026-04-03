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

/** Deposit flight — per item (wisp / relic / pellet); lower = snappier */
export const DEPOSIT_FLIGHT_DURATION_SEC = 0.068
export const DEPOSIT_ARC_HEIGHT = 0.72
export const DEPOSIT_ARC_EASE = 2.15

/** Stack: new item bounce overshoot (relative to step height) */
export const STACK_ADD_BOUNCE = 0.14
export const STACK_BOUNCE_DECAY = 14

/** Camera: follow offset + stack-based pull-back */
export const CAMERA_OFFSET_BASE = { x: 0, y: 18, z: 12 }
export const CAMERA_STACK_ZOOM_Y = 0.08
export const CAMERA_STACK_ZOOM_Z = 0.055
/** Extra pull when fill ≥ this (e.g. 0.7 = heavy stack juice). */
export const CAMERA_HEAVY_STACK_FILL = 0.7
export const CAMERA_EXTRA_ZOOM_HEAVY = 1.15
export const CAMERA_STACK_ZOOM_MAX = 2.6
export const CAMERA_SMOOTH = 6.2

export type CameraMode = 'top_down' | 'over_shoulder'

/** Over-shoulder: distance behind player along facing. */
export const CAMERA_OTS_DISTANCE = 5.05
/** Height above player feet. */
export const CAMERA_OTS_HEIGHT = 2.72
/** Lateral shift (positive = player’s right) for shoulder framing. */
export const CAMERA_OTS_SHOULDER_OFFSET = 0.42
/** Look target ahead on the ground — keeps avatar lower in frame, clearer forward view. */
export const CAMERA_OTS_LOOK_AHEAD = 5.2
export const CAMERA_OTS_LOOK_HEIGHT = 1.02
/** Position smoothing (higher = snappier). */
export const CAMERA_OTS_SMOOTH_POS = 5.8
/** Look-target smoothing (reduces jitter when turning). */
export const CAMERA_OTS_SMOOTH_LOOK = 7.5
/** Eye height used for collision pull (between player and camera). */
export const CAMERA_OTS_EYE_HEIGHT = 1.52
/** Circle probe radius for wall avoidance (keep < player radius for tight halls). */
export const CAMERA_OTS_PROBE_RADIUS = 0.36
/** Enable pull-in when overlapping wall AABBs. */
export const CAMERA_OTS_COLLISION = true

/** Ghost contact costs one life; at 0 the run ends (see `Game.ts`). */
export const PLAYER_MAX_LIVES = 3

const CAM_MODE_KEY = 'ghostBusters.cameraMode'

export function loadSavedCameraMode(): CameraMode | null {
  try {
    const v = localStorage.getItem(CAM_MODE_KEY)
    if (v === 'top_down' || v === 'over_shoulder') return v
  } catch {
    /* ignore */
  }
  return null
}

export function saveCameraMode(mode: CameraMode): void {
  try {
    localStorage.setItem(CAM_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

/** Delay between each deposit item flight (seconds). */
export const DEPOSIT_INTER_ITEM_DELAY_SEC = 0.022

/** Ghost hit optional slow-motion (real-time seconds). */
export const GHOST_HIT_SLOW_MO_SEC = 0.14
export const GHOST_HIT_SLOW_MO_SCALE = 0.38

/** Dropped stack items (ghost / traps) vanish after this if not picked up. */
export const STACK_DROP_RECOVERY_TTL_SEC = 3.6
export const STACK_DROP_SCATTER_RADIUS = 2.1
/** Floating pickup / banner text duration */
export const FLOAT_TEXT_SEC = 0.85
