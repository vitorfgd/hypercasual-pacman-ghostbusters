import type { GameItem } from '../../core/types/GameItem.ts'
import { applyDepositBatchScaling } from './depositScaling.ts'

export type DepositEval = {
  credits: number
  baseCredits: number
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
  const baseCredits = sumItemValues(items)
  const scaled = applyDepositBatchScaling(baseCredits, n)
  return {
    credits: scaled.credits,
    baseCredits,
    batchMultiplier: scaled.batchMultiplier,
    itemCount: n,
  }
}

/** HUD / planning: expected payout if you banked the current stack now. */
export function previewCarryPayout(items: readonly GameItem[]): number {
  return evaluateDeposit([...items]).credits
}
