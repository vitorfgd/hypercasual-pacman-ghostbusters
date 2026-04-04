/**
 * Ghost AI tuning — adjust here; speeds also in `gameplaySpeed.ts` (player vs ghost balance).
 */

import { publicAsset } from '../../core/publicAsset.ts'
import {
  NORMAL_ROOM_COUNT,
  NORMAL_ROOM_IDS,
  ROOMS,
  roomCenter,
} from '../world/mansionRoomData.ts'

export {
  GHOST_CHASE_SPEED,
  GHOST_FRIGHT_SPEED,
  GHOST_GRID_CHASE_SPEED,
  GHOST_GRID_FRIGHT_SPEED,
  GHOST_GRID_HUNT_SPEED,
  GHOST_GRID_WANDER_SPEED,
  GHOST_HUNT_SPEED,
  GHOST_WANDER_SPEED,
} from '../gameplaySpeed.ts'

/**
 * @deprecated Normal rooms use vision cone; kept for relic chase / tuning reference.
 */
export const GHOST_DETECT_RADIUS = 6.8

/**
 * Relic chase: release chase when player is beyond this distance (omnidirectional).
 */
export const GHOST_LOSE_CHASE_RADIUS = 11.5

/** Full cone aperture in degrees (60–90). Half-angle used for dot test. */
export const GHOST_VISION_CONE_DEG = 64

export const GHOST_VISION_HALF_ANGLE_RAD =
  ((GHOST_VISION_CONE_DEG * Math.PI) / 180) * 0.5

/** Max sight distance along cone axis (world units). Keep modest so the floor cone hugs the ghost. */
export const GHOST_VISION_RANGE = 5.85

/** cos(halfAngle) for dot(forward, toPlayer) test. */
export const GHOST_VISION_COS_HALF = Math.cos(GHOST_VISION_HALF_ANGLE_RAD)

/** Sample segment ghost→player against wall AABBs (disable for perf / simpler AI). */
export const GHOST_VISION_USE_LINE_OF_SIGHT = true

/** Guaranteed chase window after the player is spotted. */
export const GHOST_VISION_CHASE_COMMIT_SEC = 1

/** After a hunt ends, cannot spot player again for this long (reduces re-trigger spam). */
export const GHOST_VISION_COOLDOWN_SEC = 1.85

/** End hunt early if player is farther than this (escape valve). */
export const GHOST_HUNT_ABORT_RANGE = 10.5

/**
 * During a vision hunt burst, if the player leaves the aggro cone for this long (seconds),
 * the hunt ends — matches “only the cone can spot you” feel.
 */
export const GHOST_HUNT_CONE_LOST_BREAK_SEC = 0.32

/** Wireframe cone under ghost feet (dev only). */
export const GHOST_VISION_DEBUG = false

/** Filled vision cone on the floor — matches aggro cone (range + half-angle). */
export const GHOST_VISION_CONE_VISIBLE = true
/** Base opacity (higher when actively chasing). */
export const GHOST_VISION_CONE_OPACITY = 0.2
export const GHOST_VISION_CONE_OPACITY_CHASE = 0.38
/** Ectoplasm tint (hex). */
export const GHOST_VISION_CONE_COLOR = 0x55eecc
/** Arc smoothness. */
export const GHOST_VISION_CONE_SEGMENTS = 40

/** Steering: chase / fright — moderated so speed ramp + direction read cleanly */
export const GHOST_STEERING_ACCEL_CHASE = 11

/** Steering: wander — softer, less twitchy */
export const GHOST_STEERING_ACCEL_WANDER = 8.2

/** Steering: frightened flee */
export const GHOST_STEERING_ACCEL_FRIGHT = 12

/** Lerp speed for desired direction (higher = snappier turns) */
export const GHOST_DIRECTION_SMOOTH_WANDER = 4.2
export const GHOST_DIRECTION_SMOOTH_CHASE = 9.5
export const GHOST_DIRECTION_SMOOTH_FRIGHT = 4.8

/** Yaw lerp (rad/s scale in exp) — face smoothed intent, not raw velocity (avoids spin on wall slides). */
export const GHOST_FACING_TURN_DEFAULT = 15
export const GHOST_FACING_TURN_FRIGHT = 10

/** Seconds between new random wander headings (calmer = longer) */
export const GHOST_WANDER_TURN_MIN = 1.05
export const GHOST_WANDER_TURN_MAX = 2.85

/**
 * Chase peak speed ramps from wander-equivalent (0) to full chase/hunt (1).
 * Keeps chase readable — no instant snap to max speed.
 */
export const GHOST_CHASE_RAMP_UP_SEC = 0.62
export const GHOST_CHASE_RAMP_DOWN_SEC = 0.32

/** After spotting the player, brief wander-only grid before chase AI/speed ramp (seconds). */
export const GHOST_CHASE_WINDUP_SEC = 0.38

export type GhostSpawnRole = 'normal' | 'boss' | 'minion'

