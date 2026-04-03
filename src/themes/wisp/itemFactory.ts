import type {
  ClutterItem,
  ClutterVariant,
  GemColor,
  GemItem,
  RelicItem,
  WispItem,
} from '../../core/types/GameItem.ts'
import type { RoomId } from '../../systems/world/mansionRoomData.ts'
import type { ZoneTone } from '../../systems/sources/sourceTypes.ts'

export function createWispItem(hue: number, value: number): WispItem {
  return {
    id: crypto.randomUUID(),
    kind: 'collectible',
    type: 'wisp',
    hue,
    value,
  }
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

/** Small credit on deposit; main use is quest turn-in. */
export function createGemItem(gemColor: GemColor): GemItem {
  return {
    id: crypto.randomUUID(),
    kind: 'collectible',
    type: 'gem',
    gemColor,
    value: 6,
  }
}

export function createClutterItem(
  clutterVariant: ClutterVariant,
  value: number,
  spawnRoomId: RoomId,
  haunted = false,
  /** Stable id for pre-spawned clutter (omit for random UUID). */
  stableId?: string,
): ClutterItem {
  return {
    id: stableId ?? crypto.randomUUID(),
    kind: 'collectible',
    type: 'clutter',
    clutterVariant,
    spawnRoomId,
    haunted,
    value,
  }
}

/**
 * HSL hue in the ghostly cyan / pale green / teal band (Three.js 0–1).
 */
export function randomHueForZoneTone(tone: ZoneTone): number {
  if (tone === 'warm') {
    return 0.43 + Math.random() * 0.07
  }
  return 0.5 + Math.random() * 0.09
}
