import { MONEY_DISPLAY_LERP } from './juiceConfig.ts'

/** Smoothly interpolates displayed money toward the true balance. */
export class MoneyHud {
  private displayValue = 0
  private lastShownInt = -1
  private prevTarget = 0
  private readonly el: HTMLElement
  private readonly getTargetMoney: () => number

  constructor(el: HTMLElement, getTargetMoney: () => number) {
    this.el = el
    this.getTargetMoney = getTargetMoney
  }

  sync(): void {
    this.displayValue = this.getTargetMoney()
    this.prevTarget = this.displayValue
    this.flushDom()
  }

  update(dt: number): void {
    const target = this.getTargetMoney()
    const k = 1 - Math.exp(-MONEY_DISPLAY_LERP * dt)
    this.displayValue += (target - this.displayValue) * k
    if (Math.abs(target - this.displayValue) < 0.45) {
      this.displayValue = target
    }
    const prevT = this.prevTarget
    this.prevTarget = target
    if (target > prevT + 45) {
      this.el.classList.remove('money-bump-big')
      void this.el.offsetWidth
      this.el.classList.add('money-bump-big')
    }

    const shown = Math.round(this.displayValue)
    if (shown !== this.lastShownInt) {
      this.lastShownInt = shown
      this.el.classList.remove('money-tick')
      void this.el.offsetWidth
      this.el.classList.add('money-tick')
    }
    this.el.textContent = `$${Math.round(this.displayValue)}`
  }

  private flushDom(): void {
    this.lastShownInt = Math.round(this.displayValue)
    this.el.textContent = `$${this.lastShownInt}`
  }
}
