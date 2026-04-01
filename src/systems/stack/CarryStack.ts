import type { GameItem } from '../../core/types/GameItem.ts'

export class CarryStack {
  private readonly items: GameItem[] = []
  private max: number
  private readonly onChange?: () => void

  constructor(max: number, onChange?: () => void) {
    this.max = max
    this.onChange = onChange
  }

  get maxCapacity(): number {
    return this.max
  }

  /** Raises cap; never below current carried count */
  setMaxCapacity(max: number): void {
    const n = Math.max(this.items.length, Math.max(1, Math.floor(max)))
    if (n === this.max) return
    this.max = n
    this.onChange?.()
  }

  canPush(): boolean {
    return this.items.length < this.max
  }

  push(item: GameItem): boolean {
    if (!this.canPush()) return false
    this.items.push(item)
    this.onChange?.()
    return true
  }

  /** Remove and return all carried items (deposit). */
  drain(): GameItem[] {
    if (this.items.length === 0) return []
    const out = this.items.slice()
    this.items.length = 0
    this.onChange?.()
    return out
  }

  /** Remove top-of-stack item (last pushed). Use silent + notifyChange for coordinated visuals. */
  popFromTop(opts?: { silent?: boolean }): GameItem | undefined {
    const it = this.items.pop()
    if (!it) return undefined
    if (!opts?.silent) this.onChange?.()
    return it
  }

  /**
   * Pop up to `n` items from the top (most recently collected first).
   * Returns removed items in pop order (newest first).
   */
  popManyFromTop(n: number): GameItem[] {
    const take = Math.min(Math.max(0, Math.floor(n)), this.items.length)
    if (take === 0) return []
    const out: GameItem[] = []
    for (let i = 0; i < take; i++) {
      const it = this.items.pop()
      if (it) out.push(it)
    }
    this.onChange?.()
    return out
  }

  /** Fire onChange after silent pop + StackVisual handoff (HUD + sync). */
  notifyChange(): void {
    this.onChange?.()
  }

  /** Replace carried items (e.g. after aborting deposit mid-session). */
  replaceItems(items: readonly GameItem[]): void {
    this.items.length = 0
    for (const it of items) {
      this.items.push(it)
    }
    this.onChange?.()
  }

  get count(): number {
    return this.items.length
  }

  getSnapshot(): readonly GameItem[] {
    return this.items
  }

  /** True if any carried item is a high-value relic (global ghost aggro). */
  hasRelic(): boolean {
    for (const it of this.items) {
      if (it.type === 'relic') return true
    }
    return false
  }
}
