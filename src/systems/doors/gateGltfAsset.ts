import type { Group, Object3D } from 'three'
import {
  DOUBLE_DOOR_GLTF_URL,
  loadDoubleDoorGltf,
  tryCloneDoubleDoorVisual,
} from './doubleDoorGltfAsset.ts'

/** @deprecated Use `DOUBLE_DOOR_GLTF_URL` — kept for older import paths. */
export const GATE_GLTF_URL = DOUBLE_DOOR_GLTF_URL

export async function loadGateGltf(url = DOUBLE_DOOR_GLTF_URL): Promise<boolean> {
  return loadDoubleDoorGltf(url)
}

/** @deprecated Double doors use `tryCloneDoubleDoorVisual` — returns combined root for legacy callers. */
export function getGatePrototype(): Group | null {
  return null
}

export function tryCloneGateMesh(): Group | null {
  const v = tryCloneDoubleDoorVisual()
  return v ? v.root : null
}

export function disposeGateGltfClone(root: Object3D): void {
  root.removeFromParent()
}
