import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  LoopRepeat,
  Mesh,
  SkinnedMesh,
  type Object3D,
  Vector3,
} from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

/** Served from `public/` (Vite). */
export const WISP_GLTF_URL = publicAsset('assets/wisps/whisp.glb')

/** World pickups — readable on floor. */
const WISP_TARGET_MAX_DIM = 0.72

/** Carried stack — much smaller than floor wisps. */
export const WISP_STACK_TARGET_MAX_DIM = 0.54

let wispPrototype: Group | null = null
let wispAnimations: readonly AnimationClip[] = []

export function getWispPickupPrototype(): Group | null {
  return wispPrototype
}

/**
 * `SkeletonUtils.clone` reuses prototype geometry/materials by reference.
 * Do not dispose those on a clone — only skeleton + mixer.
 */
export function disposeWispGltfClone(root: Object3D): void {
  const mix = root.userData.wispMixer as AnimationMixer | undefined
  if (mix) mix.stopAllAction()
  root.removeFromParent()
}

export function disposeWispPickupPrototype(): void {
  if (!wispPrototype) return
  wispPrototype.traverse((o) => {
    if (o instanceof SkinnedMesh && o.skeleton) {
      o.skeleton.dispose()
    }
    if (o instanceof Mesh) {
      o.geometry?.dispose()
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      for (const mat of mats) mat.dispose()
    }
  })
  wispPrototype = null
  wispAnimations = []
}

export async function loadWispPickupGltf(url: string): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    wispPrototype = gltf.scene as Group
    wispPrototype.name = 'wispGltfPrototype'
    wispAnimations = gltf.animations ?? []
    wispPrototype.updateMatrixWorld(true)
    return true
  } catch (e) {
    console.warn(
      '[wisp] GLB load failed — using procedural wisps. Reason:',
      e instanceof Error ? e.message : String(e),
    )
    wispPrototype = null
    wispAnimations = []
    return false
  }
}

/** GLTF often wraps the rig in a single child. */
function mixerRootForGltfClone(root: Group): Object3D {
  if (root.children.length === 1) {
    return root.children[0]!
  }
  return root
}

function findClip(
  clips: readonly AnimationClip[],
  nameKeywords: readonly string[],
): AnimationClip | undefined {
  const lower = nameKeywords.map((k) => k.toLowerCase())
  for (const clip of clips) {
    const n = clip.name.toLowerCase()
    if (lower.some((kw) => n === kw || n.includes(kw))) return clip
  }
  return undefined
}

export type CloneWispFromGltfOpts = {
  targetMaxDim?: number
}

export function cloneWispPickupFromGltf(
  _hue: number,
  opts?: CloneWispFromGltfOpts,
): Group {
  const proto = wispPrototype!
  const root = cloneSkeletonSafe(proto) as Group
  root.name = 'wispSoulPickup'
  root.userData.wispGltf = true

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const target = opts?.targetMaxDim ?? WISP_TARGET_MAX_DIM
  const fit = Math.min(2.8, target / maxDim)
  root.scale.setScalar(fit)
  root.userData.wispBaseScale = fit

  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y

  root.userData.wispBody = undefined
  root.userData.wispMid = undefined
  root.userData.wispHalo = undefined

  const clips = wispAnimations
  if (clips.length > 0) {
    const animRoot = mixerRootForGltfClone(root)
    animRoot.updateMatrixWorld(true)
    const mixer = new AnimationMixer(animRoot)
    const idleClip = findClip(clips, ['idle', 'Idle'])
    const clip = idleClip ?? clips[0]!
    const action = mixer.clipAction(clip)
    action.enabled = true
    action.paused = false
    action.setLoop(LoopRepeat, Infinity)
    action.reset().play()
    root.userData.wispMixer = mixer
  }

  return root
}
