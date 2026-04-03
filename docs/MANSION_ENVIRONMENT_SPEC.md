# Mansion environment: rooms, ground, and walls (for 3D model authoring)

This document describes **how the playable mansion is defined in code**—units, layout, floor pieces, wall pieces, and door gaps—so you can rebuild the same space using separate 3D models (e.g. modular floor tiles, wall segments, trim) and hand the assets back for integration.

**Engine:** Three.js (Y up). **Scale:** 1 unit ≈ 1 meter (informal).

---

## 1. Core constants (single source of truth in code)

| Symbol | Value | Meaning |
|--------|-------|---------|
| `ROOM_HALF` | **8** | Half-width of every square room on **X** (and half-depth on **Z** for the room square). Room interior is **16×16** units in XZ. |
| `CORRIDOR_DEPTH` | **2** | Depth (along **Z**) of each **door threshold** strip between areas. |
| `DOOR_HALF` | **2** | Half-width of the **walkable door opening** on **X** (opening is **4** units wide on X). |
| `MANSION_OUTER_WALL_THICKNESS` | **0.28** | Thickness of the **outer perimeter** walls (used in wall collider boxes). |
| `MANSION_WORLD_HALF` | **102** | Soft outer clamp of the world (vignette / bounds), not the playable interior. |

All rooms share the same **X** extent: **minX = −8**, **maxX = +8** (i.e. `±ROOM_HALF`).

---

## 2. Coordinate system and “north” chain

- **X:** West is negative, east is positive. Playable rooms span **−8 … +8** on X.
- **Z:** The **safe hub** is toward **positive Z**. Progress into the mansion goes toward **more negative Z** (a linear chain of rooms).
- **Y:** Floor is approximately **Y = 0**. Walls are vertical boxes centered at **`WALL_Y = WALL_HEIGHT / 2`** with **`WALL_HEIGHT = 2.35`**.

Visual floors use tiny Z-fighting offsets: corridors at about **−0.0006**, each room floor stepped by **+0.0004** in Y (negligible for modeling—treat everything as **coplanar at Y = 0**).

---

## 3. Room placement along Z (formulas)

Let `S = ROOM_HALF` (8) and `C = CORRIDOR_DEPTH` (2).

- **`roomNorthZ(1)`** = `−S − C` = **−10** (north edge of ROOM_1 toward the hub/threshold).
- **`roomSouthZ(k)`** = **`roomNorthZ(k) − 2S`** (south edge of that room’s square).
- For **`k ≥ 2`**: **`roomNorthZ(k)`** = **`roomSouthZ(k−1) − C`** (north of room *k* is south of previous room minus one corridor depth).

So each **normal room** is a **16×16** square in XZ, and between consecutive rooms there is a **corridor strip** of depth **C** on Z (narrow on X: see §5).

You can compute every room’s bounds as:

- **minX, maxX:** always **−S, +S**
- **minZ, maxZ:** **`roomSouthZ(k)` … `roomNorthZ(k)`** for `ROOM_k`

**SAFE_CENTER** is the hub square: **Z from −S to +S** (−8…+8), same X.

---

## 4. Room list (logical IDs)

| Room ID | Role | X range | Z range (see formulas above) |
|---------|------|---------|--------------------------------|
| `SAFE_CENTER` | Safe hub | −8…+8 | −8…+8 |
| `ROOM_1` … `ROOM_5` | Normal rooms | −8…+8 | From `roomSouthZ(k)` to `roomNorthZ(k)` |

Connectivity (for narrative): hub → ROOM_1 → … → ROOM_5 in a **line** along **−Z**.

---

## 5. Door thresholds (corridor floor pieces)

Doors are **not** full-width on X. Walkable connection is only **`|X| ≤ DOOR_HALF`** (i.e. **−2…+2** on X).

**`CORRIDOR_BOUNDS`** in code is an array of **axis-aligned rectangles** (min/max X and Z) for the **five** threshold strips:

1. Hub → first gap south of safe: **Z** roughly **−S−C … −S** (narrow **X**).
2. Between ROOM_1 and ROOM_2: centered on **`roomSouthZ(1)`** (strip **C** deep).
3. Same pattern for ROOM_2↔3, 3↔4, 4↔5.

