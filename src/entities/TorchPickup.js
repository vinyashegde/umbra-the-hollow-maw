// =========================================================================
// TorchPickup.js - Interactive Flashlight Discovery Cold-Open Entity
// =========================================================================

export class TorchPickup {
  constructor(x = 310, y = 566) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 10;
    this.collected = false;
    this.pulseTimer = 0;
  }

  update(dt, player, input, audio, camera, particles, levelMgr) {
    if (this.collected) return;

    this.pulseTimer += dt;

    // Check pickup proximity
    const centerX = this.x + this.w * 0.5;
    const centerY = this.y + this.h * 0.5;
    const playerCenterX = player.x + player.w * 0.5;
    const playerCenterY = player.y + player.h * 0.5;
    const dist = Math.hypot(centerX - playerCenterX, centerY - playerCenterY);

    if (dist < 55) {
      // Pick up on interact key (E / touch) or lighter key (F / touch)
      if (input.actions.interactJustPressed || input.actions.lighterJustPressed) {
        this.collect(player, audio, camera, particles, levelMgr);
      }
    }
  }

  collect(player, audio, camera, particles, levelMgr) {
    if (this.collected) return;
    this.collected = true;

    // Equip player with the electric torch
    player.hasTorch = true;
    player.lighterLit = true;

    if (player.torchSpotlight) {
      player.torchSpotlight.active = true;
    }
    if (player.torchFillLight) {
      player.torchFillLight.active = true;
    }
    if (player.lightSource) {
      player.lightSource.active = true;
    }

    // Audio click of tactile industrial switch
    if (audio && typeof audio.playLighter === 'function') {
      audio.playLighter();
    }

    // Camera trauma pulse for tactile satisfaction
    if (camera && typeof camera.addTrauma === 'function') {
      camera.addTrauma(0.35);
    }

    // Spark particles
    if (particles && typeof particles.spawnSparks === 'function') {
      particles.spawnSparks(this.x + this.w * 0.5, this.y + this.h * 0.5, 12);
    }

    // Smoothly restore atmospheric ambience to standard level
    if (levelMgr && levelMgr.game && levelMgr.game.lighting) {
      levelMgr.game.lighting.ambientLight = 0.16;
    }

    // Trigger Chapter 1 Title Card cold-open reveal
    if (levelMgr && typeof levelMgr.showChapterCard === 'function') {
      levelMgr.showChapterCard(1);
    }

    // Show toast
    if (levelMgr && typeof levelMgr.showCheckpointToast === 'function') {
      levelMgr.showCheckpointToast('FLASHLIGHT ACQUIRED');
    }
  }

  render(ctx) {
    if (this.collected) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Ground contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.w * 0.5, this.h + 1, this.w * 0.55, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Flashlight Body (Dark Matte Metal Casing)
    ctx.fillStyle = '#14171d';
    ctx.beginPath();
    ctx.roundRect(4, 2, 16, 6, 1.5);
    ctx.fill();

    // Knurled grip grooves
    ctx.strokeStyle = '#28313e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(8, 8);
    ctx.moveTo(11, 2);
    ctx.lineTo(11, 8);
    ctx.moveTo(14, 2);
    ctx.lineTo(14, 8);
    ctx.stroke();

    // 3. Flared Bezel / Head (Front facing right)
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.moveTo(18, 1);
    ctx.lineTo(23, 0);
    ctx.lineTo(23, 10);
    ctx.lineTo(18, 9);
    ctx.closePath();
    ctx.fill();

    // Specular highlight edge
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5, 3);
    ctx.lineTo(19, 2);
    ctx.stroke();

    // Front Glass Lens
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(22, 1, 1.5, 8);

    // 4. Standby Diode / Pulsing Indicator (Guides player in darkness)
    const pulseAlpha = 0.4 + Math.sin(this.pulseTimer * 4.5) * 0.35;
    ctx.fillStyle = `rgba(120, 210, 255, ${pulseAlpha})`;
    ctx.beginPath();
    ctx.arc(10, 5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Subtle beacon glow halo
    const haloGrad = ctx.createRadialGradient(10, 5, 0, 10, 5, 16);
    haloGrad.addColorStop(0, `rgba(140, 220, 255, ${pulseAlpha * 0.3})`);
    haloGrad.addColorStop(1, 'rgba(140, 220, 255, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(10, 5, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
