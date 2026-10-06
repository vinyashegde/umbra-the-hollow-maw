# UMBRA: The Hollow Maw - Research & Development (R&D) Audit Log

Detailed R&D findings, mechanic deep-dives, edge cases, missing feature implementations, and continuous system verification.

---

## 1. R&D Discoveries & Planned Improvements

### [RND-01] [FATAL] Rope Climb Float Indexing Crash
- **Location:** `src/entities/Player.js:436, 452-458`
- **Root Cause:** When climbing up or down ropes, `this.ropeNodeIdx` changes by `dt * 4` (floating point). In `updateRopeClimb`, array indexing `rope.nodes[this.ropeNodeIdx]` receives a float, returning `undefined`. Accessing `node.x` immediately crashes the entire game loop with `TypeError: Cannot read properties of undefined (reading 'x')`.
- **Solution:** Index continuous rope position cleanly with clamped integer node indexing and segment interpolation.
- **Status:** Verified (Test 11).

---

### [RND-02] [MEDIUM] Mobile Touch Bottle Throw Aiming Defect
- **Location:** `src/levels/LevelManager.js:312-322`, `src/engine/Input.js`
- **Root Cause:** On touch devices where mouse position is default `(0, 0)`, tapping the on-screen "THROW" button computes trajectory towards world coordinates corresponding to screen origin `(0, 0)`. The bottle throws backwards and high into the upper-left sky rather than forward into the room.
- **Solution:** When throwing on touch or when mouse coordinates are at default `(0, 0)`, throw with a forward ballistic arc (`player.facing * 340, -180`), allowing seamless bottle distractions on mobile.
- **Status:** Verified.

---

### [RND-03] [FEATURE] Sprint-Slide Traversal Mechanic
- **Location:** `src/entities/Player.js`
- **Root Cause:** In *Limbo* and *Little Nightmares*, pressing crouch while sprinting executes a dramatic slide under low gaps. Currently, pressing crouch immediately clamps velocity to slow crawl speed (`75px/s`), halting momentum.
- **Solution:** Add `isSliding` state to `Player.js`. When sprinting (`|vx| > 160`) and pressing crouch, apply a sliding momentum boost (`290px/s`) with low friction and dust particles that allows sliding under closing bulkhead doors and low obstacles. Slide jumping also preserves momentum.
- **Status:** Verified (Test 12).

---

### [RND-04] [FEATURE] LocalStorage Progress Persistence & Resume
- **Location:** `src/levels/LevelManager.js`, `src/ui/UI.js`, `index.html`
- **Root Cause:** Accidental browser refreshes or device orientation changes completely wipe player progress back to Chapter I.
- **Solution:** Automatically save `{ act, checkpoint }` to `localStorage` on checkpoint activation and act transitions. Update the Title Screen to offer a "CONTINUE JOURNEY" option resuming directly at the saved checkpoint.
- **Status:** Verified (Test 13).

---

### [RND-05] [POLISH] Wading Water Splash & Ripple Audio
- **Location:** `src/entities/Mechanism.js:195-222`
- **Root Cause:** When the circuit breaker is flipped and electric water is de-energized, the player wades through the pool with no visual splash or aquatic audio.
- **Solution:** Trigger `particles.spawnSplash` and play soft water footsteps when player wades through the de-electrified pool.
- **Status:** Verified (Test 14).

---

### [RND-06] [GAME-FEEL] Hit-Stop (Freeze-Frame) Impact System
- **Location:** `src/main.js`, `src/entities/Player.js`, `src/entities/Trap.js`, `src/entities/Enemy.js`
- **Root Cause:** Heavy mechanical impacts (bear trap snaps, stalker kill grab) currently lack hit-stop (per `game-feel` skill pattern 2), feeling less impactful than classic cinematic platformers.
- **Solution:** Implement `game.hitStop(duration)` which pauses simulation physics for 60-90ms while maintaining real-time updates to accentuate dramatic impacts.
- **Status:** Verified.

---

### [RND-07] [BUG] Act 3 Floating Bottle on Missing Shelf
- **Location:** `src/levels/Act3_Lair.js:65`
- **Root Cause:** `bottle2` was placed at `(980, 502)`. In Act 3, Table 1 is at `x=720..830` and Table 2 is at `x=1100..1220`. At `x=980`, the floor is at `y=580`, leaving the bottle floating unsupported in mid-air in the middle of the room.
- **Solution:** Reposition `bottle2` to sit cleanly on Table 2 top at `x=1140, y=502`.
- **Status:** Verified (Test 15).

