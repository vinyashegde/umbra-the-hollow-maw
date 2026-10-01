// =========================================================================
// Act1_Forest.js - Act I: The Whispering Woods (Limbo Inspiration)
// =========================================================================

import { Crate } from '../entities/Crate.js';
import { BearTrap, SwingingPendulum } from '../entities/Trap.js';
import { VerletRope } from '../engine/Physics.js';

export function setupAct1(physics, lighting, camera, levelMgr) {
  physics.clear();
  lighting.clear();

  // Set Level Boundaries
  const levelWidth = 3200;
  const levelHeight = 900;
  camera.setBounds(0, levelWidth, -200, levelHeight);

  // Background Ambience Lighting
  lighting.ambientLight = 0.16;

  // Checkpoints
  levelMgr.checkpoints = [
    { x: 120, y: 520, act: 1, name: 'Forest Awakening' },
    { x: 1100, y: 520, act: 1, name: 'The Trap Ravine' },
    { x: 1880, y: 520, act: 1, name: 'The Chasm Edge' },
    { x: 2460, y: 520, act: 1, name: 'The Whispering Elevator' }
  ];

  // 1. Terrain & Solid Geometry
  // Ground Sections
  physics.addSolid(0, 580, 580, 200, { material: 'dirt' }); // Starting ground
  physics.addSolid(545, 545, 35, 35, { material: 'wood' }); // Mossy root step for natural climbing
  physics.addSolid(580, 500, 270, 80, { material: 'wood' }); // Raised cliff ledge (height 80px)
  physics.addSolid(850, 680, 200, 200, { material: 'dirt' }); // Low ditch
  physics.addSolid(890, 645, 60, 35, { material: 'dirt' }); // Low ditch lower step
  physics.addSolid(980, 620, 70, 60, { material: 'dirt' }); // Low ditch upper step
  physics.addSolid(1050, 580, 750, 200, { material: 'dirt' }); // Trap clearing
  physics.addSolid(1800, 580, 200, 200, { material: 'dirt' }); // Chasm ledge left
  // Deep Chasm Pit at x=2000 to 2360
  physics.addSolid(2000, 760, 360, 100, { material: 'spikes', isHazard: true }); // Spikes at bottom
  physics.addSolid(2360, 580, 840, 200, { material: 'dirt' }); // Landing cliff right

  // Pre-chasm gentle terrain rise
  physics.addSolid(1700, 545, 100, 35, { material: 'dirt' }); // Gentle pre-chasm rise

  // 2. Pushable Crates / Logs
  const puzzleCrate1 = new Crate(440, 536, 44, 44, 'wood');
  physics.addPushable(puzzleCrate1);

  const disarmCrate = new Crate(1180, 536, 40, 40, 'wood');
  physics.addPushable(disarmCrate);

  // 3. Traps (Bear Traps)
  const trap1 = new BearTrap(1360, 566);
  const trap2 = new BearTrap(1440, 566);
  levelMgr.traps = [trap1, trap2];

  // 4. Swinging Rope over Chasm (17 nodes, 16 segments = 320px, reaches y=540)
  const rope = new VerletRope(2110, 220, 17, 20);
  physics.addRope(rope);

  // 5. Ambient Forest Lights
  // Bioluminescent mushrooms
  lighting.addPointLight(420, 570, 140, 'rgba(120, 220, 255, 0.4)', 0.08);
  lighting.addPointLight(1250, 570, 130, 'rgba(180, 240, 190, 0.35)', 0.06);
  // Lantern on high pole near elevator
  lighting.addPointLight(2950, 480, 240, 'rgba(255, 200, 110, 0.75)', 0.04);

  // 6. Act Exit Trigger (Subterranean Shaft Entrance)
  physics.addTrigger(3050, 460, 100, 140, () => {
    levelMgr.loadAct(2);
  }, 'exit');

  // Parallax backdrop data for Act 1
  return {
    theme: 'forest',
    width: levelWidth,
    height: levelHeight,
    backdropLayers: [
      { depth: 0.15, color: '#090c10', trees: true },
      { depth: 0.35, color: '#0f141a', trees: true },
      { depth: 0.65, color: '#171e27', trees: true }
    ]
  };
}
