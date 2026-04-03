import type { Group } from 'three'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { GhostGltfTemplate } from './ghostGltfAsset.ts'
import { createGhostVisual } from './createGhostVisual.ts'
import { MANSION_WORLD_HALF } from '../world/mansionGeometry.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import {
  BOSS_EXTRA_VISUAL_MUL,
  BOSS_MINION_VISUAL_MUL,
  BOSS_SEEK_SPEED,
} from '../boss/bossRoomConfig.ts'
import {
  createGhostGridNavState,
  getGhostGridBoundsAt,
  resetGhostGridNavState,
  stepGhostGridNav,
  type GhostGridNavMode,
  type GhostGridNavState,
} from './ghostGridNav.ts'
import {
  GHOST_CHASE_RAMP_DOWN_SEC,
  GHOST_CHASE_RAMP_UP_SEC,
  GHOST_CHASE_SPEED,
  GHOST_CHASE_WINDUP_SEC,
  GHOST_COLLISION_RADIUS,
  GHOST_DEPOSIT_EXCLUSION_PADDING,
  GHOST_DIRECTION_SMOOTH_CHASE,
  GHOST_DIRECTION_SMOOTH_WANDER,
  GHOST_FACING_TURN_DEFAULT,
  GHOST_FACING_TURN_FRIGHT,
  GHOST_GRID_CHASE_SPEED,
  GHOST_GRID_FRIGHT_SPEED,
  GHOST_GRID_HUNT_SPEED,
  GHOST_GRID_WANDER_SPEED,
  GHOST_FRIGHT_SPEED,
  GHOST_HUNT_ABORT_RANGE,
  GHOST_HUNT_CONE_LOST_BREAK_SEC,
  GHOST_HUNT_DURATION_MAX,
  GHOST_HUNT_DURATION_MIN,
  GHOST_HUNT_SPEED,
  GHOST_MELEE_REARM_PADDING,
  GHOST_POST_HIT_CHASE_LOCKOUT_SEC,
  GHOST_POST_HIT_DISENGAGE_SPEED,
  GHOST_POST_HIT_SEPARATION,
  GHOST_EAT_SHRINK_SEC,
  GHOST_RESPAWN_AFTER_EAT_SEC,
  GHOST_ROOM_PURGE_SHRINK_SEC,
  randomSpawnChaseGraceSec,
  GHOST_STEERING_ACCEL_CHASE,
  GHOST_STEERING_ACCEL_WANDER,
  GHOST_WANDER_SPEED,
  GHOST_VISION_COOLDOWN_SEC,
  GHOST_VISION_CONE_COLOR,
  GHOST_VISION_CONE_OPACITY,
  GHOST_VISION_CONE_OPACITY_CHASE,
  GHOST_VISION_CONE_SEGMENTS,
  GHOST_VISION_CONE_VISIBLE,
  GHOST_VISION_COS_HALF,
  GHOST_VISION_DEBUG,
  GHOST_VISION_HALF_ANGLE_RAD,
  GHOST_VISION_RANGE,
  GHOST_VISION_USE_LINE_OF_SIGHT,
  GHOST_WANDER_TURN_MAX,
  GHOST_WANDER_TURN_MIN,
  ghostRoomSpeedMul,
  ghostRoomVisualMul,
  type GhostSpawnRole,
  type GhostSpawnSpec,
} from './ghostConfig.ts'
import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import { DOOR_COUNT } from '../doors/doorLayout.ts'
import { ROOMS } from '../world/mansionRoomData.ts'

/** One shared mesh (ghost spawns were each allocating a full geometry — costly on door open). */
let sharedGhostVisionConeGeometry: BufferGeometry | null = null

/** Call from `Game.dispose` after ghosts are torn down — shared cone geometry is not per-ghost. */
export function disposeSharedGhostVisionConeGeometry(): void {
  sharedGhostVisionConeGeometry?.dispose()
  sharedGhostVisionConeGeometry = null
}

function getSharedGhostVisionConeGeometry(): BufferGeometry {
  if (sharedGhostVisionConeGeometry) return sharedGhostVisionConeGeometry
  const R = GHOST_VISION_RANGE
  const half = GHOST_VISION_HALF_ANGLE_RAD
  const segs = GHOST_VISION_CONE_SEGMENTS
  const y = 0.04
  const positions: number[] = []
  positions.push(0, y, 0)
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const a = -half + t * (2 * half)
    positions.push(Math.sin(a) * R, y, Math.cos(a) * R)
  }
  const indices: number[] = []
  for (let i = 0; i < segs; i++) {
    indices.push(0, 1 + i, 2 + i)
  }
  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  sharedGhostVisionConeGeometry = geom
  return geom
}

/** Floor sector matching `playerInVisionCone` (range + half-angle, opening along local +Z). */
function createGhostVisionConeMesh(): Mesh {
  const mat = new MeshBasicMaterial({
    color: GHOST_VISION_CONE_COLOR,
    transparent: true,
    opacity: GHOST_VISION_CONE_OPACITY,
    depthWrite: false,
    side: DoubleSide,
  })
  const mesh = new Mesh(getSharedGhostVisionConeGeometry(), mat)
  mesh.name = 'ghostVisionCone'
  mesh.renderOrder = 3
  mesh.frustumCulled = false
  mesh.userData.sharedGhostGeometry = true
  return mesh
}

export type GhostBehaviorState = 'wander' | 'chase'

export type GhostHitResult =
  | { kind: 'none' }
  | { kind: 'hit'; ghostX: number; ghostZ: number }

export type GhostEatResult =
  | { kind: 'none' }
  | { kind: 'eat'; ghostX: number; ghostZ: number }

/** When a door opens, instantiate map ghosts over several frames to avoid a single-frame hitch. */
const MAP_GHOST_SPAWN_BUDGET_PER_FRAME = 5

export class GhostSystem {
  private readonly ghosts: Ghost[] = []
  private readonly ghostGroup: Group
  private readonly worldCollision: WorldCollision
  private readonly ghostGltf: GhostGltfTemplate | null
  private readonly doorUnlock: DoorUnlockSystem
  private ghostAnimTime = 0
  /** Run-wide modifier (e.g. Spectral bargain). Applied after per-room `speedMul`. */
  private runtimeSpeedMul = 1

