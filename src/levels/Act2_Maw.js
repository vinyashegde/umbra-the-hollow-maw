// =========================================================================
// Act2_Maw.js - Act II: The Rusted Maw (Little Nightmares Inspiration)
// =========================================================================

import { Crate } from '../entities/Crate.js';
import { Lever, PressurePlate, SlidingDoor, ElectricWater } from '../entities/Mechanism.js';

export function setupAct2(physics, lighting, camera, levelMgr) {
  physics.clear();
  lighting.clear();

  const levelWidth = 3400;
  const levelHeight = 900;
  camera.setBounds(0, levelWidth, -200, levelHeight);

  // Subterranean dark lighting
  lighting.ambientLight = 0.12;

  // Checkpoints
  levelMgr.checkpoints = [
    { x: 120, y: 520, act: 2, name: 'The Submerged Pipe' },
    { x: 960, y: 520, act: 2, name: 'The Generator Room' },
    { x: 2200, y: 520, act: 2, name: 'The Searchlight Gantry' }
  ];

  // 1. Terrain & Solid Geometry
  // Starting floor
  physics.addSolid(0, 580, 500, 200, { material: 'metal' });

  // Claustrophobic Air Duct Crawlspace (x=500 to x=900)
  // Floor and Low Ceiling (height 30px, requires crouching/crawling)
  physics.addSolid(500, 580, 400, 200, { material: 'metal' });
  physics.addSolid(500, 510, 400, 40, { material: 'metal' }); // Low ceiling

  // Generator Room & Electric Water Basin (x=900 to x=1800)
  physics.addSolid(900, 580, 220, 200, { material: 'metal' }); // Left walkway
  // Depressed pool basin at x=1120 to x=1420
  physics.addSolid(1120, 640, 300, 160, { material: 'metal' }); // Basin floor
  physics.addSolid(1390, 610, 30, 30, { material: 'metal' }); // Conduit step for easy basin exit
  physics.addSolid(1420, 580, 400, 200, { material: 'metal' }); // Right walkway

  // Elevated Breaker Platform (accessible via crates & clean ladder rungs)
  physics.addSolid(970, 465, 190, 20, { material: 'metal' });
  physics.addOneWay(910, 525, 55, 10); // Lower ladder rung
  physics.addOneWay(910, 480, 55, 10); // Upper ladder rung

  // Searchlight Gantry (x=1820 to x=2800)
  physics.addSolid(1820, 580, 980, 200, { material: 'metal' });
  // Cover Obstacles (shadow crates player can hide behind)
  physics.addSolid(2080, 500, 40, 80, { material: 'metal', isCover: true });
  physics.addSolid(2420, 500, 40, 80, { material: 'metal', isCover: true });

  // Exit corridor & Bulkhead Door
  physics.addSolid(2800, 580, 600, 200, { material: 'metal' });

  // 2. Interactive Mechanisms
  // Electric Water Hazard
  const electricWater = new ElectricWater(1120, 595, 300, 45);
  levelMgr.electricWater = electricWater;

  // Circuit Breaker Lever (mounted on breaker platform at y=465)
  const breakerLever = new Lever(1040, 433, (isPulled) => {
    // Flipping breaker shuts off electricity
    electricWater.isElectrified = !isPulled;
  });
  levelMgr.levers = [breakerLever];

  // Heavy Sliding Bulkhead Door at x=3100
  const bulkheadDoor = new SlidingDoor(3100, 460, 28, 120, -115);
  const doorSolid = physics.addSolid(3100, 460, 28, 120, { material: 'metal' });
  levelMgr.doors = [{ mechanism: bulkheadDoor, solid: doorSolid }];

  // Heavy Cart & Weighted Pressure Plate for Bulkhead Door
  const steelCart = new Crate(2880, 530, 46, 46, 'metal');
  physics.addPushable(steelCart);

  const pressurePlate = new PressurePlate(3010, 574, 55, (isPressed) => {
    bulkheadDoor.setOpen(isPressed);
  });
  levelMgr.pressurePlates = [pressurePlate];

  // Pushable crate to reach elevated breaker platform in generator room
  const helperCrate = new Crate(930, 536, 38, 38, 'wood');
  physics.addPushable(helperCrate);

  // 3. Dynamic Lighting & Watchtower Searchlight
  // Swaying Halogen Lamp in Generator Room
  lighting.addPointLight(1050, 360, 220, 'rgba(255, 230, 160, 0.75)', 0.05);

  // Sweeping Searchlight
  const searchlight = lighting.addSpotlight(2300, 280, 380, Math.PI * 0.5, 0.55, 'rgba(255, 245, 220, 0.95)');
  searchlight.sweepSpeed = 1.4;
  searchlight.sweepRange = 0.65;
  levelMgr.searchlights = [searchlight];

  // 4. Crawlspace Camera Zoom Trigger
  physics.addTrigger(500, 480, 400, 100, () => {
    camera.setZoom(1.35); // Close-up claustrophobic view
  }, 'zoom');
  physics.addTrigger(900, 480, 100, 100, () => {
    camera.setZoom(1.0); // Normal view
  }, 'zoom');

  // 5. Act Exit Trigger (The Caretaker's Workshop)
  physics.addTrigger(3250, 460, 100, 140, () => {
    levelMgr.loadAct(3);
  }, 'exit');

  return {
    theme: 'factory',
    width: levelWidth,
    height: levelHeight,
    backdropLayers: [
      { depth: 0.15, color: '#06080b', pipes: true },
      { depth: 0.35, color: '#0d1117', girders: true },
      { depth: 0.65, color: '#131922', pipes: true }
    ]
  };
}
