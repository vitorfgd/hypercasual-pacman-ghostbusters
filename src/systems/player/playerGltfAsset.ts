import type { AnimationClip, Group } from 'three'
import { Mesh } from 'three'
import { publicAsset } from '../../core/publicAsset.ts'

export type PlayerGltfTemplate = {
  /** Root from GLTF; never added to scene — clone only. */
  scenePrototype: Group
  animations: readonly AnimationClip[]
}

export const PLAYER_GLTF_URL = publicAsset('assets/player/character.glb')

/** How long the “collecting” clip stays primary after a wisp/relic pickup */
export const PLAYER_PICKUP_ANIM_WINDOW_SEC = 0.55

export function disposePlayerGltfTemplate(template: PlayerGltfTemplate | null): void {
  if (!template) return
  template.scenePrototype.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry?.dispose()
      const mat = o.material
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        m.dispose()
      }
    }
  })
}

export async function loadPlayerCharacterGltf(
  url: string,
): Promise<
  | { ok: true; template: PlayerGltfTemplate }
  | { ok: false; error: string }
> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    const scenePrototype = gltf.scene as Group
    const animations = gltf.animations ?? []
    if (animations.length === 0) {
      return {
        ok: false,
        error: `GLB loaded but no animations (expected idle, collecting, running). url=${url}`,
      }
    }
    return { ok: true, template: { scenePrototype, animations } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
