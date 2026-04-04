import type { Group } from 'three'
import { Vector3 } from 'three'
import type { JoystickVector } from '../input/TouchJoystick.ts'
import {
  GHOST_HIT_KNOCKBACK_DECAY,
  GHOST_HIT_KNOCKBACK_SPEED,
} from '../ghost/ghostConfig.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { RoomBounds } from '../world/mansionRoomData.ts'
import type { GridNavContext } from '../world/RoomSystem.ts'
import { boundsKey, worldToCellIndex } from '../grid/roomGridGeometry.ts'
import {
  PLAYER_BASE_MAX_SPEED,
  PLAYER_START_BOOST_DURATION_SEC,
  PLAYER_START_BOOST_MULT,
} from '../gameplaySpeed.ts'
import {
  createPlayerGridNavState,
  inputToCardinalDelta,
  PLAYER_GRID_INPUT_DEADZONE,
  resetPlayerGridNavAtPosition,
  stepPlayerGridNav,
  type PlayerGridNavState,
} from './playerGridNav.ts'
import {
  createEmptyNavDebug,
  type PlayerNavDebugSnapshot,
  SHOW_PLAYER_NAV_DEBUG_HUD,
} from './playerNavDebug.ts'

/** Base max speed (before upgrades & ghost pulse); see `gameplaySpeed.ts` */
export { PLAYER_BASE_MAX_SPEED as DEFAULT_PLAYER_MOVE_SPEED } from '../gameplaySpeed.ts'

/**
 * Keep gameplay overlap generous for pickups / ghosts, but use a slightly slimmer world
 * collision capsule so grid centers do not snag on thin wall or door AABBs.
 */
const PLAYER_WORLD_COLLISION_RADIUS = 0.46

export class PlayerController {
  private readonly navDebug: PlayerNavDebugSnapshot = createEmptyNavDebug()
  private readonly gridState: PlayerGridNavState
  /** Last grid step kinematics (before knockback). */
  private lastGridVx = 0
  private lastGridVz = 0
  /** Extra horizontal push from ghost hits (decays each frame). */
  private knockX = 0
  private knockZ = 0
  /** Applied on top of upgrade max speed (power mode). */
  private powerSpeedMul = 1
  /** Stack weight x trap slow (and other movement penalties). Clamped to (0,1]. */
  private movementSlowMul = 1
  /** Horizontal radius for overlap tests (XZ). */
  readonly radius = 0.55
  private readonly playerRoot: Group
  private readonly worldCollision: WorldCollision
  private maxSpeed: number
  private targetYaw = 0
  private currentYaw = 0
  private readonly turnSmooth = 18
  private prevFingerDown = false
  private startBoostRemaining = 0

  constructor(
    playerRoot: Group,
    worldCollision: WorldCollision,
    maxSpeed = PLAYER_BASE_MAX_SPEED,
    _dragUnused = 12,
    _getRoomAt?: (x: number, z: number) => unknown,
  ) {
    this.playerRoot = playerRoot
    this.worldCollision = worldCollision
    this.maxSpeed = maxSpeed
    this.gridState = createPlayerGridNavState()
  }

  get root(): Group {
    return this.playerRoot
  }

  setMaxSpeed(speed: number): void {
    this.maxSpeed = Math.max(2.5, speed)
  }

  getMaxSpeed(): number {
    return this.maxSpeed
  }

  setPowerSpeedMultiplier(m: number): void {
    this.powerSpeedMul = Math.max(1, m)
  }

  setMovementSlowMultiplier(m: number): void {
    this.movementSlowMul = Math.max(0.12, Math.min(1, m))
  }

  getMovementSlowMultiplier(): number {
    return this.movementSlowMul
  }

  setDragWeightMultiplier(_m: number): void {
    /* Grid movement ignores analog drag; kept for API compatibility. */
  }

  getDragWeightMultiplier(): number {
    return 1
  }

