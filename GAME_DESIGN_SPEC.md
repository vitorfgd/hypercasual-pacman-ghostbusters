# Ghost-busters prototype — design & implementation specification

This document describes **how the game works in the current codebase** (TypeScript + Three.js + Vite). If behavior diverges, **`src/` is authoritative** — update this file when systems change.

---

## 1. High-level concept

- **Genre**: **3D** hypercasual loop on **XZ**: move, fill a **stack** with pickups, **bank** at per-room **trash portals** for money, **clear rooms** by collecting **clutter** to raise **cleanliness**, and **avoid ghosts** that strip part of the stack on contact.
- **World**: **Safe hub** (`SAFE_CENTER`) and a **linear chain** of five normal rooms (`ROOM_1` … `ROOM_5`) toward **−Z**, separated by **narrow door thresholds**. All playable rooms use the **same square footprint** (`ROOM_HALF = 8` → **16×16** world units on XZ); see `docs/MANSION_ENVIRONMENT_SPEC.md`. **Gates** along the chain start **locked** except the hub↔first-room passage; opening is driven by **room clears**, not a separate currency grind on doors.
- **Camera**: **Top-down follow** (default) or **over-the-shoulder** (toggle **C**); movement in OTS mode is **camera-relative** on the ground plane.

---

## 2. Game progression (specific)

Progression is **session-based**: there is **no campaign win screen** and **no scripted finale**. Advancement works as follows.

### 2.1 Room cleanliness (primary gate)

- Each normal room has **pre-placed clutter** (`CLUTTER_PER_ROOM` = **19** pieces per `ROOM_*`). Picking up clutter whose `spawnRoomId` matches that room adds **`CLEANLINESS_PERCENT_PER_CLUTTER`** to that room’s **0–100%** progress (`RoomCleanlinessSystem`).
- When a room reaches **100%**, it is marked **cleared** once; the HUD shows **100%** thereafter for that room.

### 2.2 Rewards on clearing a room

When **`ROOM_k`** reaches 100% cleanliness (`Game.ts` → `onRoomCleared`):

1. **Automatic upgrade** (`applyUpgradeForRoomClear` in `roomClearUpgrade.ts`):
   - **Odd** `k` (1, 3, 5): **prefer +1 capacity level** (raises `CarryStack` max from base `INITIAL_STACK_CAPACITY` + levels).
   - **Even** `k` (2, 4): **prefer +1 speed level** (raises `PlayerController` max speed via `speedForLevel`).
   - If the preferred track is **maxed** (`MAX_CAPACITY_UPGRADE_LEVELS` / `MAX_SPEED_UPGRADE_LEVELS` = **12** each), the **other** track is granted if possible.
2. **UI**: Room-cleared **banner**, optional **floating level-up text**, **floor decal** in that room.
3. **Gates / ghosts**:
   - **`ROOM_1` … `ROOM_4`**: Triggers **`doorIndexToOpenWhenRoomCleared`** → **`doorIndex = k`** opens the corresponding gate after a **gate-opening cinematic** (`beginGateOpeningCinematic`); ghosts in that room **fade** during the intro of the cinematic.
   - **`ROOM_5`**: **No further door** (`doorIndex` is `null`); ghosts for that room are **purged** (shrink and remove) without the north-door cinematic.

### 2.3 Door / area access

- **`DoorUnlockSystem`**: **`DOOR_COUNT` = 5** gate indices. **`DOOR_HUB_STARTS_FULLY_OPEN`**: passage **0** (hub south wall) is **open at start**. Deeper passages **1…4** open when **`ROOM_1`…`ROOM_4`** respectively reach full cleanliness and the unlock flow runs.
- **`canAccessRoomForSpawning`**: wisps, relic spawn, clutter instantiation require **all doors before that room’s index** to be passable — so **content in deeper rooms is gated** by the chain.

### 2.4 Economy (money)

