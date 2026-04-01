import type { Group, Mesh, Scene } from 'three'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { DepositFlightAnimator } from '../deposit/DepositFlightAnimator.ts'
import {
  createDoorPaymentCoinMesh,
  disposeDoorPaymentCoinMesh,
} from '../doors/doorPaymentMesh.ts'
import { spawnDoorPayCoins } from '../doors/doorPayVfx.ts'
import { DOOR_FLIGHT_DURATION_SEC } from '../doors/doorUnlockConfig.ts'
import type { Economy } from '../economy/Economy.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import {
  INITIAL_STACK_CAPACITY,
  MAX_CAPACITY_UPGRADE_LEVELS,
  MAX_PULSE_DRAIN_UPGRADE_LEVELS,
  MAX_PULSE_FILL_UPGRADE_LEVELS,
  MAX_SPEED_UPGRADE_LEVELS,
  UPGRADE_PAD_HALF_DEPTH,
  UPGRADE_PAD_HALF_WIDTH,
  UPGRADE_PAD_HUB_OFFSET,
  UPGRADE_PAY_CHUNK,
  capacityUpgradeCost,
  pulseChargeDrainPerSec,
  pulseChargeFillPerSec,
  pulseDrainUpgradeCost,
  pulseFillUpgradeCost,
  speedForLevel,
  speedUpgradeCost,
} from './upgradeConfig.ts'
import type { PadLabelPayload } from './UpgradePadVisual.ts'
import {
  createUpgradePadWorldLabel,
  type UpgradePadWorldLabel,
} from './upgradePadWorldLabel.ts'

const p = new Vector3()

/**
 * Hub upgrade pads appear only after the matching door is paid open.
 * Door 0 is the hub south wall (unlocked at start); unlocking doors 1…4
 * reveals capacity, speed, pulse fill, and pulse drain in order.
 */
const UPGRADE_VISIBLE_AFTER_DOOR: Record<UpgradeSpendKind, number> = {
  capacity: 1,
  speed: 2,
  pulseFreq: 3,
  pulseDuration: 4,
}

export type UpgradeSpendKind =
  | 'capacity'
  | 'speed'
  | 'pulseFreq'
  | 'pulseDuration'

export type UpgradeZoneSystemOptions = {
  economy: Economy
  player: PlayerController
  stack: CarryStack
  scene: Scene
  camera: PerspectiveCamera
  hostEl: HTMLElement
  capacityPad: {
    root: Group
    setLabel: (p: PadLabelPayload) => void
    setOccupancy: (t: number) => void
  }
  speedPad: {
    root: Group
    setLabel: (p: PadLabelPayload) => void
    setOccupancy: (t: number) => void
  }
  pulseFreqPad: {
    root: Group
    setLabel: (p: PadLabelPayload) => void
    setOccupancy: (t: number) => void
  }
  pulseDurationPad: {
    root: Group
    setLabel: (p: PadLabelPayload) => void
    setOccupancy: (t: number) => void
  }
  onSpendVfx?: (
    kind: UpgradeSpendKind,
    cost: number,
    padWorld: Vector3,
  ) => void
  /** Pad is interactable only when this door index is unlocked (see `UPGRADE_VISIBLE_AFTER_DOOR`). */
  isDoorUnlocked: (doorIndex: number) => boolean
}

/**
 * Hub pads: stand on pad to pay toward the next level (door-style); floor shows $ left.
 */
export class UpgradeZoneSystem {
  private readonly economy: Economy
  private readonly player: PlayerController
  private readonly stack: CarryStack
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly hostEl: HTMLElement
  private readonly capacityPad: UpgradeZoneSystemOptions['capacityPad']
  private readonly speedPad: UpgradeZoneSystemOptions['speedPad']
  private readonly pulseFreqPad: UpgradeZoneSystemOptions['pulseFreqPad']
  private readonly pulseDurationPad: UpgradeZoneSystemOptions['pulseDurationPad']
  private readonly onSpendVfx?: UpgradeZoneSystemOptions['onSpendVfx']
  private readonly isDoorUnlocked: (doorIndex: number) => boolean

  private readonly upgradeFlight = new DepositFlightAnimator()

  private capacityUpgradeLevel = 0
  private speedUpgradeLevel = 0
  private pulseFillLevel = 0
  private pulseDrainLevel = 0

  private paidCapacity = 0
  private paidSpeed = 0
  private paidPulseFill = 0
  private paidPulseDrain = 0

  private activeKind: UpgradeSpendKind | null = null

  private occCapacity = 0
  private occSpeed = 0
  private occPulseFreq = 0
  private occPulseDuration = 0