  private readonly spawnsByRoom: readonly (readonly GhostSpawnSpec[])[]
  private readonly spawnedRoomIndices = new Set<number>()
  /** Deferred `Ghost` construction for rooms unlocked via doors (not room 1 at init). */
  private readonly pendingMapSpawnSpecs: GhostSpawnSpec[] = []

  constructor(
    ghostGroup: Group,
    worldCollision: WorldCollision,
    spawnsByRoom: readonly (readonly GhostSpawnSpec[])[],
    ghostGltf: GhostGltfTemplate | null = null,
    doorUnlock: DoorUnlockSystem,
  ) {
    this.ghostGroup = ghostGroup
    this.worldCollision = worldCollision
    this.ghostGltf = ghostGltf
    this.doorUnlock = doorUnlock
    this.spawnsByRoom = spawnsByRoom
    this.spawnGhostsForRoom(1)
  }

  /**
   * Instantiate map ghosts for `ROOM_{roomIndex}` once (when that room unlocks).
   * Room 1 is spawned synchronously at construction; deeper rooms are queued to spread cost.
   */
  spawnGhostsForRoom(roomIndex: number): void {
    if (roomIndex < 1 || this.spawnedRoomIndices.has(roomIndex)) return
    const idx = roomIndex - 1
    const specs = this.spawnsByRoom[idx]
    if (!specs?.length) {
      this.spawnedRoomIndices.add(roomIndex)
      return
    }
    this.spawnedRoomIndices.add(roomIndex)
    if (roomIndex === 1) {
      for (const s of specs) {
        this.ghosts.push(
          new Ghost(this.ghostGroup, this.worldCollision, s, this.ghostGltf),
        )
      }
      return
    }
    for (const s of specs) {
      this.pendingMapSpawnSpecs.push(s)
    }
  }

  private flushPendingMapSpawns(): void {
    let n = 0
    while (
      n < MAP_GHOST_SPAWN_BUDGET_PER_FRAME &&
      this.pendingMapSpawnSpecs.length > 0
    ) {
      const s = this.pendingMapSpawnSpecs.shift()!
      this.ghosts.push(
        new Ghost(this.ghostGroup, this.worldCollision, s, this.ghostGltf),
      )
      n++
    }
  }

  /** Global ghost speed scale from run upgrades (clamped). */
  setRuntimeSpeedMultiplier(m: number): void {
    this.runtimeSpeedMul = Math.max(0.55, Math.min(1.15, m))
  }

  getRuntimeSpeedMultiplier(): number {
    return this.runtimeSpeedMul
  }

  /** Runtime spawn (e.g. haunted clutter). Uses the same `Ghost` behavior as map spawns. */
  spawnGhost(spec: GhostSpawnSpec): void {
    this.ghosts.push(
      new Ghost(this.ghostGroup, this.worldCollision, spec, this.ghostGltf),
    )
  }

