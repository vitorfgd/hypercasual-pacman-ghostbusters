import type { Scene } from 'three'
import {
  BoxGeometry,
  Color,
  Group as ThreeGroup,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SpotLight,
} from 'three'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { AabbXZ } from '../world/collisionXZ.ts'
import { DOOR_HALF } from '../world/mansionGeometry.ts'
import type { RoomId } from '../world/mansionRoomData.ts'
import { DOOR_COUNT, getDoorBlockerZ, roomIndexFromId } from './doorLayout.ts'
import {
  DOOR_AUTO_OPEN_ANTICIPATE_SEC,
  DOOR_AUTO_OPEN_DURATION_SEC,
  DOOR_COLLIDER_THICKNESS,
  DOOR_CROSS_Z_EPS,
  DOOR_EXIT_SOUTH_MARGIN,
  DOOR_LEAF_COLLIDER_SLICES,
  DOOR_MAX_SWING_RAD,
  DOOR_MIN_SWING_TO_REGISTER_CROSS,
  DOOR_PASS_CLOSE_DELAY_SEC,
  DOOR_PASSAGE_CLEAR_SWING,
  DOOR_PUSH_ZONE_HALF_X,
  DOOR_PUSH_ZONE_HALF_Z,
  DOOR_RETREAT_CANCEL_MARGIN,
  DOOR_SLAM_SHUT_SEC,
  DOOR_TRIGGER_HALF_X,
  DOOR_TRIGGER_HALF_Z,
  DOUBLE_DOOR_VISUAL_SCALE_XZ,
  DOUBLE_DOOR_VISUAL_SCALE_Y,
  DOUBLE_DOOR_VISUAL_Z_NUDGE,
  DOOR_LIGHT_BASE_WARM_COLOR,
  DOOR_LIGHT_BASE_WARM_MIX,
  DOOR_LIGHT_LOCKED_COLOR,
  DOOR_LIGHT_LOCKED_FLICKER_AMP,
  DOOR_LIGHT_LOCKED_FLICKER_HZ,
  DOOR_LIGHT_LOCKED_INTENSITY,
  DOOR_LIGHT_PUSH_PULSE_MUL,
  DOOR_LIGHT_PUSH_PULSE_SEC,
  DOOR_LIGHT_UNLOCK_TRANSITION_SEC,
  DOOR_LIGHT_UNLOCKED_COLOR,
  DOOR_LIGHT_UNLOCKED_INTENSITY,
  DOOR_SPOT_ACTIVE_X_HALF,
  DOOR_SPOT_ACTIVE_Z_HALF,
  DOOR_SPOT_ANGLE,
  DOOR_SPOT_DECAY,
  DOOR_SPOT_DISTANCE,
  DOOR_SPOT_PENUMBRA,
  DOOR_SPOT_POS_X,
  DOOR_SPOT_POS_Y,
  DOOR_SPOT_POS_Z,
  DOOR_SPOT_SHADOW_ENABLED,
  DOOR_SPOT_SHADOW_MAP_SIZE,
  DOOR_SPOT_TARGET_X,
  DOOR_SPOT_TARGET_Y,
  DOOR_SPOT_TARGET_Z,
  GATE_PANEL_HEIGHT,
} from './doorUnlockConfig.ts'
import { tryCloneDoubleDoorVisual } from './doubleDoorGltfAsset.ts'

export type DoorUnlockSystemOptions = {
  scene: Scene
  worldCollision: WorldCollision
  onDoorPassageCleared?: (doorIndex: number) => void
  /** Fired once when a progression door begins its slam shut (impact frame). */
  onDoorSlamShut?: (doorIndex: number) => void
}

function easeInQuad(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u
}

/** Tight AABB for one slice of a door leaf (local X from spanA→spanB along the leaf). */
function rotLeafSliceAabb(
  hingeX: number,
  hingeZ: number,
  yaw: number,
  spanA: number,
  spanB: number,
  halfDepth: number,
): AabbXZ {
  const lo = Math.min(spanA, spanB)
  const hi = Math.max(spanA, spanB)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const corners: [number, number][] = [
    [lo, -halfDepth],
    [hi, -halfDepth],
    [hi, halfDepth],
    [lo, halfDepth],
  ]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [lx, lz] of corners) {
    const wx = hingeX + lx * c - lz * s
    const wz = hingeZ + lx * s + lz * c
    minX = Math.min(minX, wx)
    maxX = Math.max(maxX, wx)
    minZ = Math.min(minZ, wz)
    maxZ = Math.max(maxZ, wz)
  }
  return { minX, maxX, minZ, maxZ }
}

