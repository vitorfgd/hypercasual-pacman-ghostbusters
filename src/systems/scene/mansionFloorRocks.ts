import {
  DodecahedronGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import {
  CORRIDOR_BOUNDS,
  ROOMS,
  type RoomBounds,
  type RoomId,
} from '../world/mansionRoomData.ts'

const ROCK_GEO = new DodecahedronGeometry(1, 0)

const rockMat = new MeshStandardMaterial({
  color: 0x5c5a6a,
  emissive: 0x222838,
  emissiveIntensity: 0.07,
  roughness: 0.93,
  metalness: 0.1,
})

const ROOM_IDS: RoomId[] = [
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

/** Keep rocks out of the central deposit / upgrade hub disc. */
const DEPOSIT_CLEAR_R = 2.35

const EDGE_INSET = 0.5
const MAX_ROCKS = 156
const PLACE_TRIES = 860

function boundsList(): RoomBounds[] {
  const out: RoomBounds[] = []
  for (const id of ROOM_IDS) {
    out.push(ROOMS[id].bounds)
  }
  out.push(...CORRIDOR_BOUNDS)
  return out
}

/**
 * Small scattered rocks on floors/corridors for ground texture.
 */
export function addMansionFloorRocks(parent: Group): void {
  const pools = boundsList()
  const positions: { x: number; y: number; z: number }[] = []
  const rotations: { x: number; y: number; z: number }[] = []
  const scales: number[] = []
  let placed = 0
  for (let t = 0; t < PLACE_TRIES && placed < MAX_ROCKS; t++) {
    const b = pools[Math.floor(Math.random() * pools.length)]!
    const minX = b.minX + EDGE_INSET
    const maxX = b.maxX - EDGE_INSET
    const minZ = b.minZ + EDGE_INSET
    const maxZ = b.maxZ - EDGE_INSET
    if (minX >= maxX || minZ >= maxZ) continue
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)
    if (Math.hypot(x, z) < DEPOSIT_CLEAR_R) continue

    const s = 0.1 + Math.random() * 0.2
    positions.push({ x, y: s * 0.38, z })
    scales.push(s)
    rotations.push({
      x: Math.random() * Math.PI * 2,
      y: Math.random() * Math.PI * 2,
      z: Math.random() * Math.PI * 2,
    })
    placed += 1
  }

  if (placed === 0) return
  const inst = new InstancedMesh(ROCK_GEO, rockMat, placed)
  inst.name = 'floorRockInstanced'
  inst.castShadow = false
  inst.receiveShadow = false

  const m = new Matrix4()
  const pos = new Vector3()
  const quat = new Quaternion()
  const scl = new Vector3()
  const euler = new Euler()
  for (let i = 0; i < placed; i++) {
    const p = positions[i]!
    const r = rotations[i]!
    const s = scales[i]!
    pos.set(p.x, p.y, p.z)
    euler.set(r.x, r.y, r.z, 'XYZ')
    quat.setFromEuler(euler)
    scl.setScalar(s)
    m.compose(pos, quat, scl)
    inst.setMatrixAt(i, m)
  }
  inst.instanceMatrix.needsUpdate = true
  parent.add(inst)
}
