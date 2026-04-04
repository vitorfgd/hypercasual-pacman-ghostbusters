import type {
  PowerPelletItem,
  RelicItem,
  WispItem,
} from '../../core/types/GameItem.ts'
import type { RoomId } from '../../systems/world/mansionRoomData.ts'

export function createWispItem(
  hue: number,
  value: number,
  stableId?: string,
  spawnRoomId?: RoomId,
): WispItem {
  const item: WispItem = {
    id: stableId ?? crypto.randomUUID(),
    kind: 'collectible',
    type: 'wisp',
    hue,
    value,
  }
  if (spawnRoomId !== undefined) item.spawnRoomId = spawnRoomId
  return item
}

/** High-value timed pickup (arrow points to it while it exists in the world). */
export function createRelicItem(): RelicItem {
  return {
    id: crypto.randomUUID(),
    kind: 'collectible',
    type: 'relic',
    hue: 0.11 + Math.random() * 0.06,
    relicVariant: Math.random() < 0.5 ? 0 : 1,
    value: 72 + Math.floor(Math.random() * 49),
  }
}

export function createPowerPelletItem(
  stableId?: string,
  spawnRoomId?: RoomId,
): PowerPelletItem {
  const item: PowerPelletItem = {
    id: stableId ?? crypto.randomUUID(),
    kind: 'collectible',
    type: 'power_pellet',
    value: 25,
  }
  if (spawnRoomId !== undefined) item.spawnRoomId = spawnRoomId
  return item
}