- **Depositing** items in a **trash portal disc** (`TrashPortalSystem` + `DepositController`) runs **arc flights** and **adds money** via `evaluateDeposit` / overload rules.
- Money is shown on the HUD (`#hud-money`). **Spend sinks** for money in this build are **not** the same as older “pay pad / door gold” designs — **doors open from cleanliness**, not from spending cash on a door price.

### 2.5 Other progression-adjacent systems

- **Wisps**: `RoomWispSpawnSystem` spawns fodder into eligible rooms up to a global cap (`wispSpawnConfig.ts`).
- **Relic**: `SpecialRelicSpawnSystem` periodically spawns a **world relic**; foot arrow points to it.
- **Haunted clutter**: Some clutter is **haunted**; on pickup it can **spawn an extra ghost** (capped by `MAX_ACTIVE_GHOSTS`) and roll **relic-from-clutter** logic (`specialRelicSpawns`).

---

## 3. Lives, game over, and other failure conditions (specific)

### 3.1 Lives (ghost hits only)

- **`PLAYER_MAX_LIVES`** = **3** (`juiceConfig.ts`). Shown as **♥♥♥** in `#hud-lives`.
- Each time a **ghost contact** deals damage (same gate as stack loss: not during i-frames / cinematic / disarmed): **lose 1 life**, full-screen **−1** impact (`spawnLifeLostImpact`), strong screen shake, hearts update. **Stack loss** still applies as before.
- **Traps** do **not** remove lives (only stack fraction / slow).
- At **0 lives**: **`gameOver`** = true → animation loop **stops**, **game over overlay** (title, flavor line, **TRY AGAIN** → `location.reload()`).

### 3.2 Other situations (no life loss)

| Situation | What happens |
|-----------|----------------|
| **Trap fields** (`TrapFieldSystem`) | **Damage** traps remove a **fraction** of stack; **slow** traps reduce move speed. **No** life loss. |
| **Leaving deposit zone mid-deposit** | Session **aborts** per `DepositController`; **not** a life loss. |
| **Empty stack** | **Allowed**; ghosts can still hit (life + stack rules if stack empty only skip pop). |
| **Room already cleared** | No extra cleanliness from clutter. |

**Design implication:** Runs end on **three ghost hits that deal damage**; short-term pressure still includes **stack stripping** on every such hit.

---

## 4. Ghost behavior (specific)

Implementation: `GhostSystem.ts` + `ghostConfig.ts` + `gameplaySpeed.ts`. **`GhostSystem.update`** is called with **`frightened = false`** fixed — **frightened / eat** branches are **not** driven by `Game.ts` in this build (no pulse “power mode” hook). **Contact** uses **hit** only.

### 4.1 States (behavior)

Each ghost uses **`GhostBehaviorState`**: **`wander`** | **`chase`**.

- **Wander**: Random heading on a timer (`GHOST_WANDER_TURN_MIN` … `MAX`); speed **`GHOST_WANDER_SPEED`** × `ghostRoomSpeedMul(roomIndex)`.
- **Chase** (two sources):
  1. **Relic**: If the player’s stack **`hasRelic()`** and the ghost is allowed to hunt (`spawnChaseGrace` elapsed, not in hub-only roam, etc.), state is **chase** with **`GHOST_CHASE_SPEED`** (× room mul). If player moves **farther than `GHOST_LOSE_CHASE_RADIUS`** from the ghost, relic chase logic can release (see `GhostSystem` relic branch).
  2. **Vision cone hunt**: If **not** carrying a relic, ghosts use a **forward vision cone** (see §4.2). On **first detection**, state flips to **chase** and a **hunt timer** runs (`GHOST_HUNT_DURATION_MIN` … `MAX`). While hunting, speed **`GHOST_HUNT_SPEED`** (× room mul). When the hunt timer expires, state returns to **wander** and **`GHOST_VISION_COOLDOWN_SEC`** applies before the cone can trigger again. If distance exceeds **`GHOST_HUNT_ABORT_RANGE`**, the hunt **aborts** early.