export type GhostSpawnSpec = {
  x: number
  z: number
  /** Hex body color (bright, readable from top-down) */
  color: number
  /** Mansion chain room index (1…N) — drives size & speed */
  roomIndex: number
  /** Boss room: large slow seeker; minions use normal AI at smaller scale. */
  role?: GhostSpawnRole
}

/** Per-room ghost counts (ROOM_1 … ROOM_N). Last room is boss (0). Max tier = 3. */
export const GHOSTS_PER_ROOM: readonly number[] = (() => {
  const pattern = [1, 2, 2, 2, 3, 3, 3, 3, 3, 0]
  if (pattern.length !== NORMAL_ROOM_COUNT) {
    throw new Error('GHOSTS_PER_ROOM length must match NORMAL_ROOM_COUNT')
  }
  return pattern
})()

/** Seconds of celebration / camera settle before the room-upgrade picker appears. */
export const ROOM_CLEAR_UPGRADE_INTRO_SEC = 0.72

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

/**
 * Chance that collecting **haunted** clutter spawns a ghost (relic logic is unchanged).
 * Tuned with `clutterPrefill` haunted density so extra spawns stay noticeable but not spammy.
 */
export const HAUNTED_PICKUP_GHOST_CHANCE = 0.38

/**
 * Per grid-wisp pickup: spawn chance ramps from min (early in room) to max (few wisps left).
 * `wispsCollectedInRoomAfterThisPickup / totalWispsInRoom` drives the blend.
 */
export const WISP_COLLECT_GHOST_CHANCE_MIN = 0.028
export const WISP_COLLECT_GHOST_CHANCE_MAX = 0.18

/** Min world distance from player for random grid spawn (fallback picks farther cells if cramped). */
export const WISP_GHOST_SPAWN_MIN_PLAYER_DIST = 1.85

export function wispCollectGhostSpawnProbability(
  wispsCollectedInRoomAfterThisPickup: number,
  totalWispsInRoom: number,
  hauntedChanceBonus: number,
): number {
  if (totalWispsInRoom <= 0) return 0
  const t = Math.min(
    1,
    Math.max(0, wispsCollectedInRoomAfterThisPickup / totalWispsInRoom),
  )
  const p =
    WISP_COLLECT_GHOST_CHANCE_MIN +
    t * (WISP_COLLECT_GHOST_CHANCE_MAX - WISP_COLLECT_GHOST_CHANCE_MIN)
  return Math.min(0.94, p + hauntedChanceBonus)
}

/** Stop spawning new ghosts from haunted pickups once this many are active (chase/wander). */
export const MAX_ACTIVE_GHOSTS = 9

/** Mesh scale multiplier at first vs last chain room (applied on top of `GHOST_VISUAL_SCALE`). */
const GHOST_ROOM_VISUAL_SCALE_MIN = 0.82
const GHOST_ROOM_VISUAL_SCALE_MAX = 1.18

/** Speed multiplier at first vs last chain room (wander / chase / fright). */
const GHOST_ROOM_SPEED_MUL_MIN = 0.88
const GHOST_ROOM_SPEED_MUL_MAX = 1.06

const ROOM_CHAIN_DEPTH = Math.max(1, NORMAL_ROOM_COUNT - 1)

/** Visual size scales from first room (smallest) to last (largest). */
export function ghostRoomVisualMul(roomIndex: number): number {
  const t =
    (Math.max(1, Math.min(NORMAL_ROOM_COUNT, roomIndex)) - 1) / ROOM_CHAIN_DEPTH
  return (
    GHOST_ROOM_VISUAL_SCALE_MIN +
    t * (GHOST_ROOM_VISUAL_SCALE_MAX - GHOST_ROOM_VISUAL_SCALE_MIN)
  )
}

/** Movement speeds scale from first room to last (still below player sprint). */
export function ghostRoomSpeedMul(roomIndex: number): number {
  const t =
    (Math.max(1, Math.min(NORMAL_ROOM_COUNT, roomIndex)) - 1) / ROOM_CHAIN_DEPTH
  return (
    GHOST_ROOM_SPEED_MUL_MIN +
    t * (GHOST_ROOM_SPEED_MUL_MAX - GHOST_ROOM_SPEED_MUL_MIN)
  )
}

