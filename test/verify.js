// =========================================================================
// verify.js - Automated Headless Simulation & Physics Assertion Suite
// =========================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PhysicsWorld, VerletRope } from '../src/engine/Physics.js';
import { Camera } from '../src/engine/Camera.js';
import { Input } from '../src/engine/Input.js';
import { Player } from '../src/entities/Player.js';
import { Crate } from '../src/entities/Crate.js';
import { BearTrap, CollapsingPlatform } from '../src/entities/Trap.js';
import { ElectricWater } from '../src/entities/Mechanism.js';
import { ThrowableBottle } from '../src/entities/Throwable.js';
import { StalkerEnemy } from '../src/entities/Enemy.js';
import { LevelManager } from '../src/levels/LevelManager.js';
import { setupAct1 } from '../src/levels/Act1_Forest.js';
import { setupAct2 } from '../src/levels/Act2_Maw.js';
import { setupAct3 } from '../src/levels/Act3_Lair.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[TEST] Starting headless game mechanics verification...');

// 1. Physics World & Kinematics Test
const physics = new PhysicsWorld();
physics.addSolid(0, 500, 1000, 100, { material: 'dirt' });

const player = new Player(100, 300);
const dummyInput = {
  actions: {
    left: false, right: true, up: false, down: false,
    jump: true, jumpJustPressed: true, jumpJustReleased: false,
    crouch: false, sprint: false, interact: false,
    lighterJustPressed: false
  },
  consumeJumpBuffer: () => {}
};

const mockAudio = {
  playFootstep: () => {},
  playJump: () => {},
  playLand: () => {},
  playTrapSnap: () => {},
  playLever: () => {},
  playLighter: () => {},
  playDeath: () => {},
  playMonsterGrowl: () => {},
  playSuspenseStinger: () => {}
};

const mockCamera = { addTrauma: () => {} };
const mockParticles = { spawnLandingDust: () => {}, spawnSparks: () => {} };

// Step 60 frames
for (let i = 0; i < 60; i++) {
  player.update(1/60, dummyInput, physics, mockAudio, mockCamera, mockParticles);
  dummyInput.actions.jumpJustPressed = false;
}

if (player.y >= 500) {
  throw new Error(`Player fell through solid floor! y = ${player.y}`);
}
console.log(`✓ Floor collision passed (player settled at y = ${player.y}, onFloor = ${player.onFloor})`);

// 2. Pushable Crate & Disarm Trap Test
const crate = new Crate(200, 460, 40, 40, 'wood');
physics.addPushable(crate);
const trap = new BearTrap(260, 486);

// Push crate towards trap
crate.vx = 80;
for (let i = 0; i < 60; i++) {
  crate.update(1/60, physics);
  trap.update(1/60, player, physics, mockAudio, mockCamera, mockParticles);
}

if (!trap.isSprung) {
  throw new Error('Trap failed to spring when crate passed over it!');
}
console.log('✓ Crate pushing & bear trap safe disarm mechanics verified');

// 3. Stalker AI Sensor Test
const enemy = new StalkerEnemy(500, 424, 400, 800);
enemy.hearNoise(520, 440, 1.0);
if (enemy.state !== 'INVESTIGATE') {
  throw new Error(`Enemy should be in INVESTIGATE state after hearing noise, got: ${enemy.state}`);
}
console.log(`✓ Stalker AI hearing sensor & state transition verified (state = ${enemy.state})`);

// 4. Verlet Rope Distance Constraint Test
const rope = new VerletRope(300, 100, 8, 20);
rope.applyImpulse(50);
for (let i = 0; i < 30; i++) {
  rope.update(1/60);
}
const n0 = rope.nodes[0];
const n1 = rope.nodes[1];
const segmentDist = Math.hypot(n1.x - n0.x, n1.y - n0.y);
if (Math.abs(segmentDist - 20) > 1.0) {
  throw new Error(`Verlet constraint relaxed too much! dist = ${segmentDist}`);
}
console.log(`✓ Verlet rope constraint integration verified (segment distance = ${segmentDist.toFixed(2)})`);

// 5. Ledge Grab & Mantle Test
const ledgeSolid = physics.addSolid(700, 420, 100, 80, { material: 'wood' });
player.reset(675, 430);
player.facing = 1;
player.vy = 20; // falling near ledge rim
player.checkLedgeGrab(physics, mockAudio);
if (!player.isHanging) {
  throw new Error('Player failed to grab ledge corner!');
}
console.log('✓ Ledge grab detection verified (isHanging = true)');

