# Ghost-busters — design & implementation specification

This document describes **how the game works in the current codebase** (TypeScript + Three.js + Vite). If behavior diverges, **`src/` is authoritative** — update this file when systems change.

---

## Document map

| Section | Contents |
|--------|----------|
| [§1](#1-high-level-concept) | Genre, world shape, camera |
| [§2](#2-architecture--entrypoints) | `main.ts` → `mountGame` → `Game` |
| [§3](#3-game-progression) | Rooms, cleanliness, doors, boss |
| [§4](#4-main-simulation-loop-order) | Per-frame order inside `Game` |
| [§5](#5-complete-event-catalog) | Every notable game event (chronological / categorical) |
| [§6](#6-module-by-module-script-reference) | What each major script / folder does |
| [§7](#7-items-stack--collection) | Item types, stack, magnet |
| [§8](#8-ghosts-ai-contact-power-mode) | Ghost states, vision, hits, eat, spawns |
| [§9](#9-deposits-trash-portals--overload) | Deposit pipeline and UI feedback |
| [§10](#10-room-clear--upgrades--cinematics) | Room clear → upgrade → gate cinematic |
| [§11](#11-lives-failure--success) | Lives, run failed, boss victory |
| [§12](#12-input--hud--juice) | Controls, HUD regions, audio/VFX |
| [§13](#13-config-index-where-to-tune) | Tuning tables |

Cross-reference: environment art notes live in **`docs/MANSION_ENVIRONMENT_SPEC.md`**.

---

## 1. High-level concept

- **Genre**: **3D** hypercasual loop on **XZ**: move, fill a **stack** with pickups, **bank** at per-room **trash portals**, **clear rooms** by collecting **grid wisps** to raise **cleanliness to 100%**, and **avoid ghosts** that cost **lives** and strip the stack on contact. **Power pellets** grant a temporary **power mode** where ghosts can be **eaten** (Pac-Man–style).
- **World**: **Safe hub** (`SAFE_CENTER`) and a **linear chain** of **`NORMAL_ROOM_COUNT` normal rooms** (`ROOM_1` … `ROOM_10` in code) toward **−Z**, separated by **narrow door thresholds**. The **last** normal room id (`FINAL_NORMAL_ROOM_ID` = `ROOM_10`) hosts the **boss fight** (survive timer). All playable rooms use the **same square footprint** on XZ (`ROOM_HALF` in `mansionGeometry.ts`); see **`docs/MANSION_ENVIRONMENT_SPEC.md`** for layout detail.
- **Gates**: **`DOOR_COUNT`** equals **`NORMAL_ROOM_COUNT`** (10). Passage **0** (hub south wall) starts **open**. Deeper passages **1…9** unlock when **`ROOM_1`…`ROOM_9`** respectively reach **100% cleanliness** and the unlock flow runs. **`ROOM_10`** has **no further door** to open after clear (`doorIndex` is `null`) — instead the **boss** sequence applies when entering the final room.
- **Camera**: **Top-down follow** (default) or **over-the-shoulder** (toggle **C**); OTS movement is **camera-relative** on the ground plane. **Power mode** slightly pulls the camera (see `juiceConfig.ts`).

---

## 2. Architecture & entrypoints

### 2.1 `src/main.ts`

- Finds **`#game-viewport`**, shows **`#game-loading`** until async init completes.
- Calls **`startBackgroundMusic()`** (`juice/backgroundMusic.ts`).
- **`mountGameWithRetry`**: disposes any previous `Game`, then **`mountGame(host, { onRunFailedRetry })`** so **Retry** on run-failed can **remount** without a full page reload.
- Registers **Vite HMR** `dispose` to tear down the game on hot reload.

### 2.2 `src/systems/bootstrap/mountGame.ts`

**Async asset bootstrap** before `Game` construction:

1. Dynamic imports: **`Game.ts`**, ghost config, **ghost / player / bag GLTF** loaders, **wisp / relic / grid wisp / grid trap** GLTF loaders.
2. **`loadGateGltf()`** (`doors/gateGltfAsset.ts`) — double-door prototype for **`DoorUnlockSystem`** (same mesh source as `doubleDoorGltfAsset.ts`).
3. **`Promise.all`**: load ghost enemy, player character, carry bag, gate, and all pickup prototypes.
4. Logs warnings if GLBs fail (procedural fallbacks).
5. **`new Game(host, ghostTemplate?, playerTemplate?, onRunFailedRetry?)`**.

### 2.3 `src/core/Game.ts`

**Central orchestrator**: constructs **scene** (`createScene`), **player**, **stack**, **items**, **ghosts**, **doors**, **boss**, **room cleanliness**, **grid plans** (wisps/traps/power pellets), **traps**, **trash portals**, **deposits**, **upgrades UI**, and runs the **requestAnimationFrame** loop. Almost all **game-level events** either originate here or are invoked from here.

---

## 3. Game progression

### 3.1 Room cleanliness (primary gate)

- **`RoomCleanlinessSystem`** (`world/RoomCleanlinessSystem.ts`) tracks **0–100%** per **`ROOM_*`**.
- **Source of progress**: collecting **grid wisps** whose **`spawnRoomId`** matches that room. Each wisp adds **`100 / totalWispsInRoom`** percent (`cleanlinessPercentPerGridWisp` in `roomCleanlinessConfig.ts`). Totals come from **`planAllRoomGrids`** (`grid/planRoomGrids.ts`); the **boss room (`FINAL_NORMAL_ROOM_ID`)** gets **no** grid plan and **0** wisps in the totals map.
- At **100%**, the room is marked **cleared** once; **`onRoomCleared(roomId, doorIndex)`** fires.

**Note:** **`GameItem`** still includes **clutter** (with **haunted** flag) and **`ItemWorld`** / **`CollectionSystem`** support clutter pickup and reveal rules, but **`Game.ts` does not currently call `clutterPrefill`** — **room % is driven by grid wisps**, not legacy clutter counts. Modules like **`clutterPrefill.ts`** and **`RoomWispSpawnSystem.ts`** remain available for alternate content pipelines.

### 3.2 Rewards on clearing a room (`onRoomCleared`)

When **`ROOM_k`** hits 100% (`Game` constructor → `RoomCleanlinessSystem` callback):

1. **`doorIndexToOpenWhenRoomCleared(roomId)`** (`roomCleanlinessLayout.ts`): if **`roomIndex < DOOR_COUNT`**, **`doorIndex = roomIndex`**; else **`null`** (e.g. **`ROOM_10`**).
2. If **`doorIndex !== null`**, **`doorUnlock.unlockDoor(doorIndex)`** runs (logical unlock; physical swing is separate).
3. **`pickRunUpgradeOffers`** (`upgradePool.ts`) returns **three** eligible offers; **`roomUpgradePicker.show`** (if DOM present) or auto-pick first.
4. While the picker is open, **`roomUpgradePaused`** freezes simulation (render only).
5. On choice: **`applyRunUpgrade`**, **`completeRoomClearAfterChoice`**: **banner**, **floor label**, **float text**, then either **`beginRoomClearDoorCinematic(doorIndex)`** or **`ghostSystem.purgeGhostsForRoom(roomIndex)`** if no door.
6. **Intro cinematic** is started earlier via **`beginRoomClearIntroCinematic`** from the same callback chain (zoom + slow-mo + ghost fade window — see **`doorUnlockConfig.ts`** timings).

### 3.3 Door / area access

- **`DoorUnlockSystem`**: manages **locked/unlocked** state, **door mesh** (GLB or procedural), **blocker AABBs** for **`WorldCollision`**, **swing animation**, **spotlights**, **boss door trap** seal.
- **`canAccessRoomForSpawning`**: content systems (grid spawn, etc.) use **door progress** so deeper rooms stay empty until the chain allows access.

### 3.4 Final room (boss)

- **`BossRoomController`** (`boss/BossRoomController.ts`): when the player enters **`FINAL_NORMAL_ROOM_ID`** while the boss is **idle**, **`Game`** starts **boss intro cinematic**, then **`startFight()`**: seals entrance (**`setBossDoorTrap`**), spawns **boss ghost**, runs **survive timer** (`BOSS_SURVIVE_SEC`), **periodic pulses** (knockback), **minion spawns** on an interval, capped by **`BOSS_MINION_CAP`**.
- On timer complete: **`onVictory` → `completeBossRunVictory()`**: banner, ghost fade, **`bossVictoryOutroRemain`**; when elapsed, **run success overlay** + **Continue** remounts like retry.

### 3.5 Deposits (trash portals)

- **No currency** tied to door unlocks — doors open from **cleanliness**.
- **Trash portals** (`TrashPortalSystem`) pull the player when carrying items; **standing in disc** + input triggers **`DepositController`** sessions: arc flights, **overload** presentation, **`evaluateDeposit`** batch scoring (see **`economy/depositEvaluation.ts`**, **`depositScaling.ts`**, **`overloadDropConfig.ts`**).

---

## 4. Main simulation loop order

Simplified **per-frame** order inside `Game`’s `tick` (after loading gate):

1. **Early exit** if **`gameOver`**.
2. If **`roomUpgradePaused`**: render only, skip sim.
3. **Input**: joystick + keyboard → merge → **zero** if **`isInteractionCinematicBlocking()`** (room clear / door / boss intros) → **OTS remap** if needed.
4. **Player position / room queries**: hub banner hide, **trash portal** check, **`bossRoom.update`**, **room cleanliness HUD**.
5. **Traps**: `trapField.update` → optional **`onDamage`** → **`applyTrapDamageLoss`** (stack fraction, **no** life loss).
6. **Stack weight** → player **slow** / **drag** multipliers.
7. **`simDt`** (ghost-hit slow-mo, boss / room-clear slow-mo scale).
8. **`player.update`**, **trash suction**, **door unlock**, **item clutter gate reveal**, **room lock covers**, **trash portals update**, **item visuals**, **motion trail**.
9. **Power mode timer** decay; **HUD class** for power stripe.
10. **`collection.update`**: magnet + pickups → **`collected`** list.
11. **Per collected item**: **power pellet** → **`activatePowerMode`**; **grid wisp** → cleanliness + optional **scaled ghost spawn** (`gridGhostSpawn` + `wispCollectGhostSpawnProbability`); juice for wisp/relic/gem.
12. **`ghostSystem.update(..., powerMode)`** — frightened behavior when power mode active.
13. **`tryEatGhost`** if power mode (contact → ectoplasm burst, “Gotcha!”).
14. **`tryHitPlayer`** if not invuln / armed / blocked → **life--**, stack loss, bursts, **`lives <= 0` → run failed overlay**.
15. **Max stack** edge → optional **bag dispose** cinematic.
16. **`playerCharacter.update`** (animation state).
17. **Camera**: if **room clear intro**, **door cinematic**, or **boss intro** active → **manual camera** paths; else **`cameraRig.update`**.
18. **Item collect effects**, **bag throw**, **stack visual**, **deposit controller**, **deposit feedback**, **special relic spawns**, **relic foot arrow**.
19. **Boss victory outro** countdown → success overlay.
20. **`renderer.render`**, **perf** end frame.

---

## 5. Complete event catalog

Events are **named for design review**; hooks are in **`Game.ts`** unless noted.

### 5.1 Session / bootstrap

| Event | Description |
|--------|-------------|
| **App load** | `main.ts` mounts game, hides loading overlay. |
| **Asset preload** | Ghost, player, bag, gate, wisp/relic/grid prototypes load; failures log and use procedural meshes. |
| **Run RNG** | `createRunRandom()` (`core/runRng.ts`) seeds decor and gameplay rolls. |

### 5.2 Input & camera

| Event | Description |
|--------|-------------|
| **Move intent** | Joystick + keyboard merged; blocked during cinematics. |
| **Camera toggle** | **C** switches top-down ↔ OTS; persisted in `localStorage` (`juiceConfig.ts`). |
| **OTS remap** | Move strafe/forward relative to camera forward on XZ. |

### 5.3 Pickups & items

| Event | Description |
|--------|-------------|
| **Magnet pull** | Items in outer band slide toward player unless **magnet blocked** (ghost-hit window). |
| **Pickup blocked** | Ghost hit pickup lock or bag dispose or cinematic — no new ground pickups. |
| **Wisp collected** | Float “+1”, cleanliness register if **spawnRoomId**, run stat++, optional **ghost spawn roll** (scaled by progress in room, **MAX_ACTIVE_GHOSTS**, not during boss fight). |
| **Power pellet collected** | **`activatePowerMode`**: random duration in `[POWER_MODE_DURATION_MIN_SEC, MAX]`, sound, “POWER MODE!” text, viewport class. |
| **Relic / gem collected** | Juice sound where applicable; relic bank flow on **deposit** (see below). |
| **Stack push failure** | Non-haunted items need **`stack.push`**; overflow not collected. |
| **Haunted clutter** | `CollectionSystem` **detaches** without stacking — intended for risk/reward + **`SpecialRelicSpawnSystem`** hooks if used in a build that spawns clutter. |

### 5.4 Ghosts

| Event | Description |
|--------|-------------|
| **Spawn (map)** | Initial ghosts from **`partitionGhostSpawnsByRoom`** / **`GHOSTS_PER_ROOM`**. |
| **Spawn (runtime)** | Grid wisp pickup roll; **`spawnGhost`** with grid or **`resolveGhostSpawnFromHauntedClutter`** fallback. |
| **Wander / chase / hunt** | See **`GhostSystem`** + **`ghostConfig`**; **vision cone** + optional **LOS**; **relic** chase if carrying relic. |
| **Hub roam** | In **safe** without relic, chase from cone suppressed (wander). |
| **Gate cinematic roam** | **`gateCinematicRoamOnly`** — chases suppressed during gate intro. |
| **Power mode (fright)** | Ghosts use fright/chase grid speeds; player **`tryEatGhost`** removes ghost with shrink/eat animation. |
| **Player hit** | Knockback, i-frames, stack loss (scaled by **steady hands**), life loss, particles, optional **game over**. |
| **Post-hit** | Ghost **disengage**, separation, chase grace for new spawns. |
| **Room clear** | **Fade** during intro cinematic or **purge** if no door. |

### 5.5 Room cleanliness & doors

| Event | Description |
|--------|-------------|
| **Cleanliness step** | Each grid wisp in-room adds percent toward 100. |
| **Room cleared** | **`onRoomCleared`**: unlock door index, upgrade UI, floating “Room cleared!”, **beginRoomClearIntroCinematic**. |
| **Upgrade chosen** | **`completeRoomClearAfterChoice`**: banner, floor decal, float reward, **door cinematic** or **purge**. |
| **Door cinematic phases** | Approach door → hold (“Unlocked”) → return camera — see **`updateRoomClearDoorCinematic`**. |

### 5.6 Boss

| Event | Description |
|--------|-------------|
| **Enter final room** | If boss idle and intro not done → **boss intro cinematic** → **`startFight`**. |
| **Fight active** | Timer HUD replaces cleanliness bar for that room; pulses and minions. |
| **Survive complete** | **`onVictory`**, **`completeBossRunVictory`**, outro delay, **success overlay**. |

### 5.7 Deposits

| Event | Description |
|--------|-------------|
| **Enter / exit zone** | `DepositController` tracks **`wasInside`**; leaving mid-session **aborts** flight batch. |
| **Session start** | Overload eval from stack snapshot. |
| **Per item landed** | Portal pulse, float value text, overload impacts, screen shake. |
| **Session complete** | **`runDepositPresentationUi`**: relic celebration if relic in batch, overload burst, deposit complete feedback, **`evaluateDeposit`** totals. |

### 5.8 Traps

| Event | Description |
|--------|-------------|
| **Trap overlap** | Slow and/or **`onDamage`** fractional stack loss; **`applyTrapDamageLoss`** in `Game` (no life loss). |

### 5.9 Failure & success

| Event | Description |
|--------|-------------|
| **Run failed** | 0 lives → **`showRunFailedOverlay`** with stats + upgrade list + **Retry** → `onRunFailedRetry`. |
| **Run success** | Boss outro ends → **`showRunSuccessOverlay`** + **Continue** → remount. |

### 5.10 Meta / bag

| Event | Description |
|--------|-------------|
| **Stack at max (not in portal)** | **`tryStartBagDispose`** — bag throw cinematic, clears stack with overload-style presentation. |

---

## 6. Module-by-module script reference

Paths under **`src/`**. Grouped by folder; each entry is **one module’s responsibility**.

### 6.1 `core/`

| Script | Role |
|--------|------|
| **`Game.ts`** | Main game class: loop, pickups, ghosts, deposits, room clear, boss, HUD sync, dispose. |
| **`publicAsset.ts`** | Prefixes URLs with Vite **`import.meta.env.BASE_URL`** for `public/` files. |
| **`runRng.ts`** | Seeded RNG factory for a run. |
| **`types/GameItem.ts`** | Discriminated union of all pickup payloads (`wisp`, `relic`, `gem`, `power_pellet`, `clutter`). |

### 6.2 `systems/bootstrap/`

| Script | Role |
|--------|------|
| **`mountGame.ts`** | Preloads GLBs, constructs `Game`. |

### 6.3 `systems/player/`

| Script | Role |
|--------|------|
| **`PlayerController.ts`** | XZ movement, collision response, knockback, speed caps, OTS-related helpers. |
| **`PlayerCharacterVisual.ts`** | GLB or procedural mesh, animation blend, power/invuln visual hints. |
| **`playerGltfAsset.ts`** | Loads player GLB template. |
| **`SpecialRelicFootArrow.ts`** | World-space arrow toward active special relic. |

### 6.4 `systems/camera/`

| Script | Role |
|--------|------|
| **`CameraRig.ts`** | Top-down vs OTS, follow, stack zoom, power mode height, **resetOtsLookBlend** after cinematics. |
| **`cameraCollision.ts`** | OTS probe vs walls (used by rig). |

### 6.5 `systems/world/`

| Script | Role |
|--------|------|
| **`RoomSystem.ts`** | Room/area queries, bounds, which room player is in. |
| **`mansionRoomData.ts`** | **`NORMAL_ROOM_COUNT`**, ids, **`FINAL_NORMAL_ROOM_ID`**, **`roomNorthZ` / `roomSouthZ`**, **`RoomBounds`**. |
| **`mansionGeometry.ts`** | **`ROOM_HALF`**, corridor depth, world half extents. |
| **`mansionWalls.ts`** | Wall mesh generation / layout helpers (with environment). |
| **`WorldCollision.ts`** | Static AABBs + door blockers; **`resolveCircleXZ`** for characters/pickups. |
| **`collisionXZ.ts`** | Low-level circle vs AABB helpers. |
| **`RoomCleanlinessSystem.ts`** | Cleanliness %, cleared set, **`registerGridWispCollected`**. |
| **`roomCleanlinessConfig.ts`** | Percent per wisp from total count. |
| **`roomCleanlinessLayout.ts`** | Maps cleared room → **door index** to open. |
| **`RoomLockCoverSystem.ts`** | Visual covers for locked areas (`roomLockCoverConfig.ts`). |

### 6.6 `systems/doors/`

| Script | Role |
|--------|------|
| **`DoorUnlockSystem.ts`** | Door state, meshes, collision, swing, lights, boss trap, **tryCloneDoubleDoorVisual**. |
| **`doorLayout.ts`** | **`DOOR_COUNT`**, **`getDoorBlockerZ`**, **`roomIndexFromId`**. |
| **`doorUnlockConfig.ts`** | Door mesh scale, swing, spotlights, **room clear cinematic** durations. |
| **`doubleDoorGltfAsset.ts`** | Loads gate GLB, splits mesh for two pivots, template for clones. |
| **`gateGltfAsset.ts`** | Thin wrapper: preload gate for bootstrap. |
| **`splitMeshByCentroidX.ts`** | Splits indexed mesh into left/right leaves. |

### 6.7 `systems/grid/`

| Script | Role |
|--------|------|
| **`planRoomGrids.ts`** | Per-room **wisp/trap** placement on a grid; **skips final room**. |
| **`gridConfig.ts`** | Grid dimensions, trap/wisp fractions. |
| **`roomGridGeometry.ts`** | **`cellCenterWorld`**, **`worldToCellIndex`**. |
| **`instantiateGridRoomContent.ts`** | Spawns **grid wisps** into `ItemWorld`. |
| **`powerPelletSpawn.ts`** | Spawns **power pellets** from plans. |
| **`gridWispGltfAsset.ts`**, **`gridTrapGltfAsset.ts`** | GLB prototypes for grid pickups/traps. |
| **`gridGhostSpawn.ts`** | Random non-trap cell for **wisp-spawned ghost** placement. |

### 6.8 `systems/ghost/`

| Script | Role |
|--------|------|
| **`GhostSystem.ts`** | All ghost entities: update, spawn, hit, eat, vision cone mesh, grid nav, boss/minion roles. |
| **`ghostConfig.ts`** | Speeds, vision, hunt timers, **wisp ghost spawn curve**, **`MAX_ACTIVE_GHOSTS`**, colors, spawns. |
| **`ghostGridNav.ts`** | Cell-based movement for Pac-Man-style motion. |
| **`createGhostVisual.ts`**, **`ghostGltfAsset.ts`** | Visual setup / GLB. |
| **`ghostGemColor.ts`** | Gem tint when eating ghosts. |

### 6.9 `systems/boss/`

| Script | Role |
|--------|------|
| **`BossRoomController.ts`** | Phases idle / fighting / won, timer, pulses, minions, door seal. |
| **`bossRoomConfig.ts`** | Durations, colors, spawn positions, intro timing exports. |

### 6.10 `systems/items/` & `systems/collection/`

| Script | Role |
|--------|------|
| **`ItemWorld.ts`** | Map of world pickups, magnet, detach, recoverable drops, clutter fade vs doors. |
| **`ItemVisuals.ts`** | Mesh factory per item type. |
| **`pickupWorldState.ts`** | Whether a pickup can be collected (clutter gated by room). |
| **`PickupMotion.ts`** | Idle/bob motion for pickups. |
| **`CollectionSystem.ts`** | Magnet + overlap collect; **haunted clutter** bypasses stack. |

### 6.11 `systems/stack/`

| Script | Role |
|--------|------|
| **`CarryStack.ts`** | LIFO stack API, **push/popManyFromTop**. |
| **`StackVisual.ts`** | Bag mesh stack, animations. |
| **`bagGltfAsset.ts`** | Bag GLB. |
| **`stackWeightConfig.ts`** | Weight → speed/drag modifiers. |

### 6.12 `systems/deposit/` & `systems/economy/` & `systems/overload/`

| Script | Role |
|--------|------|
| **`DepositController.ts`** | Zone enter/exit, flight batching, overload session, callbacks to `Game`. |
| **`DepositFlightAnimator.ts`** | Arc paths for items into portal. |
| **`DepositZoneFeedback.ts`** | Screen-space / mesh feedback for deposits and overload. |
| **`depositEvaluation.ts`**, **`depositScaling.ts`** | Batch scoring presentation. |
| **`overloadDropConfig.ts`** | Overload thresholds and bonus multipliers. |

### 6.13 `systems/trash/`

| Script | Role |
|--------|------|
| **`TrashPortalSystem.ts`** | Portal discs per room, suction, combo pulse. |
| **`trashPortalConfig.ts`**, **`trashPortalLayout.ts`** | Layout and tuning. |

### 6.14 `systems/traps/`

| Script | Role |
|--------|------|
| **`TrapFieldSystem.ts`** | Trap meshes from grid plans, overlap tests, slow/damage callbacks. |

### 6.15 `systems/upgrades/`

| Script | Role |
|--------|------|
| **`upgradePool.ts`** | **`DEFINITIONS`**, **`pickRunUpgradeOffers`**, **`applyRunUpgrade`**. |
| **`runUpgradeState.ts`** | Mutable run state: speed, capacity, magnet stacks, haunted bonus, etc. |
| **`upgradeConfig.ts`** | **`INITIAL_STACK_CAPACITY`**, speed levels, caps. |

### 6.16 `systems/wisp/` & `systems/relic/`

| Script | Role |
|--------|------|
| **`SpecialRelicSpawnSystem.ts`** | Timed world relic offers with placement rules. |
| **`RoomWispSpawnSystem.ts`** | Legacy/runtime wisp spawner (module present; not wired in current `Game`). |
| **`wispSpawnConfig.ts`** | Caps / notes for legacy spawner. |
| **`wispGltfAsset.ts`** | Non-grid wisp GLB. |
| **`relicGltfAsset.ts`** | Relic GLB variants. |

### 6.17 `systems/clutter/`

| Script | Role |
|--------|------|
| **`clutterPrefill.ts`**, **`clutterSpawnConfig.ts`**, **`clutterGltfAsset.ts`**, **`clutterRevealOpacity.ts`** | Prefill pipeline and visuals for **clutter** — usable if a future build spawns clutter at init. |

### 6.18 `systems/scene/`

| Script | Role |
|--------|------|
| **`SceneSetup.ts`** | **`createScene`**: ground, player, pickups group, ghosts, deposit FX root. |
| **`mansionEnvironment.ts`**, **`groundDecor.ts`**, **`sceneLighting.ts`**, **`materialReadability.ts`** | Environment and readability passes. |
| **`createCamera.ts`**, **`createRenderer.ts`**, **`resize.ts`** | Baseline Three.js setup. |
| **`hubTitleFloorLabel.ts`**, **`roomClearedFloorLabel.ts`** | Floor text props. |

### 6.19 `themes/`

| Script | Role |
|--------|------|
| **`wisp/itemFactory.ts`** | **`createWispItem`**, **`createRelicItem`**, **`createClutterItem`**. |
| **`pellet/pelletMeshes.ts`** | Pellet + clutter stack mesh helpers. |

### 6.20 `juice/`

| Script | Role |
|--------|------|
| **`juiceConfig.ts`** | Pickup radii, deposit arcs, camera, **power mode** duration, lives, camera persistence. |
| **`juiceSound.ts`** | Central audio triggers. |
| **`floatingHud.ts`**, **`lifeHudJuice.ts`**, **`relicHud.ts`**, **`bagDisposeVfx.ts`**, **`ghostHitBagBurst.ts`**, **`ghostHitPelletBurst.ts`**, **`playerMotionTrail.ts`**, **`backgroundMusic.ts`** | VFX/HUD helpers. |
| **`runFailedOverlay.ts`**, **`runSuccessOverlay.ts`** | End-run UI. |

### 6.21 `ui/`

| Script | Role |
|--------|------|
| **`roomUpgradePicker.ts`** | Three-card upgrade UI bound to `#room-upgrade-overlay`. |

### 6.22 `systems/debug/`

| Script | Role |
|--------|------|
| **`PerfMonitor.ts`** | Frame timing / render stats (dev-oriented). |

### 6.23 `systems/sources/` & `systems/ghostPulse/`

| Script | Role |
|--------|------|
| **`sourceTypes.ts`** | Shared type stubs if any. |
| **`ghostPulseConfig.ts`** | Config fragment for legacy/alternate ghost pulse feature — verify usage if tuning. |

---

## 7. Items, stack & collection

- **`GameItem`** variants in **`core/types/GameItem.ts`**: **wisp** (optional **`spawnRoomId`**), **relic**, **gem**, **power_pellet**, **clutter** (**spawnRoomId**, **haunted**).
- **`CarryStack`**: stack of items for deposits and ghost hits; **magnet** pulls items in **`ItemWorld`** toward the player.
- **Collection** order: magnet pull, then radius test; **haunted clutter** and **power pellets** detach without going through **`stack.push`** first (pellet never stacks).

---

## 8. Ghosts: AI, contact, power mode

- **States** (see **`GhostSystem`**): **wander**, **chase** (relic or post-cone), **hunt** (timed cone aggro), **frightened** when **`powerMode`** is passed into **`update`**.
- **Vision**: cone + range + optional **line-of-sight** against **`WorldCollision`**.
- **Grid speeds**: separate constants for wander/chase/hunt/fright on the grid path.
- **Contact**: **`tryHitPlayer`** vs **`tryEatGhost`** (power mode); i-frames and **`ghostDamageArmed`** prevent immediate re-hit.
- **Scaling**: **`ghostRoomSpeedMul`**, **`ghostRoomVisualMul`** by room index; **boss** and **minions** use config in **`bossRoomConfig.ts`**.

---

## 9. Deposits, trash portals & overload

- Player must stand in **trash portal** region; **`DepositController.resolveDepositZone`** returns **null** when not in zone (see `Game` wiring).
- Flights are staggered; **overload** uses **`OVERLOAD_STACK_THRESHOLD`** and **perfect** full stack for bonus multipliers.
- **`runDepositPresentationUi`** handles **relic** celebration and **overload** burst when the deposit session completes.

---

## 10. Room clear, upgrades & cinematics

### 10.1 Upgrade definitions (current pool)

All defined in **`upgradePool.ts`**:

| ID | Title | Stackable | Effect (summary) |
|----|--------|-----------|------------------|
| `swift-stride` | Swift stride | Yes (cap by speed levels) | Increases **speed level** → **`speedForLevel`**. |
| `bag-expansion` | Bag expansion | Yes | +1 **max stack** slot. |
| `steady-hands` | Steady hands | Yes (max ~4 stacks) | Reduces **ghost hit stack loss** (`ghostHitLossReduction`). |
| `light-footing` | Light footing | Yes | +**encumbranceReliefStacks** — less slow when stack is heavy. |
| `magnet-band` | Wide magnet | Yes | +**magnetRangeStacks** — larger magnet radius. |
| `vacuum-pull` | Stronger pull | Yes | +**magnetPullStacks** — faster pull in outer band. |
| `portal-tug` | Portal tug | Yes | +**trashSuctionStacks** — stronger portal suction. |
| `echo-bait` | Echo bait | Yes | +**hauntedChanceBonus** (affects wisp ghost spawn curve + haunted systems). |
| `spectral-swarm` | Spectral bargain | No (once) | Slows ghosts (**`ghostSpeedRuntimeMul`**) + extra **haunted** bias. |
| `scavenger` | Scavenger | Yes | Stronger recall of **scattered drops** after hits. |
| `second-wind` | Second wind | Yes | +1 **life** if below max. |
| `respite-charm` | Respite charm | No (once) | +1 life **or** **ghostHitLossReduction** if already full HP. |

### 10.2 Cinematic timings

Exact seconds live in **`doorUnlockConfig.ts`** (`ROOM_CLEAR_*`, `ROOM_CLEAR_DOOR_*`, ghost fade windows). **`Game.ts`** implements **`beginRoomClearIntroCinematic`**, **`updateRoomClearIntroCinematic`**, **`beginRoomClearDoorCinematic`**, **`updateRoomClearDoorCinematic`**, and boss analogs.

---

## 11. Lives, failure & success

- **`PLAYER_MAX_LIVES`** (`juiceConfig.ts`): **3** — only **ghost hits** reduce lives (traps do not).
- **Run failed**: **`showRunFailedOverlay`** — rooms cleared, wisps collected, time, upgrades picked, **Retry** → **`onRunFailedRetry`**.
- **Boss success**: **`showRunSuccessOverlay`** after **`BOSS_VICTORY_OUTRO_SEC`** — **Continue** remounts.

---

## 12. Input, HUD & juice

- **HUD** (`index.html` regions): carry **count/max**, **camera hint**, **lives**, **room cleanliness** (or **boss survive** bar in final room), spawn hint, hit flash, overload/deposit toasts.
- **Juice**: **`playJuiceSound`**, floating text, particles, screen shake classes on **`#game-viewport`**, power mode class, ghost invuln class.

---

## 13. Config index (where to tune)

| Topic | Primary module(s) |
|--------|-------------------|
| Lives, power mode duration, pickup radii | `juice/juiceConfig.ts` |
| Player vs ghost speeds | `systems/gameplaySpeed.ts`, `systems/ghost/ghostConfig.ts` |
| Vision cone, hunt, LOS, separation | `systems/ghost/ghostConfig.ts` |
| Ghost hit loss, i-frames, knockback | `ghostConfig.ts` + `Game.ts` |
| Wisp→ghost spawn curve, max ghosts | `ghostConfig.ts`, `systems/grid/gridGhostSpawn.ts` |
| Room cleanliness math | `roomCleanlinessConfig.ts`, `RoomCleanlinessSystem.ts` |
| Grid density | `systems/grid/gridConfig.ts`, `planRoomGrids.ts` |
| Upgrades | `upgradeConfig.ts`, `runUpgradeState.ts`, `upgradePool.ts`, `ui/roomUpgradePicker.ts` |
| Gates, door swing, room-clear camera | `doorUnlockConfig.ts`, `DoorUnlockSystem.ts`, `Game.ts` |
| Mansion layout | `mansionGeometry.ts`, `mansionRoomData.ts`, `mansionWalls.ts`, `docs/MANSION_ENVIRONMENT_SPEC.md` |
| Traps | `TrapFieldSystem.ts`, `gridConfig.ts` |
| Trash portals | `trashPortalConfig.ts`, `TrashPortalSystem.ts` |
| Deposits & overload | `depositEvaluation.ts`, `depositScaling.ts`, `overloadDropConfig.ts`, `DepositController.ts` |
| Boss | `bossRoomConfig.ts`, `BossRoomController.ts` |

---

## 14. Minimal checklist (this build)

1. **XZ** movement, **`WorldCollision`**, optional **OTS** + **C** toggle.
2. **Grid wisps** → **room %** → **clear** → **pick 1 of 3 upgrades** → **door cinematic** or **ghost purge**; **ROOM_10** → **boss** after intro.
3. **Ghosts**: wander / chase / hunt / fright; **vision cone**; **power mode** eat; **contact** costs **life** + stack; **wisp spawn** scales with room progress.
4. **Trash portals** + **deposits** → batch / overload presentation.
5. **HUD**: carry, **lives**, **cleanliness** or **boss timer**; **Run failed** / **Run success** overlays with remount.

---

*End of specification.*
