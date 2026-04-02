import type { RoomSystem } from '../RoomSystem.ts'
import type { RoomId } from '../mansionRoomData.ts'
import { createRelicItem, createWispItem } from '../../../themes/wisp/itemFactory.ts'
import type { ItemWorld } from '../../items/ItemWorld.ts'

export type RoomObjectiveType = 'COLLECT' | 'SURVIVE' | 'ACTIVATE'

type Zone = { x: number; z: number; r: number; hit: boolean }

export type RoomObjectiveState = {
  roomId: RoomId
  objectiveType: RoomObjectiveType
  progress: number
  target: number
  isCompleted: boolean
  zones?: Zone[]
  surviveAccum?: number
}

export type RoomObjectiveHud = {
  visible: boolean
  line: string
}

/**
 * Per-room mini goals; rolled once when the player first enters a normal room.
 */
export class RoomObjectiveRuntime {
  private readonly roomSystem: RoomSystem
  private readonly random: () => number
  private readonly byRoom = new Map<RoomId, RoomObjectiveState>()
  private readonly completedRooms = new Set<RoomId>()
  private lastHud: RoomObjectiveHud = { visible: false, line: '' }

  constructor(
    roomSystem: RoomSystem,
    random: () => number = Math.random,
  ) {
    this.roomSystem = roomSystem
    this.random = random
  }

  getHud(): RoomObjectiveHud {
    return this.lastHud
  }

  private rollObjective(roomId: RoomId): RoomObjectiveState {
    const r = this.random()
    let objectiveType: RoomObjectiveType
    if (r < 0.36) objectiveType = 'COLLECT'
    else if (r < 0.68) objectiveType = 'SURVIVE'
    else objectiveType = 'ACTIVATE'

    if (objectiveType === 'COLLECT') {
      return {
        roomId,
        objectiveType,
        progress: 0,
        target: 3 + Math.floor(this.random() * 5),
        isCompleted: false,
      }
    }
    if (objectiveType === 'SURVIVE') {
      return {
        roomId,
        objectiveType,
        progress: 0,
        target: 5 + Math.floor(this.random() * 4),
        isCompleted: false,
        surviveAccum: 0,
      }
    }
    const nZones = 2 + Math.floor(this.random() * 2)
    const b = this.roomSystem.getBounds(roomId)
    const pad = 1.0
    const zones: Zone[] = []
    for (let i = 0; i < nZones; i++) {
      zones.push({
        x: b.minX + pad + this.random() * (b.maxX - b.minX - pad * 2),
        z: b.minZ + pad + this.random() * (b.maxZ - b.minZ - pad * 2),
        r: 0.65 + this.random() * 0.35,
        hit: false,
      })
    }
    return {
      roomId,
      objectiveType,
      progress: 0,
      target: nZones,
      isCompleted: false,
      zones,
    }
  }

  private ensure(roomId: RoomId | null): void {
    if (!roomId || roomId === 'SAFE_CENTER') return
    if (this.completedRooms.has(roomId)) return
    if (this.byRoom.has(roomId)) return
    this.byRoom.set(roomId, this.rollObjective(roomId))
  }

  private hudLine(s: RoomObjectiveState): string {
    if (s.objectiveType === 'COLLECT') return `Collect ${s.target} wisps`
    if (s.objectiveType === 'SURVIVE') return `Survive ${s.target}s`
    return `Activate ${s.target} zones`
  }

  /**
   * Call after room resolution each frame.
   */
  update(
    dt: number,
    playerX: number,
    playerZ: number,
    currentRoom: RoomId | null,
    onComplete: (roomId: RoomId, line: string) => void,
  ): void {
    this.ensure(currentRoom)

    if (!currentRoom || currentRoom === 'SAFE_CENTER') {
      this.lastHud = { visible: false, line: '' }
      return
    }

    const st = this.byRoom.get(currentRoom)
    if (!st || st.isCompleted || this.completedRooms.has(currentRoom)) {
      this.lastHud = { visible: false, line: '' }
      return
    }

    this.lastHud = { visible: true, line: this.hudLine(st) }

    if (st.objectiveType === 'SURVIVE') {
      const inside = this.roomSystem.pointInRoomBounds(
        currentRoom,
        playerX,
        playerZ,
      )
      if (inside) {
        st.surviveAccum = (st.surviveAccum ?? 0) + dt
        if (st.surviveAccum >= st.target) {
          this.finish(st, onComplete)
        }
      } else {
        st.surviveAccum = 0
      }
    }

    if (st.objectiveType === 'ACTIVATE' && st.zones) {
      let hits = 0
      for (const z of st.zones) {
        const dx = playerX - z.x
        const dz = playerZ - z.z
        if (dx * dx + dz * dz <= z.r * z.r) z.hit = true
        if (z.hit) hits++
      }
      st.progress = hits
      if (hits >= st.target) this.finish(st, onComplete)
    }
  }

  /** When a wisp is picked up, if player is in a COLLECT room, add progress. */
  onWispCollected(
    playerX: number,
    playerZ: number,
    onComplete: (roomId: RoomId, line: string) => void,
  ): void {
    const room = this.roomSystem.getRoomAt(playerX, playerZ)
    if (!room || room === 'SAFE_CENTER') return
    const st = this.byRoom.get(room)
    if (!st || st.isCompleted || st.objectiveType !== 'COLLECT') return
    st.progress += 1
    if (st.progress >= st.target) this.finish(st, onComplete)
  }

  private finish(
    st: RoomObjectiveState,
    onComplete: (roomId: RoomId, line: string) => void,
  ): void {
    if (st.isCompleted) return
    st.isCompleted = true
    this.completedRooms.add(st.roomId)
    const line = this.hudLine(st)
    const rid = st.roomId
    this.byRoom.delete(st.roomId)
    onComplete(rid, line)
  }

  spawnRewardBurst(
    roomId: RoomId,
    itemWorld: ItemWorld,
    random: () => number,
  ): void {
    const c = this.roomSystem.roomCenter(roomId)
    const relicRoll = random() < 0.12
    if (relicRoll) {
      itemWorld.spawn(createRelicItem(), c.x + (random() - 0.5) * 1.2, c.z + (random() - 0.5) * 1.2)
      return
    }
    const n = 2 + Math.floor(random() * 4)
    for (let i = 0; i < n; i++) {
      const w = createWispItem(0.42 + random() * 0.12, 4 + Math.floor(random() * 10))
      const a = random() * Math.PI * 2
      const d = random() * 1.8
      itemWorld.spawn(w, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d)
    }
  }
}
