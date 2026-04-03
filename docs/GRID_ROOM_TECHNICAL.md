# Room grid system — technical reference

This document describes **how the per-room arcade grid is defined, planned, and consumed** in the *ghost-busters* codebase. It is intended for engineers or LLMs continuing work on layout, spawning, or navigation.

---

## 1. Big picture

- The **mansion** is laid out as **axis-aligned bounding boxes (AABBs)** in world XZ: a **safe hub**, **normal rooms** in a north chain, and **narrow door corridors** between them. All of that lives in data (`mansionRoomData.ts`), not in a level editor.
- Each **normal room** (except the final boss room) gets a **fixed-size logical grid** of cells (currently **8 rows × 9 columns** = 72 cells). The grid is **not** a separate mesh asset; it is a **parameterized subdivision** of the room’s `RoomBounds`, with a small **inset** from the walls.
- At run start, **`planAllRoomGrids`** randomly places **wisps** and **traps** on that grid subject to connectivity rules, then **world positions** are computed with **`cellCenterWorld`**. Other systems spawn **items**, **traps**, **power pellets**, and use the same geometry for **ghost spawns** and **player grid movement**.

---

## 2. World layout: rooms and corridors (source of truth)

| File | Role |
|------|------|
| `src/systems/world/mansionGeometry.ts` | Shared constants: `ROOM_HALF` (8), `CORRIDOR_DEPTH` (2), `DOOR_HALF` (2), outer world half, wall thickness. |
| `src/systems/world/mansionRoomData.ts` | **`ROOMS`**: each `RoomId` → `{ bounds, type }`. Normal rooms are built in a loop: same X extent (`±ROOM_HALF`), Z spans from `roomNorthZ` / `roomSouthZ`. **`CORRIDOR_BOUNDS`**: narrow door strips (small X, short Z) between hub and `ROOM_1`, and between consecutive rooms. **`ROOM_LIST`**, **`ROOM_CONNECTIONS`**, **`roomCenter()`**. |

**Coordinates:** Exit from safe is toward **−Z** (rooms chain “north” in design language = more negative Z in this code). Room bounds are **inclusive** AABBs: a point is inside if `min ≤ x,z ≤ max`.

The grid for gameplay **does not** change these bounds; it only **samples** inside each room’s (or corridor’s) bounds after inset.

---

## 3. Grid shape and tuning

| File | Role |
|------|------|
| `src/systems/grid/gridConfig.ts` | **`ROOM_GRID_ROWS`** (8), **`ROOM_GRID_COLS`** (9), **`GRID_ROOM_INSET`** (0.55 world units). Wisp/trap **fraction ranges** and **`GRID_PLAN_MAX_ATTEMPTS`** for planning retries. |

Odd column count is intentional so a column stays centered on **x = 0**, aligning with door/gate centers.

---

## 4. Geometry: from cell (row, col) to world XZ

| File | Role |
|------|------|
| `src/systems/grid/roomGridGeometry.ts` | **`cellCenterWorld(bounds, row, col, rows?, cols?)`** — center of the cell in world space. **`worldToCellIndex(bounds, x, z, …)`** — inverse (clamped to grid). **`boundsKey(bounds)`** — stable string for comparing which AABB is active. |

**Mapping math (inside the room after inset):**

- Usable inner rectangle: shrink the room AABB by `GRID_ROOM_INSET` on all sides.
- **Normalized u,v** (0..1): column `col` uses `u = (col + 0.5) / cols`, row `row` uses `v = (row + 0.5) / rows`.
- **World:** `x = minX + INSET + u * spanX`, `z = minZ + INSET + v * spanZ`.

**Row/column convention (used everywhere: plans, overlay, nav debug):**

- **row 0** = south (smaller Z, “bottom” of the grid in the usual top-down mental model for the room).
- **col 0** = west (smaller X).
- **Linear index** (e.g. HUD / debug): `linearIdx = row * ROOM_GRID_COLS + col` (e.g. 9 columns → `row*9+col`).

---

## 5. Procedural content: `planRoomGrids`

| File | Role |
|------|------|
| `src/systems/grid/planRoomGrids.ts` | **`planOneRoom`** — builds a `rows × cols` array of cells (`empty` \| `wisp` \| `trap`). **Start cell** for connectivity is **bottom center**: `startRow = rows - 1`, `startCol = floor(cols/2)` (south row, middle column). Random **target fractions** for wisps and traps; shuffle placement; **BFS** from start ensures every **wisp** remains reachable without crossing **traps**. On success, converts each wisp/trap cell to **`cellCenterWorld`** and returns **`RoomGridPlan`**: `{ roomId, bounds, wisps, traps }`. **`planAllRoomGrids(roomSystem, random)`** — loops **`NORMAL_ROOM_IDS`**, **skips `FINAL_NORMAL_ROOM_ID`** (boss room: no arcade grid plan). **`flattenTrapPlacements(plans)`** — flat list of `{x,z}` for `TrapFieldSystem`. |

