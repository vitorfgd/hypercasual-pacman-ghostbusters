import { roomIndexFromId } from '../doors/doorLayout.ts'
import type { RoomId } from './mansionRoomData.ts'
import { cleanlinessPercentPerGridWisp } from './roomCleanlinessConfig.ts'
import { doorIndexToOpenWhenRoomCleared } from './roomCleanlinessLayout.ts'

export type RoomCleanlinessSystemOptions = {
  onRoomCleared: (roomId: RoomId, doorIndex: number | null) => void
  /** Per-room total grid wisps (from `planAllRoomGrids`); drives % per pickup. */
  wispTotalsByRoom: ReadonlyMap<RoomId, number>
}

/**
 * Tracks 0–100% cleanliness per `ROOM_*` from collecting grid wisps in that room.
 */
export class RoomCleanlinessSystem {
  private readonly progress = new Map<RoomId, number>()
  private readonly cleared = new Set<RoomId>()
  private readonly onRoomCleared: RoomCleanlinessSystemOptions['onRoomCleared']
  private readonly wispTotalsByRoom: ReadonlyMap<RoomId, number>

  constructor(opts: RoomCleanlinessSystemOptions) {
    this.onRoomCleared = opts.onRoomCleared
    this.wispTotalsByRoom = opts.wispTotalsByRoom
  }

  registerGridWispCollected(roomId: RoomId): void {
    if (!isTrackableRoom(roomId)) return
    if (this.cleared.has(roomId)) return

    const idx = roomIndexFromId(roomId)
    if (idx === null || idx < 1) return
    const total = this.wispTotalsByRoom.get(roomId) ?? 0
    const step = cleanlinessPercentPerGridWisp(total)
    if (step <= 0) return

    const cur = this.progress.get(roomId) ?? 0
    const next = Math.min(100, cur + step)
    this.progress.set(roomId, next)

    if (next >= 100 - 1e-5) {
      this.cleared.add(roomId)
      this.onRoomCleared(roomId, doorIndexToOpenWhenRoomCleared(roomId))
    }
  }

  /** 0–100 for HUD; cleared rooms stay at 100. */
  getDisplayPercent(roomId: RoomId | null): number {
    if (!roomId || roomId === 'SAFE_CENTER') return 0
    if (!isTrackableRoom(roomId)) return 0
    if (this.cleared.has(roomId)) return 100
    return this.progress.get(roomId) ?? 0
  }

  isRoomCleared(roomId: RoomId): boolean {
    return this.cleared.has(roomId)
  }
}

function isTrackableRoom(roomId: RoomId): boolean {
  return roomId.startsWith('ROOM_')
}