  private readonly padWorld: Record<UpgradeSpendKind, Vector3>
  private readonly floorLabels: UpgradePadWorldLabel[]
  /** Avoid redrawing floor canvases every frame (huge CPU/GPU cost). */
  private readonly lastFloorLabelSig = ['', '', '', '']

  constructor(opts: UpgradeZoneSystemOptions) {
    this.economy = opts.economy
    this.player = opts.player
    this.stack = opts.stack
    this.scene = opts.scene
    this.camera = opts.camera
    this.hostEl = opts.hostEl
    this.capacityPad = opts.capacityPad
    this.speedPad = opts.speedPad
    this.pulseFreqPad = opts.pulseFreqPad
    this.pulseDurationPad = opts.pulseDurationPad
    this.onSpendVfx = opts.onSpendVfx
    this.isDoorUnlocked = opts.isDoorUnlocked
    const h = UPGRADE_PAD_HUB_OFFSET
    const y = 0.02
    this.padWorld = {
      capacity: new Vector3(-h, y, h),
      speed: new Vector3(h, y, h),
      pulseFreq: new Vector3(-h, y, -h),
      pulseDuration: new Vector3(h, y, -h),
    }

    const innerW = UPGRADE_PAD_HALF_WIDTH * 2 * 0.88
    const innerD = UPGRADE_PAD_HALF_DEPTH * 2 * 0.88
    this.floorLabels = [
      createUpgradePadWorldLabel(innerW, innerD, 'CAPACITY'),
      createUpgradePadWorldLabel(innerW, innerD, 'SPEED'),
      createUpgradePadWorldLabel(innerW, innerD, 'FILL'),
      createUpgradePadWorldLabel(innerW, innerD, 'DRAIN'),
    ]
    this.capacityPad.root.add(this.floorLabels[0]!.mesh)
    this.speedPad.root.add(this.floorLabels[1]!.mesh)
    this.pulseFreqPad.root.add(this.floorLabels[2]!.mesh)
    this.pulseDurationPad.root.add(this.floorLabels[3]!.mesh)

    this.syncPadRootVisibility()
    this.refreshFloorLabels()
  }

  private kindUnlocked(kind: UpgradeSpendKind): boolean {
    const door = UPGRADE_VISIBLE_AFTER_DOOR[kind]
    return this.isDoorUnlocked(door)
  }

  /** Hide locked pads and clear their occupancy highlight (labels updated in `refreshFloorLabels`). */
  private syncPadRootVisibility(): void {
    const kinds: UpgradeSpendKind[] = [
      'capacity',
      'speed',
      'pulseFreq',
      'pulseDuration',
    ]
    const pads = [
      this.capacityPad,
      this.speedPad,
      this.pulseFreqPad,
      this.pulseDurationPad,
    ]
    for (let i = 0; i < 4; i++) {
      const k = kinds[i]!
      const vis = this.kindUnlocked(k)
      pads[i]!.root.visible = vis
      if (!vis) {
        pads[i]!.setOccupancy(0)
      }
    }
  }

  private inPadRect(px: number, pz: number, cx: number, cz: number): boolean {
    const dx = px - cx
    const dz = pz - cz
    return (
      Math.abs(dx) <= UPGRADE_PAD_HALF_WIDTH &&
      Math.abs(dz) <= UPGRADE_PAD_HALF_DEPTH
    )
  }

  getChargeFillPerSec(): number {
    return pulseChargeFillPerSec(this.pulseFillLevel)
  }

  getChargeDrainPerSec(): number {
    return pulseChargeDrainPerSec(this.pulseDrainLevel)
  }

  isPlayerInsideAnyPadZone(): boolean {
    return this.activeKind !== null
  }

