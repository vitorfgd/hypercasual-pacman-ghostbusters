/**
 * Player cell navigation: cardinal moves between cell centers, buffered turns, multi-step per frame.
 *
 * **Two bounds sources (critical):**
 * - **Nav / sticky bounds** — only for classifying the avatar’s *current* cell (matches logical
 *   row/col when physics overlaps a door strip). Passed in as `bounds` from the game loop.
 * - **Raw bounds** — `getRawGridBoundsAt` for neighbor probes and segment completion. Must be
 *   plain geometry (`RoomSystem.getGridBoundsAt`). Using sticky bounds on probes breaks door
 *   crossing: probes near the door stay “room-classified” and `resolveNeighbor` never finds a
 *   corridor/room transition.
 */
import type { RoomBounds } from '../world/mansionRoomData.ts'
import {
  GRID_ROOM_INSET,
  ROOM_GRID_COLS,
  ROOM_GRID_ROWS,
} from '../grid/gridConfig.ts'
import {
  cellCenterWorld,
  worldToCellIndex,
  boundsKey,
} from '../grid/roomGridGeometry.ts'
import type { PlayerNavDebugSnapshot } from './playerNavDebug.ts'

const ROWS = ROOM_GRID_ROWS
const COLS = ROOM_GRID_COLS

const ARRIVE_T_EPS = 1e-4
const PLAYER_GRID_HARD_RESYNC_DISTANCE = 1.75

/** Ignore stick noise below this magnitude (0–1). */
export const PLAYER_GRID_INPUT_DEADZONE = 0.22

function resolveNeighborDestination(
  activeBounds: RoomBounds,
  atRow: number,
  atCol: number,
  dr: number,
  dc: number,
  getRawGridBoundsAt: (x: number, z: number) => RoomBounds,
): { c0: { x: number; z: number }; c1: { x: number; z: number } } | null {
  const c0 = cellCenterWorld(activeBounds, atRow, atCol, ROWS, COLS)
  const startKey = boundsKey(activeBounds)

  const nr = atRow + dr
  const nc = atCol + dc

  // Standard same-region move.
  if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
    const c1 = cellCenterWorld(activeBounds, nr, nc, ROWS, COLS)
    if (Math.hypot(c1.x - c0.x, c1.z - c0.z) >= 1e-4) {
      return { c0, c1 }
    }
  }

  const spanX = activeBounds.maxX - activeBounds.minX - 2 * GRID_ROOM_INSET
  const spanZ = activeBounds.maxZ - activeBounds.minZ - 2 * GRID_ROOM_INSET
  const stepX = spanX / COLS
  const stepZ = spanZ / ROWS

  // Smaller increments make door / threshold crossing more stable.
  for (let k = 1; k <= 96; k++) {
    const mul = k * 0.5
    const probeX = c0.x + dc * stepX * mul
    const probeZ = c0.z + dr * stepZ * mul
    const b1 = getRawGridBoundsAt(probeX, probeZ)
    const idx = worldToCellIndex(b1, probeX, probeZ, ROWS, COLS)
    const c1 = cellCenterWorld(b1, idx.row, idx.col, ROWS, COLS)
    const changedRegion = boundsKey(b1) !== startKey
    const changedCell =
      changedRegion || idx.row !== atRow || idx.col !== atCol

    if (!changedCell) {
      const movedEnough =
        Math.abs(probeX - c0.x) > stepX * 0.5 ||
        Math.abs(probeZ - c0.z) > stepZ * 0.5
      if (!movedEnough) continue
    }

    if (Math.hypot(c1.x - c0.x, c1.z - c0.z) < 1e-4) continue
    return { c0, c1 }
  }

  // Safety fallback: never return null for a valid in-bounds same-region move.
  if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
    const c1 = cellCenterWorld(activeBounds, nr, nc, ROWS, COLS)
    if (Math.hypot(c1.x - c0.x, c1.z - c0.z) >= 1e-4) {
      return { c0, c1 }
    }
  }

  return null
}

const CARD_DEBUG: readonly { dr: number; dc: number; l: string }[] = [
  { dr: 1, dc: 0, l: 'N' },
  { dr: -1, dc: 0, l: 'S' },
  { dr: 0, dc: 1, l: 'E' },
  { dr: 0, dc: -1, l: 'W' },
]

