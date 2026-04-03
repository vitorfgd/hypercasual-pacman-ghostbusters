import {
  Box3,
  BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'
import { DOOR_HALF } from '../world/mansionGeometry.ts'
import { splitIndexedMeshByCentroidX } from './splitMeshByCentroidX.ts'

export const DOUBLE_DOOR_GLTF_URL = publicAsset(
  'assets/gate/haunted_cemetery_double_gate.glb',
)

/** Span across the door opening (X). */
export const DOUBLE_DOOR_TARGET_WIDTH = DOOR_HALF * 2 * 0.96

export type DoubleDoorVisualTemplate = {
  root: Group
  leftPivot: Group
  rightPivot: Group
}

let template: DoubleDoorVisualTemplate | null = null

/** Deep-clone GLB materials with no edits — preserves maps, emissive, and glTF factors. */
function cloneDoorLeafMaterial(m: Mesh['material']): Material {
  const first = Array.isArray(m) ? m[0]! : m
  if (first instanceof MeshPhysicalMaterial || first instanceof MeshStandardMaterial) {
    return first.clone()
  }
  if (first && typeof (first as Material).clone === 'function') {
    return (first as Material).clone()
  }
  return new MeshStandardMaterial({
    color: 0x6e6158,
    roughness: 0.52,
    metalness: 0.12,
  })
}

export async function loadDoubleDoorGltf(url = DOUBLE_DOOR_GLTF_URL): Promise<boolean> {
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const gltf = await new GLTFLoader().loadAsync(url)
    const scene = gltf.scene as Group
    scene.updateMatrixWorld(true)

    let found: Mesh | null = null
    scene.traverse((o) => {
      if (found) return
      if ((o as Mesh).isMesh) found = o as Mesh
    })
    if (!found) {
      template = null
      return false
    }
    const srcMesh: Mesh = found

    srcMesh.updateMatrixWorld(true)
    const geom = srcMesh.geometry.clone()
    geom.applyMatrix4(srcMesh.matrixWorld)

    const box0 = new Box3().setFromBufferAttribute(
      geom.attributes.position as BufferAttribute,
    )
    const size0 = new Vector3()
    box0.getSize(size0)
    const horiz = Math.max(size0.x, size0.z, 1e-4)
    const u = DOUBLE_DOOR_TARGET_WIDTH / horiz
    geom.scale(u, u, u)
    geom.computeBoundingBox()
    const b0 = geom.boundingBox!
    geom.translate(0, -b0.min.y, 0)

    const baseMat = cloneDoorLeafMaterial(srcMesh.material)
    const leftMat = baseMat.clone()
    const rightMat = baseMat.clone()

    const { left, right } = splitIndexedMeshByCentroidX(geom)

    const lb = new Box3().setFromBufferAttribute(left.attributes.position as BufferAttribute)
    const rb = new Box3().setFromBufferAttribute(right.attributes.position as BufferAttribute)

    const minXL = lb.min.x
    const maxXR = rb.max.x

    left.translate(-minXL, 0, 0)
    right.translate(-maxXR, 0, 0)

    const leftMesh = new Mesh(left, leftMat)
    leftMesh.name = 'doubleDoorLeftLeaf'
    const rightMesh = new Mesh(right, rightMat)
    rightMesh.name = 'doubleDoorRightLeaf'

    const leftPivot = new Group()
    leftPivot.name = 'doubleDoorLeftPivot'
    leftPivot.position.set(minXL, 0, 0)
    leftPivot.add(leftMesh)

    const rightPivot = new Group()
    rightPivot.name = 'doubleDoorRightPivot'
    rightPivot.position.set(maxXR, 0, 0)
    rightPivot.add(rightMesh)

    const root = new Group()
    root.name = 'doubleDoorGltfTemplate'
    root.add(leftPivot)
    root.add(rightPivot)
    root.userData.doubleDoorGltf = true
    leftMesh.userData.doubleDoorGltf = true
    rightMesh.userData.doubleDoorGltf = true

    template = { root, leftPivot, rightPivot }
    return true
  } catch (e) {
    console.warn(
      '[doubleDoor] GLB load failed — using procedural doors. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    template = null
    return false
  }
}

export function getDoubleDoorTemplate(): DoubleDoorVisualTemplate | null {
  return template
}

export function tryCloneDoubleDoorVisual(): DoubleDoorVisualTemplate | null {
  if (!template) return null
  const root = cloneSkeletonSafe(template.root) as Group
  root.userData.doubleDoorGltf = true
  const leftPivot = root.getObjectByName('doubleDoorLeftPivot') as Group
  const rightPivot = root.getObjectByName('doubleDoorRightPivot') as Group
  if (!leftPivot || !rightPivot) return null
  return { root, leftPivot, rightPivot }
}