  /** Boss ghost position for knockback pulses; null if absent or fading. */
  getBossGhostXZ(): { x: number; z: number } | null {
    for (const g of this.ghosts) {
      if (!g.isBossGhost()) continue
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading())
        continue
      return { x: g.root.position.x, z: g.root.position.z }
    }
    return null
  }

  /** Minion ghosts in the final room (for spawn cap). */
  countMinionGhostsInRoom(roomIndex: number): number {
    let n = 0
    for (const g of this.ghosts) {
      if (!g.isMinionGhost()) continue
      if (g.getRoomIndex() !== roomIndex) continue
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading()) continue
      n++
    }
    return n
  }

  /** Ghosts currently in play (not eaten, not mid–room-clear purge). */
  getActiveGhostCount(): number {
    let n = 0
    for (const g of this.ghosts) {
      if (!g.isEaten() && !g.isRoomClearPurging() && !g.isGateClearFading()) n++
    }
    return n
  }

  /** Cleared room: fade ghosts out during the early cinematic (replaces immediate purge). */
  beginGateClearFadeForRoom(roomIndex: number, durationSec: number): void {
    for (const g of this.ghosts) {
      if (g.getRoomIndex() === roomIndex && !g.isEaten()) {
        g.beginGateClearFade(durationSec)
      }
    }
  }

  /** Shrink away and remove all ghosts tied to `ROOM_{roomIndex}` (1…5). */
  purgeGhostsForRoom(roomIndex: number): void {
    for (const g of this.ghosts) {
      if (g.getRoomIndex() === roomIndex) {
        g.beginRoomClearPurge()
      }
    }
  }

  update(
    dt: number,
    realDt: number,
    playerPos: Vector3,
    playerCarryingRelic: boolean,
    gateCinematicRoamOnly = false,
    powerModeActive = false,
  ): void {
    this.flushPendingMapSpawns()
    this.ghostAnimTime += dt
    const hub = ROOMS.SAFE_CENTER.bounds
    const playerInSafeCenter =
      playerPos.x >= hub.minX &&
      playerPos.x <= hub.maxX &&
      playerPos.z >= hub.minZ &&
      playerPos.z <= hub.maxZ
    for (const g of this.ghosts) {
      const doorIdx = g.getRoomIndex() - 1
      const visionConeEntranceDoorOpen =
        doorIdx >= 0 &&
        doorIdx < DOOR_COUNT &&
        this.doorUnlock.isDoorSouthernAccessGranted(doorIdx)
      g.update(
        dt,
        realDt,
        playerPos,
        powerModeActive,
        this.ghostAnimTime,
        playerInSafeCenter,
        playerCarryingRelic,
        gateCinematicRoamOnly,
        visionConeEntranceDoorOpen,
        this.runtimeSpeedMul,
      )
      if (
        !g.isRoomClearPurging() &&
        !g.isGateClearFading() &&
        !g.isBossGhost()
      ) {
        g.updateVulnerableAppearance(
          powerModeActive,
          this.ghostAnimTime,
        )
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]!
      if (g.consumeDestroyAfterRoomPurge()) {
        g.destroy()
        this.ghosts.splice(i, 1)
      }
    }
  }

  /**
   * True when the player is outside “melee + padding” for every active ghost
   * (used to re-arm damage after a hit / i-frames).
   */
  isPlayerClearForGhostDamageRearm(
    playerPos: Vector3,
    playerRadius: number,
  ): boolean {
    for (const g of this.ghosts) {
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading()) continue
      const needR =
        playerRadius + g.collisionRadius + GHOST_MELEE_REARM_PADDING
      const needR2 = needR * needR
      const gx = g.root.position.x
      const gz = g.root.position.z
      const dx = playerPos.x - gx
      const dz = playerPos.z - gz
      if (dx * dx + dz * dz < needR2) return false
    }
    return true
  }

  /**
   * Circle–circle overlap on XZ: `playerRadius + ghost.collisionRadius`.
   * No damage while invulnerable (i-frames).
   */
  tryHitPlayer(
    playerPos: Vector3,
    playerRadius: number,
    invulnerable: boolean,
  ): GhostHitResult {
    if (invulnerable) return { kind: 'none' }
    for (const g of this.ghosts) {
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading()) continue
      if (!g.canDealContactDamage()) continue
      const r = playerRadius + g.collisionRadius
      const r2 = r * r
      const gx = g.root.position.x
      const gz = g.root.position.z
      const dx = playerPos.x - gx
      const dz = playerPos.z - gz
      if (dx * dx + dz * dz <= r2) {
        return { kind: 'hit', ghostX: gx, ghostZ: gz }
      }
    }
    return { kind: 'none' }
  }

  /**
   * Power mode: overlap eats a ghost (temporary disappearance + respawn). Boss ghosts are immune.
   */
  tryEatGhost(
    playerPos: Vector3,
    playerRadius: number,
    powerModeActive: boolean,
  ): GhostEatResult {
    if (!powerModeActive) return { kind: 'none' }
    for (const g of this.ghosts) {
      if (g.isBossGhost()) continue
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading()) continue
      const r = playerRadius + g.collisionRadius
      const r2 = r * r
      const gx = g.root.position.x
      const gz = g.root.position.z
      const dx = playerPos.x - gx
      const dz = playerPos.z - gz
      if (dx * dx + dz * dz <= r2) {
        g.markEaten()
        return { kind: 'eat', ghostX: gx, ghostZ: gz }
      }
    }
    return { kind: 'none' }
  }

  /**
   * After a successful damage hit: that ghost backs off and roams so it does not stay clipped on the player.
   */
  onGhostHitLandedAt(
    ghostX: number,
    ghostZ: number,
    playerPos: Vector3,
  ): void {
    const eps2 = 0.28 * 0.28
    for (const g of this.ghosts) {
      if (g.isEaten() || g.isRoomClearPurging() || g.isGateClearFading()) continue
      const dx = g.root.position.x - ghostX
      const dz = g.root.position.z - ghostZ
      if (dx * dx + dz * dz <= eps2) {
        if (g.isBossGhost()) {
          g.disengageAfterHit(playerPos)
        } else {
          g.beginRoomClearPurge()
        }
        return
      }
    }
  }

  dispose(): void {
    this.pendingMapSpawnSpecs.length = 0
    for (const g of this.ghosts) {
      g.destroy()
    }
    this.ghosts.length = 0
  }
}

type SkinSnap = {
  color: Color
  emissive: Color
  emissiveIntensity: number
}

class Ghost {
  readonly root: Group
  /** Mansion chain room index (1…N) — matches `GhostSpawnSpec.roomIndex`. */
  readonly roomIndex: number
  /** Spawn body tint (hex); used for gem color when eaten. */
  readonly bodyColor: number
  /** Hit / wall radius — scales with room tier (larger ghosts in deeper rooms). */
  readonly collisionRadius: number
  private readonly worldCollision: WorldCollision
  private readonly speedMul: number
  private readonly velocity = new Vector3()
  private readonly scratch = new Vector3()
  private readonly spawnX: number
  private readonly spawnZ: number
  private readonly materials: MeshStandardMaterial[]
  private readonly skinSnap: SkinSnap[]
  private prevPowerMode = false

  private state: GhostBehaviorState = 'wander'
  private wanderAngle = Math.random() * Math.PI * 2
  private wanderTimer = 0

  private eaten = false
  /** Room-cleared purge: shrink then remove (no respawn). */
  private roomClearPurgeRemain = 0
  /** Gate cinematic: fade / lift / shrink before removal (cleared room only). */
  private gateClearFadeRemain = 0
  private gateClearFadeTotal = 1
  private fadeBaseScale = 1
  private fadeBaseY = 0
  private destroyAfterPurgePending = false
  /** >0 while scaling down after capture; respawn timer starts after shrink. */
  private eatShrinkRemaining = 0
  private respawnRemaining = 0
  /** While > 0, cannot transition wander → chase (after scoring a hit on the player). */
  private chaseLockout = 0
  /** While > 0, ghost only roams (no chase from detect or relic). New spawns / post-eat respawn. */
  private spawnChaseGraceRemain = 0
  /** 0…1 — eases into full chase/hunt speed (see `GHOST_CHASE_RAMP_*`). */
  private chaseThrottle = 0
  /** After entering chase, brief period of wander-only grid before chase steering/speed ramp. */
  private chaseWindupRemain = 0
  /** Smoothed desired direction (unit XZ) — reduces jittery heading changes */
  private smoothedTx = 0
  private smoothedTz = 1

  /** Vision-cone hunt burst (non-relic); speed uses `GHOST_HUNT_SPEED`. */
  private huntBurstRemain = 0
  /** Accumulates while in hunt burst but player not in vision cone (non-relic). */
  private huntConeLostAccum = 0
  /** After hunt ends, cone cannot re-trigger for this long. */
  private visionCooldownRemain = 0
  private visionDebugLine: Line | null = null
  private visionConeMesh: Mesh | null = null
  private readonly role: GhostSpawnRole

