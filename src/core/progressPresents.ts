import type { TrailStyleId } from '../juice/playerMotionTrail.ts'

export type PresentRewardId =
  | 'spectral_ribbon'
  | 'rose_comet'
  | 'royal_stream'

export type PresentRewardDefinition = {
  id: PresentRewardId
  title: string
  description: string
  trailStyle: TrailStyleId
}

export type ProgressPresentState = {
  progress: number
  pendingRewardIds: PresentRewardId[]
  unlockedRewardIds: PresentRewardId[]
  equippedTrailStyle: TrailStyleId
  highestRoomRewarded: number
  bossRewardClaimed: boolean
}

export type ProgressPresentGrantKind = 'normal' | 'boss'

export type ProgressPresentOutcome = {
  grantedRewardIds: PresentRewardId[]
  progress: number
  threshold: number
  fillRatio: number
  roomsUntilNextPresent: number
  allRewardsClaimed: boolean
  source: ProgressPresentGrantKind
}

const PROGRESS_PRESENTS_KEY = 'ghostBusters.progressPresents'
export const PRESENT_PROGRESS_THRESHOLD = 3
const BOSS_PRESENT_PROGRESS = 1

export const PRESENT_REWARD_DEFS: readonly PresentRewardDefinition[] = [
  {
    id: 'spectral_ribbon',
    title: 'Spectral Ribbon',
    description: 'A cool mint trail with a brighter ghost-light edge.',
    trailStyle: 'spectral',
  },
  {
    id: 'rose_comet',
    title: 'Rose Comet',
    description: 'A hot pink chase streak that leaves a clean neon wake.',
    trailStyle: 'rose',
  },
  {
    id: 'royal_stream',
    title: 'Royal Stream',
    description: 'A gold-and-violet prize trail with a richer glow.',
    trailStyle: 'royal',
  },
] as const

export function loadSavedProgressPresentState(): ProgressPresentState {
  try {
    const raw = localStorage.getItem(PROGRESS_PRESENTS_KEY)
    if (!raw) {
      return createDefaultState()
    }
    const parsed = JSON.parse(raw) as Partial<ProgressPresentState> | null
    const pendingRewardIds = sanitizeRewardIds(parsed?.pendingRewardIds)
    const unlockedRewardIds = sanitizeRewardIds(parsed?.unlockedRewardIds)
    const equippedTrailStyle = sanitizeTrailStyle(parsed?.equippedTrailStyle)
    return {
      progress: sanitizeProgress(parsed?.progress),
      pendingRewardIds,
      unlockedRewardIds,
      equippedTrailStyle:
        unlockedRewardIds.some(
          (id) => rewardDefById(id)?.trailStyle === equippedTrailStyle,
        ) || equippedTrailStyle === 'default'
          ? equippedTrailStyle
          : 'default',
      highestRoomRewarded: sanitizeRoomNumber(parsed?.highestRoomRewarded),
      bossRewardClaimed: Boolean(parsed?.bossRewardClaimed),
    }
  } catch {
    return createDefaultState()
  }
}

export function saveProgressPresentState(state: ProgressPresentState): void {
  try {
    localStorage.setItem(
      PROGRESS_PRESENTS_KEY,
      JSON.stringify({
        progress: sanitizeProgress(state.progress),
        pendingRewardIds: sanitizeRewardIds(state.pendingRewardIds),
        unlockedRewardIds: sanitizeRewardIds(state.unlockedRewardIds),
        equippedTrailStyle: sanitizeTrailStyle(state.equippedTrailStyle),
        highestRoomRewarded: sanitizeRoomNumber(state.highestRoomRewarded),
        bossRewardClaimed: Boolean(state.bossRewardClaimed),
      }),
    )
  } catch {
    /* ignore */
  }
}

export function rewardDefById(
  rewardId: PresentRewardId,
): PresentRewardDefinition | null {
  return PRESENT_REWARD_DEFS.find((reward) => reward.id === rewardId) ?? null
}

export function hasRemainingPresentRewards(state: ProgressPresentState): boolean {
  const claimed = new Set<PresentRewardId>([
    ...state.unlockedRewardIds,
    ...state.pendingRewardIds,
  ])
  return PRESENT_REWARD_DEFS.some((reward) => !claimed.has(reward.id))
}

