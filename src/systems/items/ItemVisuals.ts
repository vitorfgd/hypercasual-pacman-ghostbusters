import type { Object3D } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import {
  createPelletStackMesh,
  createRelicPickupMesh,
  createWispPickupMesh,
} from '../../themes/pellet/pelletMeshes.ts'

export function createPickupMesh(item: GameItem): Object3D {
  if (item.type === 'relic') {
    return createRelicPickupMesh(item.hue, item.relicVariant)
  }
  return createWispPickupMesh(item.hue)
}

export function createStackMesh(item: GameItem): Object3D {
  return createPelletStackMesh(item)
}
