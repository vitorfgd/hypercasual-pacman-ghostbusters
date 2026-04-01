import { Vector3 } from 'three'
import type { Group } from 'three'
import type { Economy } from '../economy/Economy.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import {
  INITIAL_STACK_CAPACITY,
  MAX_CAPACITY_UPGRADE_LEVELS,
  MAX_PULSE_DURATION_UPGRADE_LEVELS,
  MAX_PULSE_FREQ_UPGRADE_LEVELS,
  MAX_SPEED_UPGRADE_LEVELS,
  UPGRADE_PAD_HUB_OFFSET,
  capacityUpgradeCost,
  ghostPulseDurationForLevels,
  ghostPulseIntervalForFreqLevel,
  pulseDurationUpgradeCost,
  pulseFreqUpgradeCost,
  speedForLevel,
  speedUpgradeCost,
} from './upgradeConfig.ts'
import type { PadLabelPayload } from './UpgradePadVisual.ts'
import { UPGRADE_PAD_ZONE_RADIUS } from './UpgradePadVisual.ts'

const p = new Vector3()

export type UpgradeSpendKind =
  | 'capacity'
  | 'speed'
  | 'pulseFreq'
  | 'pulseDuration'

export type UpgradeHudSnapshot =
  | { visible: false }
  | {
      visible: true
      kind: UpgradeSpendKind
      title: string
      progress: number
      maxed: boolean
      cost: number
      canAfford: boolean
      accent: string
    }

const ACCENT: Record<UpgradeSpendKind, string> = {
  capacity: '#c9a882',
  speed: '#d4b896',
  pulseFreq: '#a898b8',
  pulseDuration: '#c89078',
}

const TITLE: Record<UpgradeSpendKind, string> = {
  capacity: 'CAPACITY',
  speed: 'SPEED',
  pulseFreq: 'PULSE RATE',
  pulseDuration: 'PULSE TIME',
}

export type UpgradeZoneSystemOptions = {
  economy: Economy
  player: PlayerController
  stack: CarryStack
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
}

/**
 * World pads: stand on pad → bottom HUD shows offer; tap button to purchase.
 */
export class UpgradeZoneSystem {
  private readonly economy: Economy
  private readonly player: PlayerController
  private readonly stack: CarryStack
  private readonly capacityPad: UpgradeZoneSystemOptions['capacityPad']
  private readonly speedPad: UpgradeZoneSystemOptions['speedPad']
  private readonly pulseFreqPad: UpgradeZoneSystemOptions['pulseFreqPad']
  private readonly pulseDurationPad: UpgradeZoneSystemOptions['pulseDurationPad']
  private readonly onSpendVfx?: UpgradeZoneSystemOptions['onSpendVfx']

  private capacityUpgradeLevel = 0
  private speedUpgradeLevel = 0
  private pulseFreqLevel = 0
  private pulseDurationLevel = 0

  /** Closest pad kind while player is inside its zone; otherwise null. */
  private activeKind: UpgradeSpendKind | null = null

  private occCapacity = 0
  private occSpeed = 0
  private occPulseFreq = 0
  private occPulseDuration = 0

  /**
   * Pads live under `upgradeAreaRoot` at scene origin — world positions are fixed (no per-frame
   * `getWorldPosition`, which avoided a one-frame hitch when matrices were first sampled).
   */
  private readonly padWorld: Record<UpgradeSpendKind, Vector3>

  constructor(opts: UpgradeZoneSystemOptions) {
    this.economy = opts.economy
    this.player = opts.player
    this.stack = opts.stack
    this.capacityPad = opts.capacityPad
    this.speedPad = opts.speedPad
    this.pulseFreqPad = opts.pulseFreqPad
    this.pulseDurationPad = opts.pulseDurationPad
    this.onSpendVfx = opts.onSpendVfx
    const h = UPGRADE_PAD_HUB_OFFSET
    const y = 0.02
    this.padWorld = {
      capacity: new Vector3(-h, y, h),
      speed: new Vector3(h, y, h),
      pulseFreq: new Vector3(-h, y, -h),
      pulseDuration: new Vector3(h, y, -h),
    }
    this.refreshCapacityLabel()
    this.refreshSpeedLabel()
    this.refreshPulseFreqLabel()
    this.refreshPulseDurationLabel()
  }