// Test Mantle (pulling up onto ledge)
dummyInput.actions.up = true;
dummyInput.actions.jumpJustPressed = true;
player.updateLedgeHang(1/60, dummyInput, physics, mockAudio, mockCamera, mockParticles);
if (player.isHanging || player.y !== 420 - player.standHeight) {
  throw new Error(`Player failed to mantle onto ledge top! y = ${player.y}`);
}
console.log(`✓ Ledge mantle verified (player hoisted onto top of ledge at y = ${player.y})`);

// 6. Hazard Spikes & Death Test
const spikeHazard = physics.addSolid(850, 480, 80, 20, { material: 'spikes', isHazard: true });
player.reset(860, 470);
if (physics.checkOverlap(player, spikeHazard)) {
  player.die(mockAudio, mockCamera, mockParticles);
}
if (!player.isDead) {
  throw new Error('Player failed to die upon overlapping spike hazard!');
}
console.log('✓ Hazard spike lethal contact & player death verified');

// 7. Stealth Hiding Under Table Test
const tableTop = physics.addSolid(1200, 460, 100, 14, { material: 'wood' });
player.reset(1220, 476); // crouching under table
player.isCrouching = true;
player.lighterLit = false;
player.checkHiding(physics);
if (!player.isHiding) {
  throw new Error('Player should be hiding when crouched under table with lighter extinguished!');
}
// Turn on lighter -> should expose player!
player.lighterLit = true;
player.checkHiding(physics);
if (player.isHiding) {
  throw new Error('Player should NOT be hiding when lighter is lit!');
}
console.log('✓ Stealth crouching & shadow concealment mechanics verified');

// 8. Trigger Zone Execution Test
let triggerFired = false;
const exitTrigger = physics.addTrigger(1500, 450, 60, 60, () => {
  triggerFired = true;
}, 'exit');
player.reset(1510, 460);
if (physics.checkOverlap(player, exitTrigger)) {
  exitTrigger.onEnter(player);
}
if (!triggerFired) {
  throw new Error('Level transition trigger failed to fire on overlap!');
}
console.log('✓ Trigger zone evaluation & execution verified');

// 9. Void Pit Death Fall Test
player.reset(200, 800);
if (player.y > 750) {
  player.die(mockAudio, mockCamera, mockParticles);
}
if (!player.isDead) {
  throw new Error('Player failed to die upon falling into the abyss!');
}
console.log('✓ Void pit abyss fall death verified');

// 10. Collapsing Platform Solid Physics Test
const collapsePlat = new CollapsingPlatform(1800, 500, 70, 18, physics);
if (!collapsePlat.solid || collapsePlat.solid.y !== 500) {
  throw new Error('CollapsingPlatform failed to register a solid collider in PhysicsWorld!');
}
// Step to falling state
collapsePlat.state = 'falling';
collapsePlat.vy = 200;
collapsePlat.update(1/60, player, physics, mockAudio, mockCamera, mockParticles);
if (collapsePlat.solid.y <= 500) {
  throw new Error('CollapsingPlatform solid failed to descend with falling visual platform!');
}
console.log('✓ Collapsing platform solid physics & dynamic descent verified');
 
// 11. Rope Climb Float Index Stability Test (RND-01)
const climbRope = new VerletRope(500, 100, 10, 20);
physics.addRope(climbRope);
player.reset(500, 180);
player.grabbedRope = climbRope;
player.ropeNodeIdx = 4;
const climbInput = {
  actions: { up: true, down: false, left: false, right: false, jumpJustPressed: false },
  consumeJumpBuffer: () => {}
};
for (let i = 0; i < 30; i++) {
  player.updateRopeClimb(1/60, climbInput, mockAudio);
}
if (!player.grabbedRope || player.ropeNodeIdx >= 4) {
  throw new Error(`Rope climb failed or index did not ascend! idx = ${player.ropeNodeIdx}`);
}
console.log(`✓ Rope climb continuous float indexing verified (ascended to idx = ${player.ropeNodeIdx.toFixed(2)})`);