function openCardinalsLine(
  activeBounds: RoomBounds,
  atRow: number,
  atCol: number,
  getRawGridBoundsAt: (x: number, z: number) => RoomBounds,
): string {
  let s = ''
  for (const { dr, dc, l } of CARD_DEBUG) {
    const ok = resolveNeighborDestination(
      activeBounds,
      atRow,
      atCol,
      dr,
      dc,
      getRawGridBoundsAt,
    )
    s += ok ? l : l.toLowerCase()
  }
  return s
}

function fillStepDebug(
  d: PlayerNavDebugSnapshot,
  opts: {
    activeBounds: RoomBounds
    state: PlayerGridNavState
    inputDr: number | null
    inputDc: number | null
    speed: number
    getRawGridBoundsAt: (x: number, z: number) => RoomBounds
    idleBlocked: boolean
    hadResetThisStep: boolean
    vx: number
    vz: number
  },
): void {
  const {
    activeBounds,
    state,
    inputDr,
    inputDc,
    speed,
    getRawGridBoundsAt,
    idleBlocked,
    hadResetThisStep,
    vx,
    vz,
  } = opts
  const len0 = Math.hypot(state.segX1 - state.segX0, state.segZ1 - state.segZ0)
  const moving = len0 > 1e-5 && state.segT < 1 - ARRIVE_T_EPS
  d.hadResetThisStep = hadResetThisStep
  d.idleBlocked = idleBlocked
  d.inputDr = inputDr
  d.inputDc = inputDc
  d.nextDr = state.nextDr
  d.nextDc = state.nextDc
  d.segLen = len0
  d.segT = state.segT
  d.moving = moving
  d.speedCap = speed
  d.vx = vx
  d.vz = vz
  d.openCardinals = openCardinalsLine(
    activeBounds,
    state.atRow,
    state.atCol,
    getRawGridBoundsAt,
  )
  d.gridAtRow = state.atRow
  d.gridAtCol = state.atCol
  d.gridBoundsKey = state.boundsKey
  d.linearIdx = state.atRow * COLS + state.atCol
}

export function inputToCardinalDelta(
  ax: number,
  az: number,
  deadzone = PLAYER_GRID_INPUT_DEADZONE,
): { dr: number; dc: number } | null {
  const axa = Math.abs(ax)
  const aza = Math.abs(az)
  if (axa < deadzone && aza < deadzone) return null
  if (axa >= aza) {
    return { dr: 0, dc: ax > 0 ? 1 : -1 }
  }
  return { dr: az > 0 ? 1 : -1, dc: 0 }
}

export type PlayerGridNavState = {
  boundsKey: string
  atRow: number
  atCol: number
  segX0: number
  segZ0: number
  segX1: number
  segZ1: number
  segT: number
  segDr: number
  segDc: number
  nextDr: number | null
  nextDc: number | null
}

export function createPlayerGridNavState(): PlayerGridNavState {
  return {
    boundsKey: '',
    atRow: 0,
    atCol: 0,
    segX0: 0,
    segZ0: 0,
    segX1: 0,
    segZ1: 0,
    segT: 1,
    segDr: 0,
    segDc: 0,
    nextDr: null,
    nextDc: null,
  }
}

function snapToContainingCellCenter(
  bounds: RoomBounds,
  px: number,
  pz: number,
): { row: number; col: number; x: number; z: number } {
  const { row, col } = worldToCellIndex(bounds, px, pz, ROWS, COLS)
  const c = cellCenterWorld(bounds, row, col, ROWS, COLS)
  return { row, col, x: c.x, z: c.z }
}

export function resetPlayerGridNavAtPosition(
  state: PlayerGridNavState,
  px: number,
  pz: number,
  bounds: RoomBounds,
): void {
  const snap = snapToContainingCellCenter(bounds, px, pz)
  state.boundsKey = boundsKey(bounds)
  state.atRow = snap.row
  state.atCol = snap.col
  state.segX0 = snap.x
  state.segZ0 = snap.z
  state.segX1 = snap.x
  state.segZ1 = snap.z
  state.segT = 1
  state.segDr = 0
  state.segDc = 0
  state.nextDr = null
  state.nextDc = null
}

export type PlayerGridStepResult = {
  x: number
  z: number
  vx: number
  vz: number
  faceX: number
  faceZ: number
}

