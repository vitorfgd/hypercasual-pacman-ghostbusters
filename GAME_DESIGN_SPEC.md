# Hypercasual Ghostbusters–Pac-Man — Design & Feature Specification

This document describes the **implemented** gameplay systems in this prototype so another agent or team can recreate a **similar** hypercasual game: top-down 3D movement, stack-based economy, timed “power pulses,” ghost AI, and hub upgrades.

---

## 1. High-level concept

- **Genre**: Mobile-style **hypercasual** action: drag to move, collect floating pickups, **bank** them at a central zone for money, **avoid ghosts** that steal part of your stack on contact, and use **automatic timed power windows** to turn the tables (eat ghosts for cash).
- **Fantasy**: A mansion layout with a **safe central hub** (deposit + shop pads) and **peripheral rooms** where wisps spawn and ghosts patrol.
- **Pacing**: Short feedback loops (pickup → stack growth → risk → deposit or loss); **larger stacks pay disproportionately more** when deposited, encouraging greed vs. safety.

---

## 2. Core game loop (frame-by-frame mental model)

1. **Input**: Player reads a **virtual joystick** (pointer on the WebGL canvas): direction and magnitude map to horizontal movement on **XZ**; releasing the stick stops active input (no coasting from stick alone; physics may still have knockback decay).
2. **Movement**: Player capsule moves with **max speed**, **drag**, optional **start boost** when stick goes from idle → active, **world collision** (slide along walls), and **ghost knockback** velocity that decays over time.
3. **Spawning**:
   - **Wisps** spawn on timers into **random normal rooms**, up to a global cap; position is randomized inside room bounds with inset from walls, validated against collision and distance from the **deposit circle**.
   - **Special relics** spawn on a **fixed interval**; each new relic **replaces** the previous world relic. Spawning shows UI/sound hooks (banner, SFX id in code).
4. **Collection**: While **not** in pickup-blocked state (see ghosts), pickups in range are **magnet-pulled** slightly toward the player; on overlap, items **push onto a vertical stack** (LIFO for loss and deposit order) with a max **capacity**.
5. **Risk — ghosts**: Each frame, ghosts update AI (wander / chase / frightened). If the player overlaps a ghost in **normal** mode: **hit** resolves once (with **invulnerability** and **re-arm** rules), **knockback**, **random fractional loss** of stack from the **top**, and juice (particles, flash). If **power mode** (pulse) is active: ghosts **cannot damage**; player can **eat** overlapping ghosts for a **fixed money reward** and ghost **respawn** after a delay.
6. **Automatic power pulse**: A **global clock** (not a pickup) cycles **interval** and **duration**. While the pulse is **active**, ghosts are **frightened**, player gets a **speed multiplier**, HUD shows tint + timer. While **inactive**, a bar shows **time until next pulse**. The clock **pauses advancement** while the player stands in the **deposit zone** or **any upgrade pad zone**; entering/leaving those zones **resets** the pulse timer to a “safe” phase so players cannot exploit AFK timing.
7. **Banking**: Stepping **into** the central **circular deposit zone** with a non-empty stack **snapshots** the stack and begins a **sequential deposit animation**: items fly from the stack toward the center, with optional **overload** styling (larger stacks). **Leaving** the zone mid-session **aborts**: already-flown items pay out; **remaining** items stay in the stack. Payout uses **sum of item values** × **batch multiplier** + optional **overload bonus**.
8. **Economy**: Money increases from deposits, ghost eats, etc. Money is spent at **upgrade pads** in the hub (stand on pad + tap **Upgrade** button).
9. **Render**: Follow camera, stack visuals, particles, fullscreen HUD overlays, then **WebGL render**.

This loop repeats indefinitely; there is **no win state** in code—it's an endless score/upgrade treadmill.

---

## 3. World layout & spaces

### 3.1 Room model

- The world is described by **axis-aligned room bounds** on **XZ** plus **corridor** strips (door connections). Each room has metadata: **id**, **bounds**, **type** (`safe` vs `normal`).
- **Queries**: For any point, systems can ask: which **room** (or null if not in a room interior), or **area** (room id, **`CORRIDOR`**, or null outside the playable footprint).
- **Spawn eligibility**: Wisps, relics, and ghost spawns use **normal** rooms only—not the safe center.

### 3.2 Central hub (safe zone)