### 4.2 Vision cone (aggro)

- **Shape**: **Aperture** `GHOST_VISION_CONE_DEG` (half-angle in radians `GHOST_VISION_HALF_ANGLE_RAD`). **Range** along forward: **`GHOST_VISION_RANGE`** (tuned **short** so the floor mesh sits **close** to the ghost).
- **Test**: Player must be inside range; **dot** between ghost’s **forward** (smoothed move direction, or yaw) and **direction to player** must be ≥ **`GHOST_VISION_COS_HALF`**; optional **`GHOST_VISION_USE_LINE_OF_SIGHT`** segment test against **`WorldCollision`**.
- **Visual**: **`GHOST_VISION_CONE_VISIBLE`**: semi-transparent **floor sector** mesh aligned with ghost facing; **brighter opacity** while in **chase** (relic or hunt).

### 4.3 Hub and cinematic rules

- If the player is in **`SAFE_CENTER`** **and** **not** carrying a relic, ghosts are forced to **wander** (no chase from cone/relic in that branch).
- **Gate-opening cinematic** (`gateCinematicRunning`): movement input is zeroed; ghost update receives **roam-only** so chases drop to wander.

### 4.4 Speeds vs player (balance)

- **`PLAYER_BASE_MAX_SPEED`** (before room-clear speed upgrades) is **~10.5**; chase speeds **`GHOST_CHASE_SPEED`** / **`GHOST_HUNT_SPEED`** are set **well above** that so **open-field chase is not winnable by raw speed** — avoidance uses **geometry**, **LOS**, and **room flow**.
- **Steering**: Higher **`GHOST_STEERING_ACCEL_CHASE`** and **`GHOST_DIRECTION_SMOOTH_CHASE`** in chase than in wander.

### 4.5 Spawning and tiers

- **Map spawns**: `DEFAULT_GHOST_SPAWNS` / `GHOSTS_PER_ROOM` per `ROOM_1`…`ROOM_5`; **`ghostRoomVisualMul`** and **`ghostRoomSpeedMul`** scale with **room index**.
- **Grace**: **`GHOST_SPAWN_CHASE_GRACE_MIN`…`MAX`** — new ghosts **cannot** chase until grace expires (still move).
- **Haunted clutter**: Chance **`HAUNTED_PICKUP_GHOST_CHANCE`** to spawn a ghost at pickup location (capped by **`MAX_ACTIVE_GHOSTS`**).
- **Separation**: Pairwise push so ghosts don’t stack on the same spot.

### 4.6 Contact damage (hit)

- **Circle–circle**: `playerRadius + ghost.collisionRadius` (ghost radius scales with visual mul).
- **No hit** when: player **i-frames** after a previous hit, **`ghostDamageArmed`** false until player clears melee range, **`gateCinematicRunning`**, or ghost in **spawn grace** for **contact damage** (`canDealContactDamage`).
- **On hit**: Ghost **disengages** (`disengageAfterHit`) — brief **chase lockout**, **knockback** impulse on player; ghost does not instantly re-stick.

### 4.7 Room clear

- When a room is cleared, ghosts tied to that room either **fade** into the gate cinematic or **purge** (shrink and despawn) — **no respawn** for those room-tied clears.

---

## 5. One-frame mental model (main loop)

Simplified order in `Game`’s tick:

1. **Input**: Joystick (canvas) + keyboard; optional **camera-relative** remap for OTS (`applyOtsCameraRelativeMove`).
2. **Player**: Velocity, knockback decay, wall collision, **trap** slow/damage.
3. **World**: Doors, mansion visibility, **room cleanliness** HUD, **ghost** AI, **items**, **stack** visual, **deposit**, **wisp/relic** spawns, **camera** rig, **gate cinematic**, **money** HUD, **collection**.

---

## 6. Input