export function recordPresentProgress(
  state: ProgressPresentState,
  source: ProgressPresentGrantKind,
  roomNumber?: number,
): ProgressPresentOutcome {
  let gain = 0
  if (source === 'normal') {
    const nextMilestone = Math.floor(Number(roomNumber) || 0)
    if (nextMilestone > state.highestRoomRewarded) {
      gain = nextMilestone - state.highestRoomRewarded
      state.highestRoomRewarded = nextMilestone
    }
  } else if (!state.bossRewardClaimed) {
    gain = BOSS_PRESENT_PROGRESS
    state.bossRewardClaimed = true
  }

  if (!hasRemainingPresentRewards(state)) {
    state.progress = PRESENT_PROGRESS_THRESHOLD
    return {
      grantedRewardIds: [],
      progress: state.progress,
      threshold: PRESENT_PROGRESS_THRESHOLD,
      fillRatio: 1,
      roomsUntilNextPresent: 0,
      allRewardsClaimed: true,
      source,
    }
  }

  if (gain <= 0) {
    return {
      grantedRewardIds: [],
      progress: state.progress,
      threshold: PRESENT_PROGRESS_THRESHOLD,
      fillRatio: state.progress / PRESENT_PROGRESS_THRESHOLD,
      roomsUntilNextPresent: Math.max(0, PRESENT_PROGRESS_THRESHOLD - state.progress),
      allRewardsClaimed: false,
      source,
    }
  }

  state.progress = Math.max(0, state.progress + gain)
  const grantedRewardIds: PresentRewardId[] = []
  while (
    state.progress >= PRESENT_PROGRESS_THRESHOLD &&
    hasRemainingPresentRewards(state)
  ) {
    state.progress -= PRESENT_PROGRESS_THRESHOLD
    const nextReward = nextLockedRewardId(state)
    if (!nextReward) {
      state.progress = PRESENT_PROGRESS_THRESHOLD
      break
    }
    state.pendingRewardIds.push(nextReward)
    grantedRewardIds.push(nextReward)
  }
  if (!hasRemainingPresentRewards(state)) {
    state.progress = PRESENT_PROGRESS_THRESHOLD
  }
  return {
    grantedRewardIds,
    progress: state.progress,
    threshold: PRESENT_PROGRESS_THRESHOLD,
    fillRatio: hasRemainingPresentRewards(state)
      ? state.progress / PRESENT_PROGRESS_THRESHOLD
      : 1,
    roomsUntilNextPresent: hasRemainingPresentRewards(state)
      ? Math.max(0, PRESENT_PROGRESS_THRESHOLD - state.progress)
      : 0,
    allRewardsClaimed: !hasRemainingPresentRewards(state),
    source,
  }
}

function createDefaultState(): ProgressPresentState {
  return {
    progress: 0,
    pendingRewardIds: [],
    unlockedRewardIds: [],
    equippedTrailStyle: 'default',
    highestRoomRewarded: 0,
    bossRewardClaimed: false,
  }
}

function nextLockedRewardId(
  state: ProgressPresentState,
): PresentRewardId | null {
  const claimed = new Set<PresentRewardId>([
    ...state.unlockedRewardIds,
    ...state.pendingRewardIds,
  ])
  for (const reward of PRESENT_REWARD_DEFS) {
    if (!claimed.has(reward.id)) return reward.id
  }
  return null
}

function sanitizeProgress(value: unknown): number {
  return Math.max(0, Math.min(PRESENT_PROGRESS_THRESHOLD, Math.floor(Number(value) || 0)))
}

function sanitizeRoomNumber(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function sanitizeRewardIds(value: unknown): PresentRewardId[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<PresentRewardId>()
  for (const candidate of value) {
    if (
      typeof candidate === 'string' &&
      PRESENT_REWARD_DEFS.some((reward) => reward.id === candidate)
    ) {
      unique.add(candidate as PresentRewardId)
    }
  }
  return [...unique]
}

function sanitizeTrailStyle(value: unknown): TrailStyleId {
  switch (value) {
    case 'spectral':
    case 'rose':
    case 'royal':
      return value
    default:
      return 'default'
  }
}
