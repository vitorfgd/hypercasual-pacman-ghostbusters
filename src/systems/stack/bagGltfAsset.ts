import { Box3, Group, Mesh, type Object3D, Vector3 } from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

export const CARRY_BAG_GLTF_URL = publicAsset('assets/bag/carry_bag.glb')

/** Readable size on the player’s back after fit. */
const BAG_TARGET_MAX_DIM = 0.88

let bagPrototype: Group | null = null

export function isCarryBagReady(): boolean {
  return bagPrototype !== null
}

export async function loadCarryBagGltf(url: string = CARRY_BAG_GLTF_URL): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    bagPrototype = gltf.scene as Group
    bagPrototype.name = 'carryBagPrototype'
    bagPrototype.updateMatrixWorld(true)
    bagPrototype.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return true
  } catch (e) {
    console.warn(
      '[carryBag] GLB load failed — procedural fallback. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    bagPrototype = null
    return false
  }
}

/**
 * Clone for the carry anchor. Sets `userData.carryBagGltf`, `bagBaseScale`.
 */
export function cloneCarryBagMesh(): Group {
  const proto = bagPrototype!
  const root = cloneSkeletonSafe(proto) as Group
  root.name = 'carryBag'
  root.userData.carryBagGltf = true

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const fit = Math.min(2.4, BAG_TARGET_MAX_DIM / maxDim)
  root.scale.setScalar(fit)
  root.userData.bagBaseScale = fit

  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y

  return root
}

export function disposeCarryBagClone(root: Object3D): void {
  root.removeFromParent()
}
