# Ghost-busters prototype — design & implementation specification

This document describes **how the game works in the current codebase**: mechanics, data flow, and UI. It is meant to stay aligned with implementation in `src/` (TypeScript + Three.js + Vite).

---

## 1. High-level concept

- **Genre**: Top-down **3D** hypercasual loop on **XZ**: move, collect stackable pickups, **bank** at the hub for money, **avoid ghosts** that strip part of your stack on contact, and use **ghost pulse** (charged ability) to **eat** ghosts for cash.
- **World**: A **hub** at the origin (safe deposit + four upgrade pads) and a **north chain of rooms** (`ROOM_1` … `ROOM_5`) connected by corridors, with **doors** that unlock with gold. Wisps and ghosts use **room bounds + collision**; spawns avoid the hub.
- **Progression**: Money from deposits and ghost eats → **capacity / speed / pulse fill / pulse drain** upgrades at pads, and **door** payments to open new areas. **Quests** track relic + colored **gem** turn-ins at the hub.
- **End state**: There is **no coded win screen**; play is an open-ended loop (money, upgrades, rooms, repeating quests).

---

## 2. One-frame mental model (main loop)

Order of operations in `Game`’s animation tick (simplified):

1. **Input**: Read **virtual joystick** (pointer on the **WebGL canvas only**) and **keyboard** (WASD + arrows). Vectors are merged: keyboard wins whenever a movement key is held; otherwise joystick. Typing in inputs is ignored for movement.
2. **Player**: Integrate velocity with **drag**, **max speed** (upgrades + optional **pulse speed multiplier**), **start boost** when movement starts from idle, **wall collision** (circle vs static geometry), **ghost knockback** decay.
3. **World systems**: Upgrade zones, door unlock, **quest timer**, ghost AI, item idle motion, stack visual smoothing, deposit flights, room wisp spawns, special relic timer, relic foot arrow, camera rig, money HUD, collect effects.
4. **Pulse charge**: If the player is **outside** the safe center **and** not in the deposit disc **and** not on any **upgrade pad** zone **and** not in a **door pay** zone → `pulseCharge` increases toward 1 at **fill/sec** (from FILL upgrade). If the **PULSE** button is held and charge &gt; 0 → charge decreases at **drain/sec** (from DRAIN upgrade) and **pulse gameplay** is active (ghosts frightened, can be eaten, speed tint).
5. **Ghosts**: Update behavior from player position, **carrying relic** flag, safe-room rules, **pulse** (frightened) mode. **Eat** test: if pulse active and player overlaps a ghost → ghost is eaten, **flat money** reward, optional **gem** spawn at ghost position, respawn later. **Hit** test: if not pulse and not i-frames → knockback, **random fraction** of stack lost from **top**, particles, flash.
6. **Collection**: If not pickup-blocked (ghost hit i-frames), magnet pulls pickups; overlap pushes **GameItem** onto **CarryStack** (if capacity).
7. **Deposit controller**: If player **enters** hub deposit circle with stack non-empty → snapshot stack and run **sequential deposit flights**; leaving the circle **aborts** (partial payout rules).
8. **Render**: Scene + HUD overlays.

---

## 3. Input

| Channel | Behavior |
|--------|------------|
| **Touch / mouse** | Joystick on **canvas** only (`TouchJoystick`), so HTML HUD buttons stay clickable. |
| **Keyboard** | `KeyboardMoveInput`: **W A S D** and **arrow keys** (`event.code`), merged with joystick; keys take priority when held. Ignored while focus is in `input` / `textarea` / `select` / `contenteditable`. |
| **Pulse** | **Hold** `#hud-pulse-btn` (bottom area, toward the **right**). Pointer events on the button; not blocked by `pointer-events: none` on parent HUD wrappers. |

Movement convention: joystick **Y** is screen-down positive; **world forward** is **−Z** for this camera setup (`PlayerController` maps stick to `velocity.x` / `velocity.z` accordingly).

---

## 4. World, rooms, and collision