/** Circle (player) vs doorway trigger AABB overlap (XZ). */
function circleIntersectsDoorTrigger(
  px: number,
  pz: number,
  radius: number,
  zDoor: number,
): boolean {
  const minX = -DOOR_TRIGGER_HALF_X
  const maxX = DOOR_TRIGGER_HALF_X
  const minZ = zDoor - DOOR_TRIGGER_HALF_Z
  const maxZ = zDoor + DOOR_TRIGGER_HALF_Z
  const cx = Math.max(minX, Math.min(maxX, px))
  const cz = Math.max(minZ, Math.min(maxZ, pz))
  const dx = px - cx
  const dz = pz - cz
  return dx * dx + dz * dz <= radius * radius + 1e-5
}

function easeOutCubic(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return 1 - (1 - u) ** 3
}

/**
 * Double doors: unlock on cleanliness, contact triggers one eased open, forward-only slam.
 */
export class DoorUnlockSystem {
  private readonly worldCollision: WorldCollision
  private readonly onDoorPassageCleared?: (doorIndex: number) => void
  private readonly onDoorSlamShut?: (doorIndex: number) => void

  private readonly root = new ThreeGroup()
  /** Cleanliness satisfied — may push until passed / boss trap. */
  private readonly keyUnlocked: boolean[] = Array.from({ length: DOOR_COUNT }, (_, i) => i === 0)
  /** Player has crossed forward; door is permanently closed (progression). */
  private readonly passed: boolean[] = Array.from({ length: DOOR_COUNT }, () => false)
  /** Boss fight seal — same blocking as passed, distinct for southern access rules. */
  private readonly bossTrapped = new Set<number>()

  private readonly swing: number[] = Array.from({ length: DOOR_COUNT }, () => 0)
  /**
   * -1 = idle / not auto-opening; >=0 seconds since contact triggered one-shot open (includes
   * anticipation + eased swing).
   */
  private readonly doorAutoOpenElapsed: number[] = Array.from(
    { length: DOOR_COUNT },
    () => -1,
  )
  private readonly passageNotified: boolean[] = Array.from(
    { length: DOOR_COUNT },
    () => false,
  )

