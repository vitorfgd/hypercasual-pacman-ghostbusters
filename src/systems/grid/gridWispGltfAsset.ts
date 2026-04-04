import { Box3, Group, Mesh, SkinnedMesh, type Object3D, Vector3 } from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

export const GRID_WISP_GLTF_URL = publicAsset('assets/grid/wisp.glb')

const FLOOR_TARGET_MAX_DIM = 0.95

let prototype: Group | null = null

export function getGridWispPrototype(): Group | null {
  return prototype
}

export async function loadGridWispGltf(
  url: string = GRID_WISP_GLTF_URL,
): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    prototype = gltf.scene as Group
    prototype.name = 'gridWispPrototype'
    prototype.updateMatrixWorld(true)
    return true
  } catch (e) {
    console.warn(
      '[grid wisp] GLB load failed — grid wisps fall back to procedural. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    prototype = null
    return false
  }
}

export function disposeGridWispPrototype(): void {
  if (!prototype) return
  prototype.traverse((o) => {
    if (o instanceof SkinnedMesh && o.skeleton) o.skeleton.dispose()
    if (o instanceof Mesh) {
      o.geometry?.dispose()
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      for (const mat of mats) mat.dispose()
    }
  })
  prototype = null
}

export function disposeGridWispClone(root: Object3D): void {
  root.removeFromParent()
}

/** Clone for world pickup; scaled to read on floor cells. */
export function cloneGridWispPickup(): Group | null {
  const proto = prototype
  if (!proto) {
    return null
  }
  const root = cloneSkeletonSafe(proto) as Group
  root.name = 'gridWispPickup'
  root.userData.gridWispGltf = true
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxD = Math.max(size.x, size.y, size.z, 1e-4)
  const s = FLOOR_TARGET_MAX_DIM / maxD
  root.scale.setScalar(s)
  root.userData.wispBaseScale = s
  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y
  return root
}
