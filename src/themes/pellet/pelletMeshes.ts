import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  type Object3D,
} from 'three'
import type {
  ClutterVariant,
  GameItem,
  GemColor,
} from '../../core/types/GameItem.ts'
import {
  cloneClutterPickupFromGltf,
  getClutterPickupPrototype,
  CLUTTER_PICKUP_TARGET_MAX_DIM,
  CLUTTER_STACK_TARGET_MAX_DIM,
} from '../../systems/clutter/clutterGltfAsset.ts'
import {
  cloneRelicFromGltf,
  getRelicPrototype,
  RELIC_PICKUP_TARGET_MAX_DIM,
  RELIC_STACK_TARGET_MAX_DIM,
  type RelicVariantIndex,
} from '../../systems/relic/relicGltfAsset.ts'
import {
  cloneWispPickupFromGltf,
  getWispPickupPrototype,
  WISP_STACK_TARGET_MAX_DIM,
} from '../../systems/wisp/wispGltfAsset.ts'

const SOUL_BODY_R = 0.1
const SOUL_STACK_R = 0.06
/** Floor gem from ghost kills (pickup mesh) — large so it reads clearly on the ground. */
const GEM_PICKUP_R = 0.11 * 5
/** Stack gem octahedron — enlarged vs pickup so gems read clearly on the carry stack. */
const GEM_STACK_R = 0.062 * 5
/** Procedural floor relic — big (matches gltf “floor is large” intent). */
const RELIC_PICKUP_MESH_SCALE = (1 / 5 / 3) * 4 * 3
/** Procedural stack relic — ~wisp-like ratio vs floor pickup mesh */
const RELIC_STACK_MESH_SCALE = RELIC_PICKUP_MESH_SCALE * (0.54 / 0.72) * 0.85
/** Stack octahedron radius */
const RELIC_STACK_R = 0.2 * RELIC_STACK_MESH_SCALE

/** `hue` is Three.js HSL hue in the cyan–teal band (stored on `GameItem`). */
function soulColors(hue: number): {
  core: Color
  mid: Color
  emissive: Color
  outer: Color
} {
  const t = hue
  return {
    core: new Color().setHSL(t, 0.46, 0.74),
    mid: new Color().setHSL(t + 0.015, 0.58, 0.56),
    emissive: new Color().setHSL(t + 0.03, 0.52, 0.64),
    outer: new Color().setHSL(t - 0.025, 0.38, 0.54),
  }
}

/**
 * Small soul / wisp: bright core + soft mid + outer glow — distinct from ghosts.
 */
function createProceduralRelicPickupMesh(hue: number): Group {
  const root = new Group()
  root.name = 'relicPickup'
  const core = new Color().setHSL(hue, 0.72, 0.52)
  const emissive = new Color().setHSL(hue + 0.02, 0.88, 0.48)

  const gem = new Mesh(
    new OctahedronGeometry(0.2 * RELIC_PICKUP_MESH_SCALE, 0),
    new MeshStandardMaterial({
      color: core,
      emissive,
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.35,
    }),
  )
  gem.position.y = 0.22 * RELIC_PICKUP_MESH_SCALE
  gem.castShadow = true
  root.add(gem)

  const haloMat = new MeshStandardMaterial({
    color: new Color().setHSL(hue, 0.5, 0.62),
    emissive,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.45,
    roughness: 0.4,
    depthWrite: false,
  })
  const halo = new Mesh(
    new SphereGeometry(0.38 * RELIC_PICKUP_MESH_SCALE, 16, 14),
    haloMat,
  )
  halo.position.y = 0.22 * RELIC_PICKUP_MESH_SCALE
  root.add(halo)

  root.userData.relicGem = gem
  root.userData.relicHalo = halo
  return root
}

/** Larger gold relic — calice or coin GLB when loaded, else octahedron + halo. */
export function createRelicPickupMesh(
  hue: number,
  variant: RelicVariantIndex,
): Group {
  if (getRelicPrototype(variant)) {
    return cloneRelicFromGltf(variant, hue, {
      targetMaxDim: RELIC_PICKUP_TARGET_MAX_DIM,
    })
  }
  return createProceduralRelicPickupMesh(hue)
}

