import {
  INITIAL_STACK_CAPACITY,
  MAX_CAPACITY_UPGRADE_LEVELS,
  MAX_SPEED_UPGRADE_LEVELS,
} from './upgradeConfig.ts'

/** Per-run upgrade progress; reset when a new session starts (`Game` ctor / explicit reset). */
export class RunUpgradeState {
  capacityLevel = 0
  speedLevel = 0
  /** Added to base haunted→ghost spawn chance; clamped at apply time. */
  hauntedChanceBonus = 0
  /** Multiplies all ghost locomotion speeds (room tier mul still applies). */
  ghostSpeedRuntimeMul = 1
  /** One-time risk/reward: slower ghosts globally + extra haunted bias. */
  spectralSwarmTaken = false
  /** Sum of reductions; each steady-hands stack adds. Capped when applying hit loss. */
  ghostHitLossReduction = 0
  /** Reduces effective stack weight for encumbrance (see `stackWeightSpeedMultiplierRelief`). */
  encumbranceReliefStacks = 0
  magnetRangeStacks = 0
  magnetPullStacks = 0
  trashSuctionStacks = 0
  /** Pull multiplier for items with recover state (dropped after ghost hit). */
  scavengerStacks = 0
  /** One-time room-clear utility. */
  respiteCharmTaken = false

  /** Non-stackable upgrade ids already chosen this run. */
  readonly takenOnceIds = new Set<string>()

  reset(): void {
    this.capacityLevel = 0
    this.speedLevel = 0
    this.hauntedChanceBonus = 0
    this.ghostSpeedRuntimeMul = 1
    this.spectralSwarmTaken = false
    this.ghostHitLossReduction = 0
    this.encumbranceReliefStacks = 0
    this.magnetRangeStacks = 0
    this.magnetPullStacks = 0
    this.trashSuctionStacks = 0
    this.scavengerStacks = 0
    this.respiteCharmTaken = false
    this.takenOnceIds.clear()
  }

  get maxCapacitySlots(): number {
    return INITIAL_STACK_CAPACITY + this.capacityLevel
  }

  magnetRangeMul(): number {
    return 1 + this.magnetRangeStacks * 0.08
  }

  magnetPullMul(): number {
    return 1 + this.magnetPullStacks * 0.12
  }

  trashSuctionMul(): number {
    return 1 + this.trashSuctionStacks * 0.1
  }

  scavengerRecoverPullMul(): number {
    return 1 + this.scavengerStacks * 0.22
  }

  canTakeCapacity(): boolean {
    return this.capacityLevel < MAX_CAPACITY_UPGRADE_LEVELS
  }

  canTakeSpeed(): boolean {
    return this.speedLevel < MAX_SPEED_UPGRADE_LEVELS
  }
}
