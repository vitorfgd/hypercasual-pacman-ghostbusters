/**
 * Ghost AI tuning — adjust here; speeds also in `gameplaySpeed.ts` (player vs ghost balance).
 */

import { publicAsset } from '../../core/publicAsset.ts'
import { ROOMS, roomCenter, type RoomId } from '../world/mansionRoomData.ts'

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
  /** Mansion chain room `ROOM_1` … `ROOM_5` — drives size & speed */
  roomIndex: number
}

/** Ghost count per north-chain room (ROOM_1 … ROOM_5). */
export const GHOSTS_PER_ROOM = [1, 1, 1, 0, 1] as const

/** When a room is cleared, ghosts for that room shrink away and are removed (no respawn). */
export const GHOST_ROOM_PURGE_SHRINK_SEC = 0.55

/**
 * Newly spawned / respawned ghosts roam this long before they can chase (player detect / relic aggro).
 * Random in [min, max] seconds.
 */
export const GHOST_SPAWN_CHASE_GRACE_MIN = 1
export const GHOST_SPAWN_CHASE_GRACE_MAX = 2

export function randomSpawnChaseGraceSec(): number {
  return (
    GHOST_SPAWN_CHASE_GRACE_MIN +
    Math.random() *
      (GHOST_SPAWN_CHASE_GRACE_MAX - GHOST_SPAWN_CHASE_GRACE_MIN)
  )
}

/** Mesh scale multiplier at ROOM_1 vs ROOM_5 (applied on top of `GHOST_VISUAL_SCALE`). */
const GHOST_ROOM_VISUAL_SCALE_MIN = 0.82
const GHOST_ROOM_VISUAL_SCALE_MAX = 1.18

/** Speed multiplier at ROOM_1 vs ROOM_5 (wander / chase / fright). */
const GHOST_ROOM_SPEED_MUL_MIN = 0.88
const GHOST_ROOM_SPEED_MUL_MAX = 1.28

/** Visual size scales from first room (smallest) to last (largest). */
export function ghostRoomVisualMul(roomIndex: number): number {
  const t = (Math.max(1, Math.min(5, roomIndex)) - 1) / 4
  return (
    GHOST_ROOM_VISUAL_SCALE_MIN +
    t * (GHOST_ROOM_VISUAL_SCALE_MAX - GHOST_ROOM_VISUAL_SCALE_MIN)
  )
}

/** Movement speeds scale from first room to last (still below player sprint). */
export function ghostRoomSpeedMul(roomIndex: number): number {
  const t = (Math.max(1, Math.min(5, roomIndex)) - 1) / 4
  return (
    GHOST_ROOM_SPEED_MUL_MIN +
    t * (GHOST_ROOM_SPEED_MUL_MAX - GHOST_ROOM_SPEED_MUL_MIN)
  )
}

const ROOM_CHAIN: readonly RoomId[] = [
  'ROOM_1',
  'ROOM_2',
  'ROOM_3',
  'ROOM_4',
  'ROOM_5',
]

/** Local XZ offsets from room center — lengths match `GHOSTS_PER_ROOM`. */
const SPAWN_OFFSETS: readonly (readonly { ox: number; oz: number }[])[] = [
  [{ ox: -0.35, oz: 0.35 }],
  [{ ox: 0.38, oz: -0.28 }],
  [{ ox: -0.48, oz: 0.22 }],
  [
    { ox: -0.44, oz: 0.26 },
    { ox: 0.4, oz: -0.36 },
  ],
  [
    { ox: -0.08, oz: 0.4 },
    { ox: -0.5, oz: -0.38 },
    { ox: 0.46, oz: -0.34 },
  ],
]

const SPAWN_COLORS: readonly number[][] = [
  [0xff3355],
  [0xff5eb5],
  [0x22e8ff, 0x1ad4ee],
  [0xffaa33, 0xff8822],
  [0x88ee66, 0x66dd44, 0x44cc33],
]

