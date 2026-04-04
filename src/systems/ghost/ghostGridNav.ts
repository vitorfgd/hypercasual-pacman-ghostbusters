import type { WorldCollision } from '../world/WorldCollision.ts'
import type { RoomBounds } from '../world/mansionRoomData.ts'
import { ROOM_GRID_COLS, ROOM_GRID_ROWS } from '../grid/gridConfig.ts'
import { resolveGridBoundsAt } from '../grid/gridBoundsResolve.ts'
import {
  boundsKey,
  cellCenterWorld,
  worldToCellIndex,
} from '../grid/roomGridGeometry.ts'

const ROWS = ROOM_GRID_ROWS
const COLS = ROOM_GRID_COLS
const ARRIVE_EPS = 0.09

const CARD: readonly { dr: number; dc: number }[] = [
  { dr: 1, dc: 0 },
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 0, dc: -1 },
]

export type GhostGridNavMode = 'idle' | 'chase' | 'fright'

export type GhostGridNavState = {
  boundsKey: string
  mode: GhostGridNavMode
  atRow: number
  atCol: number
  targetX: number
  targetZ: number
  nextRow: number
  nextCol: number
  /** Unit direction along current segment (toward target). */
  segDx: number
  segDz: number
  /** Last chosen grid step — used to forbid immediate U-turn at intersections. */
  incomingDr: number
  incomingDc: number
}

export function createGhostGridNavState(): GhostGridNavState {
  return {
    boundsKey: '',
    mode: 'idle',
    atRow: 0,
    atCol: 0,
    targetX: 0,
    targetZ: 0,
    nextRow: 0,
    nextCol: 0,
    segDx: 0,
    segDz: 1,
    incomingDr: 0,
    incomingDc: 1,
  }
}

export function resetGhostGridNavState(s: GhostGridNavState): void {
  s.boundsKey = ''
  s.mode = 'idle'
}

/**
 * Same regions as `RoomSystem.getGridBoundsAt` / `resolveGridBoundsAt` (never null).
 */
export function getGhostGridBoundsAt(x: number, z: number): RoomBounds {
  return resolveGridBoundsAt(x, z)
}

function cellWalkable(
  wc: WorldCollision,
  x: number,
  z: number,
  radius: number,
): boolean {
  const r = wc.resolveCircleXZ(x, z, radius)
  return Math.hypot(r.x - x, r.z - z) < 0.12
}

type OpenDir = { dr: number; dc: number; x: number; z: number }

function listOpenCardinals(
  atRow: number,
  atCol: number,
  bounds: RoomBounds,
  wc: WorldCollision,
  radius: number,
): OpenDir[] {
  const out: OpenDir[] = []
  for (const { dr, dc } of CARD) {
    const nr = atRow + dr
    const nc = atCol + dc
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
    const { x, z } = cellCenterWorld(bounds, nr, nc, ROWS, COLS)
    if (cellWalkable(wc, x, z, radius)) {
      out.push({ dr, dc, x, z })
    }
  }
  return out
}

function findOpenDir(
  open: OpenDir[],
  dr: number,
  dc: number,
): OpenDir | null {
  return open.find((o) => o.dr === dr && o.dc === dc) ?? null
}

function pickIdle(
  open: OpenDir[],
  incomingDr: number,
  incomingDc: number,
  patrolBias: -1 | 1,
): OpenDir {
  if (open.length === 1) return open[0]!
  if (incomingDr === 0 && incomingDc === 0) {
    return open[0]!
  }
  const forward = findOpenDir(open, incomingDr, incomingDc)
  const left = findOpenDir(
    open,
    incomingDc,
    -incomingDr,
  )
  const right = findOpenDir(
    open,
    -incomingDc,
    incomingDr,
  )
  const back = findOpenDir(open, -incomingDr, -incomingDc)
  const preferredTurn = patrolBias < 0 ? left : right
  const alternateTurn = patrolBias < 0 ? right : left
  return forward ?? preferredTurn ?? alternateTurn ?? back ?? open[0]!
}

