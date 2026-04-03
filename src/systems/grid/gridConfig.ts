/**
 * Cells per room on X and Z (arcade grid). Tunable without gameplay code changes.
 * Odd column count keeps a cell centered on x=0 so the grid lines up with double-door / gate centers.
 */
export const ROOM_GRID_COLS = 9
export const ROOM_GRID_ROWS = 8

/** Inset from room AABB so pickups stay off walls (world units). */
export const GRID_ROOM_INSET = 0.55

/** Target fill: fraction of cells that are wisps (before connectivity trim). */
export const GRID_WISP_FRACTION_MIN = 0.22
export const GRID_WISP_FRACTION_MAX = 0.38

/** Trap density — kept moderate so paths stay feasible. */
export const GRID_TRAP_FRACTION_MIN = 0.06
export const GRID_TRAP_FRACTION_MAX = 0.12

/** Internal wall density — sparse blocks that turn rooms into simple mazes. */
export const GRID_WALL_FRACTION_MIN = 0.06
export const GRID_WALL_FRACTION_MAX = 0.1

export const GRID_PLAN_MAX_ATTEMPTS = 120
