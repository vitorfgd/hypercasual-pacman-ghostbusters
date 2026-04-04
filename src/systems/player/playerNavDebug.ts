/**
 * On-screen + console diagnostics for grid movement. Toggle via `SHOW_PLAYER_NAV_DEBUG_HUD`.
 */
export const SHOW_PLAYER_NAV_DEBUG_HUD = false

export type PlayerNavDebugSnapshot = {
  px: number
  pz: number
  afterPhysicsX: number
  afterPhysicsZ: number
  navBoundsKey: string
  rawKeyAtPlayer: string
  keysMatch: boolean
  cellFromNav: { row: number; col: number }
  cellFromRaw: { row: number; col: number }
  gridAtRow: number
  gridAtCol: number
  gridBoundsKey: string
  linearIdx: number
  segLen: number
  segT: number
  moving: boolean
  inputDr: number | null
  inputDc: number | null
  attemptedDr: number | null
  attemptedDc: number | null
  nextDr: number | null
  nextDc: number | null
  segmentRejectReason: 'none' | 'geometry' | 'collider'
  /** Uppercase = can move that way; lowercase = neighbor resolve failed */
  openCardinals: string
  /** Finger down with input but could not start a segment from idle at cell */
  idleBlocked: boolean
  hadResetThisStep: boolean
  collisionCorrectionDist: number
  collisionCorrectionTriggered: boolean
  navBoundsKind: 'corridor' | 'room'
  rawBoundsKind: 'corridor' | 'room'
  speedCap: number
  vx: number
  vz: number
  fingerDown: boolean
  stickX: number
  stickY: number
  stickMag: number
  gridInputDeadzone: number
}

export function createEmptyNavDebug(): PlayerNavDebugSnapshot {
  return {
    px: 0,
    pz: 0,
    afterPhysicsX: 0,
    afterPhysicsZ: 0,
    navBoundsKey: '',
    rawKeyAtPlayer: '',
    keysMatch: true,
    cellFromNav: { row: 0, col: 0 },
    cellFromRaw: { row: 0, col: 0 },
    gridAtRow: 0,
    gridAtCol: 0,
    gridBoundsKey: '',
    linearIdx: 0,
    segLen: 0,
    segT: 0,
    moving: false,
    inputDr: null,
    inputDc: null,
    attemptedDr: null,
    attemptedDc: null,
    nextDr: null,
    nextDc: null,
    segmentRejectReason: 'none',
    openCardinals: '',
    idleBlocked: false,
    hadResetThisStep: false,
    collisionCorrectionDist: 0,
    collisionCorrectionTriggered: false,
    navBoundsKind: 'corridor',
    rawBoundsKind: 'corridor',
    speedCap: 0,
    vx: 0,
    vz: 0,
    fingerDown: false,
    stickX: 0,
    stickY: 0,
    stickMag: 0,
    gridInputDeadzone: 0.22,
  }
}

export function formatNavDebugHud(d: PlayerNavDebugSnapshot): string {
  const ci = d.linearIdx
  const dz = d.gridInputDeadzone
  const belowDz =
    d.fingerDown &&
    d.stickMag > 1e-4 &&
    d.stickMag < dz &&
    d.inputDr === null &&
    d.inputDc === null
  return [
    `pos ${d.px.toFixed(2)}, ${d.pz.toFixed(2)} → phys ${d.afterPhysicsX.toFixed(2)}, ${d.afterPhysicsZ.toFixed(2)}`,
    `nav key ${shortKey(d.navBoundsKey)} | raw ${shortKey(d.rawKeyAtPlayer)} ${d.keysMatch ? '✓' : '⚠ MISMATCH'}`,
    `cell nav r${d.cellFromNav.row}c${d.cellFromNav.col} | raw r${d.cellFromRaw.row}c${d.cellFromRaw.col}`,
    `grid r${d.gridAtRow}c${d.gridAtCol} idx${ci} (=row*9+col) · idx32=r3c5 idx41=r4c5`,
    `seg len ${d.segLen.toFixed(3)} t ${d.segT.toFixed(3)} moving ${d.moving}`,
    `stick xy ${d.stickX.toFixed(2)},${d.stickY.toFixed(2)} mag ${d.stickMag.toFixed(2)} finger ${d.fingerDown ? '↓' : 'up'} | grid dz ${dz}`,
    belowDz
      ? `⚠ INPUT BELOW GRID DEADZONE (${dz}) — push stick farther`
      : null,
    `in dr ${d.inputDr ?? '—'} dc ${d.inputDc ?? '—'} | attempt ${d.attemptedDr ?? '—'} ${d.attemptedDc ?? '—'} | next ${d.nextDr ?? '—'} ${d.nextDc ?? '—'}`,
    `open NESW: ${d.openCardinals} (caps=open lowercase=blocked)`,
    d.idleBlocked
      ? `⚠ IDLE BLOCKED (${d.segmentRejectReason})`
      : 'idle ok',
    d.hadResetThisStep ? '↻ grid reset this frame' : '',
    `corr ${d.collisionCorrectionDist.toFixed(3)} ${d.collisionCorrectionTriggered ? '⚠' : ''} | nav ${d.navBoundsKind} raw ${d.rawBoundsKind}`,
    `cap ${d.speedCap.toFixed(1)} vx ${d.vx.toFixed(2)} vz ${d.vz.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function shortKey(k: string): string {
  if (k.length <= 28) return k || '(empty)'
  return `${k.slice(0, 12)}…${k.slice(-8)}`
}
