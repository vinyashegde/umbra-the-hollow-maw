# UMBRA: The Hollow Maw
### A 2.5D Cinematic Horror Puzzle-Platformer
*Inspired by Limbo and Little Nightmares*

---

## Overview

**UMBRA: The Hollow Maw** is an atmospheric, high-contrast silhouette puzzle-platformer. Stepping into the shoes of **Nox**, a frail child in an oversized hooded shroud with luminous glowing eyes, the player must traverse through a treacherous foggy forest, a subterranean industrial labyrinth, and the lair of a grotesque blind creature known as **The Caretaker**.

---

## Key Features

- **Iconic Chiaroscuro & Silhouette Art**: Pure black foreground interactables, multi-layer parallax mist, industrial pipes, dead twisted pine trees, and a lone flicking lighter cutting through darkness.
- **Physical Puzzles (Limbo DNA)**:
  - Dragging wooden crates and logs to disarm snapping steel bear traps safely.
  - Multi-node Verlet rope physics: grabbing, swinging to build lateral momentum, and leaping across bottomless chasms.
  - Pushing heavy steel carts onto weighted pressure plates to unlock blast doors.
- **Claustrophobia & Creature Stealth (Little Nightmares DNA)**:
  - Crawling through tight metallic air ducts while dynamic camera zooms in close.
  - Evading sweeping watchtower searchlights by darting between cargo shadows.
  - **The Caretaker AI**: A towering hunchbacked stalker with elongated arms who hunts by sound.
  - **Sound Distraction Mechanics**: Picking up glass bottles, aiming trajectory arcs, and hurling them across the room to lure the creature away from hiding spots!
  - **Breathless Climax Chase**: Triggering the facility alarm, outrunning the roaring stalker over collapsing floorboards, and sliding under the descending heavy steel bulkhead into the break of dawn.
- **Tuned Platformer Feel (`platformer` & `game-feel` skills)**:
  - Asymmetric gravity (1.85× heavier fall gravity for punchy landings).
  - Coyote time (110ms) & jump buffering (140ms).
  - Variable jump height (tap for short hops, hold for full height).
  - Apex hang for air micro-control.
  - Squash and stretch animation feel.
  - Decaying quadratic trauma screen shake (`trauma^2`).
- **100% Procedural Web Audio Engine (`audio-design` skill)**:
  - Zero external sound asset downloads required.
  - Ambient sub-bass rumble (46Hz) and wind noise.
  - Dynamic heartbeat synthesizer that accelerates in speed and intensity as danger nears.
  - Material-based Foley footsteps (dirt thuds, hollow wood creaks, metallic clangs, water splashes).
  - Snapping bear trap crunches, electrical arcs, and eerie dissonant stingers.

---

## Controls

### Keyboard & Mouse
| Action | Input |
|---|---|
| Move Left / Right | `A` / `D` or `Left` / `Right` Arrow |
| Jump / Climb Rope Up | `W` / `Space` / `Up` Arrow |
| Crouch / Crawl / Drop Down | `S` / `Down` Arrow |
| Sprint | `Shift` (Faster, but alerts monsters) |
| Grab / Push / Pull / Flip Switch | `E` or `Ctrl` |
| Toggle Lighter / Lantern | `L` or `F` |
| Aim & Throw Bottle | `Mouse Move` (aim arc) + `Left Click` (throw) |
| Pause Menu | `Esc` or `P` |

### Gamepad (Xbox / PlayStation / Standard)
| Action | Input |
|---|---|
| Move / Crouch | Left Stick / D-Pad |
| Jump | `A` (Xbox) / `Cross` (PS) |
| Grab / Interact | `X` (Xbox) / `Square` (PS) or `RT` |
| Crouch / Crawl | `B` (Xbox) / `Circle` (PS) |
| Toggle Lighter | `RB` / `LT` |
| Pause | `Start` |

### Touch (Mobile & Tablet)
| Action | On-Screen Button |
|---|---|
| Move Left / Right | `◀` / `▶` Left D-Pad |
| Climb Up / Jump | `▲` or Large `JUMP` Button |
| Crouch / Crawl | `▼` D-Pad Down |
| Grab / Pull / Push | `GRAB` Button (`🖐`) |
| Fast Sprint | `RUN` Pill (`⚡`) |
| Toggle Lighter | `LIGHT` Pill (`🔥`) |
| Throw Bottle | `THROW` Pill (`🎯`) (unhides when holding bottle) |
| Aim Trajectory | Touch & drag anywhere across the canvas |
| Toggle Fullscreen | Top-right `⛶` Button or Title Screen Button |
| Pause Game | Top-right Pause Icon (`⏸`) |

---

## How to Run

The game is hosted with a lightweight, zero-dependency server:

```bash
# Start the local server
npm start
# or: node server.js
```

Then open in your browser:
**`http://localhost:8080/`**

---

## Architecture

- `index.html`: Canvas container, viewport layout, and cinematic UI modals.
- `style.css`: Dark aesthetic styling, film grain jitter, and radial vignette overlays.
- `src/main.js`: Fixed 60Hz physics loop, accumulator, and multi-pass render pipeline.
- `src/engine/Input.js`: Multi-device input manager with jump buffering and gamepad support.
- `src/engine/Camera.js`: Exponential smoothing, deadzone, look-ahead, dynamic zoom, and screen shake trauma.
- `src/engine/Physics.js`: AABB collision resolver, one-way platforms, pushable dynamics, and Verlet ropes.
- `src/engine/Audio.js`: 100% synthetic procedural Web Audio synthesizer.
- `src/engine/Lighting.js`: 2D dynamic point lights, sweeping spotlights, and volumetric shadow darkness mask.
- `src/engine/Particles.js`: Atmospheric dust motes, landing dust puffs, glass shards, and electric sparks.
- `src/entities/Player.js`: Kinematic controller, procedural silhouette rig with glowing eyes and flowing hooded cape.
- `src/entities/Crate.js`: Pushable physics boxes with weight and friction.
- `src/entities/Trap.js`: Bear traps, swinging pendulums, and collapsing floorboards.
- `src/entities/Mechanism.js`: Levers, pressure plates, sliding bulkhead doors, and electrified water pools.
- `src/entities/Throwable.js`: Distraction bottles with trajectory physics.
- `src/entities/Enemy.js`: "The Caretaker" stalker AI with hearing, vision, and grotesque reaching arm kinematics.
- `src/levels/LevelManager.js`: Multi-act coordination, parallax backgrounds, and fast checkpoint respawns.
- `src/levels/Act1_Forest.js`: Act I: The Whispering Woods.
- `src/levels/Act2_Maw.js`: Act II: The Rusted Maw.
- `src/levels/Act3_Lair.js`: Act III: The Caretaker's Domain & The Climax Chase.
- `src/ui/UI.js`: In-game contextual prompts, settings modal, and aiming trajectory reticle.