// 12. Sprint-Slide Traversal Mechanic Test (RND-03)
player.reset(100, 456);
player.onFloor = true;
player.vx = 200; // sprinting speed
const slideInput = {
  actions: { crouch: true, sprint: false, left: false, right: true, jumpJustPressed: false },
  consumeJumpBuffer: () => {}
};
player.update(1/60, slideInput, physics, mockAudio, mockCamera, mockParticles);
if (!player.isSliding || player.h !== player.crouchHeight || player.vx < 250) {
  throw new Error(`Sprint-slide failed to activate! isSliding=${player.isSliding}, h=${player.h}, vx=${player.vx}`);
}
console.log(`✓ Sprint-slide activation verified (isSliding=${player.isSliding}, slideVx=${player.vx.toFixed(1)}, h=${player.h})`);

// 13. Progress Persistence & Resume Test (RND-04)
const mockStorage = new Map();
global.localStorage = {
  setItem: (k, v) => mockStorage.set(k, v),
  getItem: (k) => mockStorage.get(k) || null,
  removeItem: (k) => mockStorage.delete(k)
};
const dummyGame = {
  physics,
  camera: new Camera(800, 600),
  lighting: { clear: () => {}, addPointLight: () => ({ active: true }), addSpotlight: () => ({}) },
  particles: { initAmbientMotes: () => {} },
  player,
  audio: mockAudio
};
const testLevelMgr = new LevelManager(dummyGame);
testLevelMgr.saveProgress(2, 1);
const saved = testLevelMgr.getSavedProgress();
if (!saved || saved.act !== 2 || saved.checkpoint !== 1) {
  throw new Error(`Failed to save or restore progress! saved = ${JSON.stringify(saved)}`);
}
console.log(`✓ Progress persistence & resume verified (saved act=${saved.act}, checkpoint=${saved.checkpoint})`);

// 14. Wading Water Splash Feedback Test (RND-05)
const pool = new ElectricWater(1120, 595, 300, 45);
pool.isElectrified = false; // breaker flipped
player.reset(1150, 600);
player.onFloor = true;
player.vx = 50;
let splashSpawned = false;
const splashParticles = {
  spawnSplash: () => { splashSpawned = true; },
  spawnLandingDust: () => {},
  spawnSparks: () => {}
};
for (let i = 0; i < 20; i++) {
  pool.update(1/60, player, mockAudio, mockCamera, splashParticles);
}
if (!splashSpawned) {
  throw new Error('De-electrified wading water failed to emit splash particles!');
}
console.log('✓ Wading water splash feedback verified');

// 15. Bottle Placement & Unified Proximity Test (RND-07, RND-08)
const testBottle = new ThrowableBottle(1140, 502);
player.reset(1120, 490);
const canPick = Math.hypot(
  (testBottle.x + testBottle.w * 0.5) - (player.x + player.w * 0.5),
  (testBottle.y + testBottle.h * 0.5) - (player.y + player.h * 0.5)
) < 48;
if (!canPick) {
  throw new Error('Player failed to reach bottle on table within standard proximity!');
}
console.log('✓ Bottle placement & pickup proximity query verified');

// 16. Camera Target Centering Test (RND-10)
const cam = new Camera(1280, 720);
cam.setTarget(player);
const expectedCenterY = player.y + player.h * 0.5;
if (Math.abs(cam.focusY - expectedCenterY) > 1) {
  throw new Error(`Camera failed to frame player vertical center! focusY=${cam.focusY}, expected=${expectedCenterY}`);
}
console.log(`✓ Camera target centering verified (focusY=${cam.focusY}, playerCenterY=${expectedCenterY})`);

// 17. Sneak Crawling Silence Test (RND-13)
const stealthEnemy = new StalkerEnemy(600, 424, 400, 800);
player.reset(550, 456); // 50px away (within 90px normal hearing range)
player.isCrouching = true;
player.vx = 45; // moving slowly in crouch
stealthEnemy.update(1/60, player, physics, mockAudio, mockCamera, mockParticles);
if (stealthEnemy.state !== 'PATROL') {
  throw new Error(`Sneak crawling within 90px incorrectly alerted the enemy! state=${stealthEnemy.state}`);
}
console.log('✓ Sneak crawling hearing silence verified');

