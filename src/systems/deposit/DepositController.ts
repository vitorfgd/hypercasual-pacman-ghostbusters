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
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from './DepositZone.ts'
import {
  DEPOSIT_FLIGHT_DURATION_SEC,
  type DepositFlightAnimator,
} from './DepositFlightAnimator.ts'

const p = new Vector3()
const center = new Vector3()

export type OverloadEvalResult = {
  overload: boolean
  perfect: boolean
}

export type DepositPresentationOverload = {
  overloadActive: boolean
  perfect: boolean
  overloadBonus: number
}

export type DepositControllerOptions = {
  scene: Scene
  zoneRadius?: number
  player: PlayerController
  stack: CarryStack
  stackVisual: StackVisual
  economy: Economy
  flight: DepositFlightAnimator
  evaluateOverload?: (snapshot: readonly GameItem[]) => OverloadEvalResult
  onItemDepositLanded?: (item: GameItem) => void
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
  private readonly zoneRadius: number
  private readonly player: PlayerController
  private readonly stack: CarryStack
  private readonly stackVisual: StackVisual
  private readonly economy: Economy
  private readonly flight: DepositFlightAnimator
  private readonly evaluateOverload?: (snapshot: readonly GameItem[]) => OverloadEvalResult
  private readonly onDepositPresentationComplete: DepositControllerOptions['onDepositPresentationComplete']
  private readonly onItemDepositLanded?: (item: GameItem) => void
  private readonly onDepositSessionStart?: DepositControllerOptions['onDepositSessionStart']
  private readonly onDepositSessionEnd?: () => void

  private wasInside = false
  private sessionSnapshot: GameItem[] | null = null
  private readonly depositedIds = new Set<string>()
  private sessionOverload: { active: boolean; perfect: boolean; total: number } | null =
    null
  private peelIndex = 0

  constructor(opts: DepositControllerOptions) {
    this.scene = opts.scene
    this.zoneRadius = opts.zoneRadius ?? DEFAULT_DEPOSIT_ZONE_RADIUS
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
    /** Deposit root stays at origin — avoid `getWorldPosition` matrix walks each frame. */
    center.set(0, 0, 0)
    this.player.getPosition(p)
    const dx = p.x - center.x
    const dz = p.z - center.z
    const inside = dx * dx + dz * dz <= this.zoneRadius * this.zoneRadius

    if (this.sessionSnapshot !== null && !inside) {
      this.abortDepositSession()
    }

    this.flight.update(dt)
    if (this.flight.busy) {
      this.wasInside = inside
      return
    }

    if (
      inside &&
      !this.wasInside &&
      this.stack.count > 0 &&
      this.sessionSnapshot === null
    ) {
      const snapshot = [...this.stack.getSnapshot()]
      this.sessionSnapshot = snapshot
      this.depositedIds.clear()
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
    center.set(0, 0, 0)
    const spiralIndex = this.peelIndex
    this.peelIndex += 1
    const onFlightDone = (flightMesh: import('three').Object3D): void => {
      this.stackVisual.recycleDepositedMesh(item, flightMesh)
      this.depositedIds.add(item.id)
      this.onItemDepositLanded?.(item)
      this.tryPeelNext()
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
      center,
      onFlightDone,
      dur,
      overloadStyle,
    )
  }

  private abortDepositSession(): void {
    if (this.sessionSnapshot === null) return

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