function manhattan(
  aRow: number,
  aCol: number,
  bRow: number,
  bCol: number,
): number {
  return Math.abs(aRow - bRow) + Math.abs(aCol - bCol)
}

function pickChase(
  open: OpenDir[],
  atRow: number,
  atCol: number,
  pRow: number,
  pCol: number,
  random: () => number,
): OpenDir {
  let bestM = Infinity
  const ties: OpenDir[] = []
  for (const o of open) {
    const nr = atRow + o.dr
    const nc = atCol + o.dc
    const m = manhattan(nr, nc, pRow, pCol)
    if (m < bestM) {
      bestM = m
      ties.length = 0
      ties.push(o)
    } else if (m === bestM) {
      ties.push(o)
    }
  }
  return ties[Math.floor(random() * ties.length)]!
}

function pickFright(
  open: OpenDir[],
  atRow: number,
  atCol: number,
  pRow: number,
  pCol: number,
  random: () => number,
): OpenDir {
  let bestM = -1
  const ties: OpenDir[] = []
  for (const o of open) {
    const nr = atRow + o.dr
    const nc = atCol + o.dc
    const m = manhattan(nr, nc, pRow, pCol)
    if (m > bestM) {
      bestM = m
      ties.length = 0
      ties.push(o)
    } else if (m === bestM) {
      ties.push(o)
    }
  }
  return ties[Math.floor(random() * ties.length)]!
}

function areOpposite(a: OpenDir, b: OpenDir): boolean {
  return a.dr === -b.dr && a.dc === -b.dc
}

/** Two-way straight tunnel: only forward/back — no choice until an intersection. */
function isStraightTwoWay(open: OpenDir[]): boolean {
  return open.length === 2 && areOpposite(open[0]!, open[1]!)
}

function pickStraightTunnelForward(
  open: OpenDir[],
  incomingDr: number,
  incomingDc: number,
  random: () => number,
): OpenDir {
  const forward = open.find(
    (o) => o.dr === incomingDr && o.dc === incomingDc,
  )
  if (forward) return forward
  return open[Math.floor(random() * open.length)]!
}

function pickAtIntersection(
  open: OpenDir[],
  mode: GhostGridNavMode,
  atRow: number,
  atCol: number,
  pRow: number,
  pCol: number,
  incomingDr: number,
  incomingDc: number,
  patrolBias: -1 | 1,
  random: () => number,
): OpenDir {
  if (open.length === 1) return open[0]!
  if (isStraightTwoWay(open)) {
    return pickStraightTunnelForward(open, incomingDr, incomingDc, random)
  }
  if (mode === 'fright') {
    return pickFright(open, atRow, atCol, pRow, pCol, random)
  }
  if (mode === 'chase') {
    return pickChase(open, atRow, atCol, pRow, pCol, random)
  }
  return pickIdle(open, incomingDr, incomingDc, patrolBias)
}

function initFromPosition(
  state: GhostGridNavState,
  bounds: RoomBounds,
  px: number,
  pz: number,
  wc: WorldCollision,
  radius: number,
  mode: GhostGridNavMode,
  pRow: number,
  pCol: number,
  patrolBias: -1 | 1,
  random: () => number,
): { x: number; z: number } {
  const { row, col } = worldToCellIndex(bounds, px, pz, ROWS, COLS)
  const here = cellCenterWorld(bounds, row, col, ROWS, COLS)
  state.boundsKey = boundsKey(bounds)
  state.mode = mode
  state.atRow = row
  state.atCol = col
  state.segDx = 0
  state.segDz = 1

  const open = listOpenCardinals(row, col, bounds, wc, radius)
  if (open.length === 0) {
    state.nextRow = row
    state.nextCol = col
    state.targetX = here.x
    state.targetZ = here.z
    state.incomingDr = 0
    state.incomingDc = 1
    return { x: here.x, z: here.z }
  }

  const pick = pickAtIntersection(
    open,
    mode,
    row,
    col,
    pRow,
    pCol,
    0,
    1,
    patrolBias,
    random,
  )

  state.incomingDr = pick.dr
  state.incomingDc = pick.dc
  state.nextRow = row + pick.dr
  state.nextCol = col + pick.dc
  const t = cellCenterWorld(bounds, state.nextRow, state.nextCol, ROWS, COLS)
  state.targetX = t.x
  state.targetZ = t.z
  state.segDx = Math.sign(t.x - here.x)
  state.segDz = Math.sign(t.z - here.z)
  if (state.segDx === 0 && state.segDz === 0) state.segDz = 1

  return { x: here.x, z: here.z }
}

