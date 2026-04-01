import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from 'three'
import type { AabbXZ } from '../world/collisionXZ.ts'
import { MANSION_WALL_COLLIDERS } from '../world/mansionWalls.ts'

const SCONCE_Y = 1.42
const SURFACE_OFFSET = 0.07
const MIN_WALL_LEN = 1.35
const MAX_THICK = 2.75
/** Interior / wing partitions — fewer per length so hub doesn’t outshine the rim. */
const SCONCE_SPACING_INTERIOR = 4.6
const MAX_SCONCES_PER_INTERIOR_SEGMENT = 2
/** Outer mansion shell (thin slabs hugging the map edge) — denser. */
const SCONCE_SPACING_PERIMETER = 2.95
const MAX_SCONCES_PER_PERIMETER_SEGMENT = 6
const MAX_TOTAL_SCONCES = 100

/** World scale vs first version (~1.2×). */
const S = 1.2

function createSconceUnit(): Group {
  const root = new Group()
  root.name = 'wallSconce'

  const brass = new MeshStandardMaterial({
    color: new Color(0x6a5248),
    emissive: new Color(0x1a1410),
    emissiveIntensity: 0.12,
    roughness: 0.55,
    metalness: 0.35,
  })
  const backplate = new Mesh(
    new BoxGeometry(0.14 * S, 0.34 * S, 0.06 * S),
    brass,
  )
  backplate.castShadow = true
  root.add(backplate)

  const arm = new Mesh(
    new CylinderGeometry(0.035 * S, 0.04 * S, 0.12 * S, 8),
    brass,
  )
  arm.rotation.x = Math.PI / 2
  arm.position.set(0, 0.02 * S, 0.08 * S)
  root.add(arm)

  const flameMat = new MeshStandardMaterial({
    color: new Color(0xffe8c8),
    emissive: new Color(0xffa040),
    emissiveIntensity: 1.15,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.96,
  })
  const flame = new Mesh(new SphereGeometry(0.07 * S, 10, 8), flameMat)
  flame.position.set(0, 0.06 * S, 0.16 * S)
  flame.scale.set(1, 1.15, 0.85)
  root.add(flame)

  const light = new PointLight(0xffcc90, 0.58, 10, 1.85)
  light.position.set(0, 0.06 * S, 0.22 * S)
  root.add(light)

  return root
}

function isThinAlongX(sx: number, sz: number): boolean {
  return sx <= sz
}

type WallMetrics = {
  sx: number
  sz: number
  len: number
  thick: number
  isPerimeter: boolean
}

function wallMetrics(b: AabbXZ): WallMetrics {
  const sx = b.maxX - b.minX
  const sz = b.maxZ - b.minZ
  const len = Math.max(sx, sz)
  const thick = Math.min(sx, sz)
  const cx = (b.minX + b.maxX) * 0.5
  const cz = (b.minZ + b.maxZ) * 0.5
  const edge = Math.max(Math.abs(cx), Math.abs(cz))
  /** Thin strip hugging the outer bounds (matches perimeter wall colliders). */
  const isPerimeter =
    len >= 6 &&
    thick <= 0.52 &&
    edge >= 14.5
  return { sx, sz, len, thick, isPerimeter }
}

/**
 * Perimeter segments first (so they get light budget), then longest walls.
 */
function sortedWallBoxes(): AabbXZ[] {
  return [...MANSION_WALL_COLLIDERS].sort((a, b) => {
    const ma = wallMetrics(a)
    const mb = wallMetrics(b)
    if (ma.isPerimeter !== mb.isPerimeter) {
      return ma.isPerimeter ? -1 : 1
    }
    return mb.len - ma.len
  })
}

/**
 * Places warm wall sconces — **denser on the outer shell**, sparser on internal partitions
 * (no double-sided placement, so rooms don’t read as busier than the façade).
 */
export function addWallSconces(parent: Group): void {
  const sconceRoot = new Group()
  sconceRoot.name = 'wallSconces'

  let placed = 0

  for (const b of sortedWallBoxes()) {
    if (placed >= MAX_TOTAL_SCONCES) break

    const m = wallMetrics(b)
    const { sx, sz, len, thick, isPerimeter } = m
    if (len < MIN_WALL_LEN || thick > MAX_THICK) continue

    const spacing = isPerimeter
      ? SCONCE_SPACING_PERIMETER
      : SCONCE_SPACING_INTERIOR
    const maxSeg = isPerimeter
      ? MAX_SCONCES_PER_PERIMETER_SEGMENT
      : MAX_SCONCES_PER_INTERIOR_SEGMENT

    const nAlong = len / spacing
    const count = Math.min(maxSeg, Math.max(1, Math.ceil(nAlong)))

    const thinX = isThinAlongX(sx, sz)

    for (let i = 0; i < count; i++) {
      if (placed >= MAX_TOTAL_SCONCES) break
      const u = count === 1 ? 0.5 : (i + 1) / (count + 1)

      let px: number
      let pz: number

      if (thinX) {
        const useMinX = Math.abs(b.minX) < Math.abs(b.maxX)
        px = useMinX ? b.minX + SURFACE_OFFSET : b.maxX - SURFACE_OFFSET
        pz = b.minZ + u * (b.maxZ - b.minZ)
      } else {
        const useMinZ = Math.abs(b.minZ) < Math.abs(b.maxZ)
        pz = useMinZ ? b.minZ + SURFACE_OFFSET : b.maxZ - SURFACE_OFFSET
        px = b.minX + u * (b.maxX - b.minX)
      }

      const sconce = createSconceUnit()
      sconce.position.set(px, SCONCE_Y, pz)

      const toHub = Math.hypot(px, pz)
      const ix = toHub > 0.08 ? -px / toHub : 0
      const iz = toHub > 0.08 ? -pz / toHub : 1
      sconce.rotation.y = Math.atan2(ix, iz)

      sconceRoot.add(sconce)
      placed++
    }
  }

  parent.add(sconceRoot)
}
