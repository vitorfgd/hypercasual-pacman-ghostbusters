import { Box3, Group, type Object3D, Vector3 } from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'
import { DOOR_HALF } from '../world/mansionGeometry.ts'

export const GATE_GLTF_URL = publicAsset('assets/gate/gate.glb')

/** Span across the door opening (X). */
export const GATE_TARGET_WIDTH = DOOR_HALF * 2 * 0.96

let prototype: Group | null = null

export async function loadGateGltf(url = GATE_GLTF_URL): Promise<boolean> {
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const gltf = await new GLTFLoader().loadAsync(url)
    const scene = gltf.scene as Group
    scene.name = 'gateGltfPrototype'
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)
    const horiz = Math.max(size.x, size.z, 1e-4)
    const s = GATE_TARGET_WIDTH / horiz
    scene.scale.setScalar(s)
    scene.updateMatrixWorld(true)
    const box2 = new Box3().setFromObject(scene)
    scene.position.y -= box2.min.y
    prototype = scene
    return true
  } catch (e) {
    console.warn(
      '[gate] GLB load failed — using procedural gate. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    prototype = null
    return false
  }
}

export function getGatePrototype(): Group | null {
  return prototype
}

/** Clones share prototype materials — do not dispose shared geometry/materials on the clone. */
export function tryCloneGateMesh(): Group | null {
  if (!prototype) return null
  return cloneSkeletonSafe(prototype) as Group
}

export function disposeGateGltfClone(root: Object3D): void {
  root.removeFromParent()
}
