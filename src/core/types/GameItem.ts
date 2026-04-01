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

export type GameItem = WispItem | RelicItem
