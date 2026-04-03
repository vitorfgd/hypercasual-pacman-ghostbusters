import { Box3, Group, Mesh, type Object3D, Vector3 } from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

export const GRID_TRAP_GLTF_URL = publicAsset('assets/grid/spike_trap.glb')

const TRAP_TARGET_MAX_DIM = 1.12 * 1.15

let prototype: Group | null = null

export function getGridTrapPrototype(): Group | null {
  return prototype
}

export async function loadGridTrapGltf(
  url: string = GRID_TRAP_GLTF_URL,
): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    prototype = gltf.scene as Group
    prototype.name = 'gridTrapPrototype'
    prototype.updateMatrixWorld(true)
    return true
  } catch (e) {
    console.warn(
      '[grid trap] GLB load failed — spike traps disabled. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    prototype = null
    return false
  }
}

export function disposeGridTrapPrototype(): void {
  if (!prototype) return
  prototype.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry?.dispose()
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      for (const mat of mats) mat.dispose()
    }
  })
  prototype = null
}

/** Traps are visual-only — no Three.js raycast / implicit picking collider. */
function disableTrapMeshRaycast(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.raycast = () => {}
    }
  })
}

export function cloneGridTrapMesh(): Group | null {
  if (!prototype) return null
  const root = cloneSkeletonSafe(prototype) as Group
  root.name = 'gridTrap'
  root.userData.gridTrapGltf = true
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxD = Math.max(size.x, size.y, size.z, 1e-4)
  const s = TRAP_TARGET_MAX_DIM / maxD
  root.scale.setScalar(s)
  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y
  disableTrapMeshRaycast(root)
  return root
}

export function disposeGridTrapClone(root: Object3D): void {
  root.removeFromParent()
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry?.dispose()
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      for (const mat of mats) mat.dispose()
    }
  })
}
