import type { Group } from 'three'
import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { GhostGltfTemplate } from './ghostGltfAsset.ts'
import { createGhostVisual } from './createGhostVisual.ts'
import { MANSION_WORLD_HALF } from '../world/mansionGeometry.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import {
  DEFAULT_GHOST_SPAWNS,
  GHOST_CHASE_SPEED,
  GHOST_COLLISION_RADIUS,
  GHOST_DEPOSIT_EXCLUSION_PADDING,
  GHOST_DETECT_RADIUS,
  GHOST_DIRECTION_SMOOTH_CHASE,
  GHOST_DIRECTION_SMOOTH_FRIGHT,
  GHOST_DIRECTION_SMOOTH_WANDER,
  GHOST_FACING_TURN_DEFAULT,
  GHOST_FACING_TURN_FRIGHT,
  GHOST_FRIGHT_SPEED,
  GHOST_LOSE_CHASE_RADIUS,
  GHOST_MELEE_REARM_PADDING,
  GHOST_POST_HIT_CHASE_LOCKOUT_SEC,
  GHOST_POST_HIT_DISENGAGE_SPEED,
  GHOST_POST_HIT_SEPARATION,
  GHOST_EAT_SHRINK_SEC,
  GHOST_RESPAWN_AFTER_EAT_SEC,
  GHOST_STEERING_ACCEL_CHASE,
  GHOST_STEERING_ACCEL_FRIGHT,
  GHOST_STEERING_ACCEL_WANDER,
  GHOST_WANDER_SPEED,
  GHOST_WANDER_TURN_MAX,
  GHOST_WANDER_TURN_MIN,
  type GhostSpawnSpec,
} from './ghostConfig.ts'
import { ROOMS } from '../world/mansionRoomData.ts'

export type GhostBehaviorState = 'wander' | 'chase'

export type GhostHitResult =
  | { kind: 'none' }
  | { kind: 'hit'; ghostX: number; ghostZ: number }

export class GhostSystem {
  private readonly ghosts: Ghost[] = []
  private powerModeActive = false
  private powerModeTimeSec = 0
  private ghostAnimTime = 0

  constructor(
    ghostGroup: Group,
    worldCollision: WorldCollision,
    spawns: readonly GhostSpawnSpec[] = DEFAULT_GHOST_SPAWNS,
    ghostGltf: GhostGltfTemplate | null = null,
  ) {
    for (const s of spawns) {
      this.ghosts.push(new Ghost(ghostGroup, worldCollision, s, ghostGltf))
    }
  }

  /** While true, ghosts are vulnerable (blue), player can eat them, and they cannot deal pellet-loss hits. */
  setPowerMode(active: boolean, timeSec: number): void {
    this.powerModeActive = active
    this.powerModeTimeSec = timeSec
  }

  update(dt: number, playerPos: Vector3, playerCarryingRelic: boolean): void {
    this.ghostAnimTime += dt
    const frightened = this.powerModeActive
    const hub = ROOMS.SAFE_CENTER.bounds
    const playerInSafeCenter =
      playerPos.x >= hub.minX &&
      playerPos.x <= hub.maxX &&
      playerPos.z >= hub.minZ &&
      playerPos.z <= hub.maxZ
    for (const g of this.ghosts) {
      g.update(
        dt,
        playerPos,
        frightened,
        this.ghostAnimTime,
        playerInSafeCenter,
        playerCarryingRelic,
      )
      g.updateVulnerableAppearance(this.powerModeActive, this.powerModeTimeSec)
    }
    this.separateOverlappingGhosts()
  }

  /**
   * True when the player is outside “melee + padding” for every active ghost
   * (used to re-arm damage after a hit / i-frames).
   */
  isPlayerClearForGhostDamageRearm(
    playerPos: Vector3,
    playerRadius: number,
  ): boolean {
    const needR = playerRadius + GHOST_COLLISION_RADIUS + GHOST_MELEE_REARM_PADDING
    const needR2 = needR * needR
    for (const g of this.ghosts) {
      if (g.isEaten()) continue
      const gx = g.root.position.x
      const gz = g.root.position.z
      const dx = playerPos.x - gx
      const dz = playerPos.z - gz
      if (dx * dx + dz * dz < needR2) return false
    }
    return true
  }

