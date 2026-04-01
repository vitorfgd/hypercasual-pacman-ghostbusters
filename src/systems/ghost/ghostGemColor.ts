import { Color } from 'three'
import type { GemColor } from '../../core/types/GameItem.ts'

/**
 * Map ghost body hex (spawn tint) to a gem color bucket.
 * Cyan/teal ghosts → blue; warm / magenta → red; green → green.
 */
export function gemColorForGhostBodyHex(hex: number): GemColor {
  const hsl = { h: 0, s: 0, l: 0 }
  new Color(hex).getHSL(hsl)
  const h = hsl.h
  if (h <= 0.14 || h >= 0.78) return 'red'
  if (h >= 0.38 && h <= 0.62) return 'blue'
  return 'green'
}
