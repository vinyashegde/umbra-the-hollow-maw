// =========================================================================
// LevelManager.js - Act Coordination, Checkpoints, Fast Respawns & Parallax
// =========================================================================

import { setupAct1 } from './Act1_Forest.js';
import { setupAct2 } from './Act2_Maw.js';
import { setupAct3 } from './Act3_Lair.js';

export class LevelManager {
  constructor(game) {
    this.game = game;
    this.currentAct = 1;
    this.actData = null;

    // Checkpoint management
    this.checkpoints = [];
    this.activeCheckpointIndex = 0;

    // Entity collections
    this.traps = [];
    this.levers = [];
    this.doors = [];
    this.pressurePlates = [];
    this.throwables = [];
    this.enemies = [];
    this.collapsingPlatforms = [];
    this.searchlights = [];
    this.electricWater = null;

    // Chase mode state
    this.isChaseActive = false;
    this.chaseTimer = 0;

    // Death transition timer
    this.deathTimer = 0;
    this.respawning = false;
  }

  saveProgress(actNum, checkpointIndex) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('umbra_save', JSON.stringify({
          act: actNum,
          checkpoint: checkpointIndex,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      // Ignore private browsing quota limits
    }
  }

  getSavedProgress() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('umbra_save');
        if (saved) return JSON.parse(saved);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  loadAct(actNum, checkpointIndex = 0, isRespawn = false) {
    this.currentAct = actNum;
    this.activeCheckpointIndex = checkpointIndex;
    this.isChaseActive = false;
    this.respawning = false;
    this.deathTimer = 0;

    // Persist progress to localStorage
    this.saveProgress(actNum, checkpointIndex);

    // Clear any pending timers
    if (this._chaseDoorTimer) {
      clearTimeout(this._chaseDoorTimer);
      this._chaseDoorTimer = null;
    }
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }

    // Clear previous entities
    this.traps = [];
    this.levers = [];
    this.doors = [];
    this.pressurePlates = [];
    this.throwables = [];
    this.enemies = [];
    this.collapsingPlatforms = [];
    this.searchlights = [];
    this.electricWater = null;

    // Setup Act
    if (actNum === 1) {
      this.actData = setupAct1(this.game.physics, this.game.lighting, this.game.camera, this);
    } else if (actNum === 2) {
      this.actData = setupAct2(this.game.physics, this.game.lighting, this.game.camera, this);
    } else if (actNum === 3) {
      this.actData = setupAct3(this.game.physics, this.game.lighting, this.game.camera, this);
    }

    // Spawn player at chosen checkpoint
    const cp = this.checkpoints[checkpointIndex] || this.checkpoints[0];
    this.game.player.reset(cp.x, cp.y);
    this.game.camera.setTarget(this.game.player);
    this.game.camera.x = cp.x;
    this.game.camera.y = cp.y;
    this.game.camera.setZoom(1.0);

    // Attach player's lighter to lighting system
    const lighterLight = this.game.lighting.addPointLight(cp.x, cp.y, 160, 'rgba(255, 215, 140, 0.85)', 0.08);
    this.game.player.lightSource = lighterLight;

    // Initialize atmospheric motes
    this.game.particles.initAmbientMotes(this.game.camera.bounds);

    // Show chapter card only when entering an act from the beginning, not on respawn
    if (!isRespawn && checkpointIndex === 0) {
      this.showChapterCard(actNum);
    }
  }

  showChapterCard(actNum) {
    const titles = {
      1: { num: 'CHAPTER I', title: 'THE WHISPERING WOODS', sub: 'Some horrors are best left asleep' },
      2: { num: 'CHAPTER II', title: 'THE RUSTED MAW', sub: 'The machine breathes beneath your feet' },
      3: { num: 'CHAPTER III', title: "THE CARETAKER'S DOMAIN", sub: 'Silence is the only armor you have' }
    };

    const card = document.getElementById('chapter-card');
    const info = titles[actNum];
    if (card && info) {
      card.querySelector('.chapter-number').textContent = info.num;
      card.querySelector('.chapter-title').textContent = info.title;
      card.querySelector('.chapter-subtitle').textContent = info.sub;

      card.classList.remove('hidden');
      card.style.opacity = '1';

      setTimeout(() => {
        card.style.opacity = '0';
        setTimeout(() => card.classList.add('hidden'), 1200);
      }, 3500);
    }
  }

