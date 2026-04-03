import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from 'three'

const WHITE = new Color(1, 1, 1)

/**
 * True when this mesh is part of a loaded GLB hierarchy — do not alter its materials
 * (readability tweaks apply to procedural / authored-in-code meshes only).
 */
export function meshIsFromLoadedGltf(mesh: Mesh): boolean {
  let o: Object3D | null = mesh
  while (o) {
    const u = o.userData as Record<string, unknown>
    if (
      u.clutterGltf === true ||
      u.wispGltf === true ||
      u.relicGltf === true ||
      u.carryBagGltf === true ||
      u.gateGltf === true ||
      u.doubleDoorGltf === true
    ) {
      return true
    }
    const name = o.name
    if (name === 'ghostGltfModel' || name === 'playerGltfModel') {
      return true
    }
    o = o.parent
  }
  return false
}

/** Lerp albedo toward white for a slightly lifted, readable base (stylized, not HDR). */
const COLOR_LERP_TO_WHITE = 0.085

/** Softer microsurface = slightly punchier highlights under moon + fill. */
const ROUGHNESS_DELTA = 0.075
const ROUGHNESS_MIN = 0.04

const brightened = new WeakSet<MeshStandardMaterial | MeshPhysicalMaterial>()

/**
 * Applies readability tweaks once per material instance (safe across pools / respawns).
 */
export function brightenPbrMaterial(
  m: MeshStandardMaterial | MeshPhysicalMaterial,
): void {
  if (brightened.has(m)) return
  brightened.add(m)
  m.color.lerp(WHITE, COLOR_LERP_TO_WHITE)
  m.roughness = Math.max(ROUGHNESS_MIN, m.roughness - ROUGHNESS_DELTA)
}

export function brightenMeshMaterialsIfEnabled(mesh: Mesh): void {
  if (mesh.userData?.skipReadableMaterialBrighten === true) return
  if (meshIsFromLoadedGltf(mesh)) return
  const mat = mesh.material
  const mats = Array.isArray(mat) ? mat : [mat]
  for (const m of mats) {
    if (m instanceof MeshStandardMaterial || m instanceof MeshPhysicalMaterial) {
      brightenPbrMaterial(m)
    }
  }
}

export function applyReadableMaterialBrightening(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) brightenMeshMaterialsIfEnabled(o)
  })
}
