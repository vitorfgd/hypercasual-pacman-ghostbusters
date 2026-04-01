import type { GameItem } from '../../core/types/GameItem.ts'
import type { ItemValueResolver } from './resolveItemValue.ts'
import { defaultResolveItemValue } from './resolveItemValue.ts'

/**
 * Holds balance and applies payouts from deposited `GameItem[]`.
 * Pass a custom `resolveValue` for multipliers or alternate payout rules.
 */
export class Economy {
  money = 0
  private readonly resolveValue: ItemValueResolver
  private readonly onMoneyChanged?: (money: number) => void

  constructor(
    resolveValue: ItemValueResolver = defaultResolveItemValue,
    onMoneyChanged?: (money: number) => void,
  ) {
    this.resolveValue = resolveValue
    this.onMoneyChanged = onMoneyChanged
  }

  /** Adds money from items; returns credits granted this deposit */
  payout(items: GameItem[]): number {
    if (items.length === 0) return 0
    const add = this.resolveValue(items)
    this.addMoney(add)
    return add
  }

  /** Direct credit grant (bonuses, quest rewards, etc.) */
  addMoney(amount: number): void {
    if (amount <= 0) return
    this.money += amount
    this.onMoneyChanged?.(this.money)
  }

  /** Deducts if balance allows; returns whether spend succeeded */
  trySpend(amount: number): boolean {
    if (amount <= 0 || this.money < amount) return false
    this.money -= amount
    this.onMoneyChanged?.(this.money)
    return true
  }
}