  getPosition(out: Vector3): Vector3 {
    return out.copy(this.playerRoot.position)
  }

  getVelocity(out: Vector3): Vector3 {
    return out.set(
      this.lastGridVx + this.knockX,
      0,
      this.lastGridVz + this.knockZ,
    )
  }

  getHorizontalSpeed(): number {
    return Math.hypot(
      this.lastGridVx + this.knockX,
      this.lastGridVz + this.knockZ,
    )
  }

  getFacingYaw(): number {
    return this.currentYaw
  }

  /** Snapshot before `update` / `syncGridToWorld` for `RoomSystem.getNavGridBounds`. */
  getGridNavContext(): GridNavContext {
    return {
      boundsKey: this.gridState.boundsKey,
      atRow: this.gridState.atRow,
      atCol: this.gridState.atCol,
    }
  }

  /** Latest nav diagnostic frame (for HUD). */
  getNavDebugSnapshot(): Readonly<PlayerNavDebugSnapshot> {
    return this.navDebug
  }

  applyGhostKnockback(
    ghostX: number,
    ghostZ: number,
    playerX: number,
    playerZ: number,
    strengthScale = 1,
  ): void {
    let dx = playerX - ghostX
    let dz = playerZ - ghostZ
    const len = Math.hypot(dx, dz)
    if (len < 1e-4) {
      dx = 1
      dz = 0
    } else {
      dx /= len
      dz /= len
    }
    const s = Math.max(0, Math.min(1.5, strengthScale))
    this.knockX = dx * GHOST_HIT_KNOCKBACK_SPEED * s
    this.knockZ = dz * GHOST_HIT_KNOCKBACK_SPEED * s
  }

  /**
   * After external moves, resync grid cell to world position.
   */
  syncGridToWorld(
    getNavGridBounds: (x: number, z: number) => RoomBounds,
  ): void {
    const b = getNavGridBounds(
      this.playerRoot.position.x,
      this.playerRoot.position.z,
    )
    resetPlayerGridNavAtPosition(
      this.gridState,
      this.playerRoot.position.x,
      this.playerRoot.position.z,
      b,
    )
  }

  /**
   * Snap the avatar onto the containing grid cell before gameplay starts so the
   * first visible frame does not reposition the player.
   */
  settleToGridCenter(
    getNavGridBounds: (x: number, z: number) => RoomBounds,
  ): void {
    const b = getNavGridBounds(
      this.playerRoot.position.x,
      this.playerRoot.position.z,
    )
    resetPlayerGridNavAtPosition(
      this.gridState,
      this.playerRoot.position.x,
      this.playerRoot.position.z,
      b,
    )
    const resolved = this.worldCollision.resolveCircleXZ(
      this.gridState.segX1,
      this.gridState.segZ1,
      PLAYER_WORLD_COLLISION_RADIUS,
      false,
    )
    this.playerRoot.position.x = resolved.x
    this.playerRoot.position.z = resolved.z
    const settledBounds = getNavGridBounds(resolved.x, resolved.z)
    resetPlayerGridNavAtPosition(
      this.gridState,
      resolved.x,
      resolved.z,
      settledBounds,
    )
    this.lastGridVx = 0
    this.lastGridVz = 0
    this.knockX = 0
    this.knockZ = 0
  }