  getPulseIntervalSec(): number {
    return ghostPulseIntervalForFreqLevel(this.pulseFreqLevel)
  }

  getPulseDurationSec(): number {
    const interval = this.getPulseIntervalSec()
    return ghostPulseDurationForLevels(this.pulseDurationLevel, interval)
  }

  /** True after `update()` if the player is inside any upgrade pad radius. */
  isPlayerInsideAnyPadZone(): boolean {
    return this.activeKind !== null
  }

  /** Call after `update()` each frame. */
  getHudSnapshot(): UpgradeHudSnapshot {
    if (!this.activeKind) return { visible: false }
    const k = this.activeKind
    switch (k) {
      case 'capacity': {
        const maxed = this.capacityUpgradeLevel >= MAX_CAPACITY_UPGRADE_LEVELS
        const cost = maxed
          ? 0
          : capacityUpgradeCost(this.capacityUpgradeLevel)
        return {
          visible: true,
          kind: k,
          title: TITLE[k],
          progress: this.capacityUpgradeLevel / MAX_CAPACITY_UPGRADE_LEVELS,
          maxed,
          cost,
          canAfford: !maxed && this.economy.money >= cost,
          accent: ACCENT[k],
        }
      }
      case 'speed': {
        const maxed = this.speedUpgradeLevel >= MAX_SPEED_UPGRADE_LEVELS
        const cost = maxed ? 0 : speedUpgradeCost(this.speedUpgradeLevel)
        return {
          visible: true,
          kind: k,
          title: TITLE[k],
          progress: this.speedUpgradeLevel / MAX_SPEED_UPGRADE_LEVELS,
          maxed,
          cost,
          canAfford: !maxed && this.economy.money >= cost,
          accent: ACCENT[k],
        }
      }
      case 'pulseFreq': {
        const maxed = this.pulseFreqLevel >= MAX_PULSE_FREQ_UPGRADE_LEVELS
        const cost = maxed ? 0 : pulseFreqUpgradeCost(this.pulseFreqLevel)
        return {
          visible: true,
          kind: k,
          title: TITLE[k],
          progress: this.pulseFreqLevel / MAX_PULSE_FREQ_UPGRADE_LEVELS,
          maxed,
          cost,
          canAfford: !maxed && this.economy.money >= cost,
          accent: ACCENT[k],
        }
      }
      case 'pulseDuration': {
        const maxed = this.pulseDurationLevel >= MAX_PULSE_DURATION_UPGRADE_LEVELS
        const cost = maxed ? 0 : pulseDurationUpgradeCost(this.pulseDurationLevel)
        return {
          visible: true,
          kind: k,
          title: TITLE[k],
          progress: this.pulseDurationLevel / MAX_PULSE_DURATION_UPGRADE_LEVELS,
          maxed,
          cost,
          canAfford: !maxed && this.economy.money >= cost,
          accent: ACCENT[k],
        }
      }
    }
  }

