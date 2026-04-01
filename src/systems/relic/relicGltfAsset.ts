import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SkinnedMesh,
  type Object3D,
  Vector3,
} from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { publicAsset } from '../../core/publicAsset.ts'

/** `0` = calice, `1` = coin — matches `RelicItem.relicVariant` */
export type RelicVariantIndex = 0 | 1

export const RELIC_GLTF_URLS: readonly [string, string] = [
  publicAsset('assets/relics/calice.glb'),
  publicAsset('assets/relics/coin.glb'),
]

/** Reference scale from earlier tuning (world units, max bbox axis after fit). */
const RELIC_REF_MAX_DIM = 0.88 / 5 / 3

/**
 * **Floor** relic — large so it reads on the ground (`cloneRelicFromGltf` `targetMaxDim`).
 */
export const RELIC_PICKUP_TARGET_MAX_DIM = RELIC_REF_MAX_DIM * 6 * 3

/**
 * **Carried** relic — smaller than floor pickup, still readable (same idea as wisp stack vs floor).
 */
export const RELIC_STACK_TARGET_MAX_DIM =
  RELIC_PICKUP_TARGET_MAX_DIM * (0.54 / 0.72) * 0.85

const relicPrototypes: [Group | null, Group | null] = [null, null]
const relicAnimations: [readonly AnimationClip[], readonly AnimationClip[]] = [
  [],
  [],
]

export function getRelicPrototype(variant: RelicVariantIndex): Group | null {
  return relicPrototypes[variant]
}

export function disposeRelicGltfClone(root: Object3D): void {
  const mix = root.userData.relicMixer as AnimationMixer | undefined
  if (mix) mix.stopAllAction()
  root.removeFromParent()
}

export function disposeRelicPickupPrototypes(): void {
  for (let v = 0; v < 2; v++) {
    const p = relicPrototypes[v]
    if (!p) continue
    p.traverse((o) => {
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
    relicPrototypes[v] = null
    relicAnimations[v] = []
  }
}

export async function loadRelicGltfs(
  urls: readonly [string, string] = RELIC_GLTF_URLS,
): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  let anyOk = false
  for (let v = 0; v < 2; v++) {
    try {
      const gltf = await loader.loadAsync(urls[v]!)
      relicPrototypes[v] = gltf.scene as Group
      relicPrototypes[v]!.name = `relicGltfPrototype_${v}`
      relicAnimations[v] = gltf.animations ?? []
      relicPrototypes[v]!.updateMatrixWorld(true)
      anyOk = true
    } catch (e) {
      console.warn(
        `[relic] GLB load failed (variant ${v}) — fallback mesh for that variant. Reason:`,
        e instanceof Error ? e.message : String(e),
      )
      relicPrototypes[v] = null
      relicAnimations[v] = []
    }
  }
  return anyOk
}

function tintRelicGold(root: Group, hue: number): void {
  const tint = new Color().setHSL(hue, 0.62, 0.52)
  const emTint = new Color().setHSL(hue + 0.02, 0.72, 0.48)
  root.traverse((o) => {
    if (!(o instanceof Mesh) && !(o instanceof SkinnedMesh)) return
    o.castShadow = true
    o.receiveShadow = true
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const mat of mats) {
      if (mat instanceof MeshStandardMaterial || mat instanceof MeshPhysicalMaterial) {
        const lum = mat.color.r + mat.color.g + mat.color.b
        if (lum < 0.06) {
          mat.color.copy(tint)
        } else {
          mat.color.lerp(tint, 0.42)
        }
        mat.emissive.lerp(emTint, 0.48)
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.55)
        if (mat.opacity < 0.02) {
          mat.opacity = 1
          mat.transparent = false
        }
        mat.depthWrite = !mat.transparent || mat.opacity >= 0.98
      } else if (mat instanceof MeshBasicMaterial) {
        mat.color.lerp(tint, 0.48)
        if (mat.opacity < 0.02) {
          mat.opacity = 1
          mat.transparent = false
        }
      }
    }
  })
}

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

/** Max scale when fitting GLB — floor can use a high cap; stack uses a lower cap so bbox edge cases never explode. */
const RELIC_FLOOR_FIT_CAP = 3.2
const RELIC_STACK_FIT_CAP = 0.72

export type CloneRelicFromGltfOpts = {
  targetMaxDim?: number
  /** Carried on player stack — uses `RELIC_STACK_TARGET_MAX_DIM` and a lower fit cap than floor. */
  stackCarry?: boolean
}

export function cloneRelicFromGltf(
  variant: RelicVariantIndex,
  hue: number,
  opts?: CloneRelicFromGltfOpts,
): Group {
  const proto = relicPrototypes[variant]
  if (!proto) {
    throw new Error('cloneRelicFromGltf: prototype not loaded for variant')
  }
  const root = cloneSkeletonSafe(proto) as Group
  root.name = 'relicPickup'
  root.userData.relicGltf = true
  root.userData.relicVariant = variant

  tintRelicGold(root, hue)

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const target =
    opts?.targetMaxDim !== undefined
      ? opts.targetMaxDim
      : RELIC_PICKUP_TARGET_MAX_DIM
  const fitCap =
    opts?.stackCarry === true ? RELIC_STACK_FIT_CAP : RELIC_FLOOR_FIT_CAP
  const fit = Math.min(fitCap, target / maxDim)
  root.scale.setScalar(fit)
  root.userData.relicBaseScale = fit

  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y

  root.userData.relicGem = undefined
  root.userData.relicHalo = undefined

  const clips = relicAnimations[variant]
  if (clips.length > 0) {
    const animRoot = mixerRootForGltfClone(root)
    animRoot.updateMatrixWorld(true)
    const mixer = new AnimationMixer(animRoot)
    const idleClip = findClip(clips, ['idle', 'Idle', 'spin', 'float'])
    const clip = idleClip ?? clips[0]!
    const action = mixer.clipAction(clip)
    action.enabled = true
    action.paused = false
    action.setLoop(LoopRepeat, Infinity)
    action.reset().play()
    root.userData.relicMixer = mixer
  }

  return root
}
