import {
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import {
  CORRIDOR_BOUNDS,
  ROOM_LIST,
  type RoomBounds,
} from '../world/mansionRoomData.ts'

const INSET = 0.75

const rockMat = new MeshStandardMaterial({
  color: 0x6b6e74,
  roughness: 0.94,
  metalness: 0.05,
  flatShading: true,
})
const rockMatAlt = new MeshStandardMaterial({
  color: 0x5a5d62,
  roughness: 0.92,
  metalness: 0.06,
  flatShading: true,
})

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function areaXZ(b: RoomBounds): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ)
}

function pickXZ(
  b: RoomBounds,
  inset: number,
  rnd: () => number,
): { x: number; z: number } | null {
  const w = b.maxX - b.minX - 2 * inset
  const d = b.maxZ - b.minZ - 2 * inset
  if (w < 0.4 || d < 0.4) return null
  return {
    x: b.minX + inset + rnd() * w,
    z: b.minZ + inset + rnd() * d,
  }
}

const sharedRockGeo = new DodecahedronGeometry(0.22, 0)

function addRock(parent: Group, x: number, z: number, rnd: () => number): void {
  const mesh = new Mesh(sharedRockGeo, rnd() < 0.5 ? rockMat : rockMatAlt)
  const s = 0.55 + rnd() * 0.95
  const sy = 0.35 + rnd() * 0.5
  mesh.scale.set(s * (0.85 + rnd() * 0.3), sy, s * (0.85 + rnd() * 0.35))
  mesh.rotation.set(rnd() * 0.35, rnd() * Math.PI * 2, rnd() * 0.25)
  mesh.position.set(x, 0.08 * sy, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = 'groundRock'
  parent.add(mesh)
}

/**
 * Small rocks scattered on walkable floors — deterministic per area.
 * `runSeed` mixes per-session so decor layout differs each run.
 */
export function addCemeteryGroundDecor(root: Group, runSeed = 0): void {
  const decor = new Group()
  decor.name = 'cemeteryGroundDecor'

  const areas: { bounds: RoomBounds; seed: number }[] = []
  let seedBase = (0xce3e1e ^ runSeed) >>> 0
  for (const r of ROOM_LIST) {
    areas.push({ bounds: r.bounds, seed: seedBase++ })
  }
  for (let i = 0; i < CORRIDOR_BOUNDS.length; i++) {
    areas.push({ bounds: CORRIDOR_BOUNDS[i]!, seed: seedBase + i * 97 })
  }

  for (const { bounds: b, seed } of areas) {
    const rnd = mulberry32(seed)
    const a = areaXZ(b)
    if (a < 2) continue

    const rockCount = Math.max(1, Math.min(14, Math.floor(a / 26)))

    for (let i = 0; i < rockCount; i++) {
      const p = pickXZ(b, INSET, rnd)
      if (!p) break
      addRock(decor, p.x, p.z, rnd)
    }
  }

  root.add(decor)
}