**Important:** The **safe room** is not part of this grid plan; only **normal rooms** `ROOM_1` … `ROOM_9` get plans (with `ROOM_10` excluded as final).

---

## 6. Where the plan is consumed (bootstrap)

| File | Role |
|------|------|
| `src/core/Game.ts` | After `RoomSystem` / doors setup: calls **`planAllRoomGrids(this.roomSystem, this.runRandom)`**, stores **`roomGridPlans`**, passes traps to **`TrapFieldSystem`**, **`spawnGridWispsForPlans`**, **`spawnPowerPelletsForRun`**, and feeds **`RoomCleanlinessSystem`** via **`gridWispTotalsPerRoom`**. |

| File | Role |
|------|------|
| `src/systems/grid/instantiateGridRoomContent.ts` | **`spawnGridWispsForPlans`** — places grid wisp items at planned world positions (visibility gated by room access). |
| `src/systems/grid/powerPelletSpawn.ts` | Uses **`RoomGridPlan`** map to place power pellets (see file for rules). |
| `src/systems/grid/gridGhostSpawn.ts` | **`pickGridGhostSpawnXZ`** — picks a random **non-trap** cell center via **`cellCenterWorld`**, distance from player. |
| `src/systems/world/RoomCleanlinessSystem.ts` / `roomCleanlinessConfig.ts` | Progress / “clean room” driven in part by **grid wisp counts** from planning. |

---

## 7. Related: which AABB is “the grid” at a point (navigation)

Grid **movement** uses the same **row/col** math and **`ROOM_GRID_ROWS` / `ROOM_GRID_COLS`**, but the **active bounds** for a world position can be:

- **Room interior** (`ROOM_LIST`) or **corridor** (`CORRIDOR_BOUNDS`) — see **`resolveGridBoundsAt`** in `src/systems/grid/gridBoundsResolve.ts` (strict hit-test, then closest AABB if in a void gap).
- **`RoomSystem.getGridBoundsAt(x,z)`** — delegates to that resolver.
- **`RoomSystem.getNavGridBounds(x,z, navContext)`** — **sticky** rules so that when physics pushes the player into a **narrow corridor** AABB, logical **row/col** can still follow the **previous room** grid until a real transition or distance threshold — **probes** along movement rays should use **raw** `getGridBoundsAt`, not sticky nav, or neighbor resolution can fail.

Player step logic: `src/systems/player/playerGridNav.ts`. Ghosts: `src/systems/ghost/ghostGridNav.ts`.

---

## 8. Debug visualization

| File | Role |
|------|------|
| `src/systems/scene/gridCellDebugOverlay.ts` | **`attachGridCellDebugOverlays(scene)`** — floor planes with **linear index** and **`r,c`** per cell; one overlay per **`ROOM_LIST`** entry and per **`CORRIDOR_BOUNDS`** strip. Toggle **`GRID_CELL_DEBUG_OVERLAY`**. |
| `src/systems/player/playerNavDebug.ts` | Text HUD for nav state (`SHOW_PLAYER_NAV_DEBUG_HUD`) — complements the floor overlay when debugging stuck cells. |

---

## 9. File checklist (quick)

| Concern | Primary files |
|--------|----------------|
| Room/corridor world AABBs | `mansionGeometry.ts`, `mansionRoomData.ts` |
| Grid dimensions + inset + plan tuning | `gridConfig.ts` |
| Cell ↔ world mapping | `roomGridGeometry.ts` |
| Random wisp/trap plan per room | `planRoomGrids.ts` |
| Resolve bounds at XZ (voids + corridors) | `gridBoundsResolve.ts` |
| Query API + sticky nav | `RoomSystem.ts` |
| Run wiring | `Game.ts` |
| Spawn wisps / pellets / traps / ghosts | `instantiateGridRoomContent.ts`, `powerPelletSpawn.ts`, `TrapFieldSystem` (via `flattenTrapPlacements`), `gridGhostSpawn.ts` |
| Floor labels | `gridCellDebugOverlay.ts` |

---

## 10. Changing the grid safely

- **Dimensions:** change `ROOM_GRID_ROWS` / `ROOM_GRID_COLS` in **`gridConfig.ts`**; update any **HUD strings** that hardcode `9` if present; ensure **`planOneRoom`** start row/col still matches design (south door / entry).
- **Inset:** **`GRID_ROOM_INSET`** — affects both **visual** spacing from walls and **nav** cell boundaries; keep in sync with collision feel.
- **New room types:** extend **`mansionRoomData.ts`**; if they need arcade grids, include them in **`planAllRoomGrids`** loop (and decide boss/special exclusions).
- **Navigation bugs at doors:** usually involve **corridor vs room bounds** and **sticky vs raw** bounds — see **`gridBoundsResolve.ts`** and **`RoomSystem.getNavGridBounds`** before changing cell math.
