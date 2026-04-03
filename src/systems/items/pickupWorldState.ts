import type { Object3D } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'

/**
 * World clutter uses `userData.clutterWorldInteractable` (locked rooms = false).
 * Other pickups use `mesh.visible` only.
 */
export function isWorldPickupInteractable(mesh: Object3D, item: GameItem): boolean {
  if (item.type === 'clutter') {
    return mesh.userData.clutterWorldInteractable === true
  }
  return mesh.visible
}
