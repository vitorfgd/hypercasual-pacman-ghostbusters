import type { GameItem } from '../../core/types/GameItem.ts'
import { applyDepositBatchScaling } from './depositScaling.ts'

export type DepositEval = {
  /** Scaled batch total used for overload visuals and feedback intensity. */
  batchTotal: number
  /** Sum of item `value` before batch multiplier. */
  baseSum: number
  batchMultiplier: number
  itemCount: number
}

function sumItemValues(items: GameItem[]): number {
  let s = 0
  for (const it of items) {
    s += it.value
  }
  return s
}

export function evaluateDeposit(items: GameItem[]): DepositEval {
  const n = items.length
  const baseSum = sumItemValues(items)
  const scaled = applyDepositBatchScaling(baseSum, n)
  return {
    batchTotal: scaled.batchTotal,
    baseSum,
    batchMultiplier: scaled.batchMultiplier,
    itemCount: n,
  }
}