/**
 * One step of Pac-Man-style movement inside `bounds`.
 * Mutates `state`; returns new position and kinematics for the ghost root.
 */
export function stepGhostGridNav(
  state: GhostGridNavState,
  px: number,
  pz: number,
  dt: number,
  speed: number,
  bounds: RoomBounds,
  mode: GhostGridNavMode,
  playerX: number,
  playerZ: number,
  wc: WorldCollision,
  radius: number,
  patrolBias: -1 | 1,
  random: () => number,
): { x: number; z: number; vx: number; vz: number; fx: number; fz: number } {
  const key = boundsKey(bounds)
  const { row: pRow, col: pCol } = worldToCellIndex(
    bounds,
    playerX,
    playerZ,
    ROWS,
    COLS,
  )

  if (state.boundsKey !== key) {
    const snap = initFromPosition(
      state,
      bounds,
      px,
      pz,
      wc,
      radius,
      mode,
      pRow,
      pCol,
      patrolBias,
      random,
    )
    px = snap.x
    pz = snap.z
  } else {
    state.mode = mode
  }

  let dx = state.targetX - px
  let dz = state.targetZ - pz
  let dist = Math.hypot(dx, dz)

  if (dist < ARRIVE_EPS) {
    px = state.targetX
    pz = state.targetZ
    state.atRow = state.nextRow
    state.atCol = state.nextCol

    const open = listOpenCardinals(
      state.atRow,
      state.atCol,
      bounds,
      wc,
      radius,
    )
    if (open.length === 0) {
      state.targetX = px
      state.targetZ = pz
      state.nextRow = state.atRow
      state.nextCol = state.atCol
      state.segDx = 0
      state.segDz = 1
    } else {
      const pick = pickAtIntersection(
        open,
        mode,
        state.atRow,
        state.atCol,
        pRow,
        pCol,
        state.incomingDr,
        state.incomingDc,
        patrolBias,
        random,
      )
      state.incomingDr = pick.dr
      state.incomingDc = pick.dc
      state.nextRow = state.atRow + pick.dr
      state.nextCol = state.atCol + pick.dc
      const t = cellCenterWorld(
        bounds,
        state.nextRow,
        state.nextCol,
        ROWS,
        COLS,
      )
      state.targetX = t.x
      state.targetZ = t.z
      state.segDx = Math.sign(state.targetX - px)
      state.segDz = Math.sign(state.targetZ - pz)
      if (state.segDx === 0 && state.segDz === 0) state.segDz = 1
    }

    dx = state.targetX - px
    dz = state.targetZ - pz
    dist = Math.hypot(dx, dz)
  }

  const step = speed * dt
  let nx = px
  let nz = pz
  if (dist > 1e-6) {
    const adx = Math.abs(dx)
    const adz = Math.abs(dz)
    if (adx >= adz) {
      const sgn = dx > 0 ? 1 : -1
      nx = px + Math.min(step, adx) * sgn
    } else {
      const sgn = dz > 0 ? 1 : -1
      nz = pz + Math.min(step, adz) * sgn
    }
  }

  const vx = (nx - px) / Math.max(dt, 1e-6)
  const vz = (nz - pz) / Math.max(dt, 1e-6)
  const fl = Math.hypot(state.segDx, state.segDz)
  const fx = fl > 1e-6 ? state.segDx / fl : state.segDx
  const fz = fl > 1e-6 ? state.segDz / fl : state.segDz

  return { x: nx, z: nz, vx, vz, fx, fz }
}
