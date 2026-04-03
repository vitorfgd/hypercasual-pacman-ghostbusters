import type { Object3D } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import {
  createClutterPickupMesh,
  createGemPickupMesh,
  createPelletStackMesh,
  createPowerPelletPickupMesh,
  createRelicPickupMesh,
  createWispPickupMesh,
} from '../../themes/pellet/pelletMeshes.ts'

export function createPickupMesh(item: GameItem): Object3D {
  if (item.type === 'relic') {
    return createRelicPickupMesh(item.hue, item.relicVariant)
  }
  if (item.type === 'gem') {
    return createGemPickupMesh(item.gemColor)
  }
  if (item.type === 'power_pellet') {
    return createPowerPelletPickupMesh()
  }
  if (item.type === 'clutter') {
    return createClutterPickupMesh(item.clutterVariant)
  }
  return createWispPickupMesh(item.hue)
}

export function createStackMesh(item: GameItem): Object3D {
  return createPelletStackMesh(item)
}
