/**
 * Ghost AI tuning — adjust here; speeds also in `gameplaySpeed.ts` (player vs ghost balance).
 */

import { publicAsset } from '../../core/publicAsset.ts'
import { roomCenter } from '../world/mansionRoomData.ts'

export {
  GHOST_CHASE_SPEED,
  GHOST_FRIGHT_SPEED,
  GHOST_WANDER_SPEED,
} from '../gameplaySpeed.ts'

/** When player is within this horizontal distance, ghost switches to chase */
export const GHOST_DETECT_RADIUS = 6.8

/**
 * After chasing, ghost returns to wander only past this distance (hysteresis vs detect).
 * Must be ≥ `GHOST_DETECT_RADIUS` or ghosts flicker at the edge.
 */
export const GHOST_LOSE_CHASE_RADIUS = 9.2

/** Steering: chase / fright — snappier pursuit */
export const GHOST_STEERING_ACCEL_CHASE = 15.5

/** Steering: wander — softer, less twitchy */
export const GHOST_STEERING_ACCEL_WANDER = 9.2

/** Steering: frightened flee */
export const GHOST_STEERING_ACCEL_FRIGHT = 12

/** Lerp speed for desired direction (higher = snappier turns) */
export const GHOST_DIRECTION_SMOOTH_WANDER = 4.2
export const GHOST_DIRECTION_SMOOTH_CHASE = 10.5
export const GHOST_DIRECTION_SMOOTH_FRIGHT = 4.8

/** Yaw lerp (rad/s scale in exp) — face smoothed intent, not raw velocity (avoids spin on wall slides). */
export const GHOST_FACING_TURN_DEFAULT = 15
export const GHOST_FACING_TURN_FRIGHT = 10

/** Seconds between new random wander headings (calmer = longer) */
export const GHOST_WANDER_TURN_MIN = 1.05
export const GHOST_WANDER_TURN_MAX = 2.85

export type GhostSpawnSpec = {
  x: number
  z: number
  /** Hex body color (bright, readable from top-down) */
  color: number
}

const nw = roomCenter('NORTHWEST')
const ne = roomCenter('NORTHEAST')
const se = roomCenter('SOUTHEAST')
const n = roomCenter('NORTH')
const s = roomCenter('SOUTH')

/** Five ghosts: normal rooms only (never `SAFE_CENTER`). */
export const DEFAULT_GHOST_SPAWNS: readonly GhostSpawnSpec[] = [
  { x: nw.x - 0.35, z: nw.z + 0.35, color: 0xff3355 },
  { x: ne.x + 0.35, z: ne.z + 0.35, color: 0xff5eb5 },
  { x: se.x + 0.35, z: se.z - 0.35, color: 0x22e8ff },
  { x: n.x + 0.4, z: n.z - 0.5, color: 0xffaa33 },
  { x: s.x - 0.35, z: s.z + 0.45, color: 0x88ee66 },
]

/**
 * Uniform mesh scale (same idea as `version3` `ENEMY_GHOST_VISUAL_SCALE` ~0.98).
 * Slightly above 1 so they read well next to the player.
 */
export const GHOST_VISUAL_SCALE = 0.93

/** Served from `public/` (Vite). */
export const GHOST_GLTF_URL = publicAsset('assets/enemies/ghost.glb')

/** GLB root Y offset so feet sit on the floor. */
export const GHOST_GLB_Y_OFFSET = 0

/** Extra Y rotation if model forward ≠ world +Z (movement uses atan2(vx, vz)). */
export const GHOST_GLB_YAW_OFFSET = 0

// --- Player hit (ghost touch) — tension without full reset ---

/** Ghost body radius for circle–circle test (~max lathe radius × `GHOST_VISUAL_SCALE`) */
export const GHOST_COLLISION_RADIUS = 0.345

/**
 * Extra clearance so ghost bodies do not skim the safe hub (`SAFE_CENTER`) edges.
 * Used with `GHOST_COLLISION_RADIUS` for rectangle exclusion in `GhostSystem`.
 */
export const GHOST_DEPOSIT_EXCLUSION_PADDING = 0.14

/**
 * Extra clearance before another damage hit can register after leaving ghost melee
 * (prevents overlap spam while i-frames expire).
 */
export const GHOST_MELEE_REARM_PADDING = 0.42

/** Fraction of carried stack lost on hit: uniform random in [min, max] */
export const GHOST_HIT_LOSS_MIN = 0.3
export const GHOST_HIT_LOSS_MAX = 0.5

/** Seconds of invulnerability after a hit (ghost cannot register another touch) */
export const GHOST_HIT_INVULN_SEC = 1.55

/** Initial knockback speed away from ghost (world units/s, decays in PlayerController) */
export const GHOST_HIT_KNOCKBACK_SPEED = 7.8

/** Exponential decay on knockback velocity (higher = shorter slide) */
export const GHOST_HIT_KNOCKBACK_DECAY = 17

/** Max pellet meshes spawned for the “lost stack” burst (performance cap) */
export const GHOST_HIT_BURST_MAX_PARTICLES = 14

/** After landing a hit: push ghost this far from player (XZ) so bodies separate */
export const GHOST_POST_HIT_SEPARATION = 0.42

/** Burst velocity away from player after a hit (world units/s, blends with steering) */
export const GHOST_POST_HIT_DISENGAGE_SPEED = 10.5

/** Seconds before this ghost can enter chase again (roam / reposition) */
export const GHOST_POST_HIT_CHASE_LOCKOUT_SEC = 1.65

// --- Power mode: eating ghosts ---

/** Money granted when the player eats a ghost during power mode */
export const GHOST_EAT_MONEY_REWARD = 38

/** Visual shrink duration when captured (before hide + respawn timer). */
export const GHOST_EAT_SHRINK_SEC = 0.38

/** Seconds before an eaten ghost respawns at its spawn point */
export const GHOST_RESPAWN_AFTER_EAT_SEC = 4.25
