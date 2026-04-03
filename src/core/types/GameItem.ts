import type { RoomId } from '../../systems/world/mansionRoomData.ts'

/**
 * Generic collectible payload. Core systems only rely on id / type / value;
 * theme-specific fields (hue, …) are for visuals or future rules.
 */
export type ItemCore = {
  id: string
  value: number
}

export type WispItem = ItemCore & {
  kind: 'collectible'
  type: 'wisp'
  /** Color variation for glow / zone read */
  hue: number
}

export type RelicItem = ItemCore & {
  kind: 'collectible'
  type: 'relic'
  /** Gold tint (Three.js HSL hue) */
  hue: number
  /** Which relic GLB mesh: `0` = calice, `1` = coin */
  relicVariant: 0 | 1
}

/** Dropped when a ghost is eaten; color matches ghost body hue family. */
export type GemColor = 'red' | 'blue' | 'green'

export type GemItem = ItemCore & {
  kind: 'collectible'
  type: 'gem'
  gemColor: GemColor
}

/** Room junk — seven GLB variants; mesh variant drives floor + stack shape. */
export type ClutterVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type ClutterItem = ItemCore & {
  kind: 'collectible'
  type: 'clutter'
  clutterVariant: ClutterVariant
  /** Room this instance was spawned in; cleanliness only credits this room. */
  spawnRoomId: RoomId
  /** When true, vacuuming spawns a ghost instead of stacking (see `CollectionSystem`). */
  haunted: boolean
}

export type GameItem = WispItem | RelicItem | GemItem | ClutterItem