  update(dt: number): void {
    this.upgradeFlight.update(dt)
    this.syncPadRootVisibility()
    this.player.getPosition(p)

    const occK = 1 - Math.exp(-8 * dt)
    if (this.kindUnlocked('capacity')) {
      this.occCapacity = this.stepPadOcc(
        this.capacityPad,
        this.padWorld.capacity,
        this.occCapacity,
        occK,
      )
    } else {
      this.capacityPad.setOccupancy(0)
      this.occCapacity = 0
    }
    if (this.kindUnlocked('speed')) {
      this.occSpeed = this.stepPadOcc(
        this.speedPad,
        this.padWorld.speed,
        this.occSpeed,
        occK,
      )
    } else {
      this.speedPad.setOccupancy(0)
      this.occSpeed = 0
    }
    if (this.kindUnlocked('pulseFreq')) {
      this.occPulseFreq = this.stepPadOcc(
        this.pulseFreqPad,
        this.padWorld.pulseFreq,
        this.occPulseFreq,
        occK,
      )
    } else {
      this.pulseFreqPad.setOccupancy(0)
      this.occPulseFreq = 0
    }
    if (this.kindUnlocked('pulseDuration')) {
      this.occPulseDuration = this.stepPadOcc(
        this.pulseDurationPad,
        this.padWorld.pulseDuration,
        this.occPulseDuration,
        occK,
      )
    } else {
      this.pulseDurationPad.setOccupancy(0)
      this.occPulseDuration = 0
    }

    let bestKind: UpgradeSpendKind | null = null
    let bestD = Number.POSITIVE_INFINITY

    const tryPad = (
      kind: UpgradeSpendKind,
      cx: number,
      cz: number,
    ): void => {
      if (!this.inPadRect(p.x, p.z, cx, cz)) return
      const dx = p.x - cx
      const dz = p.z - cz
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestKind = kind
        bestD = d
      }
    }

    if (this.kindUnlocked('capacity')) {
      tryPad('capacity', this.padWorld.capacity.x, this.padWorld.capacity.z)
    }
    if (this.kindUnlocked('speed')) {
      tryPad('speed', this.padWorld.speed.x, this.padWorld.speed.z)
    }
    if (this.kindUnlocked('pulseFreq')) {
      tryPad('pulseFreq', this.padWorld.pulseFreq.x, this.padWorld.pulseFreq.z)
    }
    if (this.kindUnlocked('pulseDuration')) {
      tryPad(
        'pulseDuration',
        this.padWorld.pulseDuration.x,
        this.padWorld.pulseDuration.z,
      )
    }
    this.activeKind = bestKind

