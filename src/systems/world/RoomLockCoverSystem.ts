import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import type { Scene } from 'three'
import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import {
  GATE_ANTICIPATION_SEC,
  GATE_OPEN_DELAY_SEC,
  GATE_SINK_DURATION_SEC,
} from '../doors/doorUnlockConfig.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import { ROOMS, type RoomId } from './mansionRoomData.ts'
import type { RoomSystem } from './RoomSystem.ts'
import {
  ROOM_LOCK_COVER_FADE_DELAY_SEC,
  ROOM_LOCK_COVER_FLOOR_Y,
  ROOM_LOCK_COVER_HEIGHT,
  ROOM_LOCK_COVER_HORIZONTAL_PAD,
} from './roomLockCoverConfig.ts'

const COVER_ROOMS: RoomId[] = ['ROOM_2', 'ROOM_3', 'ROOM_4', 'ROOM_5']

/** Same as gate sink start in `DoorUnlockSystem.applyGatePose` — not duplicated animation, only timing sync. */
const GATE_SINK_T0 = GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC

/** Subtle ease for opacity (smoothstep). */
function easeOpacityFade(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/**
 * Opacity 1→0 over the sink window: optional delay at sink start, then fade in the remaining time
 * so at `sub === GATE_SINK_DURATION_SEC` opacity is 0 (matches gate fully down).
 */
function coverOpacityFromOpeningElapsed(openingElapsed: number): number {
  const sub = openingElapsed - GATE_SINK_T0
  if (sub <= 0) return 1
  if (sub >= GATE_SINK_DURATION_SEC) return 0

  const d = Math.min(ROOM_LOCK_COVER_FADE_DELAY_SEC, GATE_SINK_DURATION_SEC * 0.35)
  if (sub < d) return 1

  const fadeDur = GATE_SINK_DURATION_SEC - d
  const u = Math.min(1, (sub - d) / fadeDur)
  return 1 - easeOpacityFade(u)
}

/**
 * Black box shell per locked room (floor→ceiling, padded XZ) so interiors stay hidden from every angle;
 * opacity syncs with gate **sink** only (no gate code changes).
 */
export class RoomLockCoverSystem {
  private readonly root = new Group()
  private readonly meshes = new Map<RoomId, Mesh>()
  private readonly roomSystem: RoomSystem
  private readonly doorUnlock: DoorUnlockSystem

  constructor(scene: Scene, roomSystem: RoomSystem, doorUnlock: DoorUnlockSystem) {
    this.roomSystem = roomSystem
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

      const mat = new MeshBasicMaterial({
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
      if (this.roomSystem.isRoomAccessibleForGameplay(roomId)) {
        mesh.visible = false
        continue
      }

      mesh.visible = true
      const idx = roomIndexFromId(roomId)
      if (idx === null || idx < 2) continue

      const doorIndex = idx - 1
      const el = this.doorUnlock.getDoorOpeningElapsed(doorIndex)
      const mat = mesh.material as MeshBasicMaterial

      if (el === null) {
        mat.opacity = 1
        continue
      }

      mat.opacity = coverOpacityFromOpeningElapsed(el)
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