export function createWispPickupMesh(hue: number): Group {
  if (getWispPickupPrototype()) {
    return cloneWispPickupFromGltf(hue)
  }
  const root = new Group()
  root.name = 'wispSoulPickup'
  const { core, mid, emissive, outer } = soulColors(hue)

  const coreMat = new MeshStandardMaterial({
    color: core,
    emissive,
    emissiveIntensity: 1.55,
    roughness: 0.16,
    metalness: 0.02,
  })
  const body = new Mesh(
    new SphereGeometry(SOUL_BODY_R * 0.72, 16, 14),
    coreMat,
  )
  body.castShadow = false
  body.receiveShadow = false
  body.position.y = SOUL_BODY_R
  root.add(body)

  const midMat = new MeshStandardMaterial({
    color: mid,
    emissive,
    emissiveIntensity: 0.88,
    transparent: true,
    opacity: 0.9,
    roughness: 0.22,
    depthWrite: false,
  })
  const midSphere = new Mesh(
    new SphereGeometry(SOUL_BODY_R * 1.15, 18, 16),
    midMat,
  )
  midSphere.position.y = SOUL_BODY_R
  root.add(midSphere)

  const haloMat = new MeshStandardMaterial({
    color: outer,
    emissive: new Color().copy(emissive).multiplyScalar(0.9),
    emissiveIntensity: 0.52,
    transparent: true,
    opacity: 0.36,
    roughness: 0.48,
    depthWrite: false,
  })
  const halo = new Mesh(
    new SphereGeometry(SOUL_BODY_R * 2.05, 14, 12),
    haloMat,
  )
  halo.position.y = SOUL_BODY_R
  root.add(halo)

  root.userData.wispBody = body
  root.userData.wispMid = midSphere
  root.userData.wispHalo = halo
  return root
}

function gemPalette(c: GemColor): { core: Color; emissive: Color } {
  switch (c) {
    case 'red':
      return {
        core: new Color(0xff3355),
        emissive: new Color(0xff6688),
      }
    case 'blue':
      return {
        core: new Color(0x3399ff),
        emissive: new Color(0x88ccff),
      }
    default:
      return {
        core: new Color(0x55dd77),
        emissive: new Color(0xaaffcc),
      }
  }
}

/** Faceted gem — distinct from wisps (spheres) and relics (gold). */
function clutterMat(
  variant: ClutterVariant,
): { color: Color; roughness: number; metalness: number } {
  switch (variant) {
    case 0:
      return {
        color: new Color(0xe8e0d4),
        roughness: 0.88,
        metalness: 0.02,
      }
    case 1:
      return {
        color: new Color(0x7a7568),
        roughness: 0.92,
        metalness: 0.08,
      }
    case 2:
      return {
        color: new Color(0x5c5346),
        roughness: 0.96,
        metalness: 0.04,
      }
    case 3:
      return {
        color: new Color(0x9a9082),
        roughness: 0.9,
        metalness: 0.05,
      }
    case 4:
      return {
        color: new Color(0xb8a898),
        roughness: 0.88,
        metalness: 0.03,
      }
    case 5:
      return {
        color: new Color(0x6e665c),
        roughness: 0.94,
        metalness: 0.06,
      }
    default:
      return {
        color: new Color(0x7d7368),
        roughness: 0.93,
        metalness: 0.05,
      }
  }
}

/** Floor pickup — GLB when loaded, else procedural stand-ins. */
export function createClutterPickupMesh(clutterVariant: ClutterVariant): Group {
  if (getClutterPickupPrototype(clutterVariant)) {
    return cloneClutterPickupFromGltf(clutterVariant)
  }

  const root = new Group()
  root.name = 'clutterPickup'
  root.userData.clutterPickup = true
  root.userData.clutterVariant = clutterVariant
  root.userData.clutterBaseScale = 1
  const { color, roughness, metalness } = clutterMat(clutterVariant)

  if (clutterVariant === 0) {
    const geo = new BoxGeometry(0.44, 0.028, 0.34)
    const mat = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
    })
    const paper = new Mesh(geo, mat)
    paper.position.y = 0.014
    paper.rotation.y = (Math.random() - 0.5) * 0.35
    paper.castShadow = true
    paper.receiveShadow = true
    root.add(paper)
  } else if (clutterVariant === 1) {
    const s = 0.22
    const geo = new BoxGeometry(s, s, s)
    const mat = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
    })
    const cube = new Mesh(geo, mat)
    cube.position.y = s * 0.5
    cube.rotation.y = Math.random() * Math.PI * 2
    cube.castShadow = true
    cube.receiveShadow = true
    root.add(cube)
  } else if (clutterVariant === 2) {
    const geo = new BoxGeometry(0.2, 0.14, 0.26)
    const mat = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
    })
    const chunk = new Mesh(geo, mat)
    chunk.position.y = 0.07
    chunk.rotation.y = Math.random() * Math.PI * 2
    chunk.rotation.z = (Math.random() - 0.5) * 0.5
    chunk.castShadow = true
    chunk.receiveShadow = true
    root.add(chunk)
  } else {
    const geo = new BoxGeometry(0.2, 0.14, 0.26)
    const mat = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
    })
    const chunk = new Mesh(geo, mat)
    chunk.position.y = 0.07
    chunk.rotation.y = Math.random() * Math.PI * 2
    chunk.rotation.z = (Math.random() - 0.5) * 0.5
    chunk.castShadow = true
    chunk.receiveShadow = true
    root.add(chunk)
  }

  /** Match previous GLB fit baseline (0.58) so fallback scales with `CLUTTER_PICKUP_TARGET_MAX_DIM`. */
  const k = CLUTTER_PICKUP_TARGET_MAX_DIM / 0.58
  root.scale.setScalar(k)
  root.userData.clutterBaseScale = k

  return root
}