  /** Pac-Man-style cell movement in room interiors, hub, and corridors (same bounds as player grid). */
  private readonly gridNav: GhostGridNavState = createGhostGridNavState()

  constructor(
    ghostGroup: Group,
    worldCollision: WorldCollision,
    spec: GhostSpawnSpec,
    ghostGltf: GhostGltfTemplate | null,
  ) {
    this.worldCollision = worldCollision
    this.role = spec.role ?? 'normal'
    this.roomIndex = spec.roomIndex
    this.spawnX = spec.x
    this.spawnZ = spec.z
    this.bodyColor = spec.color
    let visualMul = ghostRoomVisualMul(spec.roomIndex)
    if (this.role === 'boss') {
      visualMul *= BOSS_EXTRA_VISUAL_MUL
    } else if (this.role === 'minion') {
      visualMul *= BOSS_MINION_VISUAL_MUL
    }
    let sm = ghostRoomSpeedMul(spec.roomIndex)
    if (this.role === 'boss') {
      sm *= 0.76
    }
    this.speedMul = sm
    this.collisionRadius = GHOST_COLLISION_RADIUS * visualMul
    this.root = createGhostVisual(spec.color, ghostGltf, visualMul)
    this.root.position.set(spec.x, 0, spec.z)
    ghostGroup.add(this.root)
    this.pickWanderTimer()
    this.spawnChaseGraceRemain = randomSpawnChaseGraceSec()

    this.materials = []
    this.skinSnap = []
    this.root.traverse((o) => {
      if (!(o instanceof Mesh) || o.userData.isGhostBody !== true) return
      const mat = o.material
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        if (
          m instanceof MeshStandardMaterial ||
          m instanceof MeshPhysicalMaterial
        ) {
          this.materials.push(m)
          this.skinSnap.push({
            color: m.color.clone(),
            emissive: m.emissive.clone(),
            emissiveIntensity: m.emissiveIntensity,
          })
        }
      }
    })

    if (GHOST_VISION_DEBUG) {
      const geom = new BufferGeometry()
      const pos = new Float32Array(9)
      geom.setAttribute('position', new BufferAttribute(pos, 3))
      const mat = new LineBasicMaterial({
        color: 0x55eecc,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
      const line = new Line(geom, mat)
      line.name = 'ghostVisionDebug'
      line.renderOrder = 4
      this.visionDebugLine = line
      this.root.add(line)
    }

    if (GHOST_VISION_CONE_VISIBLE && this.role !== 'boss') {
      this.visionConeMesh = createGhostVisionConeMesh()
      this.root.add(this.visionConeMesh)
    }
  }

  isEaten(): boolean {
    return this.eaten
  }

  getRoomIndex(): number {
    return this.roomIndex
  }

  isBossGhost(): boolean {
    return this.role === 'boss'
  }

  isMinionGhost(): boolean {
    return this.role === 'minion'
  }

  isRoomClearPurging(): boolean {
    return this.roomClearPurgeRemain > 0
  }

  isGateClearFading(): boolean {
    return this.gateClearFadeRemain > 0
  }

  /** Room clear with gate cinematic — opacity + drift + scale; then removed. */
  beginGateClearFade(durationSec: number): void {
    if (this.eaten) return
    if (this.roomClearPurgeRemain > 0) return
    if (this.gateClearFadeRemain > 0) return
    this.gateClearFadeRemain = durationSec
    this.gateClearFadeTotal = Math.max(0.05, durationSec)
    this.fadeBaseScale = this.root.scale.x
    this.fadeBaseY = this.root.position.y
    this.velocity.set(0, 0, 0)
    resetGhostGridNavState(this.gridNav)
  }

  beginRoomClearPurge(): void {
    if (this.eaten) return
    if (this.gateClearFadeRemain > 0) return
    if (this.roomClearPurgeRemain > 0) return
    this.roomClearPurgeRemain = GHOST_ROOM_PURGE_SHRINK_SEC
    this.velocity.set(0, 0, 0)
    resetGhostGridNavState(this.gridNav)
  }

  /** Returns true once when shrink finished; `GhostSystem` then calls `destroy()`. */
  consumeDestroyAfterRoomPurge(): boolean {
    if (!this.destroyAfterPurgePending) return false
    this.destroyAfterPurgePending = false
    return true
  }

  /** False during spawn / respawn grace — no stack-loss contact yet (still roams). */
  canDealContactDamage(): boolean {
    if (this.eaten) return false
    return this.spawnChaseGraceRemain <= 0
  }

  markEaten(): void {
    this.eaten = true
    this.eatShrinkRemaining = GHOST_EAT_SHRINK_SEC
    this.respawnRemaining = 0
    this.velocity.set(0, 0, 0)
    this.chaseLockout = 0
    resetGhostGridNavState(this.gridNav)
  }

  /**
   * Stop chasing, push away from player, brief roam before re-aggro.
   */
  disengageAfterHit(playerPos: Vector3): void {
    this.state = 'wander'
    this.chaseWindupRemain = 0
    this.chaseLockout = GHOST_POST_HIT_CHASE_LOCKOUT_SEC
    this.pickWanderTimer()
    const px = this.root.position.x
    const pz = this.root.position.z
    let ax = px - playerPos.x
    let az = pz - playerPos.z
    let d = Math.hypot(ax, az)
    if (d < 0.12) {
      ax = Math.cos(this.wanderAngle)
      az = Math.sin(this.wanderAngle)
      d = 1
    } else {
      ax /= d
      az /= d
    }
    this.wanderAngle = Math.atan2(az, ax)
    this.root.position.x += ax * GHOST_POST_HIT_SEPARATION
    this.root.position.z += az * GHOST_POST_HIT_SEPARATION
    resetGhostGridNavState(this.gridNav)
    this.resolveWallCollision()
    const disengage = GHOST_POST_HIT_DISENGAGE_SPEED * this.speedMul
    this.velocity.x += ax * disengage
    this.velocity.z += az * disengage
    const hs = Math.hypot(this.velocity.x, this.velocity.z)
    const maxSp = 12.5 * this.speedMul
    if (hs > maxSp) {
      const inv = maxSp / hs
      this.velocity.x *= inv
      this.velocity.z *= inv
    }
    this.smoothedTx = Math.cos(this.wanderAngle)
    this.smoothedTz = Math.sin(this.wanderAngle)
  }

  private pickWanderTimer(): void {
    this.wanderTimer =
      GHOST_WANDER_TURN_MIN +
      Math.random() * (GHOST_WANDER_TURN_MAX - GHOST_WANDER_TURN_MIN)
  }

  private resetSkin(): void {
    for (let i = 0; i < this.materials.length; i++) {
      const m = this.materials[i]!
      const s = this.skinSnap[i]!
      m.color.copy(s.color)
      m.emissive.copy(s.emissive)
      m.emissiveIntensity = s.emissiveIntensity
    }
  }

  updateVulnerableAppearance(powerMode: boolean, timeSec: number): void {
    if (this.eaten) return
    if (powerMode) {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.75)
      const blink = 0.62 + 0.38 * Math.sin(timeSec * 7.2)
      for (const m of this.materials) {
        m.color.setHex(0x2a5590)
        m.emissive.setHex(0x4488dd)
        m.emissiveIntensity = (0.38 + pulse * 0.48) * blink
      }
    } else if (this.prevPowerMode) {
      this.resetSkin()
    }
    this.prevPowerMode = powerMode
  }

