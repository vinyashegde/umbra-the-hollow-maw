// =========================================================================
// Act3_Lair.js - Act III: The Caretaker's Domain & The Thrilling Chase
// =========================================================================

import { StalkerEnemy } from '../entities/Enemy.js';
import { ThrowableBottle } from '../entities/Throwable.js';
import { Lever, SlidingDoor } from '../entities/Mechanism.js';
import { CollapsingPlatform } from '../entities/Trap.js';

export function setupAct3(physics, lighting, camera, levelMgr) {
  physics.clear();
  lighting.clear();

  const levelWidth = 3600;
  const levelHeight = 900;
  camera.setBounds(0, levelWidth, -200, levelHeight);

  // Eerie red-amber workshop lighting
  lighting.ambientLight = 0.14;

  // Checkpoints
  levelMgr.checkpoints = [
    { x: 120, y: 520, act: 3, name: "The Caretaker's Workshop" },
    { x: 1450, y: 520, act: 3, name: 'The Breaker Corridor' },
    { x: 1720, y: 520, act: 3, name: 'The Alarm Mechanism' }
  ];

  // 1. Terrain & Solid Geometry
  // Workshop Entrance & Main Hall
  physics.addSolid(0, 580, 500, 200, { material: 'wood' });
  physics.addSolid(500, 580, 950, 200, { material: 'wood' }); // Patrol arena

  // Workbench Hiding Spots (Solid table tops, open hollow underneath for crouching)
  physics.addSolid(720, 520, 110, 14, { material: 'wood' }); // Table 1 top
  physics.addSolid(1100, 520, 120, 14, { material: 'wood' }); // Table 2 top
  // Table legs (slender colliders)
  physics.addSolid(720, 534, 8, 46, { material: 'wood' });
  physics.addSolid(822, 534, 8, 46, { material: 'wood' });
  physics.addSolid(1100, 534, 8, 46, { material: 'wood' });
  physics.addSolid(1212, 534, 8, 46, { material: 'wood' });

  // Breaker Alcove
  physics.addSolid(1450, 580, 550, 200, { material: 'metal' });

  // The Chase Section: Collapsing Bridge over Chasm
  physics.addSolid(2000, 580, 250, 200, { material: 'metal' });
  // Collapsing wooden floorboards
  const collapse1 = new CollapsingPlatform(2250, 580, 70, 18, physics);
  const collapse2 = new CollapsingPlatform(2370, 580, 70, 18, physics);
  const collapse3 = new CollapsingPlatform(2490, 580, 70, 18, physics);
  levelMgr.collapsingPlatforms = [collapse1, collapse2, collapse3];

  // Spikes below collapsing bridge
  physics.addSolid(2250, 760, 350, 100, { material: 'spikes', isHazard: true });

  // Landing bridge & Final Exit Bulkhead
  physics.addSolid(2600, 580, 1000, 200, { material: 'metal' });

  // 2. The Caretaker Stalker Enemy
  const stalker = new StalkerEnemy(850, 504, 600, 1200);
  levelMgr.enemies = [stalker];

  // 3. Throwable Glass Bottles on Shelves / Tables
  const bottle1 = new ThrowableBottle(380, 562);
  const bottle2 = new ThrowableBottle(1140, 502);
  levelMgr.throwables = [bottle1, bottle2];

  // 4. Final Escape Bulkhead Door at x=3300
  const finalBulkhead = new SlidingDoor(3300, 460, 32, 120, -110);
  const finalDoorSolid = physics.addSolid(3300, 460, 32, 120, { material: 'metal' });
  levelMgr.doors = [{ mechanism: finalBulkhead, solid: finalDoorSolid }];

  // Final Alarm Lever: Pulling starts the breathless chase!
  let chaseActive = false;
  const alarmLever = new Lever(1820, 548, (isPulled) => {
    if (!chaseActive && isPulled) {
      chaseActive = true;
      levelMgr.triggerChaseSequence(stalker, finalBulkhead);
    }
  });
  levelMgr.levers = [alarmLever];

  // 5. Lighting
  // Creepy swinging red workshop lamp
  lighting.addPointLight(950, 360, 260, 'rgba(255, 180, 100, 0.7)', 0.06);
  // Bright dawn light streaming from the final exit
  lighting.addPointLight(3450, 480, 450, 'rgba(255, 235, 195, 0.95)', 0.02);

  // 6. Victory Trigger at Dawn
  physics.addTrigger(3450, 460, 100, 140, () => {
    levelMgr.triggerVictory();
  }, 'victory');

  return {
    theme: 'lair',
    width: levelWidth,
    height: levelHeight,
    backdropLayers: [
      { depth: 0.15, color: '#07080a', cages: true },
      { depth: 0.35, color: '#0e1115', beams: true },
      { depth: 0.65, color: '#161a20', cages: true }
    ]
  };
}
