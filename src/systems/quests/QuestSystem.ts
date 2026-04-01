import type { GameItem } from '../../core/types/GameItem.ts'

export type QuestHudState = {
  visible: boolean
  relic: { need: number; have: number }
  redGems: { need: number; have: number }
  blueGems: { need: number; have: number }
}

/**
 * Hub deposit turn-ins: 1 relic, 2 red gems, 1 blue gem. Progress is cumulative per active quest.
 */
export class QuestSystem {
  private active = false
  private progress = { relics: 0, redGems: 0, blueGems: 0 }
  private readonly need = { relics: 1, redGems: 2, blueGems: 1 }
  private pendingNext = false
  private nextAtSec = 0
  private readonly initialDelaySec: number
  private readonly betweenQuestsDelaySec: number
  private readonly onHud: (s: QuestHudState) => void
  private readonly onQuestComplete?: () => void

  constructor(opts: {
    initialDelaySec: number
    betweenQuestsDelaySec: number
    onHud: (s: QuestHudState) => void
    onQuestComplete?: () => void
  }) {
    this.initialDelaySec = opts.initialDelaySec
    this.betweenQuestsDelaySec = opts.betweenQuestsDelaySec
    this.onHud = opts.onHud
    this.onQuestComplete = opts.onQuestComplete
    this.pendingNext = false
    this.nextAtSec = 0
    this.onHud({
      visible: false,
      relic: { need: this.need.relics, have: 0 },
      redGems: { need: this.need.redGems, have: 0 },
      blueGems: { need: this.need.blueGems, have: 0 },
    })
  }

  /** Schedules the first quest after `initialDelaySec`. */
  bootstrapFirstQuest(elapsedSec: number): void {
    this.pendingNext = true
    this.nextAtSec = elapsedSec + this.initialDelaySec
  }

  update(elapsedSec: number): void {
    if (this.pendingNext && elapsedSec >= this.nextAtSec) {
      this.startQuest()
    }
  }

  private startQuest(): void {
    this.active = true
    this.pendingNext = false
    this.progress = { relics: 0, redGems: 0, blueGems: 0 }
    this.emitHud()
  }

  private emitHud(): void {
    if (!this.active) {
      this.onHud({
        visible: false,
        relic: { need: this.need.relics, have: this.progress.relics },
        redGems: { need: this.need.redGems, have: this.progress.redGems },
        blueGems: { need: this.need.blueGems, have: this.progress.blueGems },
      })
      return
    }
    this.onHud({
      visible: true,
      relic: { need: this.need.relics, have: this.progress.relics },
      redGems: { need: this.need.redGems, have: this.progress.redGems },
      blueGems: { need: this.need.blueGems, have: this.progress.blueGems },
    })
  }

  /** Count relic + gem turn-ins from a finished deposit session. */
  onDepositItems(items: readonly GameItem[], elapsedSec: number): void {
    if (!this.active) return
    for (const it of items) {
      if (it.type === 'relic') this.progress.relics += 1
      if (it.type === 'gem') {
        if (it.gemColor === 'red') this.progress.redGems += 1
        if (it.gemColor === 'blue') this.progress.blueGems += 1
      }
    }
    const done =
      this.progress.relics >= this.need.relics &&
      this.progress.redGems >= this.need.redGems &&
      this.progress.blueGems >= this.need.blueGems
    if (done) {
      this.active = false
      this.onQuestComplete?.()
      this.pendingNext = true
      this.nextAtSec = elapsedSec + this.betweenQuestsDelaySec
      this.emitHud()
    } else {
      this.emitHud()
    }
  }
}