  private readonly commitsForward: boolean[] = Array.from(
    { length: DOOR_COUNT },
    () => false,
  )
  private readonly pendingCloseRemain: (number | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly slamRemain: (number | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly slamStartSwing: number[] = Array.from(
    { length: DOOR_COUNT },
    () => 0,
  )
  private readonly triggerInsidePrev: boolean[] = Array.from(
    { length: DOOR_COUNT },
    () => false,
  )

  private lastPlayerZ: number | null = null

  private readonly doorRoots: (ThreeGroup | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly leftPivots: (ThreeGroup | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly rightPivots: (ThreeGroup | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )

  private readonly doorSpotLights: (SpotLight | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  /** Remaining seconds for red→green ease when `unlockDoor` fires. */
  private readonly unlockLightTransitionRemain: number[] = Array.from(
    { length: DOOR_COUNT },
    () => 0,
  )
  private readonly pushPulseRemain: number[] = Array.from(
    { length: DOOR_COUNT },
    () => 0,
  )

  private readonly colLocked = new Color(DOOR_LIGHT_LOCKED_COLOR)
  private readonly colUnlocked = new Color(DOOR_LIGHT_UNLOCKED_COLOR)
  private readonly colWarm = new Color(DOOR_LIGHT_BASE_WARM_COLOR)
  private readonly scratchDoorRgb = new Color()

  constructor(opts: DoorUnlockSystemOptions) {
    this.worldCollision = opts.worldCollision
    this.onDoorPassageCleared = opts.onDoorPassageCleared
    this.onDoorSlamShut = opts.onDoorSlamShut

    this.root.name = 'roomDoubleDoors'
    opts.scene.add(this.root)

    for (let i = 0; i < DOOR_COUNT; i++) {
      this.buildDoorSet(i)
    }

    this.syncColliders()
    this.syncDoorSpotlights(0, 0, null)
  }

  unlockDoor(doorIndex: number): void {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return
    if (this.passed[doorIndex] || this.bossTrapped.has(doorIndex)) return
    this.keyUnlocked[doorIndex] = true
    this.unlockLightTransitionRemain[doorIndex] = DOOR_LIGHT_UNLOCK_TRANSITION_SEC
    // `unlockDoor` runs from room-clear (after `update` in the same frame). Refresh immediately
    // so door colliders switch off the sealed slab without waiting a full frame.
    this.syncColliders()
  }

  openDoorFully(doorIndex: number): void {
    this.unlockDoor(doorIndex)
  }

  isKeyUnlocked(doorIndex: number): boolean {
    return (
      doorIndex >= 0 &&
      doorIndex < DOOR_COUNT &&
      this.keyUnlocked[doorIndex] === true &&
      !this.passed[doorIndex] &&
      !this.bossTrapped.has(doorIndex)
    )
  }

  isDoorUnlocked(doorIndex: number): boolean {
    return this.isDoorPassageClear(doorIndex)
  }

  /** Physical gap: swing past threshold while door is still interactable. */
  isDoorPassageClear(doorIndex: number): boolean {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return false
    if (this.passed[doorIndex] || this.bossTrapped.has(doorIndex)) return false
    return this.swing[doorIndex] >= DOOR_PASSAGE_CLEAR_SWING
  }

  /**
   * Room chain / clutter: door is “resolved” if the player has crossed (passed), boss-sealed,
   * or the passage is physically open enough.
   */
  isDoorSouthernAccessGranted(doorIndex: number): boolean {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return false
    if (this.passed[doorIndex]) return true
    if (this.bossTrapped.has(doorIndex)) return true
    return this.isDoorPassageClear(doorIndex)
  }

  setBossDoorTrap(doorIndex: number, active: boolean): void {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return
    if (active) {
      this.bossTrapped.add(doorIndex)
      this.keyUnlocked[doorIndex] = false
      this.swing[doorIndex] = 0
      this.doorAutoOpenElapsed[doorIndex] = -1
      this.slamRemain[doorIndex] = null
      this.pendingCloseRemain[doorIndex] = null
      this.commitsForward[doorIndex] = false
      this.applySwingPose(doorIndex, 0)
      const r = this.doorRoots[doorIndex]
      if (r) r.visible = true
    } else {
      this.bossTrapped.delete(doorIndex)
    }
    this.syncColliders()
  }

  canAccessRoomForSpawning(roomId: RoomId): boolean {
    const idx = roomIndexFromId(roomId)
    if (idx === null) return true
    if (idx <= 0) return true
    for (let d = 0; d < idx; d++) {
      if (!this.isDoorSouthernAccessGranted(d)) return false
    }
    return true
  }

  isPlayerInsideDoorZone(): boolean {
    return false
  }

  getDoorOpenProgress(doorIndex: number): number {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return 0
    return this.swing[doorIndex]
  }

  getDoorSwingOpen01(doorIndex: number): number {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return 0
    if (this.passed[doorIndex]) return 1
    return this.swing[doorIndex]
  }

  getDoorOpeningElapsed(doorIndex: number): number | null {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return null
    const s = this.swing[doorIndex]
    return s > 1e-4 ? s * 2.5 : null
  }

  update(dt: number, timeSec: number, player: DoorPlayerSample): void {
    const px = player.x
    const pz = player.z
    const pr = player.radius
    const lastZ = this.lastPlayerZ

    for (let i = 0; i < DOOR_COUNT; i++) {
      const zDoor = getDoorBlockerZ(i)
      const inTrig = circleIntersectsDoorTrigger(px, pz, pr, zDoor)
      const wasIn = this.triggerInsidePrev[i]

      if (!this.passed[i] && !this.bossTrapped.has(i)) {
        if (lastZ !== null) {
          const crossedForward =
            lastZ > zDoor + DOOR_CROSS_Z_EPS && pz < zDoor - DOOR_CROSS_Z_EPS
          const crossedBack =
            lastZ < zDoor - DOOR_CROSS_Z_EPS && pz > zDoor + DOOR_CROSS_Z_EPS

          if (crossedBack) {
            this.commitsForward[i] = false
            this.pendingCloseRemain[i] = null
          }

          if (crossedForward && this.keyUnlocked[i]) {
            const sw = this.swing[i]!
            if (
              sw >= DOOR_MIN_SWING_TO_REGISTER_CROSS ||
              sw >= DOOR_PASSAGE_CLEAR_SWING
            ) {
              this.commitsForward[i] = true
            }
          }
        }

        const pending = this.pendingCloseRemain[i]
        if (pending !== null && pending > 0) {
          if (pz > zDoor + DOOR_RETREAT_CANCEL_MARGIN) {
            this.pendingCloseRemain[i] = null
            this.commitsForward[i] = false
          } else {
            const nextP = pending - dt
            if (nextP <= 0) {
              this.pendingCloseRemain[i] = null
              this.beginDoorSlamShut(i)
            } else {
              this.pendingCloseRemain[i] = nextP
            }
          }
        }

        if (
          this.commitsForward[i] &&
          wasIn &&
          !inTrig &&
          pz < zDoor - DOOR_EXIT_SOUTH_MARGIN &&
          this.pendingCloseRemain[i] === null &&
          !this.passed[i]
        ) {
          this.pendingCloseRemain[i] = DOOR_PASS_CLOSE_DELAY_SEC
        }
      }

      this.triggerInsidePrev[i] = inTrig
    }

    for (let i = 0; i < DOOR_COUNT; i++) {
      const sr = this.slamRemain[i]
      if (sr !== null && sr > 0) {
        const nextSlam = sr - dt
        const t = 1 - Math.max(0, nextSlam) / DOOR_SLAM_SHUT_SEC
        const u = easeInQuad(t)
        this.swing[i] = this.slamStartSwing[i]! * (1 - u)
        this.applySwingPose(i, this.swing[i]!)
        if (nextSlam <= 0) {
          this.slamRemain[i] = null
          this.swing[i] = 0
          this.applySwingPose(i, 0)
        } else {
          this.slamRemain[i] = nextSlam
        }
        continue
      }

      if (this.bossTrapped.has(i)) continue
      if (this.passed[i]) continue

      if (!this.keyUnlocked[i]) {
        this.doorAutoOpenElapsed[i] = -1
        this.swing[i] = 0
        this.applySwingPose(i, 0)
        continue
      }

      const at = DOOR_AUTO_OPEN_ANTICIPATE_SEC
      const dur = DOOR_AUTO_OPEN_DURATION_SEC

      if (this.doorAutoOpenElapsed[i] >= 0) {
        this.doorAutoOpenElapsed[i] += dt
        const te = this.doorAutoOpenElapsed[i]
        if (te < at) {
          this.swing[i] = 0
        } else {
          let p = (te - at) / dur
          if (p >= 1) {
            this.swing[i] = 1
            this.doorAutoOpenElapsed[i] = -1
          } else {
            this.swing[i] = easeOutCubic(p)
          }
        }
        this.applySwingPose(i, this.swing[i]!)
        if (
          this.swing[i]! >= DOOR_PASSAGE_CLEAR_SWING &&
          !this.passageNotified[i]
        ) {
          this.passageNotified[i] = true
          this.onDoorPassageCleared?.(i)
        }
        continue
      }

      if (
        this.swing[i]! < 1 - 1e-4 &&
        this.playerInDoorPushZone(i, player)
      ) {
        this.doorAutoOpenElapsed[i] = 0
        this.pushPulseRemain[i] = DOOR_LIGHT_PUSH_PULSE_SEC
        this.swing[i] = 0
        this.applySwingPose(i, 0)
        continue
      }

      this.applySwingPose(i, this.swing[i]!)
      if (
        this.swing[i]! >= DOOR_PASSAGE_CLEAR_SWING &&
        !this.passageNotified[i]
      ) {
        this.passageNotified[i] = true
        this.onDoorPassageCleared?.(i)
      }
    }

    this.lastPlayerZ = pz
    this.syncColliders()
    this.syncDoorSpotlights(dt, timeSec, player)
  }

  dispose(): void {
    this.root.removeFromParent()
    this.root.traverse((o) => {
      if (!(o instanceof Mesh)) return
      if (o.userData.gateFallback !== true) return
      o.geometry.dispose()
      const mat = o.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    })
  }

  private beginDoorSlamShut(doorIndex: number): void {
    if (this.passed[doorIndex]) return
    this.passed[doorIndex] = true
    this.keyUnlocked[doorIndex] = false
    this.doorAutoOpenElapsed[doorIndex] = -1
    this.commitsForward[doorIndex] = false
    this.pendingCloseRemain[doorIndex] = null

    const s = this.swing[doorIndex]!
    this.slamStartSwing[doorIndex] = s
    this.slamRemain[doorIndex] = DOOR_SLAM_SHUT_SEC

    this.onDoorSlamShut?.(doorIndex)

    if (s < 1e-3) {
      this.swing[doorIndex] = 0
      this.slamRemain[doorIndex] = null
      this.applySwingPose(doorIndex, 0)
    } else {
      this.applySwingPose(doorIndex, s)
    }
  }

  private playerInDoorPushZone(i: number, p: DoorPlayerSample): boolean {
    const zDoor = getDoorBlockerZ(i)
    return (
      Math.abs(p.x) <= DOOR_PUSH_ZONE_HALF_X + p.radius &&
      Math.abs(p.z - zDoor) <= DOOR_PUSH_ZONE_HALF_Z + p.radius
    )
  }

  /** Normalized swing 0…1 maps linearly to panel angle (easing is applied to swing itself over time). */
  private applySwingPose(doorIndex: number, swing01: number): void {
    const lp = this.leftPivots[doorIndex]
    const rp = this.rightPivots[doorIndex]
    if (!lp || !rp) return
    const ang = swing01 * DOOR_MAX_SWING_RAD
    lp.rotation.y = ang
    rp.rotation.y = -ang
  }

  private buildDoorSet(doorIndex: number): void {
    const g = new ThreeGroup()
    g.name = `doorSet:${doorIndex}`
    const zDoor = getDoorBlockerZ(doorIndex)
    g.position.set(0, 0, zDoor)

    const vis = tryCloneDoubleDoorVisual()
    if (vis) {
      vis.root.scale.set(
        DOUBLE_DOOR_VISUAL_SCALE_XZ,
        DOUBLE_DOOR_VISUAL_SCALE_Y,
        DOUBLE_DOOR_VISUAL_SCALE_XZ,
      )
      vis.root.position.z = DOUBLE_DOOR_VISUAL_Z_NUDGE
      g.add(vis.root)
      this.leftPivots[doorIndex] = vis.leftPivot
      this.rightPivots[doorIndex] = vis.rightPivot
    } else {
      const content = new ThreeGroup()
      content.name = 'doorFallbackContent'
      const barrierW = DOOR_HALF * 2 + 0.06
      const half = barrierW * 0.25
      const lp = new ThreeGroup()
      lp.position.set(-half * 2, 0, 0)
      const lm = this.createFallbackPanel(half * 2.1)
      lp.add(lm)
      const rp = new ThreeGroup()
      rp.position.set(half * 2, 0, 0)
      const rm = this.createFallbackPanel(half * 2.1)
      rp.add(rm)
      content.add(lp)
      content.add(rp)
      g.add(content)
      this.leftPivots[doorIndex] = lp
      this.rightPivots[doorIndex] = rp
    }

    this.doorRoots[doorIndex] = g
    this.root.add(g)
    this.attachDoorSpotlight(g, doorIndex)
    this.applySwingPose(doorIndex, 0)
  }

  /** Narrow spotlight above the frame, aimed at threshold + ground in front; state-driven. */
  private attachDoorSpotlight(g: ThreeGroup, doorIndex: number): void {
    const aim = new Object3D()
    aim.name = `doorSpotAim:${doorIndex}`
    aim.position.set(DOOR_SPOT_TARGET_X, DOOR_SPOT_TARGET_Y, DOOR_SPOT_TARGET_Z)
    g.add(aim)

    const S = new SpotLight(
      0xffffff,
      2,
      DOOR_SPOT_DISTANCE,
      DOOR_SPOT_ANGLE,
      DOOR_SPOT_PENUMBRA,
      DOOR_SPOT_DECAY,
    )
    S.name = `doorStylizedSpot:${doorIndex}`
    S.position.set(DOOR_SPOT_POS_X, DOOR_SPOT_POS_Y, DOOR_SPOT_POS_Z)
    S.target = aim
    if (DOOR_SPOT_SHADOW_ENABLED) {
      S.castShadow = true
      S.shadow.mapSize.set(DOOR_SPOT_SHADOW_MAP_SIZE, DOOR_SPOT_SHADOW_MAP_SIZE)
      S.shadow.radius = 3
      S.shadow.bias = -0.00018
      S.shadow.normalBias = 0.02
    } else {
      S.castShadow = false
    }
    g.add(S)
    this.doorSpotLights[doorIndex] = S
  }

  private syncDoorSpotlights(
    dt: number,
    timeSec: number,
    player: DoorPlayerSample | null,
  ): void {
    for (let i = 0; i < DOOR_COUNT; i++) {
      const L = this.doorSpotLights[i]
      if (!L) continue

      const zDoor = getDoorBlockerZ(i)
      const activeNearby =
        player === null ||
        (Math.abs(player.z - zDoor) < DOOR_SPOT_ACTIVE_Z_HALF &&
          Math.abs(player.x) < DOOR_SPOT_ACTIVE_X_HALF)

      const passed = this.passed[i]
      const bossSeal = this.bossTrapped.has(i)
      const locked = !this.keyUnlocked[i] || bossSeal

      if (!activeNearby || passed) {
        L.visible = false
        L.intensity = 0
        continue
      }

      L.visible = true

      let intensity = DOOR_LIGHT_LOCKED_INTENSITY
      let r: number
      let gCol: number
      let b: number

      if (locked) {
        const flick =
          1 +
          DOOR_LIGHT_LOCKED_FLICKER_AMP *
            Math.sin(timeSec * (Math.PI * 2 * DOOR_LIGHT_LOCKED_FLICKER_HZ))
        intensity = DOOR_LIGHT_LOCKED_INTENSITY * flick
        r = this.colLocked.r
        gCol = this.colLocked.g
        b = this.colLocked.b
      } else {
        let u = 1
        let tr = this.unlockLightTransitionRemain[i]
        if (tr > 0) {
          tr = Math.max(0, tr - dt)
          this.unlockLightTransitionRemain[i] = tr
          u =
            1 -
            tr / Math.max(1e-5, DOOR_LIGHT_UNLOCK_TRANSITION_SEC)
        }
        u = u * u * (3 - 2 * u)
        this.scratchDoorRgb.copy(this.colLocked).lerp(this.colUnlocked, u)
        if (DOOR_LIGHT_BASE_WARM_MIX > 0) {
          this.scratchDoorRgb.lerp(this.colWarm, DOOR_LIGHT_BASE_WARM_MIX)
        }
        intensity =
          DOOR_LIGHT_LOCKED_INTENSITY +
          (DOOR_LIGHT_UNLOCKED_INTENSITY - DOOR_LIGHT_LOCKED_INTENSITY) * u
        r = this.scratchDoorRgb.r
        gCol = this.scratchDoorRgb.g
        b = this.scratchDoorRgb.b
      }

      let pr = this.pushPulseRemain[i]
      if (pr > 0) {
        pr = Math.max(0, pr - dt)
        this.pushPulseRemain[i] = pr
        intensity *= DOOR_LIGHT_PUSH_PULSE_MUL
      }

      L.color.setRGB(r, gCol, b)
      L.intensity = intensity
    }
  }

  private createFallbackPanel(width: number): Mesh {
    const mesh = new Mesh(
      new BoxGeometry(width, GATE_PANEL_HEIGHT, 0.14),
      new MeshStandardMaterial({
        color: 0x3d3250,
        emissive: 0x221830,
        emissiveIntensity: 0.12,
        roughness: 0.82,
        metalness: 0.06,
      }),
    )
    mesh.name = 'doorFallbackLeaf'
    mesh.userData.gateFallback = true
    mesh.position.y = GATE_PANEL_HEIGHT * 0.5
    return mesh
  }

  private syncColliders(): void {
    const extra: AabbXZ[] = []
    const halfW = DOOR_HALF + 0.04
    const t = DOOR_COLLIDER_THICKNESS
    const halfD = t * 0.5
    const span = DOOR_HALF * 0.98
    const yawL = (s: number) => s * DOOR_MAX_SWING_RAD
    const hingeLX = -DOOR_HALF * 0.98
    const hingeRX = DOOR_HALF * 0.98

    for (let i = 0; i < DOOR_COUNT; i++) {
      const zc = getDoorBlockerZ(i)
      if (this.passed[i] || this.bossTrapped.has(i) || !this.keyUnlocked[i]) {
        extra.push({
          minX: -halfW,
          maxX: halfW,
          minZ: zc - halfD,
          maxZ: zc + halfD,
        })
        continue
      }
      const s = this.swing[i]!
      if (s >= DOOR_PASSAGE_CLEAR_SWING) continue

      const yL = yawL(s)
      const yR = -yL
      const n = Math.max(2, DOOR_LEAF_COLLIDER_SLICES)
      for (let sl = 0; sl < n; sl++) {
        const t0 = sl / n
        const t1 = (sl + 1) / n
        const a = t0 * span
        const b = t1 * span
        extra.push(rotLeafSliceAabb(hingeLX, zc, yL, a, b, halfD))
        const ra = -t0 * span
        const rb = -t1 * span
        extra.push(rotLeafSliceAabb(hingeRX, zc, yR, rb, ra, halfD))
      }
    }

    this.worldCollision.setExtraColliders(extra)
  }
}

export type DoorPlayerSample = {
  x: number
  z: number
  radius: number
  vz: number
}
