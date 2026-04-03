import type { Scene } from 'three'
import {
  BoxGeometry,
  Group as ThreeGroup,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { AabbXZ } from '../world/collisionXZ.ts'
import { DOOR_HALF } from '../world/mansionGeometry.ts'
import type { RoomId } from '../world/mansionRoomData.ts'
import { DOOR_COUNT, getDoorBlockerZ, roomIndexFromId } from './doorLayout.ts'
import {
  DOOR_HUB_STARTS_FULLY_OPEN,
  GATE_ANTICIPATION_SEC,
  GATE_OPEN_DELAY_SEC,
  GATE_PANEL_HEIGHT,
  GATE_SHAKE_AMPLITUDE,
  GATE_SHAKE_FREQ,
  GATE_SINK_DEPTH,
  GATE_SINK_DURATION_SEC,
} from './doorUnlockConfig.ts'
import { tryCloneGateMesh } from './gateGltfAsset.ts'

export type DoorUnlockSystemOptions = {
  scene: Scene
  worldCollision: WorldCollision
  onDoorPassageCleared?: (doorIndex: number) => void
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const OPEN_TOTAL_SEC =
  GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC + GATE_SINK_DURATION_SEC

/**
 * North-chain gates: hub passage starts open; doors 1…N−1 sink when that room hits 100% cleanliness.
 */
export class DoorUnlockSystem {
  private readonly worldCollision: WorldCollision
  private readonly onDoorPassageCleared?: (doorIndex: number) => void

  private readonly root = new ThreeGroup()
  /** Player may pass — after animation finishes (or hub door starts open). */
  private readonly passageOpen: boolean[] = Array.from(
    { length: DOOR_COUNT },
    (_, i) => i === 0 && DOOR_HUB_STARTS_FULLY_OPEN,
  )
  /** Seconds since `openDoorFully` — null = idle. */
  private readonly openingElapsed: (number | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly passageNotified: boolean[] = Array.from(
    { length: DOOR_COUNT },
    () => false,
  )

  private readonly gateRoots: (ThreeGroup | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  private readonly gateContents: (ThreeGroup | null)[] = Array.from(
    { length: DOOR_COUNT },
    () => null,
  )
  /**
   * Extra solid collider while passage stays “open” for access checks — e.g. boss seals return path.
   */
  private readonly bossTrapDoorIndices = new Set<number>()

  constructor(opts: DoorUnlockSystemOptions) {
    this.worldCollision = opts.worldCollision
    this.onDoorPassageCleared = opts.onDoorPassageCleared

    this.root.name = 'roomGates'
    opts.scene.add(this.root)

    for (let i = 0; i < DOOR_COUNT; i++) {
      if (i === 0 && DOOR_HUB_STARTS_FULLY_OPEN) continue
      this.buildGateSet(i)
    }

    this.syncColliders()
  }

  isDoorUnlocked(doorIndex: number): boolean {
    return (
      doorIndex >= 0 &&
      doorIndex < DOOR_COUNT &&
      this.passageOpen[doorIndex] === true
    )
  }

  /**
   * Block walking back through `doorIndex` without changing unlock state (room stays accessible for HUD/spawns).
   * Shows the gate mesh closed at floor level.
   */
  setBossDoorTrap(doorIndex: number, active: boolean): void {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return
    if (active) {
      this.bossTrapDoorIndices.add(doorIndex)
      const root = this.gateRoots[doorIndex]
      if (root) {
        root.visible = true
        const content = this.gateContents[doorIndex]
        if (content) content.position.set(0, 0, 0)
      }
    } else {
      this.bossTrapDoorIndices.delete(doorIndex)
      if (this.passageOpen[doorIndex]) {
        const root = this.gateRoots[doorIndex]
        if (root) root.visible = false
      }
    }
    this.syncColliders()
  }

  canAccessRoomForSpawning(roomId: RoomId): boolean {
    const idx = roomIndexFromId(roomId)
    if (idx === null) return true
    if (idx <= 0) return true
    for (let d = 0; d < idx; d++) {
      if (!this.isDoorUnlocked(d)) return false
    }
    return true
  }

  isPlayerInsideDoorZone(): boolean {
    return false
  }

  openDoorFully(doorIndex: number): void {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return
    if (this.passageOpen[doorIndex] === true) return
    if (this.openingElapsed[doorIndex] !== null) return
    this.openingElapsed[doorIndex] = 0
    this.applyGatePose(doorIndex, 0)
  }

  getDoorOpenProgress(doorIndex: number): number {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return 0
    if (this.passageOpen[doorIndex] === true) return 1
    const el = this.openingElapsed[doorIndex]
    if (el === null) return 0
    return Math.min(1, el / OPEN_TOTAL_SEC)
  }

  /**
   * Elapsed seconds since `openDoorFully` for this door, or null when idle (read-only; for UI/covers).
   */
  getDoorOpeningElapsed(doorIndex: number): number | null {
    if (doorIndex < 0 || doorIndex >= DOOR_COUNT) return null
    return this.openingElapsed[doorIndex]
  }

  update(dt: number, _timeSec: number): void {
    for (let i = 0; i < DOOR_COUNT; i++) {
      const el = this.openingElapsed[i]
      if (el === null) continue
      const next = el + dt
      this.openingElapsed[i] = next
      this.applyGatePose(i, next)

      if (next >= OPEN_TOTAL_SEC) {
        this.passageOpen[i] = true
        this.openingElapsed[i] = null
        if (!this.passageNotified[i]) {
          this.passageNotified[i] = true
          this.onDoorPassageCleared?.(i)
        }
        this.setGateHidden(i)
      }
    }
    this.syncColliders()
  }

  private setGateHidden(doorIndex: number): void {
    const root = this.gateRoots[doorIndex]
    if (root) root.visible = false
  }

  private applyGatePose(doorIndex: number, elapsed: number): void {
    const content = this.gateContents[doorIndex]
    if (!content) return

    const t0 = GATE_OPEN_DELAY_SEC
    const t1 = t0 + GATE_ANTICIPATION_SEC

    let y = 0
    let shakeX = 0

    if (elapsed < t0) {
      y = 0
      shakeX = 0
    } else if (elapsed < t1) {
      const sub = elapsed - t0
      y = 0
      shakeX =
        Math.sin(sub * GATE_SHAKE_FREQ) *
        GATE_SHAKE_AMPLITUDE *
        (1 - sub / GATE_ANTICIPATION_SEC)
    } else {
      const sub = elapsed - t1
      const u = Math.min(1, sub / GATE_SINK_DURATION_SEC)
      y = -easeInOutCubic(u) * GATE_SINK_DEPTH
      shakeX = 0
    }

    content.position.set(shakeX, y, 0)
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

  private buildGateSet(doorIndex: number): void {
    const g = new ThreeGroup()
    g.name = `gateSet:${doorIndex}`
    const zDoor = getDoorBlockerZ(doorIndex)
    g.position.set(0, 0, zDoor)

    const content = new ThreeGroup()
    content.name = 'gateContent'
    g.add(content)

    const barrierW = DOOR_HALF * 2 + 0.06
    const mesh = tryCloneGateMesh()
    if (mesh) {
      mesh.name = 'gateMesh'
      content.add(mesh)
    } else {
      content.add(this.createFallbackGate(barrierW))
    }

    this.gateRoots[doorIndex] = g
    this.gateContents[doorIndex] = content
    this.root.add(g)
  }

  private createFallbackGate(barrierW: number): Mesh {
    const mesh = new Mesh(
      new BoxGeometry(barrierW, GATE_PANEL_HEIGHT, 0.2),
      new MeshStandardMaterial({
        color: 0x3d3250,
        emissive: 0x221830,
        emissiveIntensity: 0.12,
        roughness: 0.82,
        metalness: 0.06,
      }),
    )
    mesh.name = 'gateFallback'
    mesh.userData.gateFallback = true
    mesh.position.y = GATE_PANEL_HEIGHT * 0.5
    return mesh
  }

  private syncColliders(): void {
    const extra: AabbXZ[] = []
    const t = 0.16
    const hw = DOOR_HALF + 0.04

    for (let i = 0; i < DOOR_COUNT; i++) {
      if (this.passageOpen[i] === true && !this.bossTrapDoorIndices.has(i))
        continue
      const zc = getDoorBlockerZ(i)
      extra.push({
        minX: -hw,
        maxX: hw,
        minZ: zc - t * 0.5,
        maxZ: zc + t * 0.5,
      })
    }
    this.worldCollision.setExtraColliders(extra)
  }
}