  /**
   * First overlapping ghost is eaten; returns true if one was eaten this frame.
   * Only when `setPowerMode(true, …)` is active.
   */
  tryEatGhost(playerPos: Vector3, playerRadius: number): boolean {
    if (!this.powerModeActive) return false
    const r = playerRadius + GHOST_COLLISION_RADIUS
    const r2 = r * r
    for (const g of this.ghosts) {
      if (g.isEaten()) continue
      const gx = g.root.position.x
      const gz = g.root.position.z
      const dx = playerPos.x - gx
      const dz = playerPos.z - gz
      if (dx * dx + dz * dz <= r2) {
        g.markEaten()
        return true
      }
    }
    return false
  }

  /**
   * Circle–circle overlap on XZ: `playerRadius + GHOST_COLLISION_RADIUS`.
   * No damage while invulnerable (i-frames) or during power mode (ghosts flee harm).
   */
  tryHitPlayer(
    playerPos: Vector3,
    playerRadius: number,
    invulnerable: boolean,
  ): GhostHitResult {
    if (invulnerable || this.powerModeActive) return { kind: 'none' }
    const r = playerRadius + GHOST_COLLISION_RADIUS
    const r2 = r * r
    for (const g of this.ghosts) {
      if (g.isEaten()) continue
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
   * After a successful damage hit: that ghost backs off and roams so it does not stay clipped on the player.
   */
  onGhostHitLandedAt(
    ghostX: number,
    ghostZ: number,
    playerPos: Vector3,
  ): void {
    const eps2 = 0.2 * 0.2
    for (const g of this.ghosts) {
      if (g.isEaten()) continue
      const dx = g.root.position.x - ghostX
      const dz = g.root.position.z - ghostZ
      if (dx * dx + dz * dz <= eps2) {
        g.disengageAfterHit(playerPos)
        return
      }
    }
  }

  dispose(): void {
    for (const g of this.ghosts) {
      g.destroy()
    }
    this.ghosts.length = 0
  }

  /** Push ghost centers apart so multiple chasers do not stack on the player. */
  private separateOverlappingGhosts(): void {
    const minD = GHOST_COLLISION_RADIUS * 2.25
    const list = this.ghosts.filter((g) => !g.isEaten())
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        let dx = b.root.position.x - a.root.position.x
        let dz = b.root.position.z - a.root.position.z
        let dist = Math.hypot(dx, dz)
        if (dist >= minD || dist < 1e-7) continue
        dx /= dist
        dz /= dist
        const push = (minD - dist) * 0.52
        a.root.position.x -= dx * push
        a.root.position.z -= dz * push
        b.root.position.x += dx * push
        b.root.position.z += dz * push
      }
    }
    for (const g of list) {
      g.resolveAgainstWalls()
    }
  }
}

type SkinSnap = {
  color: Color
  emissive: Color
  emissiveIntensity: number
}

class Ghost {
  readonly root: Group
  private readonly worldCollision: WorldCollision
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
  /** >0 while scaling down after capture; respawn timer starts after shrink. */
  private eatShrinkRemaining = 0
  private respawnRemaining = 0
  /** While > 0, cannot transition wander → chase (after scoring a hit on the player). */
  private chaseLockout = 0
  /** Smoothed desired direction (unit XZ) — reduces jittery heading changes */
  private smoothedTx = 0
  private smoothedTz = 1

  constructor(
    ghostGroup: Group,
    worldCollision: WorldCollision,
    spec: GhostSpawnSpec,
    ghostGltf: GhostGltfTemplate | null,
  ) {
    this.worldCollision = worldCollision
    this.spawnX = spec.x
    this.spawnZ = spec.z
    this.root = createGhostVisual(spec.color, ghostGltf)
    this.root.position.set(spec.x, 0, spec.z)
    ghostGroup.add(this.root)
    this.pickWanderTimer()

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
  }

  isEaten(): boolean {
    return this.eaten
  }

  markEaten(): void {
    this.eaten = true
    this.eatShrinkRemaining = GHOST_EAT_SHRINK_SEC
    this.respawnRemaining = 0
    this.velocity.set(0, 0, 0)
    this.chaseLockout = 0
  }

