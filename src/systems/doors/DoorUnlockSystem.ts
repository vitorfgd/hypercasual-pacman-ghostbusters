import type { Scene } from 'three'
import {
  DoubleSide,
  Group as ThreeGroup,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three'
import type { PerspectiveCamera } from 'three'
import type { Economy } from '../economy/Economy.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { AabbXZ } from '../world/collisionXZ.ts'
import { DOOR_HALF } from '../world/mansionGeometry.ts'
import type { RoomId } from '../world/mansionRoomData.ts'
import { DepositFlightAnimator } from '../deposit/DepositFlightAnimator.ts'
import {
  DOOR_COUNT,
  getDoorBlockerZ,
  getDoorPayTarget,
  getDoorZoneCenter,
  roomIndexFromId,
} from './doorLayout.ts'
import {
  DOOR_FLIGHT_DURATION_SEC,
  DOOR_PANEL_HEIGHT,
  DOOR_PAY_CHUNK,
  DOOR_UNLOCK_COST,
  DOOR_ZONE_HALF_DEPTH,
  DOOR_ZONE_HALF_WIDTH,
} from './doorUnlockConfig.ts'
import { createDoorBarrierMaterial } from './doorBarrierMaterial.ts'
import {
  createDoorPaymentCoinMesh,
  disposeDoorPaymentCoinMesh,
} from './doorPaymentMesh.ts'
import { spawnDoorPayCoins } from './doorPayVfx.ts'
import { createDoorPayWorldLabel, type DoorPayWorldLabel } from './doorPayWorldLabel.ts'

export type DoorUnlockSystemOptions = {
  scene: Scene
  player: PlayerController
  economy: Economy
  worldCollision: WorldCollision
  camera: PerspectiveCamera
  hostEl: HTMLElement
  onUnlocked?: (doorIndex: number) => void
}

export class DoorUnlockSystem {
  private readonly scene: Scene
  private readonly player: PlayerController
  private readonly economy: Economy
  private readonly worldCollision: WorldCollision
  private readonly camera: PerspectiveCamera
  private readonly hostEl: HTMLElement
  private readonly onUnlocked?: (doorIndex: number) => void

  private readonly root = new ThreeGroup()
  private readonly unlocked: boolean[] = Array.from(
    { length: DOOR_COUNT },
    () => false,
  )
  /** Gold already paid toward the **current** door. */
  private paidIntoCurrent = 0
  private readonly barrierMaterials: Array<{
    uniforms: { uTime: { value: number } }
  }> = []
  private readonly doorFlight = new DepositFlightAnimator()
  private readonly payTargetScratch = new Vector3()
  private activeKind: 'door' | null = null
  private readonly doorPayLabels: DoorPayWorldLabel[] = []
  /** Only redraw door floor textures when paid/cost display changes. */
  private readonly lastDoorLabelSig: string[] = Array.from(
    { length: DOOR_COUNT },
    () => '',
  )

  constructor(opts: DoorUnlockSystemOptions) {
    this.scene = opts.scene
    this.player = opts.player
    this.economy = opts.economy
    this.worldCollision = opts.worldCollision
    this.camera = opts.camera
    this.hostEl = opts.hostEl
    this.onUnlocked = opts.onUnlocked

    this.root.name = 'doorUnlock'
    this.scene.add(this.root)

    for (let i = 0; i < DOOR_COUNT; i++) {
      const g = this.buildDoorVisual(i)
      this.root.add(g)
    }

    /** Hub → ROOM_1 is open from the start; first payment is for ROOM_2 onward. */
    this.unlocked[0] = true
    this.syncBlockersAndColliders()
  }

  /** Whether the given door index is cleared (0 = hub wall, starts unlocked). */
  isDoorUnlocked(doorIndex: number): boolean {
    return doorIndex >= 0 && doorIndex < DOOR_COUNT
      ? this.unlocked[doorIndex]!
      : false
  }

  /** ROOM_k only if doors 0..k-1 are unlocked (door 0 starts unlocked). */
  canAccessRoomForSpawning(roomId: RoomId): boolean {
    const idx = roomIndexFromId(roomId)
    if (idx === null) return true
    if (idx <= 0) return true
    for (let d = 0; d < idx; d++) {
      if (!this.unlocked[d]) return false
    }
    return true
  }

  isPlayerInsideDoorZone(): boolean {
    return this.activeKind !== null
  }

  update(dt: number, timeSec: number): void {
    this.doorFlight.update(dt)

    for (const m of this.barrierMaterials) {
      m.uniforms.uTime.value = timeSec
    }

    this.activeKind = null
    const idx = this.firstLockedIndex()
    if (idx !== null) {
      const c = getDoorZoneCenter(idx)
      this.player.getPosition(this.payTargetScratch)
      const dx = this.payTargetScratch.x - c.x
      const dz = this.payTargetScratch.z - c.z
      if (this.isInDoorZoneRect(dx, dz)) {
        this.activeKind = 'door'
      }
    }

    /** Standing on the pad spends gold like the hub deposit — one chunk per flight gap. */
    if (this.activeKind === 'door') {
      this.tryAutoPayStep()
    }
    this.updateDoorLabels()
  }

  /**
   * While you stand in the zone and have balance, pays toward the door (same rhythm as deposit flights).
   */
  private tryAutoPayStep(): void {
    if (this.doorFlight.busy) return
    const idx = this.firstLockedIndex()
    if (idx === null) return

    const c = getDoorZoneCenter(idx)
    this.player.getPosition(this.payTargetScratch)
    const dx = this.payTargetScratch.x - c.x
    const dz = this.payTargetScratch.z - c.z
    if (!this.isInDoorZoneRect(dx, dz)) return

    const need = DOOR_UNLOCK_COST - this.paidIntoCurrent
    if (need <= 0) return
    const chunk = Math.min(DOOR_PAY_CHUNK, need, this.economy.money)
    if (chunk <= 0) return
    if (!this.economy.trySpend(chunk)) return

    this.paidIntoCurrent += chunk
    this.spawnPayEffects(idx, chunk)

    if (this.paidIntoCurrent >= DOOR_UNLOCK_COST) {
      this.unlocked[idx] = true
      this.paidIntoCurrent = 0
      this.onUnlocked?.(idx)
      this.syncBlockersAndColliders()
    }
  }

  private updateDoorLabels(): void {
    const fi = this.firstLockedIndex()
    for (let i = 0; i < this.doorPayLabels.length; i++) {
      const lbl = this.doorPayLabels[i]
      if (this.unlocked[i]) {
        lbl.mesh.visible = false
        this.lastDoorLabelSig[i] = ''
        continue
      }
      lbl.mesh.visible = true
      const paidShow =
        fi !== null && i === fi ? this.paidIntoCurrent : 0
      const sig = `${paidShow}|${DOOR_UNLOCK_COST}`
      if (this.lastDoorLabelSig[i] === sig) continue
      this.lastDoorLabelSig[i] = sig
      lbl.redraw(paidShow, DOOR_UNLOCK_COST)
    }
  }

  private isInDoorZoneRect(dx: number, dz: number): boolean {
    return (
      Math.abs(dx) <= DOOR_ZONE_HALF_WIDTH &&
      Math.abs(dz) <= DOOR_ZONE_HALF_DEPTH
    )
  }

  dispose(): void {
    this.doorFlight.cancel()
    for (const lbl of this.doorPayLabels) {
      lbl.dispose()
    }
    this.doorPayLabels.length = 0
    this.root.removeFromParent()
    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose()
        const mat = o.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
    })
  }

  private firstLockedIndex(): number | null {
    for (let i = 0; i < DOOR_COUNT; i++) {
      if (!this.unlocked[i]) return i
    }
    return null
  }

  private spawnPayEffects(doorIndex: number, chunk: number): void {
    const t = getDoorPayTarget(doorIndex)
    const endFlight = new Vector3(t.x, t.y, t.z)
    const endHud = new Vector3(t.x, t.y + 0.48, t.z)

    spawnDoorPayCoins(this.hostEl, this.camera, chunk, endHud)

    const coin = createDoorPaymentCoinMesh()
    this.player.getPosition(this.payTargetScratch)
    const start = new Vector3(
      this.payTargetScratch.x,
      0.38,
      this.payTargetScratch.z,
    )
    coin.userData.depositWorldStart = start.clone()
    coin.position.copy(start)

    this.doorFlight.startOne(
      this.scene,
      coin,
      endFlight,
      (m) => {
        disposeDoorPaymentCoinMesh(m as Mesh)
      },
      DOOR_FLIGHT_DURATION_SEC,
      null,
    )
  }

  private buildDoorVisual(doorIndex: number): ThreeGroup {
    const g = new ThreeGroup()
    g.name = `doorSet:${doorIndex}`

    const mat = createDoorBarrierMaterial()
    this.barrierMaterials.push(mat as unknown as { uniforms: { uTime: { value: number } } })

    const barrierW = DOOR_HALF * 2 + 0.06
    const plane = new Mesh(new PlaneGeometry(barrierW, DOOR_PANEL_HEIGHT), mat)
    plane.position.set(0, DOOR_PANEL_HEIGHT * 0.5, getDoorBlockerZ(doorIndex))
    plane.name = 'doorBarrier'
    g.add(plane)

    const pad = new ThreeGroup()
    pad.name = 'doorPayPad'
    const padY = 0.018
    const zone = getDoorZoneCenter(doorIndex)
    pad.position.set(zone.x, padY, zone.z)

    const w = DOOR_ZONE_HALF_WIDTH * 2
    const d = DOOR_ZONE_HALF_DEPTH * 2
    const innerW = w * 0.88
    const innerD = d * 0.88

    const border = new Mesh(
      new PlaneGeometry(w, d),
      new MeshStandardMaterial({
        color: 0x3a6878,
        emissive: 0x1a4050,
        emissiveIntensity: 0.1,
        roughness: 0.82,
        metalness: 0.08,
        transparent: true,
        opacity: 0.92,
        side: DoubleSide,
      }),
    )
    border.rotation.x = -Math.PI / 2
    border.position.y = 0.002
    pad.add(border)

    const label = createDoorPayWorldLabel(innerW, innerD)
    pad.add(label.mesh)
    this.doorPayLabels.push(label)

    g.add(pad)
    return g
  }

  private syncBlockersAndColliders(): void {
    for (let i = 0; i < DOOR_COUNT; i++) {
      const set = this.root.children[i] as ThreeGroup
      const barrier = set?.getObjectByName('doorBarrier') as Mesh | undefined
      if (barrier) barrier.visible = !this.unlocked[i]
      const payPad = set?.getObjectByName('doorPayPad') as ThreeGroup | undefined
      if (payPad) payPad.visible = !this.unlocked[i]
    }

    const extra: AabbXZ[] = []
    const t = 0.14
    const hw = DOOR_HALF + 0.04
    for (let i = 0; i < DOOR_COUNT; i++) {
      if (this.unlocked[i]) continue
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
