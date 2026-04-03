import { Vector3 } from 'three'
import type { Scene } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import {
  evaluateDeposit,
  type DepositEval,
} from '../economy/depositEvaluation.ts'
import type { Economy } from '../economy/Economy.ts'
import {
  OVERLOAD_BONUS_MULT,
  OVERLOAD_FLIGHT_DURATION_MULT,
  PERFECT_OVERLOAD_BONUS_MULT,
} from '../overload/overloadDropConfig.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import type { StackVisual } from '../stack/StackVisual.ts'
import { DEPOSIT_INTER_ITEM_DELAY_SEC } from '../../juice/juiceConfig.ts'
import {
  DEPOSIT_FLIGHT_DURATION_SEC,
  type DepositFlightAnimator,
} from './DepositFlightAnimator.ts'

const p = new Vector3()
const flightEnd = new Vector3()

export type OverloadEvalResult = {
  overload: boolean
  perfect: boolean
}

export type DepositPresentationOverload = {
  overloadActive: boolean
  perfect: boolean
  overloadBonus: number
}

export type DepositZoneResolver = () => {
  center: Vector3
  radius: number
} | null

export type DepositControllerOptions = {
  scene: Scene
  player: PlayerController
  stack: CarryStack
  stackVisual: StackVisual
  economy: Economy
  flight: DepositFlightAnimator
  /** Trash portal / room deposit disc — null when player is not in a deposit zone. */
  resolveDepositZone: DepositZoneResolver
  evaluateOverload?: (snapshot: readonly GameItem[]) => OverloadEvalResult
  onItemDepositLanded?: (item: GameItem, flightIndex: number) => void
  onDepositSessionStart?: (meta: {
    overload: boolean
    perfect: boolean
    itemCount: number
  }) => void
  onDepositSessionEnd?: () => void
  onDepositPresentationComplete: (
    items: GameItem[],
    ev: DepositEval,
    overload: DepositPresentationOverload,
  ) => void
}

export class DepositController {
  private readonly scene: Scene
  private readonly resolveDepositZone: DepositZoneResolver
  private readonly player: PlayerController
  private readonly stack: CarryStack
  private readonly stackVisual: StackVisual
  private readonly economy: Economy
  private readonly flight: DepositFlightAnimator
  private readonly evaluateOverload?: (snapshot: readonly GameItem[]) => OverloadEvalResult
  private readonly onDepositPresentationComplete: DepositControllerOptions['onDepositPresentationComplete']
  private readonly onItemDepositLanded?: (
    item: GameItem,
    flightIndex: number,
  ) => void
  private readonly onDepositSessionStart?: DepositControllerOptions['onDepositSessionStart']
  private readonly onDepositSessionEnd?: () => void

  private wasInside = false
  private sessionSnapshot: GameItem[] | null = null
  private readonly depositedIds = new Set<string>()
  private sessionOverload: { active: boolean; perfect: boolean; total: number } | null =
    null
  private peelIndex = 0
  /** Stagger between item flights (after each lands, before next peel). */
  private depositDelayRemain = 0
  /** Snapshot at session start — player must stay inside this disc while depositing. */
  private readonly sessionDepositCenter = new Vector3()
  private sessionDepositRadius = 1.28

  constructor(opts: DepositControllerOptions) {
    this.scene = opts.scene
    this.resolveDepositZone = opts.resolveDepositZone
    this.player = opts.player
    this.stack = opts.stack
    this.stackVisual = opts.stackVisual
    this.economy = opts.economy
    this.flight = opts.flight
    this.evaluateOverload = opts.evaluateOverload
    this.onDepositPresentationComplete = opts.onDepositPresentationComplete
    this.onItemDepositLanded = opts.onItemDepositLanded
    this.onDepositSessionStart = opts.onDepositSessionStart
    this.onDepositSessionEnd = opts.onDepositSessionEnd
  }