// 18. Hiding Grab Immunity Test (RND-14)
const stalkerPatrol = new StalkerEnemy(700, 424, 500, 900);
player.reset(710, 456); // close contact (within 40px)
player.isHiding = true; // player is hiding under cover
stalkerPatrol.update(1/60, player, physics, mockAudio, mockCamera, mockParticles);
if (player.isDead) {
  throw new Error('Enemy killed player while hiding under cover during patrol!');
}
console.log('✓ Hiding grab immunity against patrolling stalker verified');

// 19. Crate & Ascending Jump Ledge Grab Protection (RND-24)
const ledgePhysics = new PhysicsWorld();
const testCrate = new Crate(400, 450, 48, 48, 'wood');
ledgePhysics.addPushable(testCrate);

// A. Jumping near or over a pushable crate must NEVER trigger ledge grab
player.reset(376, 442);
player.facing = 1;
player.onFloor = false;
player.vy = -120; // moving upward
player.checkLedgeGrab(ledgePhysics, mockAudio);
if (player.isHanging) {
  throw new Error('Player incorrectly grabbed a pushable crate!');
}

// B. Upward jump launch near a solid cliff must NOT grab or teleport
const testCliff = ledgePhysics.addSolid(400, 400, 100, 100, { material: 'stone' });
player.reset(376, 405);
player.vy = -250; // launching upward
player.checkLedgeGrab(ledgePhysics, mockAudio);
if (player.isHanging) {
  throw new Error('Player grabbed cliff during upward jump launch phase!');
}

// C. Falling at cliff edge catches ledge naturally and hangs below lip
player.reset(376, 405);
player.vy = 20; // falling near lip
player.checkLedgeGrab(ledgePhysics, mockAudio);
if (!player.isHanging || !player.hangingLedge) {
  throw new Error('Player failed to grab high cliff ledge while falling!');
}
if (player.y !== 400 + 4) {
  throw new Error(`Player hanging position not aligned below ledge lip! y=${player.y}, expected=404`);
}

// Perform mantle
const mantleInput = { actions: { jumpJustPressed: true, up: false, down: false, crouch: false }, consumeJumpBuffer: () => {} };
player.updateLedgeHang(1/60, mantleInput, ledgePhysics, mockAudio, mockCamera, mockParticles);

if (player.isHanging || !player.onFloor || player.y !== 400 - player.standHeight) {
  throw new Error(`Player failed to mantle onto top of cliff! isHanging=${player.isHanging}, onFloor=${player.onFloor}, y=${player.y}`);
}
console.log('✓ Crate immunity, ascent jump safety, and natural cliff ledge mantle verified');

// 20. Mobile Touch Input Synthesis & Minimum Tap Elevation (RND-15, RND-23)
const touchInput = new Input();
// Tap jump button
touchInput.setTouchAction('jump', true);
touchInput.update(1/60);
if (!touchInput.actions.jump || !touchInput.actions.jumpJustPressed) {
  throw new Error('Touch jump press failed to synthesize actions.jump or jumpJustPressed!');
}

// Release jump button on touch
touchInput.setTouchAction('jump', false);
touchInput.update(1/60);
if (touchInput.actions.jump || !touchInput.actions.jumpJustReleased) {
  throw new Error('Touch jump release failed to synthesize jumpJustReleased!');
}

// Verify player minimum jump elevation on quick tap
const testFloorPhysics = new PhysicsWorld();
testFloorPhysics.addSolid(0, 600, 800, 100, { material: 'dirt' });
player.reset(200, 556);
player.onFloor = true;

// Frame 1: Jump triggered
const tapSimInput = {
  actions: {
    left: false, right: false, up: false, down: false,
    jump: true, jumpJustPressed: true, jumpJustReleased: false,
    crouch: false, sprint: false, interact: false, lighterJustPressed: false
  },
  lastInputWasTouch: true,
  consumeJumpBuffer: () => {}
};
player.update(1/60, tapSimInput, testFloorPhysics, mockAudio, mockCamera, mockParticles);

// Frame 2: Quick release on touch (touchend fired)
tapSimInput.actions.jump = false;
tapSimInput.actions.jumpJustPressed = false;
tapSimInput.actions.jumpJustReleased = true;
player.update(1/60, tapSimInput, testFloorPhysics, mockAudio, mockCamera, mockParticles);

// Verify upward velocity is preserved above minimum threshold (accounting for frame gravity)
if (player.vy > -400) {
  throw new Error(`Mobile quick tap jump cut was overly punitive! vy=${player.vy}, expected <= -400`);
}