---

### [RND-08] [BUG] Proximity Calculation Mismatch on Bottle Pickup
- **Location:** `src/levels/LevelManager.js:294` vs `src/ui/UI.js:283`
- **Root Cause:** `UI.js` measured distance from bottle to `player.x`, while `LevelManager.js` measured from bottle to player center with a stricter radius (`36px` vs `45px`), resulting in cases where the HUD prompted "PICK UP BOTTLE" but pressing interact failed.
- **Solution:** Standardize both on center-to-center distance check (`radius < 48px`).
- **Status:** Verified (Test 15).

---

### [RND-09] [PERF/BUG] Redundant Double `physics.moveKinematic` Call
- **Location:** `src/entities/Player.js:292-302`
- **Root Cause:** `physics.moveKinematic` was called twice in succession on every frame for the player, doubling horizontal impulse pushes to pushables and wasting cycles.
- **Solution:** Clean up redundant first call, retaining the single authoritative kinematic update.
- **Status:** Verified.

---

### [RND-10] [POLISH] Camera Framing Center Offset & Property Normalization
- **Location:** `src/engine/Camera.js:97-99`
- **Root Cause:** Camera tracked `target.x` (left edge) and referenced `target.height` which was undefined (`Player` uses `this.h`). This kept camera focus pinned to the top-left rather than character center.
- **Solution:** Use `target.w || target.width` and `target.h || target.height` to frame character center.
- **Status:** Verified (Test 16).

---

### [RND-11] [POLISH] Rope Grab Tolerance Window
- **Location:** `src/entities/Player.js:422`
- **Root Cause:** Rope grab radius was set to 26px, which was overly punitive when jumping across the 400px wide ravine in Act 1.
- **Solution:** Expand grab radius to 38px for a responsive, fluid platforming feel.
- **Status:** Verified.

---

### [RND-12] [BUG] Pendulum Multi-Kill Loop & Impact Juice
- **Location:** `src/entities/Trap.js:124`
- **Root Cause:** `SwingingPendulum.update` checked collision without verifying `!player.isDead`, triggering multiple death calls per cycle.
- **Solution:** Guard with `!player.isDead` and spawn impact dust, audio, and camera trauma.
- **Status:** Verified.

---

### [RND-13] [STEALTH/BUG] Sneak Crawling Triggering Stalker Hearing
- **Location:** `src/entities/Enemy.js:89`
- **Root Cause:** Enemy hearing detection checked `Math.abs(player.vx) > 30` without verifying `!player.isCrouching`. Crawling past the Stalker at 75px/s within 90px alerted the monster, making close stealth impossible.
- **Solution:** Guard hearing detection with `!player.isCrouching` and provide moderate detection radius (140px) during sprint slides.
- **Status:** Verified (Test 17).

---

### [RND-14] [STEALTH/BUG] Stalker Proximity Kill Overriding Stealth Cover
- **Location:** `src/entities/Enemy.js:184`
- **Root Cause:** Stalker proximity kill triggered when `distToPlayer < 40` regardless of whether `player.isHiding` was true. Patrolling above or past workbenches instantly killed players hiding underneath.
- **Solution:** Guard kill grab with `!player.isHiding || this.state === 'CHASE'`.
- **Status:** Verified (Test 18).

---

### [RND-15] [GAMEPLAY/METRICS] Mobile Touch Jump Truncation on Quick Taps
- **Location:** `src/entities/Player.js:292-298`, `src/engine/Input.js`
- **Root Cause:** On touchscreen devices, tapping the virtual "JUMP" button releases the touch in <80ms, triggering `jumpJustReleased`. The variable jump cut multiplied `vy` by `0.45`, reducing jump height from 104px down to 21px. Quick taps were completely unable to clear 40–85px ledges.
- **Solution:** Guarantee a generous minimum jump height on touch taps (`minReleaseSpeed = 440px/s` on touch, giving ~58px guaranteed elevation) while preserving full 104px jump height on sustained hold and avoiding unwanted apex boosts.
- **Status:** Verified (Test 20).

---

### [RND-16] [GAMEPLAY/METRICS] Ledge Grab Velocity & Collider Restrictions
- **Location:** `src/entities/Player.js:347, 400-435`
- **Root Cause:** Ledge grabbing was blocked whenever `vy < -180`, preventing players from grabbing ledges during the rising phase of jumps. Additionally, `checkLedgeGrab` only tested static `solids` and ignored `pushables` (crates), meaning players couldn't grab crate lips, and the 26px radius was too restrictive.
- **Solution:** Remove `vy < -180` gating so rising jumps can catch ledge lips naturally, allow grabbing `pushables` (crates) for climbing/mantling, and broaden the lip window to `dx < 26, dy between -18 and +26`.
- **Status:** Verified (Test 19).

