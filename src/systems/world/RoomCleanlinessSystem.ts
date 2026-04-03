import type { ClutterItem } from '../../core/types/GameItem.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import type { RoomId } from './mansionRoomData.ts'
import { cleanlinessPercentPerClutter } from './roomCleanlinessConfig.ts'
import { doorIndexToOpenWhenRoomCleared } from './roomCleanlinessLayout.ts'

export type RoomCleanlinessSystemOptions = {
  onRoomCleared: (roomId: RoomId, doorIndex: number | null) => void
}

/**
 * Tracks 0–100% cleanliness per `ROOM_*`. Progress only from clutter whose
 * `spawnRoomId` matches that room (see `ClutterItem.spawnRoomId`).
 */
export class RoomCleanlinessSystem {
  private readonly progress = new Map<RoomId, number>()
  private readonly cleared = new Set<RoomId>()
  private readonly onRoomCleared: RoomCleanlinessSystemOptions['onRoomCleared']

  constructor(opts: RoomCleanlinessSystemOptions) {
    this.onRoomCleared = opts.onRoomCleared
  }

  registerClutterCollected(item: ClutterItem): void {
    const room = item.spawnRoomId
    if (!isTrackableRoom(room)) return
    if (this.cleared.has(room)) return

    const idx = roomIndexFromId(room)
    if (idx === null || idx < 1) return
    const cur = this.progress.get(room) ?? 0
    const next = Math.min(
      100,
      cur + cleanlinessPercentPerClutter(idx),
    )
    this.progress.set(room, next)

    if (next >= 100 - 1e-5) {
      this.cleared.add(room)
      this.onRoomCleared(room, doorIndexToOpenWhenRoomCleared(room))
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