  /** Player inside forward cone + range; optional wall LOS. */
  private playerInVisionCone(
    px: number,
    pz: number,
    playerPos: Vector3,
  ): boolean {
    const dx = playerPos.x - px
    const dz = playerPos.z - pz
    const distSq = dx * dx + dz * dz
    const r2 = GHOST_VISION_RANGE * GHOST_VISION_RANGE
    if (distSq > r2 || distSq < 1e-8) return false
    const dist = Math.sqrt(distSq)
    const nx = dx / dist
    const nz = dz / dist
    const sl = Math.hypot(this.smoothedTx, this.smoothedTz)
    let fx: number
    let fz: number
    if (sl > 0.12) {
      fx = this.smoothedTx / sl
      fz = this.smoothedTz / sl
    } else {
      const y = this.root.rotation.y
      fx = Math.sin(y)
      fz = Math.cos(y)
    }
    if (fx * nx + fz * nz < GHOST_VISION_COS_HALF) return false
    if (
      GHOST_VISION_USE_LINE_OF_SIGHT &&
      !this.worldCollision.lineOfSightClearXZ(
        px,
        pz,
        playerPos.x,
        playerPos.z,
      )
    ) {
      return false
    }
    return true
  }

  private updateBossSeek(
    dt: number,
    _realDt: number,
    playerPos: Vector3,
    timeSec: number,
    cinematicRoamOnly: boolean,
    globalSpeedMul: number,
  ): void {
    const pulse = 0.42 + 0.58 * Math.sin(timeSec * 2.05)
    for (const m of this.materials) {
      m.emissive.setHex(0xaa66ff)
      m.emissiveIntensity = 0.44 + pulse * 0.48
    }

    if (cinematicRoamOnly) {
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2
        this.pickWanderTimer()
      }
      const tx = Math.cos(this.wanderAngle)
      const tz = Math.sin(this.wanderAngle)
      const targetSpeed =
        GHOST_WANDER_SPEED * this.speedMul * 0.5 * globalSpeedMul
      const dirK = 1 - Math.exp(-GHOST_DIRECTION_SMOOTH_WANDER * dt)
      this.smoothedTx += (tx - this.smoothedTx) * dirK
      this.smoothedTz += (tz - this.smoothedTz) * dirK
      const sl = Math.hypot(this.smoothedTx, this.smoothedTz)
      if (sl > 1e-5) {
        this.smoothedTx /= sl
        this.smoothedTz /= sl
      }
      const desiredVx = this.smoothedTx * targetSpeed
      const desiredVz = this.smoothedTz * targetSpeed
      const k = 1 - Math.exp(-GHOST_STEERING_ACCEL_WANDER * dt)
      this.velocity.x += (desiredVx - this.velocity.x) * k
      this.velocity.z += (desiredVz - this.velocity.z) * k
    } else {
      const px = this.root.position.x
      const pz = this.root.position.z
      const dx = playerPos.x - px
      const dz = playerPos.z - pz
      const dist = Math.hypot(dx, dz)
      let tx = 0
      let tz = 0
      if (dist > 0.06) {
        tx = dx / dist
        tz = dz / dist
      }
      const targetSpeed = BOSS_SEEK_SPEED * this.speedMul * globalSpeedMul
      const dirK = 1 - Math.exp(-GHOST_DIRECTION_SMOOTH_CHASE * dt)
      this.smoothedTx += (tx - this.smoothedTx) * dirK
      this.smoothedTz += (tz - this.smoothedTz) * dirK
      const sl = Math.hypot(this.smoothedTx, this.smoothedTz)
      if (sl > 1e-5) {
        this.smoothedTx /= sl
        this.smoothedTz /= sl
      }
      const desiredVx = this.smoothedTx * targetSpeed
      const desiredVz = this.smoothedTz * targetSpeed
      const sk = 1 - Math.exp(-GHOST_STEERING_ACCEL_CHASE * dt)
      this.velocity.x += (desiredVx - this.velocity.x) * sk
      this.velocity.z += (desiredVz - this.velocity.z) * sk
    }

    this.scratch.set(this.velocity.x * dt, 0, this.velocity.z * dt)
    this.root.position.add(this.scratch)
    this.resolveWallCollision()

    const faceSl = Math.hypot(this.smoothedTx, this.smoothedTz)
    if (faceSl > 0.06) {
      const targetYaw = Math.atan2(this.smoothedTx, this.smoothedTz)
      const cur = this.root.rotation.y
      let delta = targetYaw - cur
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      this.root.rotation.y =
        cur + delta * (1 - Math.exp(-GHOST_FACING_TURN_DEFAULT * dt))
    }

