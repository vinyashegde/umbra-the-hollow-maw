# UMBRA: The Hollow Maw - Code Analysis & Bug Audit Log

Comprehensive audit and integration analysis across all subsystems and levels in `/workspace/limbo`.

---

## 1. Identified Issues & Fix Plan

### [BUG-01] [CRITICAL] Act 2 Air Duct Blocked by Crate
- **Location:** `src/levels/Act2_Maw.js:81`
- **Issue:** `helperCrate` was placed at `x: 820, y: 530, w: 38, h: 38`. The air duct crawlspace spans `x: 500` to `x: 900` with a 30px vertical gap (ceiling bottom `y: 550`, floor `y: 580`). The 38px crate spawns directly inside the 30px duct, permanently wedging into the ceiling and blocking the player from crawling through.
- **Resolution:** Relocate `helperCrate` to `x: 930, y: 536` in the Generator Room, directly under the one-way rung ladder leading to the circuit breaker platform.

---

### [BUG-02] [CRITICAL] Act 3 Collapsing Platforms Lack Physics Solids
- **Location:** `src/entities/Trap.js:164-209`, `src/levels/Act3_Lair.js:48-51`
- **Issue:** `CollapsingPlatform` instances were instantiated and rendered, but never registered with `physics.solids` or `physics.oneWayPlatforms`. As a result, they had no collision geometry, causing the player to fall straight through the bridge into the spikes below.
- **Resolution:** Equip `CollapsingPlatform` with an internal physics solid that supports the player when idle/shaking and descends as the platform falls.

---

### [BUG-03] [CRITICAL] Act 3 Chase Bulkhead Door Closes Too Fast
- **Location:** `src/levels/LevelManager.js:153-157`
- **Issue:** When the alarm lever is pulled at `x: 1820`, the bulkhead door at `x: 3300` begins closing after only 4.5 seconds. The distance is 1480px, requiring at least 6.16 seconds of non-stop sprinting (`runSpeed = 240px/s`) plus jump time over the collapsing bridge. It was mathematically impossible for the player to beat the chase. Additionally, the Stalker at `x: 850` was too far behind (970px) to pose an immediate threat.
- **Resolution:** Reposition the Stalker to `x: 1580` (240px behind the player) with high chase speed (`205px/s`) when the alarm sounds. Delay the bulkhead door descent to 7.2 seconds, allowing a thrilling, cinematic slide underneath before it slams shut.

---

### [BUG-04] [MEDIUM] Key Conflict for KeyF in Input System
- **Location:** `src/engine/Input.js:177, 180`
- **Issue:** `KeyF` was bound to `kInteract` in `Input.js`, while the in-game UI and Controls settings menu explicitly instruct the player to use `F` or `L` for the lighter/lantern.
- **Resolution:** Remove `KeyF` from `kInteract` (retaining `KeyE` and `ControlLeft`), and bind `KeyF` to `kLighterPressed` to match user expectations.

---

### [BUG-05] [MEDIUM] Active Timeout Leaks Across Level Restarts
- **Location:** `src/levels/LevelManager.js:118, 153`
- **Issue:** `setTimeout` handlers for chase bulkhead descent and checkpoint toast notifications were not cancelled when `loadAct()` or `reloadCheckpoint()` executed.
- **Resolution:** Store timer handles (`_chaseDoorTimer`, `_toastTimer`) and cancel them on act reload.

---

### [BUG-06] [LOW] Act 1 Ditch Stepping Height
- **Location:** `src/levels/Act1_Forest.js:33`
- **Issue:** Low ditch at `x: 850, y: 680` had a 100px vertical step up to `y: 580`.
- **Resolution:** Add an intermediate stepping ledge at `x: 970, y: 630` for smooth platforming cadence.

---

## 2. Integration Status Summary

| Subsystem | File | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Input** | `src/engine/Input.js` | Fixed | Resolved `KeyF` binding conflict |
| **Camera** | `src/engine/Camera.js` | Verified | Deadzone, look-ahead, and trauma decay functioning |
| **Audio** | `src/engine/Audio.js` | Verified | Web Audio synth with ducking & compressor verified |
| **Physics** | `src/engine/Physics.js` | Verified | Hazards ignored by kinematic solver for lethal contact |
| **Lighting** | `src/engine/Lighting.js` | Verified | 2D volumetric darkness & raycast shadows working |
| **Particles**| `src/engine/Particles.js` | Verified | Dust, sparks, splashes, and glass particles working |
| **Player** | `src/entities/Player.js` | Verified | Ledge mantle, crouching, hiding, and death working |
| **Traps** | `src/entities/Trap.js` | Fixed | Added solid collider support to `CollapsingPlatform` |
| **Act 1** | `src/levels/Act1_Forest.js`| Fixed | Safe checkpoints & smooth ditch step added |
| **Act 2** | `src/levels/Act2_Maw.js` | Fixed | Relocated crate out of duct, safe checkpoints verified |
| **Act 3** | `src/levels/Act3_Lair.js` | Fixed | Chase sequence rebalanced, safe checkpoints verified |
| **LevelMgr** | `src/levels/LevelManager.js`| Fixed | Triggers, hazard death, void death, respawn verified |
| **UI** | `src/ui/UI.js` | Verified | Stealth indicator, HUD prompts, touch controls active |
| **Tests** | `test/verify.js` | Verified | 23/23 automated headless tests passing |
