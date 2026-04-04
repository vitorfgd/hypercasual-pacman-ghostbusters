import {
  Box3,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

export const GRID_TRAP_GLTF_URL = publicAsset('assets/grid/spike_trap.glb')

const TRAP_TARGET_MAX_DIM = 1

let prototype: Group | null = null

function cloneTrapMaterial(material: Mesh['material']): Mesh['material'] {
  if (Array.isArray(material)) {
    return material.map((entry) => cloneTrapMaterial(entry)) as Mesh['material']
  }
  if (
    material instanceof MeshPhysicalMaterial ||
    material instanceof MeshStandardMaterial
  ) {
    return material.clone()
  }
  if (material && typeof (material as Material).clone === 'function') {
    return (material as Material).clone() as Mesh['material']
  }
  return new MeshStandardMaterial({
    color: 0xa1262c,
    emissive: 0x4f0d15,
    emissiveIntensity: 0.28,
    roughness: 0.72,
    metalness: 0.08,
  })
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
      '[grid trap] GLB load failed, using procedural trap tile instead. Reason:',
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
      const material = o.material
      const materials = Array.isArray(material) ? material : [material]
      for (const entry of materials) entry.dispose()
    }
  })
  prototype = null
}

export function cloneGridTrapMesh(): Group | null {
  if (!prototype) return null
  const root = cloneSkeletonSafe(prototype) as Group
  root.name = 'gridTrap'
  root.userData.gridTrapGltf = true
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.geometry = o.geometry.clone()
    o.material = cloneTrapMaterial(o.material)
    o.castShadow = false
    o.receiveShadow = true
    o.raycast = () => {}
  })
  root.updateMatrixWorld(true)

  const bounds = new Box3().setFromObject(root)
  const size = new Vector3()
  bounds.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const scale = TRAP_TARGET_MAX_DIM / maxDim
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)

  const groundedBounds = new Box3().setFromObject(root)
  root.position.y -= groundedBounds.min.y
  root.updateMatrixWorld(true)
  return root
}
