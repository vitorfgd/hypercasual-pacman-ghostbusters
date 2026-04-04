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
const COVER_OPACITY_EPS = 1e-4

/** Ease-in cubic: slow at first — room stays dark longer, then brightens for a gradual reveal. */
function easeInCubic(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u * u
}

/**
 * Blackout opacity 1→0 tracks full door-open sequence time (not raw swing), so the fade
 * begins when the door starts opening and eases in slowly.
 */
function coverOpacityFromRevealProgress(reveal01: number): number {
  const u = Math.max(0, Math.min(1, reveal01))
  return 1 - easeInCubic(u)
}

/**
 * Black box shell per room (floor→ceiling, padded XZ) so interiors stay hidden until the
 * matching door swing reveals them.
 */
export class RoomLockCoverSystem {
  private readonly root = new Group()
  private readonly meshes = new Map<RoomId, Mesh>()
  private readonly lastOpacity = new Map<RoomId, number>()
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

      // Must use transparent: true from frame 0 — with opaque materials Three.js ignores
      // opacity, so the fade would snap from solid black the first frame opacity < 1 applies.
      const mat = new MeshBasicMaterial({
        // Dark purple (temporary — was 0x000000 black) for fade testing visibility
        color: 0x000000,
        transparent: true,
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
      const reveal = this.doorUnlock.getDoorRevealProgress01(doorIndex)

      const op = coverOpacityFromRevealProgress(reveal)
      const prevOp = this.lastOpacity.get(roomId)
      if (prevOp !== undefined && Math.abs(prevOp - op) <= COVER_OPACITY_EPS) {
        continue
      }
      this.lastOpacity.set(roomId, op)
      const mat = mesh.material as MeshBasicMaterial
      mat.opacity = op
      mat.depthWrite = op > 0.02
      mesh.visible = op > 1e-6
    }
  }

  /**
   * Temporarily hides all room blackout covers so off-screen compile passes can see the real room contents.
   */
  withAllCoversHidden<T>(work: () => T): T {
    const prevVisible = new Map<Mesh, boolean>()
    for (const mesh of this.meshes.values()) {
      prevVisible.set(mesh, mesh.visible)
      mesh.visible = false
    }
    try {
      return work()
    } finally {
      for (const [mesh, visible] of prevVisible) {
        mesh.visible = visible
      }
    }
  }

  async withAllCoversHiddenAsync<T>(work: () => Promise<T>): Promise<T> {
    const prevVisible = new Map<Mesh, boolean>()
    for (const mesh of this.meshes.values()) {
      prevVisible.set(mesh, mesh.visible)
      mesh.visible = false
    }
    try {
      return await work()
    } finally {
      for (const [mesh, visible] of prevVisible) {
        mesh.visible = visible
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent()
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose()
      ;(mesh.material as MeshBasicMaterial).dispose()
    }
    this.meshes.clear()
    this.lastOpacity.clear()
  }
}
