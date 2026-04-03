export type PersonalBestSnapshot = {
  bestRoomReached: number
  bestTimeSec: number
  bestBossReachTimeSec: number | null
}

const PERSONAL_BEST_KEY = 'ghostBusters.personalBest'

export function loadSavedPersonalBest(): PersonalBestSnapshot {
  try {
    const raw = localStorage.getItem(PERSONAL_BEST_KEY)
    if (!raw) {
      return { bestRoomReached: 0, bestTimeSec: 0, bestBossReachTimeSec: null }
    }
    const parsed = JSON.parse(raw) as Partial<PersonalBestSnapshot> | null
    return {
      bestRoomReached: sanitizeCount(parsed?.bestRoomReached),
      bestTimeSec: sanitizeSeconds(parsed?.bestTimeSec),
      bestBossReachTimeSec: sanitizeNullableSeconds(parsed?.bestBossReachTimeSec),
    }
  } catch {
    return { bestRoomReached: 0, bestTimeSec: 0, bestBossReachTimeSec: null }
  }
}

export function savePersonalBest(snapshot: PersonalBestSnapshot): void {
  try {
    localStorage.setItem(
      PERSONAL_BEST_KEY,
        JSON.stringify({
          bestRoomReached: sanitizeCount(snapshot.bestRoomReached),
          bestTimeSec: sanitizeSeconds(snapshot.bestTimeSec),
          bestBossReachTimeSec: sanitizeNullableSeconds(
            snapshot.bestBossReachTimeSec,
          ),
        }),
      )
  } catch {
    /* ignore */
  }
}

export function formatPersonalBestTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatPersonalBestRoom(roomNumber: number): string {
  return roomNumber > 0 ? `Room ${roomNumber}` : 'None yet'
}

function sanitizeCount(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function sanitizeSeconds(value: unknown): number {
  return Math.max(0, Number(value) || 0)
}

function sanitizeNullableSeconds(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
