import { MAX_SPEED_UPGRADE_LEVELS } from './upgradeConfig.ts'

/** Per-run upgrade progress; reset when a new session starts (`Game` ctor / explicit reset). */
export class RunUpgradeState {
  speedLevel = 0
  /** Added to base haunted→ghost spawn chance; clamped at apply time. */
  hauntedChanceBonus = 0
  /** Multiplies all ghost locomotion speeds (room tier mul still applies). */
  ghostSpeedRuntimeMul = 1
  /** One-time risk/reward: slower ghosts globally + extra haunted bias. */
  spectralSwarmTaken = false
  /** Reduces effective stack weight for encumbrance (see `stackWeightSpeedMultiplierRelief`). */
  encumbranceReliefStacks = 0
  /** One-time room-clear utility. */
  respiteCharmTaken = false
  /** Unlocks one free damage block per room entered. */
  roomShieldTaken = false

  /** Non-stackable upgrade ids already chosen this run. */
  readonly takenOnceIds = new Set<string>()

  reset(): void {
    this.speedLevel = 0
    this.hauntedChanceBonus = 0
    this.ghostSpeedRuntimeMul = 1
    this.spectralSwarmTaken = false
    this.encumbranceReliefStacks = 0
    this.respiteCharmTaken = false
    this.roomShieldTaken = false
    this.takenOnceIds.clear()
  }

  canTakeSpeed(): boolean {
    return this.speedLevel < MAX_SPEED_UPGRADE_LEVELS
  }
}