- **Deposit**: Circular **gold** zone centered at **world origin** (0, 0) with a fixed **radius** (circle test on XZ). This is the only place stacks convert to money (aside from ghost-eat cash).
- **Upgrade pads**: Four pads arranged at fixed **offsets** from origin (corners of a square in **XZ**). Each pad has a **radius**; the **closest** pad wins if the player overlaps multiple. Pads show **occupancy** (0–1) when the player is near/inside.

### 3.3 Mansion rooms

- Multiple named rooms (e.g. compass-style: north, south, northeast, …) with **connected** graphs for design reference; gameplay primarily uses **bounds** + **corridors** for collision and spawn placement.
- **Ghosts** are spawned at **preset points** in **normal** rooms (not the safe center), each with a **distinct body color** for readability.

---

## 4. Player

### 4.1 Control scheme

- **Touch / mouse**: Joystick on the **canvas only** so HUD buttons remain clickable.
- **Mapping**: Screen-space stick defines a 2D vector; world movement on XZ uses the game’s **camera forward** convention (e.g. stick “up” maps to **−Z** forward for this project).

### 4.2 Movement tuning

- **Base max speed** is tuned so the player **outruns ghosts in a straight line**; threat is from **positioning and corners**, not raw ghost speed being higher than the player.
- **Upgrades** increase max speed per level on a linear curve from a **base** value.
- **Ghost pulse** applies an additional **multiplier** to effective max speed while active (on top of upgrades).

### 4.3 Knockback

- On ghost **hit**, the player receives **horizontal impulse** away from the ghost, with **exponential decay**; ghost AI may also **disengage** briefly so bodies separate.

### 4.4 Carrying a relic (aggro)

- If **any** item in the stack is a **relic**, a flag is exposed to ghost AI (e.g. **global aggro** or heightened behavior)—ghosts respond more aggressively while the player holds a relic.

---

## 5. Items & stack

### 5.1 Data model

- Every collectible is a **`GameItem`** with at least: **id**, **value**, **type**.
- **Wisp**: Low-level fodder; has a **hue** for visuals; value is randomized within a band at creation.
- **Relic**: High value; has **hue**, **relic variant** (e.g. two different GLB meshes), value rolled in a **higher band**.

### 5.2 Carry stack

- **Stack discipline**: **Last in, first out** for **ghost hits** (loss from the top) and **deposit peel** (top flies first).
- **Capacity**: Starts at a **fixed slot count**; **capacity upgrades** add +1 per purchase up to a **max level**.
- **Deposit snapshot**: Entering deposit captures the **current list**; if deposit **aborts** by leaving the zone, **partial** payout is computed for items that already landed; **remaining** items restore to the stack.

### 5.3 Stack visualization

- Items appear as a **vertical stack** anchored above the player with **bounce** when adding; **sync** runs on any stack change.
- **Estimated payout** HUD line shows **evaluateDeposit(current stack)** so the player sees ≈ cash if they bank now.

---

## 6. Pickups in the world (`ItemWorld`)

- Pickups are **pooled** / managed in a group; wisps can be **prewarmed** for fewer hitches.
- **Magnet**: Outside strict pickup radius, items in an outer **magnet band** **slide** toward the player at a set speed.
- **Collect**: On overlap, if stack has room, the world detaches the mesh and the item enters the stack; **pop** VFX timing is centralized.

---

## 7. Spawning systems

### 7.1 Room wisps

- **Goal**: Keep the mansion fed with **wisps** without cluttering the hub or walls.
- **Cap**: Maximum **active** wisps globally.
- **Timer**: After each successful spawn, next spawn delay is **random** between min/max seconds.
- **Placement**: Pick a **random eligible room**, random point inside **inset** AABB, **resolve** circle against walls, reject if not still in the intended room, reject if **too close** to deposit, retry up to **N attempts**; on repeated failure, **short retry delay**.
- **Wisp stats**: Random **scale-ish** parameters (e.g. size variance) and **value** rolled from a range.

### 7.2 Special relics

- On a **fixed interval** (seconds), spawn **one** relic in a random normal room (similar placement rules).
- **Only one** “special” relic pickup is tracked at a time in the world: spawning again **removes** the previous pickup if still present.
- **On spawn**: Banner text + sound hook; **foot arrow** at player points toward relic **XZ** until collected or replaced.

---

## 8. Deposit, economy, and risk–reward

### 8.1 Deposit session