- **`RoomSystem`**: Classifies a point into a **room id** (e.g. `SAFE_CENTER`, `ROOM_1` … `ROOM_5`) or corridor / outside, using **axis-aligned bounds** from `mansionRoomData`.
- **`WorldCollision`**: Resolves the player circle against static geometry so the avatar slides on walls.
- **Hub**: **Deposit** is a **circle** centered at **(0,0)** on XZ (`DEFAULT_DEPOSIT_ZONE_RADIUS` in `DepositZone.ts`). **Upgrade pads** are **rectangles** (half-width × half-depth in `upgradeConfig.ts`), placed at **(±h, ±h)** with `UPGRADE_PAD_HUB_OFFSET`.
- **Doors**: Multiple door indices along the north chain; each has a **rectangular pay zone** in front of the threshold (`doorUnlockConfig.ts`, `doorLayout.ts`). **Barriers** and **pay pads** visibility follow unlock state.
- **Ghosts**: Spawn presets in `ghostConfig.ts` — **per-room** counts, **body color** per spawn, **room index** scales size/speed. Not placed in the safe center.

---

## 5. Items and `GameItem` types

All stackable collectibles implement **`GameItem`** (`core/types/GameItem.ts`):

| Type | Fields (extra) | Role |
|------|------------------|------|
| **wisp** | `hue`, `value` | Fodder; random value band at spawn. |
| **relic** | `hue`, `relicVariant` (0\|1), `value` | High value; special spawn timer; ghost aggro when carried. |
| **gem** | `gemColor` (`red` \| `blue` \| `green`), `value` | Dropped when a ghost is **eaten**; color derived from that ghost’s **body tint**; small deposit value (e.g. **$6**). |

**Stack (`CarryStack`)**: LIFO for **ghost hits** (pop from top) and **deposit** (peel from top). Capacity starts at **`INITIAL_STACK_CAPACITY`** and increases with **capacity** upgrades.

**Estimated payout**: HUD uses `previewCarryPayout` / `evaluateDeposit` on the current stack snapshot (includes gem values).

---

## 6. Pickups (`ItemWorld`)

- World pickups live under a scene **group**; each entry is **mesh + item**.
- **Magnet**: Outside strict pickup radius, items in an outer band **move toward** the player (`juiceConfig` radii/speed).
- **Pickup**: On overlap, **`stack.push(item)`**; if successful, mesh detaches for a short **collect pop** animation.
- **Meshes**: Wisps (GLB or procedural), relics (GLB or procedural), gems (**octahedron** facets, color by `gemColor`). **Canvas floor labels** on upgrade/door pads are **dirty-flagged** so textures are not redrawn every frame unless values change.

---

## 7. Spawning

### 7.1 Room wisps (`RoomWispSpawnSystem`, `wispSpawnConfig.ts`)

- Global cap **`WISP_SPAWN_MAX_ACTIVE`** (9).
- When under cap, after a **random** delay in **[min, max]** seconds, pick an **eligible room** (doors may block deeper rooms), random point with **inset**, collision checks, **min distance from deposit**, retry budget.
- Factory: `createWispItem(hue, value)` from `itemFactory.ts`.

### 7.2 Special relic (`SpecialRelicSpawnSystem`)

- Every **`SPECIAL_RELIC_INTERVAL_SEC`** (30): spawn **one** relic; **replaces** the previous world relic if still present.
- `createRelicItem()`; banner + SFX on spawn; **foot arrow** points to active relic XZ.

---

## 8. Ghosts (`GhostSystem`)

- States: **wander** vs **chase**; with **pulse** active, behavior is **frightened** (flee) and **vulnerable**.
- **Hit** (normal mode): circle–circle; **no hit** during player i-frames or while **pulse** is active. Loss: **random fraction** between config min/max of **current** stack count, **ceil** to whole items, popped from **top**.
- **Eat** (pulse mode): first overlapping non-eaten ghost is **marked eaten**; player receives **`GHOST_EAT_MONEY_REWARD`**; a **gem** is spawned at the ghost position with `createGemItem(gemColorForGhostBodyHex(bodyColor))`. Ghost **respawns** after timers.
- **Relic aggro**: `hasRelic()` on stack tightens ghost pressure when carrying a relic.
- **Separation**: Ghosts are pushed apart slightly each frame to reduce stacking.

