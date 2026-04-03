import { Box3, Group, Mesh, type Object3D, Vector3 } from 'three'
import { clone as cloneSkeletonSafe } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { ClutterVariant } from '../../core/types/GameItem.ts'
import { publicAsset } from '../../core/publicAsset.ts'

/** Seven Meshy clutter props — filenames map to `ClutterVariant` 0…6. */
export const CLUTTER_GLTF_URLS: readonly string[] = [
  publicAsset('assets/clutter/clutter_0.glb'),
  publicAsset('assets/clutter/clutter_1.glb'),
  publicAsset('assets/clutter/clutter_2.glb'),
  publicAsset('assets/clutter/clutter_3.glb'),
  publicAsset('assets/clutter/clutter_4.glb'),
  publicAsset('assets/clutter/clutter_5.glb'),
  publicAsset('assets/clutter/clutter_6.glb'),
]

/** Floor clutter — readable in rooms (world units; max bounding-box extent). */
export const CLUTTER_PICKUP_TARGET_MAX_DIM = 1.52

/** Carried stack — smaller than floor pickups. */
export const CLUTTER_STACK_TARGET_MAX_DIM =
  CLUTTER_PICKUP_TARGET_MAX_DIM * (0.54 / 0.72) * 0.88

const clutterPrototypes: (Group | null)[] = Array.from(
  { length: 7 },
  () => null,
)

export function getClutterPickupPrototype(
  variant: ClutterVariant,
): Group | null {
  return clutterPrototypes[variant] ?? null
}

/**
 * Clones share prototype materials/geometry; do not dispose meshes on the clone.
 */
export function disposeClutterGltfClone(root: Object3D): void {
  root.removeFromParent()
}

export function disposeClutterPickupPrototypes(): void {
  for (let v = 0; v < clutterPrototypes.length; v++) {
    const p = clutterPrototypes[v]
    if (!p) continue
    p.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry?.dispose()
        const m = o.material
        const mats = Array.isArray(m) ? m : [m]
        for (const mat of mats) mat.dispose()
      }
    })
    clutterPrototypes[v] = null
  }
}

export async function loadClutterGltfs(
  urls: readonly string[] = CLUTTER_GLTF_URLS,
): Promise<boolean> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  let anyOk = false
  await Promise.all(
    urls.map(async (url, i) => {
      const v = i as ClutterVariant
      try {
        const gltf = await loader.loadAsync(url)
        const scene = gltf.scene as Group
        scene.name = `clutterGltfPrototype_${v}`
        scene.updateMatrixWorld(true)
        scene.traverse((o) => {
          o.castShadow = true
          o.receiveShadow = true
        })
        clutterPrototypes[v] = scene
        anyOk = true
      } catch (e) {
        console.warn(
          `[clutter] GLB load failed (variant ${v}) — procedural fallback. Reason:`,
          e instanceof Error ? e.message : String(e),
        )
        clutterPrototypes[v] = null
      }
    }),
  )
  return anyOk
}

export type CloneClutterFromGltfOpts = {
  targetMaxDim?: number
}

export function cloneClutterPickupFromGltf(
  variant: ClutterVariant,
  opts?: CloneClutterFromGltfOpts,
): Group {
  const proto = clutterPrototypes[variant]
  if (!proto) {
    throw new Error(`cloneClutterPickupFromGltf: missing prototype ${variant}`)
  }
  const root = cloneSkeletonSafe(proto) as Group
  root.name = 'clutterMeshPickup'
  root.userData.clutterGltf = true
  root.userData.clutterPickup = true
  root.userData.clutterVariant = variant

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const target = opts?.targetMaxDim ?? CLUTTER_PICKUP_TARGET_MAX_DIM
  const fit = Math.min(3.4, target / maxDim)
  root.scale.setScalar(fit)
  root.userData.clutterBaseScale = fit

  root.updateMatrixWorld(true)
  const box2 = new Box3().setFromObject(root)
  root.position.y -= box2.min.y

  return root
}