- **Trigger**: Player crosses **into** deposit zone with **stack count > 0** while no session is active and no deposit flight is busy.
- **Overload classification**: If stack length ≥ **threshold**, the session is flagged **overload**; if stack length ≥ **max capacity**, **perfect overload** (stronger bonus / visuals).
- **Peel**: Items removed from **top** one by one; each flies **arc** (and **overload spiral** variant with extra duration/amplitude) to the center; per-item **landing** callbacks drive **SFX** and **overload vs normal** feedback.
- **Payout**: When the stack is empty, compute **base sum** of item values, apply **batch scaling**, add **overload extra** (if any), then `addMoney` once (or split between partial and completion depending on abort path).

### 8.2 Batch scaling (core hook)

- Multiplier grows with **item count** using **linear + quadratic** terms on `(n−1)` so **big deposits** are **superlinearly** better than banking repeatedly with tiny stacks.
- HUD toast can show **batch multiplier** and **base** vs **final** for transparency.

### 8.3 Abort (leave zone early)

- Flight **cancels**; items already deposited pay out with **batch rules** on the **completed subset**; **overload bonus** computed from that subset; **remaining** items go back to the stack.

### 8.4 Economy object

- Holds **money**; supports **add**, **conditional spend** for upgrades, and optional **callbacks** for HUD.

---

## 9. Ghosts

### 9.1 Roles

- **Antagonists**: Touch in **normal** mode causes **stack loss** (not full reset—**fractional** loss from top).
- **Prey during pulse**: In **power mode**, ghosts **flee**; contact **eats** them for **flat money**; they **respawn** after a timer.

### 9.2 AI states (conceptual)

- **Wander**: Random heading changes on timers, **steering** acceleration tuned for calm motion; **speed** is lower than chase.
- **Chase**: When player within **detection radius**, steer toward player; **faster** than wander but still **below player max speed** for straight-line chase.
- **Lose chase**: Hysteresis with a **larger** radius than detect so ghosts don’t flicker at the edge.
- **Frightened**: When **power mode** active, **flee** from player with separate speed/accel/smoothing; **visual** becomes blue/vulnerable.
- **Safe center**: While player is in **safe hub** bounds, ghosts **cannot chase** (or are otherwise neutralized in that region—implementation ties chase/fright to hub rules).
- **Separation**: Post-update pass **pushes overlapping ghosts apart** so they don’t stack.

### 9.3 Combat resolution

- **Hit**: Circle–circle on XZ with **player radius + ghost collision radius**. No damage during **player invuln** or during **power mode**.
- **Invulnerability**: After a hit, **timer** runs; during this time **no pickup** and **no** ghost hit re-arm until player clears **melee + padding** from all non-eaten ghosts (prevents spam in overlap).
- **Re-arm**: Separate flag so the first frame after i-frames doesn’t instantly re-hit if still touching—requires **clearance** from ghost bodies.
- **On hit**: Knockback, **random** loss between **min/max fraction** of **current** stack size (ceil to integer items), **burst particles** for lost items, **hit flash** HUD, ghost **disengage** behavior.

### 9.4 Eating ghosts

- Only when **power mode** on; **first** overlapping ghost gets eaten; **shrink** animation then hide; **reward** added to economy; **respawn** after delay at spawn point.

### 9.5 Visuals

- **GLB** optional: if load fails, **procedural** ghost mesh is used. Animations matched by **name** (idle, chase). Materials tint for **frightened** mode.

---

## 10. Ghost pulse (“power mode”) — automatic

- **No energizer pickup**: Power is **entirely time-based**, driven by upgrades.
- **Phase math**: Global clock modulo **interval**; first **duration** seconds of each cycle are **active** (clamped to a fraction of interval so phases never overlap).
- **HUD**:
  - **Tint** overlay when active.
  - **Timer bar**: fills with **remaining pulse time** when active; during idle, shows **progress toward next pulse** (distinct styling).
- **SFX**: One-shot when pulse **starts** (edge detect).
- **Pause zones**: **Deposit circle** and **upgrade pad zones** **freeze** the pulse clock and **reset** phase when entering/exiting (design: no idle farming in hub).

---

## 11. Upgrades (four tracks)

All purchased by **standing on a pad** (closest pad wins) and pressing a **dedicated Upgrade button** (not automatic spend).

| Track | Effect | Notes |
|--------|--------|--------|
| **Capacity** | +1 stack slot per level | Raises **max**; cost curve increases per level; **max levels** capped. |
| **Speed** | Increases player **max speed** per level | Linear increment from base. |
| **Pulse rate** | Shortens **interval** between pulses | Per level subtracts fixed seconds from interval down to a **floor**. |
| **Pulse time** | Lengthens **active duration** per cycle | Per level adds seconds; **capped** so duration never exceeds ~92% of interval (keeps idle gap). |