function clampSpawnToRoomBounds(
  x: number,
  z: number,
  bounds: (typeof ROOMS)['ROOM_1']['bounds'],
  margin: number,
): { x: number; z: number } {
  return {
    x: Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, x)),
    z: Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, z)),
  }
}

/** Body tint for a new ghost at `roomIndex` 1…5 (matches default spawn palette). */
export function pickGhostColorForRoomIndex(
  roomIndex: number,
  random: () => number,
): number {
  const ri = Math.max(0, Math.min(4, Math.floor(roomIndex) - 1))
  const colors = SPAWN_COLORS[ri]!
  return colors[Math.floor(random() * colors.length)]!
}

export function buildDefaultGhostSpawns(): GhostSpawnSpec[] {
  const out: GhostSpawnSpec[] = []
  const margin = 0.62
  for (let ri = 0; ri < ROOM_CHAIN.length; ri++) {
    const roomId = ROOM_CHAIN[ri]!
    const count = GHOSTS_PER_ROOM[ri]!
    const offs = SPAWN_OFFSETS[ri]!
    const colors = SPAWN_COLORS[ri]!
    const bounds = ROOMS[roomId].bounds
    const c = roomCenter(roomId)
    for (let i = 0; i < count; i++) {
      const o = offs[i]!
      const rawX = c.x + o.ox
      const rawZ = c.z + o.oz
      const p = clampSpawnToRoomBounds(rawX, rawZ, bounds, margin)
      out.push({
        x: p.x,
        z: p.z,
        color: colors[i]!,
        roomIndex: ri + 1,
      })
    }
  }
  return out
}

/** Spawns across the chain (ROOM_4 empty here); larger & faster toward ROOM_5. */
export const DEFAULT_GHOST_SPAWNS: readonly GhostSpawnSpec[] =
  buildDefaultGhostSpawns()

/**
 * Uniform mesh scale (same idea as `version3` `ENEMY_GHOST_VISUAL_SCALE` ~0.98).
 * Global −25% vs prior baseline; room tier still scales on top via `ghostRoomVisualMul`.
 */
export const GHOST_VISUAL_SCALE = 0.93 * 0.75

/** Served from `public/` (Vite). */
export const GHOST_GLTF_URL = publicAsset('assets/enemies/ghost.glb')

/** GLB root Y offset so feet sit on the floor. */
export const GHOST_GLB_Y_OFFSET = 0

/** Extra Y rotation if model forward ≠ world +Z (movement uses atan2(vx, vz)). */
export const GHOST_GLB_YAW_OFFSET = 0

// --- Player hit (ghost touch) — tension without full reset ---

/**
 * Base ghost body radius for circle tests at `ROOM_1` scale (`ghostRoomVisualMul` 1).
 * Actual radius is `GHOST_COLLISION_RADIUS * ghostRoomVisualMul(roomIndex)`.
 */
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

/** Stronger burst cap when ghost lands a hit (visual juice). */
export const GHOST_HIT_BURST_MAX_PARTICLES_INTENSE = 22

/** After a hit, vacuum (magnet pull) is disabled for this many seconds. */
export const GHOST_HIT_VACUUM_DISABLE_SEC = 0.5

/**
 * Chance each popped item becomes a recoverable world pickup (rest are lost in the blast).
 * Order is still LIFO from `popManyFromTop`; per-item roll is independent.
 */
export const GHOST_HIT_DROP_RECOVER_CHANCE = 0.58

/** Ghost-hit scatter: min ring radius (world units) from player */
export const GHOST_HIT_SCATTER_R_MIN = 0.55
/** Ghost-hit scatter: extra random radius on top of min */
export const GHOST_HIT_SCATTER_R_SPREAD = 2.45

/** Recoverable kick — horizontal burst speed (world units/s) */
export const GHOST_HIT_DROP_KICK_H_MIN = 4.8
export const GHOST_HIT_DROP_KICK_H_SPREAD = 5.2
/** Recoverable kick — upward pop */
export const GHOST_HIT_DROP_POP_VY_MIN = 5.4
export const GHOST_HIT_DROP_POP_VY_SPREAD = 4.4

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