---

### [RND-17] [LEVEL-DESIGN] Act 2 Breaker Platform Height & Ladder Headroom Overlap
- **Location:** `src/levels/Act2_Maw.js:41-46`
- **Root Cause:** The Breaker Platform was placed at `y=440` (140px above ground, exceeding the player's 104px max jump). The one-way ladder rung at `x=940..1020, y=510` overlapped the solid platform at `x=980..1160, y=440`, leaving only 40px open space and causing the player's head to collide with the platform underside when jumping.
- **Solution:** Adjust platform to `y=465` (115px above ground; easily cleared from the 38px crate), and position two ladder rungs cleanly at `x=910..965` to the left of the platform (`y=525` and `y=480`) with 0 vertical overlap.
- **Status:** Verified (Test 22).

---

### [RND-18] [LEVEL-DESIGN] Act 1 Chasm Rope Height & Reachability
- **Location:** `src/levels/Act1_Forest.js:58-60`
- **Root Cause:** The chasm rope had 14 segments of 20px (`length=280px`) anchored at `y=220`. The bottom node hung at `y=500`, which was 80px ABOVE the player's standing ledge at `y=580`. Players jumping across the 400px chasm frequently flew underneath the rope.
- **Solution:** Extend rope to 17 nodes (16 segments = 320px), allowing the bottom nodes to hang at `y=540` directly across the player's jump arc.
- **Status:** Verified (Test 21).

---

### [RND-19] [LEVEL-DESIGN] Act 1 Pre-Chasm Obstruction Mound
- **Location:** `src/levels/Act1_Forest.js:43-45`
- **Root Cause:** A sheer 80px vertical block was placed at `x=1700, y=500` right before the chasm. Players running to build momentum for the chasm crossing slammed into this wall, losing all speed and forcing an awkward double jump on a 200px runway.
- **Solution:** Lower mound to a gentle 35px rise (`y=545, h=35`), allowing smooth run-ups or natural leap-overs.
- **Status:** Verified.

---

### [RND-20] [LEVEL-DESIGN] Act 1 Low Ditch Stepping Progression
- **Location:** `src/levels/Act1_Forest.js:33-36`
- **Root Cause:** Ditch is at `y=680` (185px drop from the cliff at `y=495`). The only stepping stone was at `x=980`, far to the right. Players landing on the left of the ditch felt trapped against the 185px vertical cliff face.
- **Solution:** Add a secondary stepping mound at `x=890, y=645, w=60, h=35`, creating a natural 3-step staircase out of the ditch with all rises <= 40px.
- **Status:** Verified (Test 21).

---

### [RND-21] [LEVEL-DESIGN] Act 2 Water Basin Exit Step
- **Location:** `src/levels/Act2_Maw.js:38-40`
- **Root Cause:** Generator basin floor is at `y=640`, 60px below the walkway at `y=580`. When water is de-electrified and player wades across, jumping out requires a full 60px lift against water drag.
- **Solution:** Add an industrial conduit step at `x=1390, y=610, w=30, h=30` at the right wall of the basin for effortless exit.
- **Status:** Verified (Test 22).

---

### [RND-22] [STEALTH/BUG] Act 3 Workbench Overhead Stealth Cover Detection
- **Location:** `src/entities/Player.js:130-133`
- **Root Cause:** `checkHiding` tested an overhead box of height 14px (`y: this.y - 12, h: 14`). When crouched under tables in Act 3 (table top at `y=520..534`, player crouched at `y=556`), the overhead box only reached up to `y=544`, leaving a 10px gap. Crouching under tables failed to register `isHiding = true`, resulting in immediate kills by the Stalker.
- **Solution:** Expand overhead check box to span 35px (`y: this.y - 35, w: 12, h: 36`), cleanly overlapping table tops and overhead ducts while maintaining lighter flame compromise logic.
- **Status:** Verified (Test 23).

---

### [RND-23] [INPUT] Unified Mobile Touch & Gamepad Jump Release Synthesis
- **Location:** `src/engine/Input.js:41-80, 175-215`
- **Root Cause:** `rawJumpReleased` was strictly checking keyboard release states (`isKeyJustReleased('Space')`). Releasing touch on mobile devices set `touchState.jump = false` but never triggered `jumpJustReleased`. As a result, variable jump cuts never operated on touch devices.
- **Solution:** Added `touchState.jumpJustReleased` flag in `setTouchAction('jump', false)` and synthesized `rawJumpReleased = (prevJump && !rawJump) || this.touchState.jumpJustReleased || keyboardRelease`, unifying jump release mechanics across touch, keyboard, and gamepads.
- **Status:** Verified (Test 20).

---

### [RND-24] [BUG/VISUAL] Mid-Jump Teleportation & "Thin Creature" Ledge Hang Distortion
- **Location:** `src/entities/Player.js:184, 279, 396-435, 579-645`
- **Root Cause:**
  1. Jump & Slide extreme squash/stretch (`squash = 0.7, stretch = 1.35`) compressed character width by 30% and stretched height by 35%, elongating the silhouette into a thin stick on jumps.
  2. Ledge grab allowed grabbing pushable crates (`physics.pushables`) and triggered during upward launch (`vy < -60`). When jumping next to a 44px crate (as shown in user screenshot `Screenshot_20261002_003839.jpg`), `checkLedgeGrab` prematurely aborted the jump arc, snapped the player to the crate corner, and teleported `this.y` to `cornerY - 10`.
  3. The `isHanging` render method discarded the character model and drew a narrow 16px wide triangular cone with an invisible `#080a0c` arm and a floating white dot, causing the character to appear like a deformed "thin creature" frozen on a knee-high box.
- **Solution:**
  1. Moderated jump squash/stretch to volume-preserving `squash = 0.92, stretch = 1.10`, slide to `squash = 1.15, stretch = 0.85`, landing to `squash = 1.12, stretch = 0.90`.
  2. Guarded `checkLedgeGrab` against ascending jump velocities (`if (this.vy < -60) return;`), excluded pushable crates entirely, and required structural ledges (`h >= 55`). Positioned hanging body naturally below the lip at `cornerY + 4`.
  3. Redesigned the `isHanging` rendering with a complete silhouette character: two visible grasping arms clutching the stone lip, hooded head tilted upward, glowing white eye with soft aura, draped cloak body, and dangling legs.
- **Status:** Verified (Test 19).

---

### [RND-25] [GAMEPLAY/TRAVERSAL] Rope Swing Impulse & Dismount Re-Grab Lock
- **Location:** `src/entities/Player.js:485-560`, `src/engine/Physics.js:288-295`, `src/levels/Act1_Forest.js:38-60`
- **Root Cause:**
  1. When leaping off a rope via `jumpJustPressed`, the jump button is held across subsequent frames (human key press duration ~100-200ms). Because `checkRopeGrab` was called without a release cooldown, the player was immediately recaptured on frame 2 at `nodeX, nodeY`, freezing velocity to 0 and locking the player onto the rope.
  2. `VerletRope.applyImpulse` only added displacement to the bottom node (`nodes[nodes.length - 1]`), causing delayed, sluggish swing feedback when the player was holding higher segments.
  3. In Act 1, the chasm rope anchor was placed at `x=2180`, 180px away from the left cliff edge at `x=2000`. Even a maximum sprint jump only covers 137px, leaving the rope out of reach (54px gap vs 38px grab radius) and causing players to plunge into the pit.
- **Solution:**
  1. Implemented `ropeCooldown = 0.35` in `Player.js` upon jumping off, preventing immediate re-grab lock and allowing the player to cleanly fly free.
  2. Updated `applyImpulse(fx, nodeIdx)` in `Physics.js` and `Player.js` to target the grabbed node directly for instantaneous lateral responsiveness.
  3. Relocated the Act 1 chasm rope anchor to `x=2110` (110px from left cliff) and tuned the right landing cliff to `x=2360` (chasm width 360px). Both walking jumps and running jumps can catch the rope comfortably, and the forward swing leap deposits the player safely onto the right landing cliff with generous mantle forgiveness.
- **Status:** Verified (Test 24).

---

### [RND-26] [VISUAL/SPRITESHEET] High-Definition Silhouette Character Spritesheet
- **Location:** `assets/player_spritesheet.png`, `assets/player_animations.json`, `src/entities/Player.js:72-88, 592-760`
- **Feature & Implementation:**
  1. Generated an authentic, atmospheric 1280x800 transparent RGBA spritesheet (`assets/player_spritesheet.png`) embodying the dark cinematic silhouette art style of *Limbo* and *Little Nightmares*.
  2. Extracted and normalized 5 complete animation sets into standardized 160x160 cells:
     - **Row 0: Idle** (6 frames): Subtle breathing, cloak rustle, and piercing glowing white circular eyes with soft ethereal bloom.
     - **Row 1: Run** (8 frames): Dynamic stride cycle with billowing, flowing ragged cloak trailing backward.
     - **Row 2: Jump & Airborne** (6 frames): Velocity-mapped launch anticipation, rising leap, apex float, glide descent, and landing recovery.
     - **Row 3: Crawl & Slide** (6 frames): Low sneak crawl and streamlined slide traversal poses.
     - **Row 4: Ledge Hang & Mantle** (6 frames): Wall clutch, ledge lip grip, pulling up, and mantle recovery.
  3. Integrated a responsive animation state machine in `Player.js` with speed-scaled run animation, velocity-mapped jump frames, and dynamic lighter flame rendering attached to the character's hand.
  4. Preserved procedural vector rendering as an automatic graceful fallback for headless testing and instant initialization before assets load.
- **Status:** Verified (Test 25).

---

## 2. Implementation & Verification Tracking

| ID | Component | Status | Notes |
| :--- | :--- | :--- | :--- |
| **RND-01** | `Player.js` (Rope Climb) | Verified | Continuous clamped segment interpolation |
| **RND-02** | `LevelManager.js` / `Input.js` (Touch Throw) | Verified | Fallback ballistic arc for touch |
| **RND-03** | `Player.js` (Sprint-Slide) | Verified | Slide momentum boost & dust emission |
| **RND-04** | `LevelManager.js` / `UI.js` (Save/Resume) | Verified | LocalStorage checkpoint persistence & Continue button |
| **RND-05** | `Mechanism.js` (Water Splash) | Verified | Splash particles & wading footstep foley |
| **RND-06** | `main.js` (Hit-Stop) | Verified | Simulation freeze frame on heavy impacts |
| **RND-07** | `Act3_Lair.js` (Floating Bottle) | Verified | Placed on Table 2 top |
| **RND-08** | `LevelManager.js` / `UI.js` (Interact Proximity) | Verified | Unified center-to-center distance query |
| **RND-09** | `Player.js` (Duplicate Kinematic Call) | Verified | Removed redundant call |
| **RND-10** | `Camera.js` (Center Framing) | Verified | Framed on character center |
| **RND-11** | `Player.js` (Rope Grab Radius) | Verified | Generous 38px catch window |
| **RND-12** | `Trap.js` (Pendulum Guard) | Verified | Guarded against multi-kill loops |
| **RND-13** | `Enemy.js` (Crawl Hearing Silence) | Verified | Guarded sneak crawling against 90px sensor |
| **RND-14** | `Enemy.js` (Hiding Grab Immunity) | Verified | Protected players hiding under cover |
| **RND-15** | `Player.js` (Mobile Jump Height) | Verified | Minimum guaranteed tap height ~58px |
| **RND-16** | `Player.js` (Ledge Grab Overhaul) | Verified | Generous lip window and natural hanging coordinates |
| **RND-17** | `Act2_Maw.js` (Breaker Height & Ladder) | Verified | `y=465` platform + non-overlapping ladder rungs |
| **RND-18** | `Act1_Forest.js` (Chasm Rope Length) | Verified | 17 nodes (16 segments) hanging to `y=540` |
| **RND-19** | `Act1_Forest.js` (Pre-Chasm Mound) | Verified | Lowered to gentle 35px rise |
| **RND-20** | `Act1_Forest.js` (Ditch Staircase) | Verified | Secondary stepping mound at `x=890` (all dy <= 40px) |
| **RND-21** | `Act2_Maw.js` (Basin Exit Step) | Verified | Conduit step at `x=1390` |
| **RND-22** | `Player.js` (Table Cover Detection) | Verified | 35px overhead detection window for tables/ducts |
| **RND-23** | `Input.js` (Touch Jump Release) | Verified | Unified release synthesis across touch/gamepad/keys |
| **RND-24** | `Player.js` (Jump Teleport & Thin Form) | Verified | Ledge grab crate immunity, ascent guard, volume squash/stretch & new hang sprite |
| **RND-25** | `Player.js` / `Physics.js` (Rope Swing & Dismount) | Verified | Grab cooldown (0.35s), targeted impulse, and chasm geometry at x=2110/2360 |
| **RND-26** | `Player.js` / `assets/` (Player Spritesheet) | Verified | 1280x800 transparent spritesheet, 5 animation rows & state machine |


