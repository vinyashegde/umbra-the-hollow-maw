// =========================================================================
// main.js - Master Game Loop, Subsystem Orchestration & Render Pipeline
// =========================================================================

import { Input } from './engine/Input.js';
import { Camera } from './engine/Camera.js';
import { PhysicsWorld } from './engine/Physics.js';
import { LightingSystem } from './engine/Lighting.js';
import { ParticleSystem } from './engine/Particles.js';
import { AudioManager } from './engine/Audio.js';
import { Player } from './entities/Player.js';
import { LevelManager } from './levels/LevelManager.js';
import { UIManager } from './ui/UI.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Subsystems
    this.input = new Input();
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.physics = new PhysicsWorld();
    this.lighting = new LightingSystem(window.innerWidth, window.innerHeight);
    this.particles = new ParticleSystem();
    this.audio = new AudioManager();
    this.player = new Player(100, 480);
    this.levelMgr = new LevelManager(this);
    this.ui = new UIManager(this);

    // Game state
    this.isRunning = false;
    this.isPaused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.hitStopTimer = 0;
    this.FIXED_STEP = 1 / 60; // 60Hz physics

    this.initWindow();
  }

  initWindow() {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);

      this.camera.setViewport(w, h);
      this.lighting.resize(w, h);
    };

    window.addEventListener('resize', resize);
    resize();
  }

  start(actNum = 1, checkpointIndex = 0) {
    this.isRunning = true;
    this.isPaused = false;
    this.levelMgr.loadAct(actNum, checkpointIndex);
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  hitStop(duration = 0.08) {
    this.hitStopTimer = Math.max(this.hitStopTimer || 0, duration);
  }

  togglePause(forceState = null) {
    if (!this.isRunning) return;
    this.isPaused = forceState !== null ? forceState : !this.isPaused;

    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
      if (this.isPaused) {
        pauseMenu.classList.remove('hidden');
      } else {
        pauseMenu.classList.add('hidden');
        this.lastTime = performance.now();
      }
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    const delta = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // Handle Pause Toggle
    if (this.input.actions.pauseJustPressed) {
      this.togglePause();
    }

    if (!this.isPaused) {
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= delta;
      } else {
        this.accumulator += delta;
        while (this.accumulator >= this.FIXED_STEP) {
          this.update(this.FIXED_STEP);
          this.accumulator -= this.FIXED_STEP;
        }
      }
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 1. Input update
    this.input.update(dt);

    // 2. Physics & dynamic objects
    this.physics.update(dt);

    // 3. Player update
    this.player.update(dt, this.input, this.physics, this.audio, this.camera, this.particles);

    // 4. Level & enemies
    this.levelMgr.update(dt, this.player, this.input, this.physics, this.audio, this.camera, this.particles);

    // 5. Particles & Lighting
    this.particles.update(dt, this.camera);
    this.lighting.update(dt);

    // 6. Camera smooth follow & trauma shake
    this.camera.update(dt);

    // 7. Contextual HUD
    this.ui.update(this.player, this.levelMgr, this.camera, this.input);
  }

  render() {
    const ctx = this.ctx;
    const w = this.camera.viewportWidth;
    const h = this.camera.viewportHeight;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Parallax Sky & Background Silhouettes
    this.levelMgr.renderBackground(ctx, this.camera);

    // 2. Camera Transform Applied
    this.camera.apply(ctx);

    // 3. Solid Platforms & Foreground Hazards
    this.levelMgr.renderForeground(ctx, this.camera);

    // 4. Dynamic Level Entities (Puzzles, Traps, Crates, Ropes, Enemies)
    this.levelMgr.renderEntities(ctx, this.camera);

    // 5. Player Silhouette
    this.player.render(ctx);

    // 6. Particles (Dust motes, sparks, splashes)
    this.particles.render(ctx, this.camera);

    // 7. Aim Trajectory Arc (when holding bottle)
    this.ui.renderAimArc(ctx, this.player, this.camera, this.input);

    // Restore Camera Transform
    this.camera.restore(ctx);

    // 8. 2D Dynamic Lighting & Volumetric Darkness Mask Pass
    this.lighting.render(ctx, this.camera, this.physics.solids);
  }
}

// Instantiate and start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