    if (this.activeKind) {
      this.tryAutoPayChunk()
    }
    this.refreshFloorLabels()
  }

  private refreshFloorLabels(): void {
    const kinds: UpgradeSpendKind[] = [
      'capacity',
      'speed',
      'pulseFreq',
      'pulseDuration',
    ]
    for (let i = 0; i < 4; i++) {
      const k = kinds[i]!
      const lbl = this.floorLabels[i]!
      const vis = this.kindUnlocked(k)
      lbl.mesh.visible = vis
      if (!vis) {
        this.lastFloorLabelSig[i] = ''
        continue
      }
      const sn = this.snapshotForLabel(k)
      const sig = `${sn.paid}|${sn.cost}|${sn.maxed}`
      if (this.lastFloorLabelSig[i] === sig) continue
      this.lastFloorLabelSig[i] = sig
      lbl.redraw(sn.paid, sn.cost, sn.maxed)
    }
  }

  private snapshotForLabel(k: UpgradeSpendKind): {
    paid: number
    cost: number
    maxed: boolean
  } {
    switch (k) {
      case 'capacity': {
        if (this.capacityUpgradeLevel >= MAX_CAPACITY_UPGRADE_LEVELS) {
          return { paid: 0, cost: 0, maxed: true }
        }
        const cost = capacityUpgradeCost(this.capacityUpgradeLevel)
        return { paid: this.paidCapacity, cost, maxed: false }
      }
      case 'speed': {
        if (this.speedUpgradeLevel >= MAX_SPEED_UPGRADE_LEVELS) {
          return { paid: 0, cost: 0, maxed: true }
        }
        const cost = speedUpgradeCost(this.speedUpgradeLevel)
        return { paid: this.paidSpeed, cost, maxed: false }
      }
      case 'pulseFreq': {
        if (this.pulseFillLevel >= MAX_PULSE_FILL_UPGRADE_LEVELS) {
          return { paid: 0, cost: 0, maxed: true }
        }
        const cost = pulseFillUpgradeCost(this.pulseFillLevel)
        return { paid: this.paidPulseFill, cost, maxed: false }
      }
      case 'pulseDuration': {
        if (this.pulseDrainLevel >= MAX_PULSE_DRAIN_UPGRADE_LEVELS) {
          return { paid: 0, cost: 0, maxed: true }
        }
        const cost = pulseDrainUpgradeCost(this.pulseDrainLevel)
        return { paid: this.paidPulseDrain, cost, maxed: false }
      }
    }
  }

  private tryAutoPayChunk(): void {
    if (this.upgradeFlight.busy) return
    const k = this.activeKind
    if (!k) return

    switch (k) {
      case 'capacity':
        this.payCapacity()
        return
      case 'speed':
        this.paySpeed()
        return
      case 'pulseFreq':
        this.payPulseFill()
        return
      case 'pulseDuration':
        this.payPulseDrain()
        return
    }
  }

  private payCapacity(): void {
    if (this.capacityUpgradeLevel >= MAX_CAPACITY_UPGRADE_LEVELS) return
    const cost = capacityUpgradeCost(this.capacityUpgradeLevel)
    const need = cost - this.paidCapacity
    if (need <= 0) return
    const chunk = Math.min(UPGRADE_PAY_CHUNK, need, this.economy.money)
    if (chunk <= 0) return
    if (!this.economy.trySpend(chunk)) return
    this.paidCapacity += chunk
    this.spawnPayFx('capacity', chunk, this.padWorld.capacity)
    if (this.paidCapacity >= cost) {
      this.capacityUpgradeLevel += 1
      this.stack.setMaxCapacity(
        INITIAL_STACK_CAPACITY + this.capacityUpgradeLevel,
      )
      this.paidCapacity = 0
      this.onSpendVfx?.('capacity', cost, this.padWorld.capacity.clone())
    }
  }

  private paySpeed(): void {
    if (this.speedUpgradeLevel >= MAX_SPEED_UPGRADE_LEVELS) return
    const cost = speedUpgradeCost(this.speedUpgradeLevel)
    const need = cost - this.paidSpeed
    if (need <= 0) return
    const chunk = Math.min(UPGRADE_PAY_CHUNK, need, this.economy.money)
    if (chunk <= 0) return
    if (!this.economy.trySpend(chunk)) return
    this.paidSpeed += chunk
    this.spawnPayFx('speed', chunk, this.padWorld.speed)
    if (this.paidSpeed >= cost) {
      this.speedUpgradeLevel += 1
      this.player.setMaxSpeed(speedForLevel(this.speedUpgradeLevel))
      this.paidSpeed = 0
      this.onSpendVfx?.('speed', cost, this.padWorld.speed.clone())
    }
  }

  private payPulseFill(): void {
    if (this.pulseFillLevel >= MAX_PULSE_FILL_UPGRADE_LEVELS) return
    const cost = pulseFillUpgradeCost(this.pulseFillLevel)
    const need = cost - this.paidPulseFill
    if (need <= 0) return
    const chunk = Math.min(UPGRADE_PAY_CHUNK, need, this.economy.money)
    if (chunk <= 0) return
    if (!this.economy.trySpend(chunk)) return
    this.paidPulseFill += chunk
    this.spawnPayFx('pulseFreq', chunk, this.padWorld.pulseFreq)
    if (this.paidPulseFill >= cost) {
      this.pulseFillLevel += 1
      this.paidPulseFill = 0
      this.onSpendVfx?.('pulseFreq', cost, this.padWorld.pulseFreq.clone())
    }
  }

  private payPulseDrain(): void {
    if (this.pulseDrainLevel >= MAX_PULSE_DRAIN_UPGRADE_LEVELS) return
    const cost = pulseDrainUpgradeCost(this.pulseDrainLevel)
    const need = cost - this.paidPulseDrain
    if (need <= 0) return
    const chunk = Math.min(UPGRADE_PAY_CHUNK, need, this.economy.money)
    if (chunk <= 0) return
    if (!this.economy.trySpend(chunk)) return
    this.paidPulseDrain += chunk
    this.spawnPayFx('pulseDuration', chunk, this.padWorld.pulseDuration)
    if (this.paidPulseDrain >= cost) {
      this.pulseDrainLevel += 1
      this.paidPulseDrain = 0
      this.onSpendVfx?.('pulseDuration', cost, this.padWorld.pulseDuration.clone())
    }
  }

  private spawnPayFx(
    _kind: UpgradeSpendKind,
    chunk: number,
    padCenter: Vector3,
  ): void {
    const endHud = new Vector3(padCenter.x, padCenter.y + 0.52, padCenter.z)
    spawnDoorPayCoins(this.hostEl, this.camera, chunk, endHud)

    const coin = createDoorPaymentCoinMesh()
    this.player.getPosition(p)
    const start = new Vector3(p.x, 0.38, p.z)
    coin.position.copy(start)

    const endFlight = new Vector3(padCenter.x, 0.06, padCenter.z)

    this.upgradeFlight.startOne(
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

  private stepPadOcc(
    pad: UpgradeZoneSystemOptions['capacityPad'],
    padCenter: Vector3,
    cur: number,
    k: number,
  ): number {
    const target = this.inPadRect(p.x, p.z, padCenter.x, padCenter.z)
      ? 1
      : 0
    const next = cur + (target - cur) * k
    pad.setOccupancy(next)
    return next
  }

  dispose(): void {
    this.upgradeFlight.cancel()
    for (const lbl of this.floorLabels) {
      lbl.dispose()
    }
  }
}