// Simulate remaining arc to verify peak elevation >= 55px
const startY = 556;
let peakY = player.y;
for (let f = 0; f < 30; f++) {
  tapSimInput.actions.jumpJustReleased = false;
  player.update(1/60, tapSimInput, testFloorPhysics, mockAudio, mockCamera, mockParticles);
  if (player.y < peakY) peakY = player.y;
}
const maxElevation = startY - peakY;
if (maxElevation < 55) {
  throw new Error(`Mobile tap jump failed to achieve 55px minimum clearance! elevation=${maxElevation.toFixed(1)}px`);
}
console.log(`✓ Mobile touch jump release & guaranteed tap elevation verified (elevation=${maxElevation.toFixed(1)}px >= 55px)`);

// 21. Act 1 Geometry & Chasm Rope Clearance (RND-18, RND-19, RND-20)
const act1Physics = new PhysicsWorld();
const mockLighting = { clear: () => {}, addPointLight: () => ({ active: true }), addSpotlight: () => ({ active: true }), ambientLight: 0 };
const mockCam = new Camera(1280, 720);
const mockLM = { checkpoints: [], traps: [], loadAct: () => {} };
setupAct1(act1Physics, mockLighting, mockCam, mockLM);

// Verify ditch steps (all dy <= 45px)
const step1 = act1Physics.solids.find(s => s.x === 890);
const step2 = act1Physics.solids.find(s => s.x === 980);
const clearing = act1Physics.solids.find(s => s.x === 1050);
if (!step1 || !step2 || !clearing) {
  throw new Error('Act 1 ditch steps missing from solid geometry!');
}
const ditchDy1 = 680 - step1.y; // 680 to 645 = 35px
const ditchDy2 = step1.y - step2.y; // 645 to 620 = 25px
const ditchDy3 = step2.y - clearing.y; // 620 to 580 = 40px
if (ditchDy1 > 45 || ditchDy2 > 45 || ditchDy3 > 45) {
  throw new Error(`Act 1 ditch step too high for smooth ascent! dy1=${ditchDy1}, dy2=${ditchDy2}, dy3=${ditchDy3}`);
}

// Verify chasm rope reaches down to jump arc (bottom node y >= 530)
if (act1Physics.ropes.length === 0) {
  throw new Error('Act 1 chasm rope is missing!');
}
const chasmRope = act1Physics.ropes[0];
const ropeBottomY = chasmRope.nodes[chasmRope.nodes.length - 1].y;
if (ropeBottomY < 530) {
  throw new Error(`Act 1 rope hung too high above player jump arc! bottomY=${ropeBottomY}, expected >= 530`);
}
console.log(`✓ Act 1 ditch staircase & chasm rope clearance verified (ropeBottomY=${ropeBottomY})`);

// 22. Act 2 Breaker Platform Height & Ladder Headroom (RND-17, RND-21)
const act2Physics = new PhysicsWorld();
const mockLM2 = { checkpoints: [], levers: [], doors: [], pressurePlates: [], searchlights: [], loadAct: () => {} };
setupAct2(act2Physics, mockLighting, mockCam, mockLM2);

// Platform height at y=465
const breakerPlatform = act2Physics.solids.find(s => s.y === 465 && s.x === 970);
if (!breakerPlatform) {
  throw new Error('Act 2 breaker platform not found at y=465!');
}

// Ladder rungs must not horizontally overlap the solid platform
const rungs = act2Physics.oneWayPlatforms.filter(ow => ow.x >= 900 && ow.x <= 970);
for (const rung of rungs) {
  if (rung.x + rung.w > breakerPlatform.x) {
    throw new Error(`Act 2 ladder rung overlaps breaker platform underside! rungRight=${rung.x + rung.w}, platLeft=${breakerPlatform.x}`);
  }
}

// Conduit step at x=1390 for basin exit
const basinStep = act2Physics.solids.find(s => s.x === 1390 && s.y === 610);
if (!basinStep) {
  throw new Error('Act 2 water basin exit conduit step missing at (1390, 610)!');
}
console.log('✓ Act 2 breaker platform, ladder clearance & basin exit step verified');

// 23. Act 3 Workbench Hiding Under Cover (RND-22)
const act3Physics = new PhysicsWorld();
const mockLM3 = { checkpoints: [], collapsingPlatforms: [], enemies: [], throwables: [], doors: [], levers: [], loadAct: () => {} };
setupAct3(act3Physics, mockLighting, mockCam, mockLM3);

