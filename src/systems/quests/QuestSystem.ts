import type { GameItem } from '../../core/types/GameItem.ts'

export type QuestHudState = {
  visible: boolean
  relic: { need: number; have: number }
  redGems: { need: number; have: number }
  blueGems: { need: number; have: number }
}

/**
 * Hub deposit turn-ins: 1 relic, 2 red gems, and (once the cyan-ghost room is open) 1 blue gem.
 * Blue gems only drop from ghosts in deeper rooms — requirement stays off until door 2 is unlocked.
 */
export class QuestSystem {
  private active = false
  private progress = { relics: 0, redGems: 0, blueGems: 0 }
  private readonly baseNeed = { relics: 1, redGems: 2 }
  private pendingNext = false
  private nextAtSec = 0
  private readonly initialDelaySec: number
  private readonly betweenQuestsDelaySec: number
  private readonly onHud: (s: QuestHudState) => void
  private readonly onQuestComplete?: () => void
  /** When true, quest also needs 1 blue gem (ROOM_3+ ghosts). Matches `DoorUnlockSystem.isDoorUnlocked(2)`. */
  private readonly isBlueGemRequired: () => boolean
  /** Re-emit HUD when door 2 unlocks mid-quest so the blue line appears. */
  private prevBlueGemRequiredSnapshot: boolean

  constructor(opts: {
    initialDelaySec: number
    betweenQuestsDelaySec: number
    onHud: (s: QuestHudState) => void
    onQuestComplete?: () => void
    isBlueGemRequired: () => boolean
  }) {
    this.initialDelaySec = opts.initialDelaySec
    this.betweenQuestsDelaySec = opts.betweenQuestsDelaySec
    this.onHud = opts.onHud
    this.onQuestComplete = opts.onQuestComplete
    this.isBlueGemRequired = opts.isBlueGemRequired
    this.prevBlueGemRequiredSnapshot = this.isBlueGemRequired()
    this.pendingNext = false
    this.nextAtSec = 0
    const need = this.currentNeed()
    this.onHud({
      visible: false,
      relic: { need: need.relics, have: 0 },
      redGems: { need: need.redGems, have: 0 },
      blueGems: { need: need.blueGems, have: 0 },
    })
  }

  private currentNeed(): { relics: number; redGems: number; blueGems: number } {
    const blue = this.isBlueGemRequired() ? 1 : 0
    return { relics: this.baseNeed.relics, redGems: this.baseNeed.redGems, blueGems: blue }
  }

  /** Schedules the first quest after `initialDelaySec`. */
  bootstrapFirstQuest(elapsedSec: number): void {
    this.pendingNext = true
    this.nextAtSec = elapsedSec + this.initialDelaySec
  }

  update(elapsedSec: number): void {
    if (this.active && this.isBlueGemRequired() !== this.prevBlueGemRequiredSnapshot) {
      this.prevBlueGemRequiredSnapshot = this.isBlueGemRequired()
      this.emitHud()
    }
    if (this.pendingNext && elapsedSec >= this.nextAtSec) {
      this.startQuest()
    }
  }

  private startQuest(): void {
    this.active = true
    this.pendingNext = false
    this.progress = { relics: 0, redGems: 0, blueGems: 0 }
    this.prevBlueGemRequiredSnapshot = this.isBlueGemRequired()
    this.emitHud()
  }

  private emitHud(): void {
    const need = this.currentNeed()
    if (!this.active) {
      this.onHud({
        visible: false,
        relic: { need: need.relics, have: this.progress.relics },
        redGems: { need: need.redGems, have: this.progress.redGems },
        blueGems: { need: need.blueGems, have: this.progress.blueGems },
      })
      return
    }
    this.onHud({
      visible: true,
      relic: { need: need.relics, have: this.progress.relics },
      redGems: { need: need.redGems, have: this.progress.redGems },
      blueGems: { need: need.blueGems, have: this.progress.blueGems },
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
    const n = this.currentNeed()
    const done =
      this.progress.relics >= n.relics &&
      this.progress.redGems >= n.redGems &&
      this.progress.blueGems >= n.blueGems
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