---

## 9. Ghost pulse (charge + hold) — **not** an automatic timer

This replaced an older “automatic interval clock” design.

| Concept | Implementation |
|--------|------------------|
| **Charge** | Scalar **`pulseCharge`** in \[0, 1\]. Fills while **outside** `SAFE_CENTER` and **not** in deposit / **any upgrade pad** / **door pay** zone (`pulsePaused` in `Game.ts`). Fill rate from upgrades: **`pulseChargeFillPerSec`** (FILL track). |
| **Spending** | While **PULSE** button held and charge &gt; 0, charge **drains** at **`pulseChargeDrainPerSec`** (DRAIN track). |
| **Gameplay** | While holding with charge &gt; 0: **`GHOST_PULSE_SPEED_MULTIPLIER`** on player speed; ghosts in **frightened** mode; screen **tint**; top **bar** shows **charge %**; SFX on **edge** activate. |
| **HUD bar** | `#hud-power-timer` fill width = charge × 100%; styling differs idle vs active. |

Config reference: `ghostPulseConfig.ts` (multiplier only); fill/drain curves in `upgradeConfig.ts` (`pulseChargeFillPerSec`, `pulseChargeDrainPerSec`).

---

## 10. Deposit, economy, overload

- **Enter** deposit circle with stack → **snapshot** → sequential **arc flights** to center (`DepositFlightAnimator`). **Leave** circle mid-session → **abort** with rules for partial payout + stack restore.
- **Evaluation**: `evaluateDeposit` — sum **item.value**, then **`applyDepositBatchScaling`** (`depositScaling.ts`) so larger batches earn **superlinear** total vs many small banks.
- **Overload**: If stack length ≥ **`OVERLOAD_STACK_THRESHOLD`** (7), session is **overload**; if stack length = **max capacity**, **perfect** overload (stronger bonus multipliers, longer/spiral flights — see `overloadDropConfig.ts`).
- **Economy**: `Economy` holds balance; deposits **add** money; upgrades/doors **trySpend** in chunks.

---

## 11. Hub upgrades (four pads, no separate “Upgrade” HUD card)

Pads are **large rectangles** in hub corners with **floor canvas labels** (CAPACITY, SPEED, FILL, DRAIN) showing **progress bar**, **name**, and **$ remaining** or **MAX**.

- **Stand on pad** → that pad becomes the **active** pay target (closest pad wins if overlapping multiple).
- **Auto-pay**: Same rhythm as hub deposit — gold spends in **chunks** (`UPGRADE_PAY_CHUNK`) while you remain in zone and flights aren’t busy (`UpgradeZoneSystem`).
- **Costs**: Per-track curves in `upgradeConfig.ts` (`capacityUpgradeCost`, `speedUpgradeCost`, `pulseFillUpgradeCost`, `pulseDrainUpgradeCost`).

Tracks:

| Pad label | Effect |
|-----------|--------|
| **CAPACITY** | +1 max stack per level (capped). |
| **SPEED** | +max move speed per level. |
| **FILL** | Faster **pulse charge** gain outside safe room (when not paused). |
| **DRAIN** | Faster **pulse charge** loss while **holding** PULSE (more power usage per second). |

---

## 12. Doors (`DoorUnlockSystem`)

- **Sequential** locks: first **locked** door is the only one that accepts payment toward **`DOOR_UNLOCK_COST`**.
- **Stand in door pay rectangle** → auto-pay chunks (`DOOR_PAY_CHUNK`) like upgrades.
- **Floor labels** on each **locked** door show **$ remaining** (or full cost for later doors); **barriers** hide when unlocked.
- **Room access** for spawns: `canAccessRoomForSpawning` gates wisps/relics by door chain.

---

## 13. Quests (`QuestSystem`)

- **Always-on loop**: After a **short delay** at game start (**~2.8 s**), a quest becomes **active**. After **completion**, **~2.2 s** delay, the **same** quest starts again.
- **Objectives** (counted only from **hub deposit** sessions — items that actually bank): **1 relic**, **2 red gems**, **1 blue gem**. Progress is **cumulative** across multiple deposits until complete.
- **Gem colors** on quests: **red** and **blue** count; **green** gems can drop from green-tinted ghosts but do **not** advance the blue/red counters.
- **HUD**: `#hud-quest` (top-left under the charge bar) shows three lines; **hidden** when no active quest. **“Quest complete!”** floating text on finish.

