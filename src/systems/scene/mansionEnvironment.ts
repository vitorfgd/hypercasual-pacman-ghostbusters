import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import { MANSION_WALL_COLLIDERS } from '../world/mansionWalls.ts'
import { addWallSconces } from './mansionSconces.ts'
import { MANSION_WORLD_HALF } from '../world/mansionGeometry.ts'
import { CORRIDOR_BOUNDS, ROOMS, type RoomId } from '../world/mansionRoomData.ts'
import { addMansionFloorRocks } from './mansionFloorRocks.ts'

const WALL_HEIGHT = 2.35
const WALL_Y = WALL_HEIGHT * 0.5

function makeFloorMat(opts: {
  color: number
  emissive: number
  emissiveIntensity: number
  roughness: number
}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: opts.color,
    emissive: opts.emissive,
    emissiveIntensity: opts.emissiveIntensity,
    roughness: opts.roughness,
    metalness: 0.06,
  })
}

/** Unified wood/stone tone — matches corridors and void tint. */
const FLOOR_COLOR = 0x2a2e44
const floorMat = makeFloorMat({
  color: FLOOR_COLOR,
  emissive: 0x1c2230,
  emissiveIntensity: 0.28,
  roughness: 0.86,
})

/** Walls: cooler + lighter than floor so verticals read clearly vs boards. */
const wallMat = new MeshStandardMaterial({
  color: 0x565068,
  emissive: 0x242a3c,
  emissiveIntensity: 0.13,
  roughness: 0.9,
  metalness: 0.05,
})

function addCorridorFloors(parent: Group, mat: MeshStandardMaterial, y: number): void {
  for (const b of CORRIDOR_BOUNDS) {
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const cx = (b.minX + b.maxX) * 0.5
    const cz = (b.minZ + b.maxZ) * 0.5
    const mesh = new Mesh(new PlaneGeometry(w, d), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(cx, y, cz)
    mesh.receiveShadow = true
    mesh.name = 'floor_corridor'
    parent.add(mesh)
  }
}

function addRoomFloor(parent: Group, id: RoomId, y: number): void {
  const def = ROOMS[id]
  const b = def.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) * 0.5
  const cz = (b.minZ + b.maxZ) * 0.5
  const mat = floorMat
  const mesh = new Mesh(new PlaneGeometry(w, d), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(cx, y, cz)
  mesh.receiveShadow = true
  mesh.name = `floor_${id}`
  parent.add(mesh)
}

function addWallMeshes(parent: Group): void {
  for (const b of MANSION_WALL_COLLIDERS) {
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    if (w < 0.02 && d < 0.02) continue
    const cx = (b.minX + b.maxX) * 0.5
    const cz = (b.minZ + b.maxZ) * 0.5
    const mesh = new Mesh(new BoxGeometry(w, WALL_HEIGHT, d), wallMat)
    mesh.position.set(cx, WALL_Y, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'mansionWall'
    parent.add(mesh)
  }
}

/** Soft edge bands — same family as floor. */
function addEdgeVignette(parent: Group): void {
  const edge = new MeshStandardMaterial({
    color: 0x1e252e,
    emissive: 0x121a24,
    emissiveIntensity: 0.09,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.58,
  })
  const H = MANSION_WORLD_HALF
  const span = H * 2 + 2
  const band = 2.2
  const y = 0.014
  const z0 = H + band * 0.5
  const x0 = H + band * 0.5

  const n = new Mesh(new PlaneGeometry(span, band), edge.clone())
  n.rotation.x = -Math.PI / 2
  n.position.set(0, y, z0)
  n.receiveShadow = true
  parent.add(n)

  const s = new Mesh(new PlaneGeometry(span, band), edge.clone())
  s.rotation.x = -Math.PI / 2
  s.position.set(0, y, -z0)
  s.receiveShadow = true
  parent.add(s)

  const e = new Mesh(new PlaneGeometry(band, span), edge.clone())
  e.rotation.x = -Math.PI / 2
  e.position.set(x0, y, 0)
  e.receiveShadow = true
  parent.add(e)

  const w = new Mesh(new PlaneGeometry(band, span), edge.clone())
  w.rotation.x = -Math.PI / 2
  w.position.set(-x0, y, 0)
  w.receiveShadow = true
  parent.add(w)
}

const ROOM_ORDER: RoomId[] = [
  'SAFE_CENTER',
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'NORTHWEST',
  'NORTHEAST',
  'SOUTHWEST',
  'SOUTHEAST',
]

/**
 * Mansion floor (one mesh per room; unified floor material) + wall meshes aligned with `MANSION_WALL_COLLIDERS`.
 */
export function createMansionGround(): Group {
  const root = new Group()
  root.name = 'mansionGround'

  addCorridorFloors(root, floorMat, -0.0006)

  let y = 0
  for (const id of ROOM_ORDER) {
    addRoomFloor(root, id, y)
    y += 0.0004
  }

  addWallMeshes(root)
  addWallSconces(root)
  addMansionFloorRocks(root)
  addEdgeVignette(root)

  return root
}

/** Playable half-extent (for any legacy callers). */
export const MANSION_MAP_HALF_X = MANSION_WORLD_HALF
export const MANSION_MAP_HALF_Z = MANSION_WORLD_HALF