  /** Purchase the pad you're standing on (HUD button). */
  tryPurchaseActive(): boolean {
    const k = this.activeKind
    if (!k) return false
    this.player.getPosition(p)
    switch (k) {
      case 'capacity': {
        if (this.capacityUpgradeLevel >= MAX_CAPACITY_UPGRADE_LEVELS) return false
        const cost = capacityUpgradeCost(this.capacityUpgradeLevel)
        if (!this.economy.trySpend(cost)) return false
        this.capacityUpgradeLevel += 1
        this.stack.setMaxCapacity(
          INITIAL_STACK_CAPACITY + this.capacityUpgradeLevel,
        )
        this.onSpendVfx?.('capacity', cost, this.padWorld.capacity.clone())
        return true
      }
      case 'speed': {
        if (this.speedUpgradeLevel >= MAX_SPEED_UPGRADE_LEVELS) return false
        const cost = speedUpgradeCost(this.speedUpgradeLevel)
        if (!this.economy.trySpend(cost)) return false
        this.speedUpgradeLevel += 1
        this.player.setMaxSpeed(speedForLevel(this.speedUpgradeLevel))
        this.onSpendVfx?.('speed', cost, this.padWorld.speed.clone())
        return true
      }
      case 'pulseFreq': {
        if (this.pulseFreqLevel >= MAX_PULSE_FREQ_UPGRADE_LEVELS) return false
        const cost = pulseFreqUpgradeCost(this.pulseFreqLevel)
        if (!this.economy.trySpend(cost)) return false
        this.pulseFreqLevel += 1
        this.onSpendVfx?.('pulseFreq', cost, this.padWorld.pulseFreq.clone())
        return true
      }
      case 'pulseDuration': {
        if (this.pulseDurationLevel >= MAX_PULSE_DURATION_UPGRADE_LEVELS)
          return false
        const cost = pulseDurationUpgradeCost(this.pulseDurationLevel)
        if (!this.economy.trySpend(cost)) return false
        this.pulseDurationLevel += 1
        this.onSpendVfx?.(
          'pulseDuration',
          cost,
          this.padWorld.pulseDuration.clone(),
        )
        return true
      }
    }
  }

  update(dt: number): void {
    this.player.getPosition(p)

    const occK = 1 - Math.exp(-8 * dt)
    this.occCapacity = this.stepPadOcc(
      this.capacityPad,
      this.padWorld.capacity,
      this.occCapacity,
      occK,
    )
    this.occSpeed = this.stepPadOcc(
      this.speedPad,
      this.padWorld.speed,
      this.occSpeed,
      occK,
    )
    this.occPulseFreq = this.stepPadOcc(
      this.pulseFreqPad,
      this.padWorld.pulseFreq,
      this.occPulseFreq,
      occK,
    )
    this.occPulseDuration = this.stepPadOcc(
      this.pulseDurationPad,
      this.padWorld.pulseDuration,
      this.occPulseDuration,
      occK,
    )

    let bestKind: UpgradeSpendKind | null = null
    let bestD = Number.POSITIVE_INFINITY

    let d = Math.hypot(p.x - this.padWorld.capacity.x, p.z - this.padWorld.capacity.z)
    if (d <= UPGRADE_PAD_ZONE_RADIUS && d < bestD) {
      bestKind = 'capacity'
      bestD = d
    }

    d = Math.hypot(p.x - this.padWorld.speed.x, p.z - this.padWorld.speed.z)
    if (d <= UPGRADE_PAD_ZONE_RADIUS && d < bestD) {
      bestKind = 'speed'
      bestD = d
    }

    d = Math.hypot(p.x - this.padWorld.pulseFreq.x, p.z - this.padWorld.pulseFreq.z)
    if (d <= UPGRADE_PAD_ZONE_RADIUS && d < bestD) {
      bestKind = 'pulseFreq'
      bestD = d
    }

    d = Math.hypot(
      p.x - this.padWorld.pulseDuration.x,
      p.z - this.padWorld.pulseDuration.z,
    )
    if (d <= UPGRADE_PAD_ZONE_RADIUS && d < bestD) {
      bestKind = 'pulseDuration'
    }
    this.activeKind = bestKind
  }

  private refreshCapacityLabel(): void {
    this.capacityPad.setLabel({ title: TITLE.capacity })
  }

  private refreshSpeedLabel(): void {
    this.speedPad.setLabel({ title: TITLE.speed })
  }

  private refreshPulseFreqLabel(): void {
    this.pulseFreqPad.setLabel({ title: TITLE.pulseFreq })
  }

  private refreshPulseDurationLabel(): void {
    this.pulseDurationPad.setLabel({ title: TITLE.pulseDuration })
  }

  private stepPadOcc(
    pad: UpgradeZoneSystemOptions['capacityPad'],
    padCenter: Vector3,
    cur: number,
    k: number,
  ): number {
    const d = Math.hypot(p.x - padCenter.x, p.z - padCenter.z)
    const target = d <= UPGRADE_PAD_ZONE_RADIUS ? 1 : 0
    const next = cur + (target - cur) * k
    pad.setOccupancy(next)
    return next
  }
}
