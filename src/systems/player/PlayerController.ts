import type { Group } from 'three'
import { Vector3 } from 'three'
import type { JoystickVector } from '../input/TouchJoystick.ts'
import {
  GHOST_HIT_KNOCKBACK_DECAY,
  GHOST_HIT_KNOCKBACK_SPEED,
} from '../ghost/ghostConfig.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import {
  PLAYER_BASE_MAX_SPEED,
  PLAYER_START_BOOST_DURATION_SEC,
  PLAYER_START_BOOST_MULT,
} from '../gameplaySpeed.ts'

/** Base max speed (before upgrades & ghost pulse); see `gameplaySpeed.ts` */
export { PLAYER_BASE_MAX_SPEED as DEFAULT_PLAYER_MOVE_SPEED } from '../gameplaySpeed.ts'

export class PlayerController {
  private readonly velocity = new Vector3()
  /** Extra horizontal push from ghost hits (decays each frame) */
  private knockX = 0
  private knockZ = 0
  /** Applied on top of upgrade max speed (power mode). */
  private powerSpeedMul = 1
  /** Horizontal radius for overlap tests (XZ) */
  readonly radius = 0.55
  private readonly playerRoot: Group
  private readonly worldCollision: WorldCollision
  private maxSpeed: number
  private readonly drag: number
  private targetYaw = 0
  private currentYaw = 0
  private readonly turnSmooth = 14
  private prevFingerDown = false
  private startBoostRemaining = 0

  constructor(
    playerRoot: Group,
    worldCollision: WorldCollision,
    maxSpeed = PLAYER_BASE_MAX_SPEED,
    drag = 12,
  ) {
    this.playerRoot = playerRoot
    this.worldCollision = worldCollision
    this.maxSpeed = maxSpeed
    this.drag = drag
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

  /** 1 = normal; >1 during automatic ghost pulse */
  setPowerSpeedMultiplier(m: number): void {
    this.powerSpeedMul = Math.max(1, m)
  }

  getPosition(out: Vector3): Vector3 {
    return out.copy(this.playerRoot.position)
  }

  /** Horizontal velocity (XZ) for lean / animation */
  getVelocity(out: Vector3): Vector3 {
    return out.set(this.velocity.x, 0, this.velocity.z)
  }

  /** Horizontal speed on XZ (for visuals / juice) */
  getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  /** Push away from ghost; direction is from ghost center toward player. */
  applyGhostKnockback(ghostX: number, ghostZ: number, playerX: number, playerZ: number): void {
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
    this.knockX = dx * GHOST_HIT_KNOCKBACK_SPEED
    this.knockZ = dz * GHOST_HIT_KNOCKBACK_SPEED
  }

  /**
   * Reads intent from the input system only (no pointer logic here).
   * Joystick y is screen-down; world forward on XZ is -Z for this camera setup.
   */
  update(dt: number, input: JoystickVector): void {
    if (!input.fingerDown) {
      this.velocity.x = 0
      this.velocity.z = 0
    } else {
      const ax = input.x
      const az = input.y
      const mag = Math.hypot(ax, az)
      const nx = mag > 1e-6 ? ax / mag : 0
      const nz = mag > 1e-6 ? az / mag : 0

      if (input.fingerDown && !this.prevFingerDown) {
        this.startBoostRemaining = PLAYER_START_BOOST_DURATION_SEC
      }
      this.prevFingerDown = input.fingerDown

      let startBoost = 1
      if (this.startBoostRemaining > 0) {
        startBoost = PLAYER_START_BOOST_MULT
        this.startBoostRemaining -= dt
      }

      const cap = this.maxSpeed * this.powerSpeedMul * startBoost
      const targetVx = nx * cap
      const targetVz = nz * cap

      const k = 1 - Math.exp(-this.drag * dt)
      this.velocity.x += (targetVx - this.velocity.x) * k
      this.velocity.z += (targetVz - this.velocity.z) * k
    }

    if (!input.fingerDown) {
      this.prevFingerDown = false
      this.startBoostRemaining = 0
    }

    const kd = Math.exp(-GHOST_HIT_KNOCKBACK_DECAY * dt)
    this.knockX *= kd
    this.knockZ *= kd

    const mx = this.velocity.x + this.knockX
    const mz = this.velocity.z + this.knockZ
    this.playerRoot.position.x += mx * dt
    this.playerRoot.position.z += mz * dt

    const resolved = this.worldCollision.resolveCircleXZ(
      this.playerRoot.position.x,
      this.playerRoot.position.z,
      this.radius,
    )
    this.playerRoot.position.x = resolved.x
    this.playerRoot.position.z = resolved.z

    const ax = input.x
    const az = input.y
    const mag = input.fingerDown ? Math.hypot(ax, az) : 0
    const hs = Math.hypot(this.velocity.x, this.velocity.z)
    if (input.fingerDown && (mag > 0.08 || hs > 0.4)) {
      this.targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z)
    }

    const diff = Math.atan2(
      Math.sin(this.targetYaw - this.currentYaw),
      Math.cos(this.targetYaw - this.currentYaw),
    )
    this.currentYaw += diff * (1 - Math.exp(-this.turnSmooth * dt))
    this.playerRoot.rotation.y = this.currentYaw
  }
}
