// =========================================================================
// Trap.js - Snapping Bear Traps, Swinging Pendulums & Collapsing Floorboards
// =========================================================================

export class BearTrap {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 32;
    this.h = 14;

    this.isSprung = false;
    this.jawAngle = 0; // 0 = open, 1 = closed
    this.snapProgress = 0;
  }

  update(dt, player, physics, audio, camera, particles) {
    if (this.isSprung) {
      if (this.snapProgress < 1.0) {
        this.snapProgress = Math.min(1.0, this.snapProgress + dt * 14.0); // instant snap
      }
      return;
    }

    const trapBox = { x: this.x + 4, y: this.y, w: this.w - 8, h: this.h };

    // 1. Check if Crate touches it (Disarm safely)
    for (const box of physics.pushables) {
      if (physics.checkOverlap(trapBox, box)) {
        this.spring(audio, camera, particles, false);
        return;
      }
    }

    // 2. Check if Player steps into it (Lethal Kill)
    if (!player.isDead && physics.checkOverlap(trapBox, player)) {
      this.spring(audio, camera, particles, true);
      player.die(audio, camera, particles);
    }
  }

  spring(audio, camera, particles, killedPlayer) {
    this.isSprung = true;
    audio.playTrapSnap();
    camera.addTrauma(killedPlayer ? 0.6 : 0.35);
    particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, killedPlayer ? 18 : 8);
    if (!killedPlayer) {
      particles.spawnSparks(this.x + this.w * 0.5, this.y + this.h * 0.5, 6);
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);

    const openFactor = 1.0 - this.snapProgress; // 1 = flat open, 0 = clamped shut

    // Base plate
    ctx.fillStyle = '#111317';
    ctx.fillRect(-this.w * 0.5, -4, this.w, 4);

    // Left and Right jagged jaws
    ctx.strokeStyle = '#08090c';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#181b20';

    // Left jaw
    ctx.save();
    ctx.translate(-this.w * 0.4, -2);
    ctx.rotate(-openFactor * 1.35 + (1.0 - openFactor) * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(4, -15);
    ctx.lineTo(0, -12);
    ctx.lineTo(4, -9);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right jaw
    ctx.save();
    ctx.translate(this.w * 0.4, -2);
    ctx.rotate(openFactor * 1.35 - (1.0 - openFactor) * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(-4, -15);
    ctx.lineTo(0, -12);
    ctx.lineTo(-4, -9);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

export class SwingingPendulum {
  constructor(pivotX, pivotY, length = 180, speed = 2.2, maxAngle = 0.9) {
    this.pivotX = pivotX;
    this.pivotY = pivotY;
    this.length = length;
    this.speed = speed;
    this.maxAngle = maxAngle;
    this.angle = 0;
    this._time = 0;
    this.radius = 20; // spiked ball radius
  }

  update(dt, player, audio, camera, particles) {
    this._time += dt;
    this.angle = Math.sin(this._time * this.speed) * this.maxAngle;

    const ballX = this.pivotX + Math.sin(this.angle) * this.length;
    const ballY = this.pivotY + Math.cos(this.angle) * this.length;

    // Check collision with player
    if (!player.isDead) {
      const dist = Math.hypot(ballX - (player.x + player.w * 0.5), ballY - (player.y + player.h * 0.5));
      if (dist < this.radius + player.w * 0.5) {
        audio.playDeath();
        camera.addTrauma(0.7);
        particles.spawnLandingDust(ballX, ballY, 15);
        player.die(audio, camera, particles);
      }
    }
  }

  render(ctx) {
    const ballX = this.pivotX + Math.sin(this.angle) * this.length;
    const ballY = this.pivotY + Math.cos(this.angle) * this.length;

    ctx.save();
    // Chain
    ctx.strokeStyle = '#181b20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.pivotX, this.pivotY);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();

    // Spiked Ball
    ctx.fillStyle = '#080a0c';
    ctx.beginPath();
    ctx.arc(ballX, ballY, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Spikes around perimeter
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.angle;
      const sx = ballX + Math.cos(a) * (this.radius + 7);
      const sy = ballY + Math.sin(a) * (this.radius + 7);
      ctx.beginPath();
      ctx.moveTo(ballX + Math.cos(a) * this.radius, ballY + Math.sin(a) * this.radius);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class CollapsingPlatform {
  constructor(x, y, w = 64, h = 16, physics = null) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.state = 'idle'; // 'idle', 'shaking', 'falling'
    this.shakeTimer = 0;
    this.vy = 0;
    this.offsetX = 0;
    this.solid = physics ? physics.addSolid(x, y, w, h, { material: 'wood' }) : null;
  }

  update(dt, player, physics, audio, camera, particles) {
    if (!this.solid && physics) {
      this.solid = physics.addSolid(this.x, this.y, this.w, this.h, { material: 'wood' });
    }

    if (this.state === 'idle') {
      const topTrigger = { x: this.x, y: this.y - 6, w: this.w, h: 8 };
      if (player.onFloor && physics.checkOverlap(player, topTrigger)) {
        this.state = 'shaking';
        this.shakeTimer = 0.45;
        audio.playFootstep('wood', false);
        camera.addTrauma(0.2);
      }
    } else if (this.state === 'shaking') {
      this.shakeTimer -= dt;
      this.offsetX = (Math.random() - 0.5) * 5;
      if (this.shakeTimer <= 0) {
        this.state = 'falling';
        audio.playLand(1.2);
        camera.addTrauma(0.3);
      }
    } else if (this.state === 'falling') {
      this.vy += 850 * dt;
      this.y += this.vy * dt;
      if (this.solid) {
        this.solid.y = this.y;
      }
    }
  }

  render(ctx) {
    if (this.y > 2000) return; // culled
    ctx.save();
    ctx.fillStyle = '#1c1712';
    ctx.fillRect(this.x + this.offsetX, this.y, this.w, this.h);
    ctx.strokeStyle = '#080605';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + this.offsetX, this.y, this.w, this.h);
    ctx.restore();
  }
}