  /**
   * Grid-based movement: cardinal input only, cell centers, queued next direction + same-frame turns.
   * `getNavGridBounds` classifies the avatar (sticky near doors); `getRawGridBoundsAt` is plain
   * geometry for neighbor probes - see `playerGridNav.ts`.
   */
  update(
    dt: number,
    input: JoystickVector,
    getNavGridBounds: (x: number, z: number) => RoomBounds,
    getRawGridBoundsAt: (x: number, z: number) => RoomBounds,
  ): void {
    const kd = Math.exp(-GHOST_HIT_KNOCKBACK_DECAY * dt)
    this.knockX *= kd
    this.knockZ *= kd

    const px = this.playerRoot.position.x
    const pz = this.playerRoot.position.z
    const bounds = getNavGridBounds(px, pz)
    const rawAtPlayer = getRawGridBoundsAt(px, pz)

    if (input.fingerDown && !this.prevFingerDown) {
      this.startBoostRemaining = PLAYER_START_BOOST_DURATION_SEC
    }
    this.prevFingerDown = input.fingerDown
    if (!input.fingerDown) {
      this.prevFingerDown = false
      this.startBoostRemaining = 0
    }

    let startBoost = 1
    if (this.startBoostRemaining > 0) {
      startBoost = PLAYER_START_BOOST_MULT
      this.startBoostRemaining -= dt
    }

    const speedCap =
      this.maxSpeed *
      this.powerSpeedMul *
      this.movementSlowMul *
      startBoost

    const delta = inputToCardinalDelta(input.x, input.y)
    const res = stepPlayerGridNav(
      this.gridState,
      px,
      pz,
      dt,
      speedCap,
      bounds,
      delta?.dr ?? null,
      delta?.dc ?? null,
      input.fingerDown,
      getRawGridBoundsAt,
      SHOW_PLAYER_NAV_DEBUG_HUD ? this.navDebug : null,
    )

    this.lastGridVx = res.vx
    this.lastGridVz = res.vz

    const resolved = this.worldCollision.resolveCircleXZ(
      res.x + this.knockX * dt,
      res.z + this.knockZ * dt,
      PLAYER_WORLD_COLLISION_RADIUS,
      false,
    )

    this.playerRoot.position.x = resolved.x
    this.playerRoot.position.z = resolved.z
    const boundsAfter = getNavGridBounds(resolved.x, resolved.z)
    const correction = Math.hypot(
      resolved.x - (res.x + this.knockX * dt),
      resolved.z - (res.z + this.knockZ * dt),
    )
    if (correction > 0.08) {
      resetPlayerGridNavAtPosition(
        this.gridState,
        resolved.x,
        resolved.z,
        boundsAfter,
      )
    }

    if (SHOW_PLAYER_NAV_DEBUG_HUD) {
      const nd = this.navDebug
      nd.px = px
      nd.pz = pz
      nd.afterPhysicsX = resolved.x
      nd.afterPhysicsZ = resolved.z
      nd.navBoundsKey = boundsKey(boundsAfter)
      nd.rawKeyAtPlayer = boundsKey(rawAtPlayer)
      nd.keysMatch = nd.navBoundsKey === nd.rawKeyAtPlayer
      nd.cellFromNav = worldToCellIndex(boundsAfter, resolved.x, resolved.z)
      nd.cellFromRaw = worldToCellIndex(rawAtPlayer, px, pz)
      nd.fingerDown = input.fingerDown
      nd.stickX = input.x
      nd.stickY = input.y
      nd.stickMag = Math.hypot(input.x, input.y)
      nd.gridInputDeadzone = PLAYER_GRID_INPUT_DEADZONE
      nd.vx = this.lastGridVx + this.knockX
      nd.vz = this.lastGridVz + this.knockZ
    }

    const hs = Math.hypot(res.vx, res.vz)
    if (input.fingerDown && (Math.hypot(input.x, input.y) > 0.08 || hs > 0.15)) {
      if (Math.abs(res.faceX) + Math.abs(res.faceZ) > 0.1) {
        this.targetYaw = Math.atan2(-res.faceX, -res.faceZ)
      }
    }

    const diff = Math.atan2(
      Math.sin(this.targetYaw - this.currentYaw),
      Math.cos(this.targetYaw - this.currentYaw),
    )
    this.currentYaw += diff * (1 - Math.exp(-this.turnSmooth * dt))
    this.playerRoot.rotation.y = this.currentYaw
  }
}
