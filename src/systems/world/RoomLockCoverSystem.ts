import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import type { Scene } from 'three'
import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import { NORMAL_ROOM_IDS, ROOMS, type RoomId } from './mansionRoomData.ts'
import {
  ROOM_LOCK_COVER_FLOOR_Y,
  ROOM_LOCK_COVER_HEIGHT,
  ROOM_LOCK_COVER_HORIZONTAL_PAD,
} from './roomLockCoverConfig.ts'

/** Every normal room stays blacked out until the previous double door swings open. */
const COVER_ROOMS: RoomId[] = [...NORMAL_ROOM_IDS]

/** Subtle ease for opacity (smoothstep). */
function easeOpacityFade(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/** Blackout fades 1→0 as the revealing door swings 0→1 (see `DoorUnlockSystem.getDoorSwingOpen01`). */
function coverOpacityFromDoorSwing(swing01: number): number {
  const u = Math.max(0, Math.min(1, swing01))
  return 1 - easeOpacityFade(u)
}

/**
 * Black box shell per room (floor→ceiling, padded XZ) so interiors stay hidden until the
 * matching door swing reveals them.
 */
export class RoomLockCoverSystem {
  private readonly root = new Group()
  private readonly meshes = new Map<RoomId, Mesh>()
  private readonly doorUnlock: DoorUnlockSystem

  constructor(scene: Scene, doorUnlock: DoorUnlockSystem) {
    this.doorUnlock = doorUnlock
    this.root.name = 'roomLockCovers'
    scene.add(this.root)

    const pad = ROOM_LOCK_COVER_HORIZONTAL_PAD
    const H = ROOM_LOCK_COVER_HEIGHT
    const floorY = ROOM_LOCK_COVER_FLOOR_Y

    for (const roomId of COVER_ROOMS) {
      const b = ROOMS[roomId].bounds
      const w = b.maxX - b.minX + pad * 2
      const d = b.maxZ - b.minZ + pad * 2
      const cx = (b.minX + b.maxX) * 0.5
      const cz = (b.minZ + b.maxZ) * 0.5

      // `transparent: true` with full opacity still uses the transparent render queue and
      // can sort after opaque geometry (doors), painting black over door faces. Only enable
      // transparency while the shell is actually fading.
      const mat = new MeshBasicMaterial({
        color: 0x000000,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
      })
      const mesh = new Mesh(new BoxGeometry(w, H, d), mat)
      mesh.position.set(cx, floorY + H * 0.5, cz)
      mesh.renderOrder = 18
      mesh.name = `roomLockCover:${roomId}`
      mesh.frustumCulled = true
      this.root.add(mesh)
      this.meshes.set(roomId, mesh)
    }
  }

  /** Call each frame after `DoorUnlockSystem.update`. */
  update(): void {
    for (const [roomId, mesh] of this.meshes) {
      const idx = roomIndexFromId(roomId)
      if (idx === null || idx < 1) continue

      const doorIndex = idx - 1
      const swing = this.doorUnlock.getDoorSwingOpen01(doorIndex)
      const mat = mesh.material as MeshBasicMaterial

      const op = coverOpacityFromDoorSwing(swing)
      mat.opacity = op
      mat.transparent = op < 0.999
      mesh.visible = op > 0.004
    }
  }

  dispose(): void {
    this.root.removeFromParent()
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose()
      ;(mesh.material as MeshBasicMaterial).dispose()
    }
    this.meshes.clear()
  }
}