  /**
   * Stop chasing, push away from player, brief roam before re-aggro.
   */
  disengageAfterHit(playerPos: Vector3): void {
    this.state = 'wander'
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
    this.resolveWallCollision()
    this.velocity.x += ax * GHOST_POST_HIT_DISENGAGE_SPEED
    this.velocity.z += az * GHOST_POST_HIT_DISENGAGE_SPEED
    const hs = Math.hypot(this.velocity.x, this.velocity.z)
    const maxSp = 12.5
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

  update(
    dt: number,
    playerPos: Vector3,
    frightened: boolean,
    timeSec: number,
    playerInSafeCenter: boolean,
    relicCarried: boolean,
  ): void {
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
        this.pickWanderTimer()
        this.resetSkin()
        this.smoothedTx = 0
        this.smoothedTz = 1
      }
      return
    }

    const px = this.root.position.x
    const pz = this.root.position.z
    const dx = playerPos.x - px
    const dz = playerPos.z - pz
    const dist = Math.hypot(dx, dz)

    if (this.chaseLockout > 0) {
      this.chaseLockout -= dt
    }

    let tx = 0
    let tz = 0
    let targetSpeed = GHOST_WANDER_SPEED

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
    } else if (relicCarried) {
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
    } else {
      const detectR2 = GHOST_DETECT_RADIUS * GHOST_DETECT_RADIUS
      const loseR2 = GHOST_LOSE_CHASE_RADIUS * GHOST_LOSE_CHASE_RADIUS

      if (this.state === 'wander') {
        if (
          this.chaseLockout <= 0 &&
          dist * dist <= detectR2
        ) {
          this.state = 'chase'
        }
      } else {
        if (dist * dist > loseR2) {
          this.state = 'wander'
          this.pickWanderTimer()
          this.wanderAngle = Math.random() * Math.PI * 2
        }
      }

      if (this.state === 'chase') {
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

    const rawLen = Math.hypot(tx, tz)
    if (rawLen > 1e-5) {
      tx /= rawLen
      tz /= rawLen
    }

    let dirSmooth = GHOST_DIRECTION_SMOOTH_WANDER
    if (frightened) {
      dirSmooth = GHOST_DIRECTION_SMOOTH_FRIGHT
    } else if (
      this.state === 'chase' &&
      (relicCarried || !playerInSafeCenter)
    ) {
      dirSmooth = GHOST_DIRECTION_SMOOTH_CHASE
    }
    const dirK = 1 - Math.exp(-dirSmooth * dt)
    this.smoothedTx += (tx - this.smoothedTx) * dirK
    this.smoothedTz += (tz - this.smoothedTz) * dirK
    const sl = Math.hypot(this.smoothedTx, this.smoothedTz)
    if (sl > 1e-5) {
      this.smoothedTx /= sl
      this.smoothedTz /= sl
    }

    const desiredVx = this.smoothedTx * targetSpeed
    const desiredVz = this.smoothedTz * targetSpeed

    let steerAccel = GHOST_STEERING_ACCEL_WANDER
    if (frightened) {
      steerAccel = GHOST_STEERING_ACCEL_FRIGHT
    } else if (
      this.state === 'chase' &&
      (relicCarried || !playerInSafeCenter)
    ) {
      steerAccel = GHOST_STEERING_ACCEL_CHASE
    }
    const k = 1 - Math.exp(-steerAccel * dt)
    this.velocity.x += (desiredVx - this.velocity.x) * k
    this.velocity.z += (desiredVz - this.velocity.z) * k

    this.scratch.set(this.velocity.x * dt, 0, this.velocity.z * dt)
    this.root.position.add(this.scratch)

    this.resolveWallCollision()

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
      (this.state === 'chase' && (relicCarried || !playerInSafeCenter))
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

    this.applyEdgeNudge(targetSpeed)
    this.excludeFromSafeCenterRoom()
    this.resolveWallCollision()
  }

  /**
   * Hub interior (`SAFE_CENTER`) is a no-go for ghosts — keep circle body + padding clear of the AABB.
   */
  private excludeFromSafeCenterRoom(): void {
    const { minX, maxX, minZ, maxZ } = ROOMS.SAFE_CENTER.bounds
    const r = GHOST_COLLISION_RADIUS + GHOST_DEPOSIT_EXCLUSION_PADDING
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
      GHOST_COLLISION_RADIUS,
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
