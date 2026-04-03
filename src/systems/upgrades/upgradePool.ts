import { PLAYER_MAX_LIVES } from '../../juice/juiceConfig.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import { RunUpgradeState } from './runUpgradeState.ts'
import { MAX_SPEED_UPGRADE_LEVELS, speedForLevel } from './upgradeConfig.ts'

export type RunUpgradeOffer = {
  id: string
  title: string
  description: string
}

export type ApplyRunUpgradeContext = {
  state: RunUpgradeState
  stack: CarryStack
  player: PlayerController
  lives: number
  random: () => number
}

export type ApplyRunUpgradeResult = {
  lives: number
  bannerSubtitle: string
  floatText?: string
  floatClass?: string
}

type UpgradeDef = {
  id: string
  title: string
  description: string
  stackable: boolean
  /** Max stacks for stackable upgrades; omit = no extra cap beyond code checks */
  maxStacks?: number
  isEligible: (s: RunUpgradeState, lives: number) => boolean
  apply: (
    ctx: ApplyRunUpgradeContext,
  ) => Omit<ApplyRunUpgradeResult, 'lives'> & { livesDelta?: number }
}

function shuffleInPlace<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

const DEFINITIONS: readonly UpgradeDef[] = [
  {
    id: 'swift-stride',
    title: 'Swift stride',
    description: 'Move faster while exploring.',
    stackable: true,
    isEligible: (s) => s.canTakeSpeed(),
    apply: ({ state, player }) => {
      state.speedLevel += 1
      player.setMaxSpeed(speedForLevel(state.speedLevel))
      return {
        bannerSubtitle: 'YOU FEEL FASTER',
        floatText: `Speed ${state.speedLevel}/${MAX_SPEED_UPGRADE_LEVELS}`,
        floatClass: 'float-hud--level-up',
      }
    },
  },
  {
    id: 'steady-hands',
    title: 'Steady hands',
    description: 'Lose fewer items when a ghost hits you.',
    stackable: true,
    maxStacks: 4,
    isEligible: (s) => s.ghostHitLossReduction < 0.36,
    apply: ({ state }) => {
      state.ghostHitLossReduction = Math.min(
        0.4,
        state.ghostHitLossReduction + 0.09,
      )
      return {
        bannerSubtitle: 'STEADY HANDS',
        floatText: 'Tighter grip on your haul',
        floatClass: 'float-hud--level-up',
      }
    },
  },
  {
    id: 'light-footing',
    title: 'Light footing',
    description: 'Heavy stacks slow you down a bit less.',
    stackable: true,
    maxStacks: 5,
    isEligible: (s) => s.encumbranceReliefStacks < 5,
    apply: ({ state }) => {
      state.encumbranceReliefStacks += 1
      return {
        bannerSubtitle: 'LIGHTER STEP',
        floatText: 'Easier to move when packed',
        floatClass: 'float-hud--level-up',
      }
    },
  },
  {
    id: 'echo-bait',
    title: 'Echo bait',
    description: 'Haunted clutter is a bit more common (more ghosts, more risk).',
    stackable: true,
    maxStacks: 3,
    isEligible: (s) => s.hauntedChanceBonus < 0.14,
    apply: ({ state }) => {
      state.hauntedChanceBonus += 0.045
      return {
        bannerSubtitle: 'ECHO BAIT',
        floatText: 'Spookier rooms…',
        floatClass: 'float-hud--level-up',
      }
    },
  },
  {
    id: 'spectral-swarm',
    title: 'Spectral bargain',
    description: 'Ghosts move slower, but haunted pickups are more common.',
    stackable: false,
    isEligible: (s) => !s.spectralSwarmTaken,
    apply: ({ state }) => {
      state.spectralSwarmTaken = true
      state.ghostSpeedRuntimeMul *= 0.88
      state.hauntedChanceBonus += 0.06
      return {
        bannerSubtitle: 'SPECTRAL BARGAIN',
        floatText: 'Slower ghosts · spookier clutter',
        floatClass: 'float-hud--level-up',
      }
    },
  },
  {
    id: 'second-wind',
    title: 'Second wind',
    description: 'Restore one heart if you are not full.',
    stackable: true,
    isEligible: (_s, lives) => lives < PLAYER_MAX_LIVES,
    apply: () => ({
      livesDelta: 1,
      bannerSubtitle: 'HEART RESTORED',
      floatText: 'Second wind',
      floatClass: 'float-hud--level-up',
    }),
  },
  {
    id: 'respite-charm',
    title: 'Respite charm',
    description:
      'Once per run: restore a heart if possible; otherwise steady your grip on the haul.',
    stackable: false,
    isEligible: (s) => !s.respiteCharmTaken,
    apply: (ctx) => {
      const { state } = ctx
      state.respiteCharmTaken = true
      if (ctx.lives < PLAYER_MAX_LIVES) {
        return {
          livesDelta: 1,
          bannerSubtitle: 'RESPITE',
          floatText: 'Heart restored',
          floatClass: 'float-hud--level-up',
        }
      }
      state.ghostHitLossReduction = Math.min(
        0.4,
        state.ghostHitLossReduction + 0.12,
      )
      return {
        bannerSubtitle: 'RESPITE',
        floatText: 'Steadier grip (full health)',
        floatClass: 'float-hud--level-up',
      }
    },
  },
]

function stackCountFor(
  def: UpgradeDef,
  state: RunUpgradeState,
): number {
  switch (def.id) {
    case 'swift-stride':
      return state.speedLevel
    case 'steady-hands':
      return Math.round(state.ghostHitLossReduction / 0.09)
    case 'light-footing':
      return state.encumbranceReliefStacks
    case 'echo-bait':
      return Math.round(state.hauntedChanceBonus / 0.045)
    default:
      return 0
  }
}

function isDefEligible(def: UpgradeDef, state: RunUpgradeState, lives: number): boolean {
  if (!def.stackable && state.takenOnceIds.has(def.id)) return false
  if (!def.isEligible(state, lives)) return false
  if (def.stackable && def.maxStacks !== undefined) {
    if (stackCountFor(def, state) >= def.maxStacks) return false
  }
  return true
}

/** Three unique offers for the room-clear picker. */
export function pickRunUpgradeOffers(
  random: () => number,
  state: RunUpgradeState,
  lives: number,
): RunUpgradeOffer[] {
  const pool = DEFINITIONS.filter((d) => isDefEligible(d, state, lives))
  const arr = [...pool]
  shuffleInPlace(arr, random)
  const out: RunUpgradeOffer[] = []
  const seen = new Set<string>()
  for (const d of arr) {
    if (out.length >= 3) break
    if (seen.has(d.id)) continue
    seen.add(d.id)
    out.push({ id: d.id, title: d.title, description: d.description })
  }
  return out
}

export function applyRunUpgrade(
  offerId: string,
  ctx: ApplyRunUpgradeContext,
): ApplyRunUpgradeResult | null {
  const def = DEFINITIONS.find((d) => d.id === offerId)
  if (!def) return null
  if (!isDefEligible(def, ctx.state, ctx.lives)) return null

  if (!def.stackable) {
    ctx.state.takenOnceIds.add(def.id)
  }

  const partial = def.apply(ctx)
  let lives = ctx.lives
  if (partial.livesDelta !== undefined) {
    lives = Math.max(0, Math.min(PLAYER_MAX_LIVES, lives + partial.livesDelta))
  }

  return {
    lives,
    bannerSubtitle: partial.bannerSubtitle,
    floatText: partial.floatText,
    floatClass: partial.floatClass,
  }
}