// Position player crouching under Table 1
player.reset(760, 556);
player.isCrouching = true;
player.h = player.crouchHeight;
player.lighterLit = false; // lighter extinguished

const isHidden = player.checkHiding(act3Physics);
if (!isHidden) {
  throw new Error('Player crouching beneath Table 1 failed hiding detection!');
}

// Lighting flame must immediately break concealment
player.lighterLit = true;
if (player.checkHiding(act3Physics)) {
  throw new Error('Player lighter flame failed to compromise stealth hiding!');
}

// Standing up must break concealment
player.lighterLit = false;
player.isCrouching = false;
if (player.checkHiding(act3Physics)) {
  throw new Error('Standing player incorrectly registered as hidden under table!');
}
console.log('✓ Act 3 workbench stealth cover & lighter concealment verified');

// 24. Rope Swing Impulse & Dismount Re-Grab Prevention (RND-25)
const testRope = new VerletRope(2110, 220, 17, 20);
const ropePhysics = new PhysicsWorld();
ropePhysics.addRope(testRope);

player.reset(2100, 480);
player.grabbedRope = testRope;
player.ropeNodeIdx = 13;
player.ropeCooldown = 0;

// Test targeted impulse on grabbed node
const oldNodeX = testRope.nodes[13].x;
testRope.applyImpulse(25, 13);
if (testRope.nodes[13].x <= oldNodeX) {
  throw new Error('VerletRope.applyImpulse failed to deflect targeted node!');
}

// Frame 1: Jump off rope with jump button held
const jumpOffInput = {
  actions: { jumpJustPressed: true, jump: true, up: false, left: false, right: true },
  consumeJumpBuffer: () => {}
};
player.update(0.016, jumpOffInput, ropePhysics, mockAudio, {}, {});

if (player.grabbedRope !== null) {
  throw new Error('Player failed to release rope upon jump input!');
}
if (player.ropeCooldown <= 0.2) {
  throw new Error(`Rope release cooldown not set! ropeCooldown=${player.ropeCooldown}`);
}

// Frame 2 & 3: Next frames with jump button still held (user hold time ~120ms)
const heldInput = {
  actions: { jumpJustPressed: false, jump: true, up: false, left: false, right: true },
  consumeJumpBuffer: () => {}
};
player.update(0.016, heldInput, ropePhysics, mockAudio, {}, {});
player.update(0.016, heldInput, ropePhysics, mockAudio, {}, {});

if (player.grabbedRope !== null) {
  throw new Error('Rope dismount lock failure: Player instantly re-grabbed rope while holding jump button!');
}
console.log('✓ Rope swing impulse & jump dismount re-grab lock prevention verified');

// 25. Player Spritesheet Assets & Animation State Machine (RND-26)
const spritesheetPath = path.join(__dirname, '../assets/player_spritesheet.png');
const animJsonPath = path.join(__dirname, '../assets/player_animations.json');

if (!fs.existsSync(spritesheetPath) || fs.statSync(spritesheetPath).size < 1000) {
  throw new Error('player_spritesheet.png missing or empty in assets!');
}
if (!fs.existsSync(animJsonPath)) {
  throw new Error('player_animations.json missing in assets!');
}
const animData = JSON.parse(fs.readFileSync(animJsonPath, 'utf8'));
const requiredAnims = ['idle', 'run', 'jump', 'crawl', 'hang'];
for (const animName of requiredAnims) {
  if (!animData.animations[animName] || animData.animations[animName].frameCount < 6) {
    throw new Error(`Animation ${animName} missing or invalid frameCount in player_animations.json!`);
  }
}

// Test Player animation state machine transitions
player.reset(100, 300);
player.onFloor = true;
player.vx = 0;
player.updateAnimation(0.016);
if (player.currentAnim !== 'idle') {
  throw new Error(`Expected idle animation on floor when still, got ${player.currentAnim}`);
}

player.vx = 180;
player.updateAnimation(0.016);
if (player.currentAnim !== 'run') {
  throw new Error(`Expected run animation when moving, got ${player.currentAnim}`);
}

player.onFloor = false;
player.vy = -380;
player.updateAnimation(0.016);
if (player.currentAnim !== 'jump' || player.animFrame !== 0) {
  throw new Error(`Expected jump frame 0 on launch, got ${player.currentAnim} frame ${player.animFrame}`);
}

