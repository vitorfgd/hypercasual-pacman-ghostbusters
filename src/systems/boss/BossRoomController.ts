import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import type { GhostSystem } from '../ghost/GhostSystem.ts'
import {
  GHOST_COLLISION_RADIUS,
  ghostRoomVisualMul,
  maxActiveGhostsForRoomProgress,
  type GhostSpawnSpec,
} from '../ghost/ghostConfig.ts'
import {
  BOSS_COLOR_HEX,
  BOSS_ENTRANCE_DOOR_INDEX,
  getBossSpawnXZ,
  BOSS_MINION_CAP,
  BOSS_MINION_COLOR_HEX,
  BOSS_MINION_INTERVAL_SEC,
  BOSS_MINION_VISUAL_MUL,
  BOSS_PULSE_INTERVAL_SEC,
  BOSS_SURVIVE_SEC,
} from './bossRoomConfig.ts'
import {
  FINAL_NORMAL_ROOM_ID,
  NORMAL_ROOM_COUNT,
  ROOMS,
  type RoomId,
} from '../world/mansionRoomData.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'

export type BossRoomControllerOptions = {
  doorUnlock: DoorUnlockSystem
  ghostSystem: GhostSystem
  worldCollision: WorldCollision
  random: () => number
  onPulsePlayer: (bossX: number, bossZ: number) => void
  onVictory: () => void
}

/**
 * Final room: seal entrance, spawn boss, survive timer + pulses + minions.
 */
export class BossRoomController {
  private readonly doorUnlock: DoorUnlockSystem
  private readonly ghostSystem: GhostSystem
  private readonly worldCollision: WorldCollision
  private readonly random: () => number
  private readonly onPulsePlayer: BossRoomControllerOptions['onPulsePlayer']
  private readonly onVictory: () => void

  private phase: 'idle' | 'fighting' | 'won' = 'idle'
  private fightElapsed = 0
  private pulseTimer = 0
  private minionTimer = 0

  constructor(opts: BossRoomControllerOptions) {
    this.doorUnlock = opts.doorUnlock
    this.ghostSystem = opts.ghostSystem
    this.worldCollision = opts.worldCollision
    this.random = opts.random
    this.onPulsePlayer = opts.onPulsePlayer
    this.onVictory = opts.onVictory
  }

  isFightActive(): boolean {
    return this.phase === 'fighting'
  }

  isIdle(): boolean {
    return this.phase === 'idle'
  }

  getBossHudPercent(): number {
    if (this.phase !== 'fighting') return 0
    return Math.min(100, (100 * this.fightElapsed) / BOSS_SURVIVE_SEC)
  }

  getBossHudLabel(): string {
    return 'Survive'
  }

  update(dt: number, _roomId: RoomId | null): void {
    if (this.phase === 'won') return

    if (this.phase !== 'fighting') return

    this.fightElapsed += dt
    if (this.fightElapsed >= BOSS_SURVIVE_SEC) {
      this.phase = 'won'
      this.onVictory()
      return
    }

    this.pulseTimer += dt
    if (this.pulseTimer >= BOSS_PULSE_INTERVAL_SEC) {
      this.pulseTimer -= BOSS_PULSE_INTERVAL_SEC
      const p = this.ghostSystem.getBossGhostXZ()
      if (p) this.onPulsePlayer(p.x, p.z)
    }

    this.minionTimer += dt
    if (this.minionTimer >= BOSS_MINION_INTERVAL_SEC) {
      this.minionTimer -= BOSS_MINION_INTERVAL_SEC
      this.trySpawnMinion()
    }
  }

  /**
   * Called after intro cinematic — seals room and spawns the boss.
   */
  startFight(): void {
    if (this.phase !== 'idle') return
    this.phase = 'fighting'
    this.fightElapsed = 0
    this.pulseTimer = BOSS_PULSE_INTERVAL_SEC * 0.35
    this.minionTimer = BOSS_MINION_INTERVAL_SEC * 0.4

    this.doorUnlock.setBossDoorTrap(BOSS_ENTRANCE_DOOR_INDEX, true)

    const { x: cx, z: cz } = getBossSpawnXZ()
    const spec: GhostSpawnSpec = {
      x: cx,
      z: cz,
      color: BOSS_COLOR_HEX,
      roomIndex: NORMAL_ROOM_COUNT,
      role: 'boss',
    }
    this.ghostSystem.spawnGhost(spec)
  }

  private trySpawnMinion(): void {
    if (
      this.ghostSystem.getActiveGhostCount() >=
      maxActiveGhostsForRoomProgress(NORMAL_ROOM_COUNT)
    ) {
      return
    }
    if (
      this.ghostSystem.countMinionGhostsInRoom(NORMAL_ROOM_COUNT) >=
      BOSS_MINION_CAP
    ) {
      return
    }
    const b = ROOMS[FINAL_NORMAL_ROOM_ID].bounds
    const inset = 0.95
    const rx =
      b.minX +
      inset +
      this.random() * Math.max(0.15, b.maxX - b.minX - 2 * inset)
    const rz =
      b.minZ +
      inset +
      this.random() * Math.max(0.15, b.maxZ - b.minZ - 2 * inset)
    const r =
      GHOST_COLLISION_RADIUS *
      ghostRoomVisualMul(NORMAL_ROOM_COUNT) *
      BOSS_MINION_VISUAL_MUL
    const placed = this.worldCollision.resolveCircleXZ(rx, rz, r)
    this.ghostSystem.spawnGhost({
      x: placed.x,
      z: placed.z,
      color: BOSS_MINION_COLOR_HEX,
      roomIndex: NORMAL_ROOM_COUNT,
      role: 'minion',
    })
  }
}
