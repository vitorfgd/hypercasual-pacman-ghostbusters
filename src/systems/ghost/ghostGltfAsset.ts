import type { AnimationClip, Group } from 'three'
import { Mesh } from 'three'

export type GhostGltfTemplate = {
  /** Root from GLTF; never added to scene — clones only. */
  scenePrototype: Group
  animations: readonly AnimationClip[]
}

/**
 * Dispose prototype scene graph (geometries, materials). Call on game shutdown.
 */
export function disposeGhostGltfTemplate(template: GhostGltfTemplate | null): void {
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

export async function loadGhostEnemyGltf(
  url: string,
): Promise<
  | { ok: true; template: GhostGltfTemplate }
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
        error: `GLB loaded but no animations (expected idle + chasing). url=${url}`,
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