Each corridor piece is **`2*DOOR_HALF` wide on X`** by **`CORRIDOR_DEPTH` deep on Z** (4 × 2 units), positioned between the large room squares.

**Art note:** Side “wall” segments beside each threshold (the **full** room width minus the door gap) are implemented as separate collider/volume pieces—see §6.

---

## 6. How **ground** is built in the game (reference for your models)

Today the game does **not** use a single mesh; it builds:

1. **One horizontal plane per corridor** rectangle in `CORRIDOR_BOUNDS` (same material).
2. **One horizontal plane per room** in `ROOMS` (same family of material).
3. Optional **edge vignette** bands around the outer map (very large planes).

Each plane is a **`PlaneGeometry(width, depth)`** rotated **−90° around X** (so it lies in XZ), positioned at the rectangle center **(cx, y, cz)** with **`y ≈ 0`**.

**For your modeling:** You can replace these planes with:

- Tiled floor meshes per room (must cover the same **min/max X/Z**),
- Separate corridor floor meshes matching **`CORRIDOR_BOUNDS`**,
- Trim/baseboards as separate meshes sitting on top of **Y = 0**.

Keep **walkable area** inside the same rectangles—especially **door strips** only **|X| ≤ 2** in thresholds unless gameplay is changed.

---

## 7. How **walls** are built in the game (reference for your models)

Walls are derived from **`MANSION_WALL_COLLIDERS`**: a list of **axis-aligned boxes in XZ** (2D AABBs), extruded in code as **3D boxes** with:

- **Height:** `WALL_HEIGHT = 2.35`
- **Vertical center:** `WALL_Y = WALL_HEIGHT / 2`

Each collider box becomes **`BoxGeometry(widthX, WALL_HEIGHT, depthZ)`** at **`(cx, WALL_Y, cz)`**.

**Layout intent:**

- **Outer shell:** North cap, west and east side bands, south cap—slightly **outside** the inner `±S` room square using thickness `t = MANSION_OUTER_WALL_THICKNESS`.
- **Door gaps:** Where a door exists, the **full-width** wall segment is **split** into **left** and **right** pieces using **`hGap(...)`**—only the strip **|X| ≤ D** is removed so the opening is **4 units wide**.
- **Corridor sides:** Beside each threshold, **two** blocks fill **X from −S to −D** and **D to +S** between the relevant **Z** values (`corridorSideBlocks`).

So for modeling:

- You can author **straight wall modules** that match those **XZ footprints** and **2.35 m** height.
- **Door openings** are always **4 m** wide on X, centered on **X = 0**, at the Z locations of each connection.
- **Corners** are implicit intersections of adjacent boxes; if you use modular pieces, add corner meshes or mitered pieces to avoid gaps.

---

## 8. Collision vs visuals

- **Player/world collision** uses the same **`MANSION_WALL_COLLIDERS`** (plus optional **door gate** boxes when a gate is closed).
- **Rendered** wall meshes in `mansionEnvironment.ts` are built from **the same collider list**, so visuals and blocking align.
- If your imported models **differ** in thickness or position, either **match these AABBs** or the code must be updated so collision meshes still match gameplay.

---

## 9. Checklist for handing models to implementation

1. **Units:** Model in **meters**, **Y up**, origin on the **floor** (bottom of walls) unless you document otherwise.
2. **Per-room floor:** Covers **exact** `ROOMS[id].bounds` XZ for each id (or one atlas with consistent grid).
3. **Corridor floors:** Five strips matching **`CORRIDOR_BOUNDS`** (narrow X).
4. **Walls:** Height **2.35** (or one consistent height if everything is scaled together); door openings **4** wide on X at listed Z bands.
5. **Naming:** Suggest names like `floor_safe`, `floor_room_01`, `wall_outer_north`, `wall_door_split_L`, etc.
6. **Export:** Prefer **GLB** per module or grouped by room; avoid duplicate materials if the engine shares prototypes.

---

## 10. File references in this repo (for engineers)

| Topic | File |
|-------|------|
| Room bounds & corridor rectangles | `src/systems/world/mansionRoomData.ts` |
| Wall collider generation | `src/systems/world/mansionWalls.ts` |
| Constants | `src/systems/world/mansionGeometry.ts` |
| Floor + wall mesh instantiation | `src/systems/scene/mansionEnvironment.ts` |
| World collision | `src/systems/world/WorldCollision.ts` |

This spec is accurate to the **procedural** mansion. Replacing primitives with **models** should preserve these dimensions and gaps so gates, pickups, and room logic stay aligned.