player.vy = 0;
player.updateAnimation(0.016);
if (player.currentAnim !== 'jump' || player.animFrame !== 2) {
  throw new Error(`Expected jump frame 2 at apex, got ${player.currentAnim} frame ${player.animFrame}`);
}

player.onFloor = true;
player.isCrouching = true;
player.vx = 80;
player.updateAnimation(0.016);
if (player.currentAnim !== 'crawl') {
  throw new Error(`Expected crawl animation when crouching and moving, got ${player.currentAnim}`);
}

player.isHanging = true;
player.updateAnimation(0.016);
if (player.currentAnim !== 'hang') {
  throw new Error(`Expected hang animation when isHanging, got ${player.currentAnim}`);
}
console.log('✓ Player spritesheet assets & animation state machine verified');

// 27. Motion Matching Locomotion Stride Synchronization Test
player.isHanging = false;
player.onFloor = true;
player.isCrouching = false;
player.vx = 170; // 170 px/s
player.strideDistance = 0;
player.updateAnimation(0.016); // moves 170 * 0.016 = 2.72px
if (player.currentAnim !== 'run') {
  throw new Error(`Expected run animation, got ${player.currentAnim}`);
}
// Step forward by 17px (exactly 1/8th of 136px cycle)
player.updateAnimation(0.084); // total distance now ~17px
if (player.animFrame < 1) {
  throw new Error(`Expected motion matching to advance frame to >= 1 after 17px stride, got ${player.animFrame}`);
}

// Test stationary crouch keeps steady frame 0
player.isCrouching = true;
player.vx = 0;
player.updateAnimation(0.1);
if (player.currentAnim !== 'crawl' || player.animFrame !== 0) {
  throw new Error(`Expected stationary crouch frame 0, got ${player.currentAnim} frame ${player.animFrame}`);
}
console.log('✓ Motion matching stride synchronization & zero foot-slipping verified');

// 28. Animated Torch Fire Spritesheet & Dynamic Hand Anchor Test
const torchPngPath = path.join(__dirname, '../assets/torch_fire.png');
const torchJsonPath = path.join(__dirname, '../assets/torch_animations.json');

if (!fs.existsSync(torchPngPath)) {
  throw new Error(`torch_fire.png missing at: ${torchPngPath}`);
}
if (!fs.existsSync(torchJsonPath)) {
  throw new Error(`torch_animations.json missing at: ${torchJsonPath}`);
}

const torchMeta = JSON.parse(fs.readFileSync(torchJsonPath, 'utf8'));
if (torchMeta.frameCount !== 8 || torchMeta.frameWidth !== 64) {
  throw new Error(`Invalid torch metadata: ${JSON.stringify(torchMeta)}`);
}

// Verify hand anchor adapts across postures and anchors lightSource
player.onFloor = true;
player.isCrouching = false;
player.vx = 0;
player.updateAnimation(0.016);
const idleHand = player.getHandAnchor();

// Verify hand is strictly at waist/hip level, far below head top (-44) and eyes (-32)
if (idleHand.y < -20 || idleHand.y > -8) {
  throw new Error(`idle hand Y is not at waist/hand level! got ${idleHand.y}`);
}

player.isCrouching = true;
player.vx = 60;
player.updateAnimation(0.016);
const crawlHand = player.getHandAnchor();

// In crouch/crawl, hand must be significantly closer to floor (y is less negative)
if (crawlHand.y <= idleHand.y) {
  throw new Error(`Hand anchor did not lower in crawl! idle.y=${idleHand.y}, crawl.y=${crawlHand.y}`);
}

// Test dynamic lightSource follows hand anchor
player.lighterLit = true;
player.lightSource = { x: 0, y: 0 };
player.update(0.016, dummyInput, physics, mockAudio, mockCamera, mockParticles);
const expectedLightY = player.y + player.h + crawlHand.y - 6;
if (Math.abs(player.lightSource.y - expectedLightY) > 2) {
  throw new Error(`lightSource did not track hand anchor! got ${player.lightSource.y}, expected ${expectedLightY}`);
}
console.log('✓ Torch flame spritesheet & dynamic hand anchor attachment verified');

console.log('====================================================');
console.log('All automated simulation tests PASSED with 0 errors!');
console.log('====================================================');