function clutterStackDim(variant: ClutterVariant): number {
  switch (variant) {
    case 0:
      return 0.05
    case 1:
      return 0.12
    case 2:
      return 0.09
    default:
      return 0.09
  }
}

export function createClutterStackMesh(clutterVariant: ClutterVariant): Object3D {
  if (getClutterPickupPrototype(clutterVariant)) {
    return cloneClutterPickupFromGltf(clutterVariant, {
      targetMaxDim: CLUTTER_STACK_TARGET_MAX_DIM,
    })
  }

  const d = clutterStackDim(clutterVariant)
  const { color, roughness, metalness } = clutterMat(clutterVariant)
  let geo: BoxGeometry
  if (clutterVariant === 0) {
    geo = new BoxGeometry(d * 3.2, d * 0.45, d * 2.4)
  } else if (clutterVariant === 1) {
    geo = new BoxGeometry(d, d, d)
  } else {
    geo = new BoxGeometry(d * 0.9, d * 0.7, d * 1.1)
  }
  const mesh = new Mesh(
    geo,
    new MeshStandardMaterial({ color, roughness, metalness }),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.clutterVariant = clutterVariant
  mesh.userData.clutterStackMesh = true
  mesh.position.y = d * 0.55
  mesh.rotation.y = Math.random() * Math.PI * 2
  return mesh
}

export function createGemPickupMesh(gemColor: GemColor): Group {
  const root = new Group()
  root.name = 'gemPickup'
  const { core, emissive } = gemPalette(gemColor)
  const gem = new Mesh(
    new OctahedronGeometry(GEM_PICKUP_R, 0),
    new MeshStandardMaterial({
      color: core,
      emissive,
      emissiveIntensity: 1.2,
      roughness: 0.14,
      metalness: 0.42,
    }),
  )
  gem.position.y = GEM_PICKUP_R * 1.05
  gem.castShadow = true
  gem.receiveShadow = false
  root.add(gem)
  root.userData.gemBody = gem
  root.userData.gemColorKey = gemColor
  return root
}

function createGemStackMesh(gemColor: GemColor): Mesh {
  const { core, emissive } = gemPalette(gemColor)
  const mesh = new Mesh(
    new OctahedronGeometry(GEM_STACK_R, 0),
    new MeshStandardMaterial({
      color: core,
      emissive,
      emissiveIntensity: 1.05,
      roughness: 0.16,
      metalness: 0.38,
    }),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.y = GEM_STACK_R * 1.05
  mesh.userData.gemColorKey = gemColor
  return mesh
}

function createWispStackMesh(hue: number): Object3D {
  if (getWispPickupPrototype()) {
    return cloneWispPickupFromGltf(hue, {
      targetMaxDim: WISP_STACK_TARGET_MAX_DIM,
    })
  }
  const { core, emissive } = soulColors(hue)
  const mat = new MeshStandardMaterial({
    color: core,
    emissive,
    emissiveIntensity: 1.05,
    roughness: 0.2,
    metalness: 0.03,
  })
  const mesh = new Mesh(
    new SphereGeometry(SOUL_STACK_R, 16, 14),
    mat,
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.y = SOUL_STACK_R
  return mesh
}

function createProceduralRelicStackMesh(
  hue: number,
  variant: RelicVariantIndex,
): Mesh {
  const core = new Color().setHSL(hue, 0.7, 0.5)
  const emissive = new Color().setHSL(hue + 0.02, 0.85, 0.45)
  const mat = new MeshStandardMaterial({
    color: core,
    emissive,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.32,
  })
  const mesh = new Mesh(new OctahedronGeometry(RELIC_STACK_R, 0), mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.y = RELIC_STACK_R
  mesh.userData.relicVariant = variant
  return mesh
}

function createRelicStackMesh(
  hue: number,
  variant: RelicVariantIndex,
): Object3D {
  if (getRelicPrototype(variant)) {
    return cloneRelicFromGltf(variant, hue, {
      targetMaxDim: RELIC_STACK_TARGET_MAX_DIM,
      stackCarry: true,
    })
  }
  return createProceduralRelicStackMesh(hue, variant)
}

export function createPelletStackMesh(item: GameItem): Object3D {
  if (item.type === 'relic') {
    return createRelicStackMesh(item.hue, item.relicVariant)
  }
  if (item.type === 'gem') {
    return createGemStackMesh(item.gemColor)
  }
  if (item.type === 'clutter') {
    return createClutterStackMesh(item.clutterVariant)
  }
  return createWispStackMesh(item.hue)
}
