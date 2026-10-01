// =========================================================================
// Throwable.js - Throwable Bottles for Sound Distraction Puzzles
// =========================================================================

export class ThrowableBottle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 18;
    this.vx = 0;
    this.vy = 0;
    this.isHeld = false;
    this.isAirborne = false;
    this.isShattered = false;
    this.rotation = 0;
  }

  update(dt, player, physics, audio, camera, particles, onShatterNoise = null) {
    if (this.isShattered) return;

    if (this.isHeld) {
      // Follow player's hands
      this.x = player.x + player.w * 0.5 + player.facing * 6;
      this.y = player.y + player.h * 0.45;
      this.rotation = 0;
      return;
    }

    if (this.isAirborne) {
      this.vy += 850 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.vx * 0.04;

      // Check collision with solids
      const hit = physics.solids.some(s => physics.checkOverlap(this, s));
      if (hit) {
        this.shatter(audio, camera, particles, onShatterNoise);
      }
    }
  }

  throw(vx, vy) {
    this.isHeld = false;
    this.isAirborne = true;
    this.vx = vx;
    this.vy = vy;
  }

  shatter(audio, camera, particles, onShatterNoise) {
    this.isShattered = true;
    this.isAirborne = false;
    audio.playBottleShatter();
    camera.addTrauma(0.3);
    particles.spawnGlass(this.x + this.w * 0.5, this.y + this.h * 0.5, 14);

    if (onShatterNoise) {
      onShatterNoise(this.x + this.w * 0.5, this.y + this.h * 0.5);
    }
  }

  render(ctx) {
    if (this.isShattered) return;

    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h * 0.5);
    ctx.rotate(this.rotation);

    // Dark glass silhouette with cyan glint
    ctx.fillStyle = '#18242a';
    ctx.fillRect(-this.w * 0.5, -this.h * 0.5 + 5, this.w, this.h - 5);

    // Bottle neck
    ctx.fillStyle = '#1c2b33';
    ctx.fillRect(-this.w * 0.25, -this.h * 0.5, this.w * 0.5, 5);

    // Glass glint reflection
    ctx.strokeStyle = '#5cc6e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-this.w * 0.3, -this.h * 0.2);
    ctx.lineTo(-this.w * 0.3, this.h * 0.3);
    ctx.stroke();

    ctx.restore();
  }
}