  showCheckpointToast(name) {
    const toast = document.getElementById('checkpoint-toast');
    const nameEl = document.getElementById('checkpoint-name');
    if (toast && nameEl) {
      nameEl.textContent = name || 'PROGRESS SAVED';
      toast.classList.remove('hidden');
      toast.style.opacity = '1';
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 500);
      }, 2200);
    }
  }

  // Reload current checkpoint upon death
  reloadCheckpoint() {
    this.loadAct(this.currentAct, this.activeCheckpointIndex, true /* isRespawn */);
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
      deathScreen.style.opacity = '0';
      setTimeout(() => deathScreen.classList.add('hidden'), 400);
    }
  }

  triggerChaseSequence(stalker, bulkheadDoor) {
    this.isChaseActive = true;
    stalker.state = 'CHASE';
    stalker.facing = 1;
    // Position Stalker menacingly behind the player breaking through the wall!
    stalker.x = 1580;
    stalker.y = 504;
    stalker.chaseSpeed = 205; // Menacing pursuit speed
    this.game.audio.playMonsterGrowl();
    this.game.audio.playSuspenseStinger();
    this.game.camera.addTrauma(0.85);

    // Screen flash
    const flash = document.getElementById('flash-overlay');
    if (flash) {
      flash.style.opacity = '0.5';
      setTimeout(() => flash.style.opacity = '0', 250);
    }

    // Door begins slow descent at 7.2s, giving player thrilling slide!
    bulkheadDoor.setOpen(true);
    if (this._chaseDoorTimer) clearTimeout(this._chaseDoorTimer);
    this._chaseDoorTimer = setTimeout(() => {
      bulkheadDoor.openOffset = 0;
    }, 7200);
  }

  triggerVictory() {
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) {
      victoryScreen.classList.remove('hidden');
      const stats = document.getElementById('stats-summary');
      if (stats) {
        stats.innerHTML = `
          <div>Acts Conquered: 3 / 3</div>
          <div>Stealth Puzzles Cleared: 100%</div>
          <div>The Shadows Relinquished Their Hold</div>
        `;
      }
    }
  }

  update(dt, player, input, physics, audio, camera, particles) {
    // 1. Checkpoint detection
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const inCp = player.x >= cp.x - 30 && player.x <= cp.x + 80 && Math.abs(player.y - cp.y) < 120;
      if (inCp && this.activeCheckpointIndex < i) {
        this.activeCheckpointIndex = i;
        this.saveProgress(this.currentAct, i);
        audio.playLever(); // chime sound
        this.showCheckpointToast(cp.name);
      }
    }

    // 2. Hazard Solids (Spikes) & Void Pit Death
    if (!player.isDead) {
      for (const solid of physics.solids) {
        if (solid.isHazard && physics.checkOverlap(player, solid)) {
          this.game.hitStop(0.08);
          audio.playDeath();
          camera.addTrauma(0.7);
          particles.spawnLandingDust(player.x + player.w * 0.5, player.y + player.h, 25);
          player.die(audio, camera, particles, this.game);
          break;
        }
      }

      const pitThreshold = (this.actData && this.actData.height) ? this.actData.height - 100 : 750;
      if (player.y > pitThreshold) {
        this.game.hitStop(0.08);
        audio.playDeath();
        camera.addTrauma(0.6);
        player.die(audio, camera, particles, this.game);
      }
    }

    // 3. Triggers (Act Transitions, Camera Zoom, Victory)
    if (!player.isDead) {
      const currentActBeforeTriggers = this.currentAct;
      for (const trig of [...physics.triggers]) {
        if (trig.active && physics.checkOverlap(player, trig)) {
          if (typeof trig.onEnter === 'function') {
            trig.onEnter(player, this);
            if (this.currentAct !== currentActBeforeTriggers) {
              return; // Act transitioned
            }
          }
        }
      }
    }

    // 4. Traps update
    for (const trap of this.traps) {
      trap.update(dt, player, physics, audio, camera, particles);
    }

    // 5. Levers & Doors
    for (const lever of this.levers) {
      lever.update(dt, player, input, audio);
    }
    for (const doorObj of this.doors) {
      doorObj.mechanism.update(dt, doorObj.solid);
    }
    for (const plate of this.pressurePlates) {
      plate.update(dt, player, physics, audio);
    }

    // 6. Electric Water Hazard
    if (this.electricWater) {
      this.electricWater.update(dt, player, audio, camera, particles);
    }

    // 7. Collapsing platforms
    for (const plat of this.collapsingPlatforms) {
      plat.update(dt, player, physics, audio, camera, particles);
    }

    // 8. Searchlights detection (with cover raycasting & alert grace period)
    for (const spot of this.searchlights) {
      const dx = player.x + player.w * 0.5 - spot.x;
      const dy = player.y + player.h * 0.5 - spot.y;
      const angleToPlayer = Math.atan2(dy, dx);
      let diff = Math.abs(angleToPlayer - spot.angle);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

      const inCone = diff < spot.spread * 0.5 && Math.hypot(dx, dy) < spot.radius;
      if (inCone && !player.isDead) {
        // Line of sight raycast from searchlight tower
        const hit = physics.raycast(spot.x, spot.y, player.x + player.w * 0.5, player.y + player.h * 0.5);
        const isCovered = hit && hit.t < 0.92;

        if (!player.isHiding && !isCovered) {
          spot.alertTimer = (spot.alertTimer || 0) + dt;
          if (spot.alertTimer > 0.22) {
            audio.playSuspenseStinger();
            particles.spawnSparks(player.x + player.w * 0.5, player.y + 10, 8);
            player.die(audio, camera, particles);
          }
        } else {
          spot.alertTimer = 0;
        }
      } else {
        spot.alertTimer = 0;
      }
    }

    // 9. Throwable bottles
    for (const bottle of this.throwables) {
      // Pickup check
      if (!bottle.isHeld && !bottle.isAirborne && !bottle.isShattered && !player.heldItem) {
        const canPick = Math.hypot(
          (bottle.x + bottle.w * 0.5) - (player.x + player.w * 0.5),
          (bottle.y + bottle.h * 0.5) - (player.y + player.h * 0.5)
        ) < 48;
        if (canPick && input.actions.interactJustPressed) {
          bottle.isHeld = true;
          player.heldItem = bottle;
          audio.playLever();
        }
      }

      // Update bottle
      bottle.update(dt, player, physics, audio, camera, particles, (noiseX, noiseY) => {
        // Alert enemies
        for (const enemy of this.enemies) {
          enemy.hearNoise(noiseX, noiseY, 1.0);
        }
      });
    }

    // Throw held bottle
    if (player.heldItem && input.actions.throw) {
      let vx, vy;
      if (input.lastInputWasTouch || (input.mouse.x === 0 && input.mouse.y === 0)) {
        // Generous forward ballistic arc for mobile touch controls
        vx = player.facing * 340;
        vy = -180;
      } else {
        const mouseWorld = camera.screenToWorld(input.mouse.x, input.mouse.y);
        const throwOriginX = player.x + player.w * 0.5;
        const throwOriginY = player.y + player.h * 0.4;
        const dx = mouseWorld.x - throwOriginX;
        const dy = mouseWorld.y - throwOriginY;
        const dist = Math.hypot(dx, dy) || 1;
        const power = Math.min(520, Math.max(220, dist * 1.5));
        vx = (dx / dist) * power;
        vy = (dy / dist) * power - 120;
      }

      player.heldItem.throw(vx, vy);
      player.heldItem = null;
      audio.playJump();
    }

    // 10. Enemies
    let maxThreat = 0;
    for (const enemy of this.enemies) {
      enemy.update(dt, player, physics, audio, camera, particles);
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < 450) {
        const threat = 1.0 - (dist / 450);
        if (threat > maxThreat) maxThreat = threat;
      }
    }
    // Feed threat into dynamic heartbeat
    audio.updateHeartbeat(dt, maxThreat);

    // 11. Death handling & fast respawn
    if (player.isDead && !this.respawning) {
      this.deathTimer += dt;
      const deathScreen = document.getElementById('death-screen');
      if (deathScreen) {
        deathScreen.classList.remove('hidden');
        deathScreen.style.opacity = Math.min(1.0, this.deathTimer * 2.2).toString();
      }

      if (this.deathTimer > 0.95) {
        this.respawning = true;
        this.deathTimer = 0;
        this.reloadCheckpoint();
      }
    }
  }

  // Render Parallax Background & Environmental Art
  renderBackground(ctx, camera) {
    if (!this.actData) return;

    ctx.save();
    const w = camera.viewportWidth;
    const h = camera.viewportHeight;

    // 1. Sky / Fog gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.currentAct === 1) {
      skyGrad.addColorStop(0, '#040508');
      skyGrad.addColorStop(1, '#111720');
    } else if (this.currentAct === 2) {
      skyGrad.addColorStop(0, '#030406');
      skyGrad.addColorStop(1, '#0e1218');
    } else {
      skyGrad.addColorStop(0, '#060405');
      skyGrad.addColorStop(1, '#1c1315');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Parallax Layers
    for (const layer of this.actData.backdropLayers) {
      const scrollX = camera.x * layer.depth;
      ctx.fillStyle = layer.color;

      if (layer.trees) {
        // Misty forest tree silhouettes
        ctx.beginPath();
        for (let x = -200; x < w + 200; x += 90) {
          const treeX = x - (scrollX % 90);
          const treeH = 340 + Math.sin(treeX * 0.05) * 60;
          ctx.rect(treeX, h - treeH, 18, treeH);
        }
        ctx.fill();
      } else if (layer.pipes || layer.girders) {
        // Industrial pipes & steel trusses
        ctx.beginPath();
        for (let x = -200; x < w + 200; x += 160) {
          const girderX = x - (scrollX % 160);
          ctx.rect(girderX, 40, 24, h - 80);
          ctx.rect(girderX - 40, 180, 120, 14);
        }
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Render Entities
  renderEntities(ctx, camera) {
    // 1. Traps
    for (const trap of this.traps) {
      trap.render(ctx);
    }
    // 2. Levers & Pressure Plates
    for (const lever of this.levers) {
      lever.render(ctx);
    }
    for (const plate of this.pressurePlates) {
      plate.render(ctx);
    }
    // 3. Doors
    for (const doorObj of this.doors) {
      doorObj.mechanism.render(ctx);
    }
    // 4. Electric Water
    if (this.electricWater) {
      this.electricWater.render(ctx);
    }
    // 5. Collapsing Platforms
    for (const plat of this.collapsingPlatforms) {
      plat.render(ctx);
    }
    // 6. Pushables (Crates)
    for (const box of this.game.physics.pushables) {
      box.render(ctx);
    }
    // 7. Ropes
    for (const rope of this.game.physics.ropes) {
      rope.render(ctx);
    }
    // 8. Throwables
    for (const bottle of this.throwables) {
      bottle.render(ctx);
    }
    // 9. Enemies
    for (const enemy of this.enemies) {
      enemy.render(ctx);
    }
  }

  // Render Foreground Silhouettes (Lush black foreground framing depth)
  renderForeground(ctx, camera) {
    ctx.save();
    ctx.fillStyle = '#010203'; // Pure black silhouettes

    // Solid world geometry
    for (const solid of this.game.physics.solids) {
      if (!camera.isRectVisible(solid.x, solid.y, solid.w, solid.h)) continue;

      if (solid.isHazard) {
        // Spikes silhouette
        ctx.beginPath();
        for (let x = solid.x; x < solid.x + solid.w; x += 18) {
          ctx.moveTo(x, solid.y + solid.h);
          ctx.lineTo(x + 9, solid.y);
          ctx.lineTo(x + 18, solid.y + solid.h);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      }
    }

    ctx.restore();
  }
}