/** One pattern per chain slot — cycles when `NORMAL_ROOM_COUNT` exceeds pattern length. */
const SPAWN_OFFSETS_BASE: readonly (readonly { ox: number; oz: number }[])[] = [
  [{ ox: -0.35, oz: 0.35 }],
  [{ ox: 0.38, oz: -0.28 }],
  [
    { ox: -0.48, oz: 0.22 },
    { ox: 0.42, oz: -0.32 },
  ],
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

const SPAWN_COLORS_BASE: readonly number[][] = [
  [0xff3355],
  [0xff5eb5],
  [0x22e8ff, 0x1ad4ee],
  [0xffaa33, 0xff8822],
  [0x88ee66, 0x66dd44, 0x44cc33],
]

const SPAWN_OFFSETS: readonly (readonly { ox: number; oz: number }[])[] =
  Array.from({ length: NORMAL_ROOM_COUNT }, (_, i) => {
    const src = SPAWN_OFFSETS_BASE[i % SPAWN_OFFSETS_BASE.length]!
    return src
  })

const SPAWN_COLORS: readonly number[][] = Array.from(
  { length: NORMAL_ROOM_COUNT },
  (_, i) => SPAWN_COLORS_BASE[i % SPAWN_COLORS_BASE.length]!,
)

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

/** Body tint for a new ghost at `roomIndex` ≥1 (matches default spawn palette). */
export function pickGhostColorForRoomIndex(
  roomIndex: number,
  random: () => number,
): number {
  const slot = Math.max(0, Math.floor(roomIndex) - 1) % SPAWN_COLORS.length
  const colors = SPAWN_COLORS[slot]!
  return colors[Math.floor(random() * colors.length)]!
}

export function buildDefaultGhostSpawns(): GhostSpawnSpec[] {
  const out: GhostSpawnSpec[] = []
  const margin = 0.62
  for (let ri = 0; ri < NORMAL_ROOM_IDS.length; ri++) {
    const roomId = NORMAL_ROOM_IDS[ri]!
    const count = GHOSTS_PER_ROOM[ri]!
    const offs = SPAWN_OFFSETS[ri]!
    const colors = SPAWN_COLORS[ri]!
    const bounds = ROOMS[roomId].bounds
    const c = roomCenter(roomId)
    for (let i = 0; i < count; i++) {
      const o = offs[i % offs.length]!
      const rawX = c.x + o.ox
      const rawZ = c.z + o.oz
      const p = clampSpawnToRoomBounds(rawX, rawZ, bounds, margin)
      out.push({
        x: p.x,
        z: p.z,
        color: colors[i % colors.length]!,
        roomIndex: ri + 1,
      })
    }
  }
  return out
}

/** Full spawn list (used to partition per room for lazy spawn). */
export const DEFAULT_GHOST_SPAWNS: readonly GhostSpawnSpec[] =
  buildDefaultGhostSpawns()

/** Prespawn specs grouped by `roomIndex` (1…N) for unlocking rooms one at a time. */
export function partitionGhostSpawnsByRoom(): readonly GhostSpawnSpec[][] {
  const byRoom: GhostSpawnSpec[][] = Array.from(
    { length: NORMAL_ROOM_COUNT },
    () => [],
  )
  for (const s of buildDefaultGhostSpawns()) {
    const i = s.roomIndex - 1
    if (i >= 0 && i < byRoom.length) {
      byRoom[i]!.push(s)
    }
  }
  return byRoom
}

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

/** Fraction of carried stack lost on hit: uniform random in [min, max] (then clamp ≥1 item). */
export const GHOST_HIT_LOSS_MIN = 0.2
export const GHOST_HIT_LOSS_MAX = 0.35

/** Seconds of invulnerability after a hit (ghost cannot register another touch) */
export const GHOST_HIT_INVULN_SEC = 1.55

/** Brief ground-pickup lock so burst items scatter before re-collection. */
export const GHOST_HIT_PICKUP_LOCK_SEC = 0.32

/** Initial knockback speed away from ghost (world units/s, decays in PlayerController) */
export const GHOST_HIT_KNOCKBACK_SPEED = 7.8

/** Exponential decay on knockback velocity (higher = shorter slide) */
export const GHOST_HIT_KNOCKBACK_DECAY = 17

/** Max pellet meshes spawned for the “lost stack” burst (performance cap) */
export const GHOST_HIT_BURST_MAX_PARTICLES = 14

/** Stronger burst cap when ghost lands a hit (visual juice). */
export const GHOST_HIT_BURST_MAX_PARTICLES_INTENSE = 34

/** Ghost-hit scatter: min ring radius (world units) from player */
export const GHOST_HIT_SCATTER_R_MIN = 0.45
/** Ghost-hit scatter: extra random radius on top of min */
export const GHOST_HIT_SCATTER_R_SPREAD = 2.85

/** Recoverable kick — horizontal burst speed (world units/s) */
export const GHOST_HIT_DROP_KICK_H_MIN = 5.2
export const GHOST_HIT_DROP_KICK_H_SPREAD = 6.4
/** Recoverable kick — upward pop */
export const GHOST_HIT_DROP_POP_VY_MIN = 5.8
export const GHOST_HIT_DROP_POP_VY_SPREAD = 5.2

/** After landing a hit: push ghost this far from player (XZ) so bodies separate */
export const GHOST_POST_HIT_SEPARATION = 0.42

/** Burst velocity away from player after a hit (world units/s, blends with steering) */
export const GHOST_POST_HIT_DISENGAGE_SPEED = 10.5

/** Seconds before this ghost can enter chase again (roam / reposition) */
export const GHOST_POST_HIT_CHASE_LOCKOUT_SEC = 1.65

// --- Power mode: eating ghosts ---

/** Visual shrink duration when captured (before hide + respawn timer). */
export const GHOST_EAT_SHRINK_SEC = 0.38

/** Seconds before an eaten ghost respawns at its spawn point */
export const GHOST_RESPAWN_AFTER_EAT_SEC = 4.25