export function stepPlayerGridNav(
  state: PlayerGridNavState,
  px: number,
  pz: number,
  dt: number,
  speed: number,
  /** Sticky/nav bounds at the player — defines logical row/col grid for this step. */
  bounds: RoomBounds,
  inputDr: number | null,
  inputDc: number | null,
  fingerDown: boolean,
  /** Raw room/corridor query — probes + segment completion only. */
  getRawGridBoundsAt: (x: number, z: number) => RoomBounds,
  /** When set, filled with step diagnostics for the on-screen HUD. */
  debug: PlayerNavDebugSnapshot | null = null,
): PlayerGridStepResult {
  const key = boundsKey(bounds)
  let hadResetThisStep = false

  // Initialize once only.
  if (state.boundsKey === '') {
    resetPlayerGridNavAtPosition(state, px, pz, bounds)
    hadResetThisStep = true
  } else {
    // Keep logical cell authoritative unless physics is clearly far away.
    const logicalCenter = cellCenterWorld(bounds, state.atRow, state.atCol, ROWS, COLS)
    const distToLogical = Math.hypot(px - logicalCenter.x, pz - logicalCenter.z)
    const shouldHardResync =
      state.boundsKey !== key &&
      state.segT >= 1 - ARRIVE_T_EPS &&
      distToLogical > PLAYER_GRID_HARD_RESYNC_DISTANCE

    if (shouldHardResync) {
      resetPlayerGridNavAtPosition(state, px, pz, bounds)
      hadResetThisStep = true
    } else {
      state.boundsKey = key
      if (state.segT >= 1 - ARRIVE_T_EPS) {
        state.segX0 = logicalCenter.x
        state.segZ0 = logicalCenter.z
        state.segX1 = logicalCenter.x
        state.segZ1 = logicalCenter.z
      }
    }
  }

  let activeBounds = bounds

  const cellAt = (b: RoomBounds, r: number, c: number) =>
    cellCenterWorld(b, r, c, ROWS, COLS)

  const tryStartSegment = (dr: number, dc: number): boolean => {
    const resolved = resolveNeighborDestination(
      activeBounds,
      state.atRow,
      state.atCol,
      dr,
      dc,
      getRawGridBoundsAt,
    )
    if (!resolved) return false
    const { c0, c1 } = resolved
    state.segX0 = c0.x
    state.segZ0 = c0.z
    state.segX1 = c1.x
    state.segZ1 = c1.z
    state.segT = 0
    state.segDr = dr
    state.segDc = dc
    return true
  }

  const snapshotPos = (): { x: number; z: number } => {
    const dx = state.segX1 - state.segX0
    const dz = state.segZ1 - state.segZ0
    const len = Math.hypot(dx, dz)
    if (len < 1e-5 || state.segT >= 1 - ARRIVE_T_EPS) {
      const c = cellAt(activeBounds, state.atRow, state.atCol)
      return { x: c.x, z: c.z }
    }
    return {
      x: state.segX0 + dx * state.segT,
      z: state.segZ0 + dz * state.segT,
    }
  }

  const updateNextDirection = (alongSegment: boolean): void => {
    if (!fingerDown || inputDr === null || inputDc === null) return
    if (!alongSegment) {
      state.nextDr = inputDr
      state.nextDc = inputDc
      return
    }
    if (inputDr === state.segDr && inputDc === state.segDc) {
      state.nextDr = null
      state.nextDc = null
      return
    }
    state.nextDr = inputDr
    state.nextDc = inputDc
  }

  const tryStartFromNextOrInput = (): boolean => {
    if (state.nextDr !== null && state.nextDc !== null) {
      const dr = state.nextDr
      const dc = state.nextDc
      if (tryStartSegment(dr, dc)) {
        state.nextDr = null
        state.nextDc = null
        return true
      }
      state.nextDr = null
      state.nextDc = null
    }
    if (fingerDown && inputDr !== null && inputDc !== null) {
      if (tryStartSegment(inputDr, inputDc)) {
        return true
      }
    }
    return false
  }

  const start = snapshotPos()
  let dtRem = dt
  let lastFaceX = 0
  let lastFaceZ = 1
  let iterations = 0

  while (iterations < 24 && dtRem > 1e-12) {
    iterations++
    const len0 = Math.hypot(state.segX1 - state.segX0, state.segZ1 - state.segZ0)
    let alongSegment = len0 > 1e-5 && state.segT < 1 - ARRIVE_T_EPS

    if (!alongSegment) {
      updateNextDirection(false)
      if (!tryStartFromNextOrInput()) {
        const c = cellAt(activeBounds, state.atRow, state.atCol)
        const vx = (c.x - start.x) / Math.max(dt, 1e-6)
        const vz = (c.z - start.z) / Math.max(dt, 1e-6)
        if (debug) {
          fillStepDebug(debug, {
            activeBounds,
            state,
            inputDr,
            inputDc,
            speed,
            getRawGridBoundsAt,
            idleBlocked:
              fingerDown && inputDr !== null && inputDc !== null,
            hadResetThisStep,
            vx,
            vz,
          })
        }
        return { x: c.x, z: c.z, vx, vz, faceX: 0, faceZ: 1 }
      }
      alongSegment = true
    }

    updateNextDirection(true)

    const dx = state.segX1 - state.segX0
    const dz = state.segZ1 - state.segZ0
    const segLen = Math.hypot(dx, dz)
    const fl = segLen > 1e-6 ? 1 / segLen : 1
    lastFaceX = dx * fl
    lastFaceZ = dz * fl

    const prevT = state.segT
    const tToEnd = ((1 - prevT) * segLen) / Math.max(speed, 1e-6)

    if (tToEnd > dtRem - 1e-10) {
      const newT = prevT + (speed * dtRem) / Math.max(segLen, 1e-5)
      state.segT = newT
      const nx = state.segX0 + dx * newT
      const nz = state.segZ0 + dz * newT
      const vx = (nx - start.x) / Math.max(dt, 1e-6)
      const vz = (nz - start.z) / Math.max(dt, 1e-6)
      if (debug) {
        fillStepDebug(debug, {
          activeBounds,
          state,
          inputDr,
          inputDc,
          speed,
          getRawGridBoundsAt,
          idleBlocked: false,
          hadResetThisStep,
          vx,
          vz,
        })
      }
      return { x: nx, z: nz, vx, vz, faceX: lastFaceX, faceZ: lastFaceZ }
    }

    dtRem -= tToEnd
    const bEnd = getRawGridBoundsAt(state.segX1, state.segZ1)
    activeBounds = bEnd
    const prevKey = state.boundsKey
    const srcRow = state.atRow
    const srcCol = state.atCol
    const sdr = state.segDr
    const sdc = state.segDc
    const destRow = srcRow + sdr
    const destCol = srcCol + sdc
    const sameRegion = boundsKey(bEnd) === prevKey

    if (
      sameRegion &&
      destRow >= 0 &&
      destRow < ROWS &&
      destCol >= 0 &&
      destCol < COLS
    ) {
      state.atRow = destRow
      state.atCol = destCol
    } else {
      const idx = worldToCellIndex(bEnd, state.segX1, state.segZ1, ROWS, COLS)
      state.atRow = idx.row
      state.atCol = idx.col
    }

    state.boundsKey = boundsKey(bEnd)
    const c = cellAt(bEnd, state.atRow, state.atCol)
    state.segX0 = c.x
    state.segZ0 = c.z
    state.segX1 = c.x
    state.segZ1 = c.z
    state.segT = 1
    state.segDr = 0
    state.segDc = 0

    if (dtRem < 1e-10) {
      const vx = (c.x - start.x) / Math.max(dt, 1e-6)
      const vz = (c.z - start.z) / Math.max(dt, 1e-6)
      if (debug) {
        fillStepDebug(debug, {
          activeBounds,
          state,
          inputDr,
          inputDc,
          speed,
          getRawGridBoundsAt,
          idleBlocked: false,
          hadResetThisStep,
          vx,
          vz,
        })
      }
      return { x: c.x, z: c.z, vx, vz, faceX: lastFaceX, faceZ: lastFaceZ }
    }
  }

  const c = cellAt(activeBounds, state.atRow, state.atCol)
  const vx = (c.x - start.x) / Math.max(dt, 1e-6)
  const vz = (c.z - start.z) / Math.max(dt, 1e-6)
  if (debug) {
    fillStepDebug(debug, {
      activeBounds,
      state,
      inputDr,
      inputDc,
      speed,
      getRawGridBoundsAt,
      idleBlocked: false,
      hadResetThisStep,
      vx,
      vz,
    })
  }
  return { x: c.x, z: c.z, vx, vz, faceX: lastFaceX, faceZ: lastFaceZ }
}