    const anim = this.root.userData.updateGhostAnimation as
      | ((
          dt: number,
          timeSec: number,
          vx: number,
          vz: number,
          chaseAnim?: boolean,
        ) => void)
      | undefined
    anim?.(dt, timeSec, this.velocity.x, this.velocity.z, true)
  }

  update(
    dt: number,
    realDt: number,
    playerPos: Vector3,
    powerModeActive: boolean,
    timeSec: number,
    playerInSafeCenter: boolean,
    relicCarried: boolean,
    cinematicRoamOnly: boolean,
    visionConeEntranceDoorOpen: boolean,
    globalSpeedMul = 1,
  ): void {
    if (this.gateClearFadeRemain > 0) {
      this.gateClearFadeRemain -= realDt
      const u = Math.max(
        0,
        this.gateClearFadeRemain / this.gateClearFadeTotal,
      )
      const vis = u
      const s = this.fadeBaseScale * (0.18 + 0.82 * vis)
      this.root.scale.setScalar(s)
      this.root.position.y =
        this.fadeBaseY + (1 - vis) * 0.95
      for (const m of this.materials) {
        m.transparent = true
        m.opacity = vis
        m.depthWrite = vis > 0.35
      }
      if (this.gateClearFadeRemain <= 0) {
        this.gateClearFadeRemain = 0
        this.destroyAfterPurgePending = true
      }
      return
    }

    if (this.roomClearPurgeRemain > 0) {
      this.roomClearPurgeRemain -= dt
      const t = Math.max(0, this.roomClearPurgeRemain / GHOST_ROOM_PURGE_SHRINK_SEC)
      this.root.scale.setScalar(Math.max(0.04, t))
      if (this.roomClearPurgeRemain <= 0) {
        this.roomClearPurgeRemain = 0
        this.destroyAfterPurgePending = true
      }
      return
    }

    if (this.eaten) {
      if (this.eatShrinkRemaining > 0) {
        this.eatShrinkRemaining -= dt
        const t = Math.max(
          0,
          this.eatShrinkRemaining / GHOST_EAT_SHRINK_SEC,
        )
        this.root.scale.setScalar(t)
        if (this.eatShrinkRemaining <= 0) {
          this.root.visible = false
          this.root.scale.setScalar(1)
          this.eatShrinkRemaining = 0
          this.respawnRemaining = GHOST_RESPAWN_AFTER_EAT_SEC
        }
        return
      }
      this.respawnRemaining -= dt
      if (this.respawnRemaining <= 0) {
        this.eaten = false
        this.root.visible = true
        this.root.scale.setScalar(1)
        this.root.position.set(this.spawnX, 0, this.spawnZ)
        this.velocity.set(0, 0, 0)
        this.state = 'wander'
        this.chaseLockout = 0
        this.chaseWindupRemain = 0
        this.chaseThrottle = 0
        this.pickWanderTimer()
        this.spawnChaseGraceRemain = randomSpawnChaseGraceSec()
        this.resetSkin()
        this.smoothedTx = 0
        this.smoothedTz = 1
        resetGhostGridNavState(this.gridNav)
      }
      return
    }

    if (this.role === 'boss') {
      this.updateBossSeek(
        dt,
        realDt,
        playerPos,
        timeSec,
        cinematicRoamOnly,
        globalSpeedMul,
      )
      return
    }

    const px = this.root.position.x
    const pz = this.root.position.z
    const dx = playerPos.x - px
    const dz = playerPos.z - pz
    const dist = Math.hypot(dx, dz)

    const frightened = powerModeActive && !this.isBossGhost()

    if (this.chaseLockout > 0) {
      this.chaseLockout -= dt
    }
    if (this.spawnChaseGraceRemain > 0) {
      this.spawnChaseGraceRemain -= dt
    }
    if (this.state === 'chase' && this.chaseWindupRemain > 0) {
      this.chaseWindupRemain = Math.max(0, this.chaseWindupRemain - realDt)
    }
    const canHuntPlayer = this.spawnChaseGraceRemain <= 0
    const allowChase = canHuntPlayer && !cinematicRoamOnly
    if (cinematicRoamOnly && this.state === 'chase') {
      this.state = 'wander'
      this.chaseWindupRemain = 0
      this.huntBurstRemain = 0
      this.pickWanderTimer()
      this.wanderAngle = Math.random() * Math.PI * 2
    }

    let tx = 0
    let tz = 0
    let targetSpeed = 0

    if (frightened) {
      let ax = px - playerPos.x
      let az = pz - playerPos.z
      let ad = Math.hypot(ax, az)
      if (ad < 0.22) {
        ax = Math.cos(this.wanderAngle)
        az = Math.sin(this.wanderAngle)
        ad = 1
      }
      const inv = 1 / ad
      tx = ax * inv
      tz = az * inv
      targetSpeed = GHOST_FRIGHT_SPEED
    } else if (playerInSafeCenter && !relicCarried) {
      if (this.state === 'chase') {
        this.state = 'wander'
        this.chaseWindupRemain = 0
        this.huntBurstRemain = 0
        this.visionCooldownRemain = 0
        this.pickWanderTimer()
        this.wanderAngle = Math.random() * Math.PI * 2
      }
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2
        this.pickWanderTimer()
      }
      tx = Math.cos(this.wanderAngle)
      tz = Math.sin(this.wanderAngle)
      targetSpeed = GHOST_WANDER_SPEED
    } else if (relicCarried && allowChase) {
      if (this.state !== 'chase') {
        this.chaseWindupRemain = GHOST_CHASE_WINDUP_SEC
      }
      this.state = 'chase'
      if (dist > 1e-4) {
        const inv = 1 / dist
        tx = dx * inv
        tz = dz * inv
        targetSpeed = GHOST_CHASE_SPEED
      } else {
        tx = 0
        tz = 0
        targetSpeed = 0
      }
    } else if (relicCarried && !allowChase) {
      if (this.state === 'chase') {
        this.state = 'wander'
        this.chaseWindupRemain = 0
        this.huntBurstRemain = 0
        this.pickWanderTimer()
        this.wanderAngle = Math.random() * Math.PI * 2
      }
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2
        this.pickWanderTimer()
      }
      tx = Math.cos(this.wanderAngle)
      tz = Math.sin(this.wanderAngle)
      targetSpeed = GHOST_WANDER_SPEED
    } else {
      if (this.huntBurstRemain > 0) {
        this.huntBurstRemain -= dt
        if (this.huntBurstRemain <= 0) {
          this.huntBurstRemain = 0
          this.state = 'wander'
          this.chaseWindupRemain = 0
          this.visionCooldownRemain = GHOST_VISION_COOLDOWN_SEC
          this.pickWanderTimer()
          this.wanderAngle = Math.random() * Math.PI * 2
        }
      }
      if (this.visionCooldownRemain > 0) {
        this.visionCooldownRemain -= dt
      }

      const sawPlayer = this.playerInVisionCone(px, pz, playerPos)

      if (this.huntBurstRemain > 0 && !relicCarried && !sawPlayer) {
        this.huntConeLostAccum += realDt
        if (this.huntConeLostAccum >= GHOST_HUNT_CONE_LOST_BREAK_SEC) {
          this.huntBurstRemain = 0
          this.state = 'wander'
          this.chaseWindupRemain = 0
          this.visionCooldownRemain = GHOST_VISION_COOLDOWN_SEC
          this.pickWanderTimer()
          this.wanderAngle = Math.random() * Math.PI * 2
          this.huntConeLostAccum = 0
        }
      } else {
        this.huntConeLostAccum = 0
      }

      let hunting = this.huntBurstRemain > 0
      if (hunting && dist > GHOST_HUNT_ABORT_RANGE) {
        this.huntBurstRemain = 0
        this.state = 'wander'
        this.chaseWindupRemain = 0
        this.visionCooldownRemain = GHOST_VISION_COOLDOWN_SEC
        this.pickWanderTimer()
        this.wanderAngle = Math.random() * Math.PI * 2
        hunting = false
      }

      if (this.state === 'wander') {
        if (
          !hunting &&
          this.chaseLockout <= 0 &&
          allowChase &&
          this.visionCooldownRemain <= 0 &&
          sawPlayer
        ) {
          this.chaseWindupRemain = GHOST_CHASE_WINDUP_SEC
          this.state = 'chase'
          this.huntBurstRemain =
            GHOST_HUNT_DURATION_MIN +
            Math.random() *
              (GHOST_HUNT_DURATION_MAX - GHOST_HUNT_DURATION_MIN)
        }
      }

      hunting = this.huntBurstRemain > 0

      if (this.state === 'chase') {
        if (dist > 1e-4) {
          const inv = 1 / dist
          tx = dx * inv
          tz = dz * inv
          targetSpeed = hunting ? GHOST_HUNT_SPEED : GHOST_CHASE_SPEED
        } else {
          tx = 0
          tz = 0
          targetSpeed = 0
        }
      } else {
        this.wanderTimer -= dt
        if (this.wanderTimer <= 0) {
          this.wanderAngle = Math.random() * Math.PI * 2
          this.pickWanderTimer()
        }
        tx = Math.cos(this.wanderAngle)
        tz = Math.sin(this.wanderAngle)
        targetSpeed = GHOST_WANDER_SPEED
      }
    }

    const chaseAiActive =
      this.state === 'chase' && this.chaseWindupRemain <= 0

    if (!frightened && chaseAiActive) {
      targetSpeed =
        GHOST_WANDER_SPEED +
        (targetSpeed - GHOST_WANDER_SPEED) * this.chaseThrottle
    }

    targetSpeed *= this.speedMul * globalSpeedMul
    void (tx + tz)

    const roomBounds = getGhostGridBoundsAt(px, pz)
    let gridMode: GhostGridNavMode
    if (frightened) {
      gridMode = 'fright'
    } else if (chaseAiActive) {
      gridMode = 'chase'
    } else {
      gridMode = 'idle'
    }

    let gridSpeed: number
    if (frightened) {
      gridSpeed = GHOST_GRID_FRIGHT_SPEED
    } else if (chaseAiActive) {
      const peak =
        this.huntBurstRemain > 0
          ? GHOST_GRID_HUNT_SPEED
          : GHOST_GRID_CHASE_SPEED
      gridSpeed =
        GHOST_GRID_WANDER_SPEED +
        (peak - GHOST_GRID_WANDER_SPEED) * this.chaseThrottle
    } else {
      gridSpeed = GHOST_GRID_WANDER_SPEED
    }
    gridSpeed *= this.speedMul * globalSpeedMul

    const gStep = stepGhostGridNav(
      this.gridNav,
      px,
      pz,
      dt,
      gridSpeed,
      roomBounds,
      gridMode,
      playerPos.x,
      playerPos.z,
      this.worldCollision,
      this.collisionRadius,
      Math.random,
    )
    this.root.position.x = gStep.x
    this.root.position.z = gStep.z
    this.velocity.x = gStep.vx
    this.velocity.z = gStep.vz
    this.smoothedTx = gStep.fx
    this.smoothedTz = gStep.fz
    this.resolveWallCollision()
    this.applyEdgeNudge(targetSpeed)

    /**
     * Face toward smoothed intent (not raw velocity). Wall resolution only moves position;
     * velocity can oscillate along barriers while fleeing, which made `atan2(vx,vz)` spin.
     */
    const faceSl = Math.hypot(this.smoothedTx, this.smoothedTz)
    if (faceSl > 0.06) {
      const targetYaw = Math.atan2(this.smoothedTx, this.smoothedTz)
      const cur = this.root.rotation.y
      let delta = targetYaw - cur
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      const turn =
        frightened ? GHOST_FACING_TURN_FRIGHT : GHOST_FACING_TURN_DEFAULT
      this.root.rotation.y = cur + delta * (1 - Math.exp(-turn * dt))
    }

    /** Run clip during pulse flee and during chase; idle only for calm wander. */
    const chaseAnim =
      frightened ||
      (chaseAiActive && (relicCarried || this.huntBurstRemain > 0))
    const anim = this.root.userData.updateGhostAnimation as
      | ((
          dt: number,
          timeSec: number,
          vx: number,
          vz: number,
          chaseAnim?: boolean,
        ) => void)
      | undefined
    anim?.(dt, timeSec, this.velocity.x, this.velocity.z, chaseAnim)

    if (this.visionConeMesh) {
      const show =
        visionConeEntranceDoorOpen &&
        !this.eaten &&
        this.roomClearPurgeRemain <= 0 &&
        this.gateClearFadeRemain <= 0
      this.visionConeMesh.visible = show
      if (show) {
        const mat = this.visionConeMesh.material as MeshBasicMaterial
        const chasing =
          chaseAiActive && (relicCarried || this.huntBurstRemain > 0)
        mat.opacity = chasing
          ? GHOST_VISION_CONE_OPACITY_CHASE
          : GHOST_VISION_CONE_OPACITY
      }
    }

    if (this.visionDebugLine) {
      const R = GHOST_VISION_RANGE
      const a = GHOST_VISION_HALF_ANGLE_RAD
      const lx = Math.sin(a) * R
      const lz = Math.cos(a) * R
      const rx = Math.sin(-a) * R
      const rz = Math.cos(-a) * R
      const g = this.visionDebugLine.geometry as BufferGeometry
      const arr = g.attributes.position!.array as Float32Array
      arr[0] = 0
      arr[1] = 0.05
      arr[2] = 0
      arr[3] = lx
      arr[4] = 0.05
      arr[5] = lz
      arr[6] = rx
      arr[7] = 0.05
      arr[8] = rz
      g.attributes.position!.needsUpdate = true
    }

    if (frightened) {
      this.chaseThrottle = 0
    } else if (chaseAiActive) {
      this.chaseThrottle = Math.min(
        1,
        this.chaseThrottle + realDt / GHOST_CHASE_RAMP_UP_SEC,
      )
    } else {
      this.chaseThrottle = Math.max(
        0,
        this.chaseThrottle - realDt / GHOST_CHASE_RAMP_DOWN_SEC,
      )
    }

    this.excludeFromSafeCenterRoom()
    this.resolveWallCollision()
  }

  /**
   * Hub interior (`SAFE_CENTER`) is a no-go for ghosts — keep circle body + padding clear of the AABB.
   */
  private excludeFromSafeCenterRoom(): void {
    const { minX, maxX, minZ, maxZ } = ROOMS.SAFE_CENTER.bounds
    const r = this.collisionRadius + GHOST_DEPOSIT_EXCLUSION_PADDING
    let px = this.root.position.x
    let pz = this.root.position.z

    const qx = Math.max(minX, Math.min(px, maxX))
    const qz = Math.max(minZ, Math.min(pz, maxZ))
    let dx = px - qx
    let dz = pz - qz
    let dist = Math.hypot(dx, dz)

    let nx: number
    let nz: number

    if (dist < 1e-8) {
      const dl = px - minX
      const dr = maxX - px
      const dd = pz - minZ
      const du = maxZ - pz
      const m = Math.min(dl, dr, dd, du)
      let bx = px
      let bz = pz
      if (m === dl) {
        bx = minX
        bz = Math.max(minZ, Math.min(pz, maxZ))
      } else if (m === dr) {
        bx = maxX
        bz = Math.max(minZ, Math.min(pz, maxZ))
      } else if (m === dd) {
        bz = minZ
        bx = Math.max(minX, Math.min(px, maxX))
      } else {
        bz = maxZ
        bx = Math.max(minX, Math.min(px, maxX))
      }
      const tx = px - bx
      const tz = pz - bz
      const tlen = Math.hypot(tx, tz)
      if (tlen < 1e-8) {
        nx = Math.cos(this.wanderAngle)
        nz = Math.sin(this.wanderAngle)
      } else {
        nx = tx / tlen
        nz = tz / tlen
      }
      px = bx + nx * r
      pz = bz + nz * r
    } else {
      if (dist >= r) return
      nx = dx / dist
      nz = dz / dist
      px = qx + nx * r
      pz = qz + nz * r
    }

    this.root.position.x = px
    this.root.position.z = pz

    const vn = this.velocity.x * nx + this.velocity.z * nz
    if (vn < 0) {
      this.velocity.x -= vn * nx
      this.velocity.z -= vn * nz
    }
  }

  private resolveWallCollision(): void {
    const r = this.worldCollision.resolveCircleXZ(
      this.root.position.x,
      this.root.position.z,
      this.collisionRadius,
    )
    this.root.position.x = r.x
    this.root.position.z = r.z
  }

  /** After inter-ghost separation pushes — keep inside walkable area. */
  resolveAgainstWalls(): void {
    this.resolveWallCollision()
  }

  private applyEdgeNudge(moveSpeed: number): void {
    const m = 2.8
    const px = this.root.position.x
    const pz = this.root.position.z
    let nx = 0
    let nz = 0
    const H = MANSION_WORLD_HALF
    if (px > H - m) nx -= 1
    if (px < -H + m) nx += 1
    if (pz > H - m) nz -= 1
    if (pz < -H + m) nz += 1
    if (nx !== 0 || nz !== 0) {
      const len = Math.hypot(nx, nz) || 1
      const push = moveSpeed * 0.35
      this.velocity.x += (nx / len) * push
      this.velocity.z += (nz / len) * push
    }
  }

  destroy(): void {
    const disposeAnim = this.root.userData.disposeGhostAnim as
      | (() => void)
      | undefined
    disposeAnim?.()
    if (this.visionDebugLine) {
      this.visionDebugLine.geometry.dispose()
      ;(this.visionDebugLine.material as LineBasicMaterial).dispose()
      this.visionDebugLine = null
    }
    this.visionConeMesh = null
    this.root.position.set(0, 0, 0)
    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        if (!o.userData.sharedGhostGeometry) {
          o.geometry.dispose()
        }
        const mat = o.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })
    this.root.removeFromParent()
  }
}