---

## 14. HUD layout (HTML/CSS)

Approximate layout in `#game-viewport`:

| Region | Content |
|--------|---------|
| **Top center** | Ghost **pulse charge** bar (`#hud-power-timer`). |
| **Top strip** | **Carry** `count / max`, **≈ payout** (when stack non-empty), **money** (`#hud-top` / `#hud-row`). |
| **Below bar, left** | **Quest** panel (`#hud-quest`). |
| **Center** | **Objective** line when holding items (deposit hint). |
| **Bottom** | **Spawn / hint** text (`#hud-spawn`); **PULSE** button (`#hud-bottom-pulse`, aligned **center-right**). |
| **Full-screen** | **Hit flash**, **pulse tint** overlay. |
| **Toasts** | Deposit toast, overload banner, relic celebration layers. |

---

## 15. Juice and audio

- **Floating text**: e.g. `+$n` on ghost eat and deposit item land, `+1` on wisp pickup, **Quest complete!**, large **BANKED** on big deposits.
- **Particles**: Ghost hit **pellet burst** (colors from item type, including gems), relic bank **burst**, upgrade spend **coin VFX**.
- **Sounds**: Central `playJuiceSound` ids (`ghost_pulse`, `ghost_eat`, `deposit_item`, `pickup`, …); implementation may be minimal stubs.

---

## 16. Technical stack

- **Build**: Vite; entry `src/main.ts` mounts **`Game`** into `index.html`.
- **Rendering**: Three.js **WebGL**; viewport aspect clamped (e.g. 9:16 style frame).
- **Assets**: GLB under `public/` for player, ghost, wisp, relic; **procedural** fallbacks if missing.
- **Perf**: Optional **frame monitor**; **canvas textures** for pad labels update only when display values change.

---

## 17. Config index (where to tune)

| Topic | Primary module |
|--------|----------------|
| Player speed, ghost speeds, chase radii | `gameplaySpeed.ts`, `ghostConfig.ts` |
| Ghost hits, eat reward, respawn | `ghostConfig.ts` |
| Pulse speed multiplier | `ghostPulseConfig.ts` |
| Pulse fill/drain base + per-level | `upgradeConfig.ts` |
| Upgrade pad geometry / offset | `upgradeConfig.ts` |
| Wisp / relic spawn | `wispSpawnConfig.ts`, `RoomWispSpawnSystem.ts` |
| Deposit zone radius | `DepositZone.ts` |
| Deposit batch math | `depositScaling.ts`, `depositEvaluation.ts` |
| Overload | `overloadDropConfig.ts` |
| Doors | `doorUnlockConfig.ts`, `doorLayout.ts` |
| Quest targets / delays | `QuestSystem.ts` (constructor args in `Game.ts`) |
| Gem color from ghost | `ghostGemColor.ts` |

---

## 18. Minimal checklist to match this build

1. **XZ** movement, **joystick + WASD**, wall collision, knockback.
2. **Stack** with LIFO damage and deposit, **capacity** upgrades.
3. **Hub deposit** with batch scaling + **overload** path + abort rules.
4. **Ghosts**: wander/chase/frighten, safe hub rules, hit vs eat, **relic aggro**.
5. **Pulse**: **charge** outside safe (paused on deposit/pads/doors), **hold** to use, **FILL/DRAIN** upgrades.
6. **Four upgrade pads** with **auto-pay** in zone + **floor labels**.
7. **Doors** with **sequential** unlock and **pay zones**.
8. **Relic** timer spawn + **arrow**; wisps room-spawned.
9. **Gems** from **ghost eats** + **quests** tied to **hub deposits**.
10. **HUD**: top stats, **pulse bar**, **quest** block, **PULSE** button bottom.

This spec is **descriptive of the current repo**, not a wishlist; if behavior diverges, treat **source code** as authoritative and update this file when systems change.
