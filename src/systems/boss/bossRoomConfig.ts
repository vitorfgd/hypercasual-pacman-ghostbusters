import {
  FINAL_NORMAL_ROOM_ID,
  NORMAL_ROOM_COUNT,
  ROOMS,
} from '../world/mansionRoomData.ts'

/** Door plane between ROOM_{N-1} and the final room (player sealed in during boss). */
export const BOSS_ENTRANCE_DOOR_INDEX = NORMAL_ROOM_COUNT - 1

/** Boss spawn / intro camera focus (matches `BossRoomController.startFight`). */
export function getBossSpawnXZ(): { x: number; z: number } {
  const b = ROOMS[FINAL_NORMAL_ROOM_ID].bounds
  return {
    x: (b.minX + b.maxX) * 0.5,
    z: (b.minZ + b.maxZ) * 0.5 + 1.05,
  }
}

export const BOSS_SURVIVE_SEC = 40

export const BOSS_PULSE_INTERVAL_SEC = 8
export const BOSS_MINION_INTERVAL_SEC = 12
export const BOSS_MINION_CAP = 4

export const BOSS_COLOR_HEX = 0x9933ff
export const BOSS_MINION_COLOR_HEX = 0xff5599

/** Slow approach — still threatening in a small room. */
export const BOSS_SEEK_SPEED = 2.11

export const BOSS_EXTRA_VISUAL_MUL = 1.68
export const BOSS_MINION_VISUAL_MUL = 0.5

/** `applyGhostKnockback` strength scale (1 = normal hit). */
export const BOSS_PULSE_KNOCK_STRENGTH = 1.08

/** Intro: pull back & blend look toward boss (reuses gate cinematic pattern). */
export const BOSS_CINE_ZOOM_SEC = 0.36
/** Hold on boss while sim runs slower. */
export const BOSS_CINE_SLOW_SEC = 0.52
export const BOSS_CINE_SLOW_SIM_SCALE = 0.5
/** Return to follow camera. */
export const BOSS_CINE_RETURN_SEC = 0.44

/** After victory: let ghosts fade / reward text read before summary overlay. */
export const BOSS_VICTORY_OUTRO_SEC = 1.05