  update(dt: number): void {
    this.player.getPosition(p)
    const zone = this.resolveDepositZone()
    const inside =
      zone !== null &&
      (() => {
        const dx = p.x - zone.center.x
        const dz = p.z - zone.center.z
        return dx * dx + dz * dz <= zone.radius * zone.radius
      })()

    if (this.sessionSnapshot !== null) {
      const dxs = p.x - this.sessionDepositCenter.x
      const dzs = p.z - this.sessionDepositCenter.z
      const inSessionDisc =
        dxs * dxs + dzs * dzs <=
        this.sessionDepositRadius * this.sessionDepositRadius
      if (!inSessionDisc) {
        this.abortDepositSession()
      }
    }

    this.flight.update(dt)

    if (!this.flight.busy && this.depositDelayRemain > 0) {
      this.depositDelayRemain -= dt
      if (this.depositDelayRemain <= 0) {
        this.depositDelayRemain = 0
        this.tryPeelNext()
      }
    }

    if (this.flight.busy) {
      this.wasInside = inside
      return
    }

    if (
      inside &&
      !this.wasInside &&
      this.stack.count > 0 &&
      this.sessionSnapshot === null &&
      zone !== null
    ) {
      const snapshot = [...this.stack.getSnapshot()]
      this.sessionSnapshot = snapshot
      this.depositedIds.clear()
      this.sessionDepositCenter.copy(zone.center)
      this.sessionDepositRadius = zone.radius
      const evo = this.evaluateOverload?.(snapshot) ?? {
        overload: false,
        perfect: false,
      }
      this.sessionOverload = {
        active: evo.overload,
        perfect: evo.perfect,
        total: snapshot.length,
      }
      this.peelIndex = 0
      this.onDepositSessionStart?.({
        overload: evo.overload,
        perfect: evo.perfect,
        itemCount: snapshot.length,
      })
      this.tryPeelNext()
    }

    this.wasInside = inside
  }

  private computeOverloadExtra(ev: DepositEval): number {
    const s = this.sessionOverload
    if (!s?.active) return 0
    let extra = Math.floor(ev.credits * (OVERLOAD_BONUS_MULT - 1))
    if (s.perfect) {
      extra = Math.floor(extra * PERFECT_OVERLOAD_BONUS_MULT)
    }
    return Math.max(0, extra)
  }

  private tryPeelNext(): void {
    if (this.sessionSnapshot === null) return
    if (this.flight.busy) return

    if (this.stack.count === 0) {
      const snapshot = this.sessionSnapshot
      this.sessionSnapshot = null
      this.depositedIds.clear()
      const ev = evaluateDeposit(snapshot)
      const overloadBonus = this.computeOverloadExtra(ev)
      this.economy.addMoney(ev.credits + overloadBonus)
      const s = this.sessionOverload
      this.sessionOverload = null
      this.peelIndex = 0
      this.onDepositSessionEnd?.()
      this.onDepositPresentationComplete(snapshot, ev, {
        overloadActive: s?.active ?? false,
        perfect: s?.perfect ?? false,
        overloadBonus,
      })
      return
    }

    const item = this.stack.popFromTop({ silent: true })
    if (!item) {
      this.sessionSnapshot = null
      this.sessionOverload = null
      this.peelIndex = 0
      this.onDepositSessionEnd?.()
      this.depositedIds.clear()
      return
    }
    const mesh = this.stackVisual.extractTopMeshForDeposit(item)
    this.stack.notifyChange()
    flightEnd.copy(this.sessionDepositCenter)
    const spiralIndex = this.peelIndex
    this.peelIndex += 1
    const onFlightDone = (flightMesh: import('three').Object3D): void => {
      this.stackVisual.recycleDepositedMesh(item, flightMesh)
      this.depositedIds.add(item.id)
      this.onItemDepositLanded?.(item, spiralIndex)
      if (this.stack.count === 0) {
        this.depositDelayRemain = 0
        this.tryPeelNext()
      } else {
        this.depositDelayRemain = DEPOSIT_INTER_ITEM_DELAY_SEC
      }
    }
    const ov = this.sessionOverload
    const overloadStyle =
      ov?.active === true
        ? {
            spiralIndex,
            spiralTotal: ov.total,
            perfect: ov.perfect,
          }
        : null
    const dur =
      DEPOSIT_FLIGHT_DURATION_SEC *
      (ov?.active ? OVERLOAD_FLIGHT_DURATION_MULT : 1)
    this.flight.startOne(
      this.scene,
      mesh,
      flightEnd,
      onFlightDone,
      dur,
      overloadStyle,
    )
  }

  private abortDepositSession(): void {
    if (this.sessionSnapshot === null) return

    this.depositDelayRemain = 0
    this.flight.cancel()

    const snapshot = this.sessionSnapshot
    this.sessionSnapshot = null

    const completed = snapshot.filter((it) => this.depositedIds.has(it.id))
    const remaining = snapshot.filter((it) => !this.depositedIds.has(it.id))

    const ev = evaluateDeposit(completed)
    const overloadBonus = this.computeOverloadExtra(ev)
    this.economy.addMoney(ev.credits + overloadBonus)
    this.stack.replaceItems(remaining)
    this.depositedIds.clear()
    this.sessionOverload = null
    this.peelIndex = 0
    this.onDepositSessionEnd?.()
  }
}