- **HUD card** shows **title**, **progress bar** (level / max), **cost**, **affordability**, **accent color**; button shows **MAXED** when capped.
- **Spend VFX**: Optional **coin burst** from pad world position toward screen (implemented as DOM/camera projection).

---

## 12. HUD & UX elements

- **Money**: Running total; **animates** bump on big deposits.
- **Carry**: `count / maxCapacity`; **estimated value** if non-empty.
- **Bottom hint**: Initial text points to deposit; **objective** line appears when **holding** items (“deposit at gold circle”).
- **Idle hint**: After **stillness** for N seconds **and** low speed **and** player **not** in a normal room, show **“Drag to move”** (teach controls).
- **Power timer**: bar + ARIA labels for accessibility.
- **Hit flash**: brief fullscreen-ish flash on ghost damage.
- **Ghost invuln**: **CSS class** on viewport for subtle state (e.g. desat or border).
- **Deposit toast**: shows **amount** + **hint lines** for overload / stack jackpot / multipliers.
- **Overload banner**: large **Overload** label + payout on **overload** deposits.
- **Relic**: **Spawn banner**, **pickup hint**, **bank celebration** + **screen spark burst** when a relic is deposited.

---

## 13. Juice, audio, and polish

- **Floating combat text**: `+1` on wisp pickup, `+$n` on money events, **big BANKED** text on large deposits.
- **Particles**: Ghost hit **pellet burst**; relic collect **burst**; **upgrade spend** coins.
- **Sounds**: Central **sound id** registry exists (`pickup`, `deposit`, `ghost_hit`, `ghost_pulse`, `relic_spawn`, …); **implementation may be stubbed**—hook points are ready for Web Audio or asset pipeline.
- **Camera**: Smooth follow with **height/back pull** slightly increasing with **stack count** for readability.

---

## 14. Technical implementation notes (for porting)

- **Stack**: TypeScript + **Three.js** + **Vite**; **GLB** assets under `public/` for player, ghost, wisps, relics, with **fallback** procedural meshes.
- **Bootstrap**: Async load GLBs; construct `Game` with optional templates.
- **Main loop**: `requestAnimationFrame`; fixed **dt** cap for stability.
- **Perf**: Optional **debug overlay** (draw calls, etc.) exists in code.
- **Build**: `base` path env for **GitHub Pages** subpath hosting.

---

## 15. Balance constants (reference snapshot)

Values are **tunable** in dedicated config modules; approximate categories:

- **Player**: base max speed, start-boost, radius, drag.
- **Ghosts**: wander/chase/fright speeds, detect/lose radii, steering, wander turn cadence, hit loss **30–50%** of stack (random), i-frame duration, knockback, eat reward, respawn time.
- **Pulse**: base interval ~10s, min interval floor ~5.25s, base duration ~2.75s, max duration cap, speed multiplier ~1.12x.
- **Wisps**: spawn interval ~0.82–1.55s, max active ~9, deposit min distance ~2.65m, room inset ~1.15m.
- **Relics**: interval ~30s, value ~72–120.
- **Overload**: triggers at stack ≥ **7**; bonus multiplier on deposit credit; **perfect** multiplies overload bonus further; longer deposit flight.
- **Deposit batch**: linear **0.062** per extra item, quadratic **0.0135** on `(n−1)²`.

---

## 16. Similar-game checklist (minimal feature set)

To match this prototype’s **feel**, implement at minimum:

1. Top-down **XZ** movement with **wall collision** and **virtual joystick**.
2. **Stack** with **LIFO** loss and **capacity**.
3. **Central deposit** with **partial payout** if leaving mid-deposit.
4. **Superlinear batch multiplier** on deposit size.
5. **Multiple ghosts** with **wander/chase/fright** and **safe hub** rules.
6. **Automatic pulse** with **HUD** + **pause in hub/pads** + **upgrades** to interval/duration.
7. **Timed special relic** + **world arrow**.
8. **Room-based** spawns with **inset** and **deposit exclusion**.
9. **Four upgrade pads** + **HUD purchase** flow.

This specification intentionally mixes **design intent** and **implementation truth** so a new agent can reproduce mechanics without reading the source tree line by line.