| Channel | Behavior |
|--------|------------|
| **Touch / mouse** | Joystick on **canvas** (`TouchJoystick`). |
| **Keyboard** | WASD + arrows; keyboard wins when held. Ignored in input fields / contenteditable. |
| **C** | Toggle **camera mode** (top-down vs over-shoulder) — see `juiceConfig.ts` / `CameraRig`. |

Default movement: joystick **Y** screen-down → world **+Z**; **top-down** is axis-aligned; **OTS** uses **camera forward** on XZ.

---

## 7. World, rooms, collision

- **`RoomSystem`** + **`mansionRoomData`**: All **`ROOM_*`** share the same **±`ROOM_HALF`** on **X**; **Z** extents come from **`roomNorthZ` / `roomSouthZ`**.
- **`WorldCollision`**: **`MANSION_WALL_COLLIDERS`** + door blockers while gates are closed (`DoorUnlockSystem`).

---

## 8. Items (`GameItem`)

Types include **wisp**, **relic**, **gem**, **clutter** — see `core/types/GameItem.ts`. **Stack** is LIFO for ghost hits and deposits.

---

## 9. Deposit and economy

- **Zone**: `DepositController` resolves the active **trash portal** disc via `TrashPortalSystem` when the player stands in it.
- **Batching**: `evaluateDeposit`, `depositScaling` for **superlinear** batch value; **overload** thresholds in `overloadDropConfig.ts`.

---

## 10. HUD (current `index.html`)

| Region | Content |
|--------|---------|
| **Top** | Carry **count / max**, **camera hint** (`C · far/near`), **lives** (hearts), **money** |
| | **Room cleanliness** bar + title (when in a trackable room) |
| **Bottom** | **Toss & cash in** when at max stack; **spawn** hint area |
| Overlays | Hit flash, overload, deposit toast |

---

## 11. Juice and audio

Floating text, particles, `playJuiceSound` — see `juice/` modules.

---

## 12. Technical stack

Vite, Three.js, `src/main.ts` → `Game`. GLB assets under `public/` with procedural fallbacks.

---

## 13. Config index (where to tune)

| Topic | Primary module |
|--------|----------------|
| Player lives / game over | `juiceConfig.ts` (`PLAYER_MAX_LIVES`), `Game.ts`, `juice/lifeHudJuice.ts` |
| Player / ghost speeds | `gameplaySpeed.ts`, `ghostConfig.ts` |
| Vision cone shape / LOS / hunt timers | `ghostConfig.ts` |
| Ghost hit loss, i-frames, knockback | `ghostConfig.ts` |
| Room cleanliness math | `roomCleanlinessConfig.ts`, `clutterSpawnConfig.ts` |
| Room-clear upgrades | `upgradeConfig.ts`, `roomClearUpgrade.ts` |
| Gates / cinematic timing | `doorUnlockConfig.ts`, `Game.ts` |
| Doors / layout | `doorLayout.ts`, `DoorUnlockSystem.ts` |
| Mansion geometry | `mansionGeometry.ts`, `mansionRoomData.ts`, `mansionWalls.ts` |
| Traps | `TrapFieldSystem.ts` |
| Trash portals | `trashPortalConfig.ts`, `TrashPortalSystem.ts` |
| Deposits | `depositEvaluation.ts`, `depositScaling.ts`, `DepositController.ts` |

---

## 14. Minimal checklist (this build)

1. **XZ** movement, wall collision, optional **OTS** camera + **C** toggle.
2. **Stack**, ghost **hit** strips stack **and** costs **1 life**; at **0 lives**, **game over** + reload.
3. **Clutter** → **room %** → **clear** → **capacity/speed** upgrade + **gate** or **ghost purge**.
4. **Ghosts**: wander / chase (relic + vision hunt), **compact cone + LOS**, **high chase speeds**, contact damage, room clear removes/fades.
5. **Trash portal** deposits → **money** + overload presentation.
6. **HUD**: carry, **lives**, money, **room cleanliness**, toss at max stack.
