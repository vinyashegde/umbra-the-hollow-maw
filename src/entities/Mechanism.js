// =========================================================================
// Mechanism.js - Levers, Breakers, Pressure Plates, Blast Doors & Electric Water
// =========================================================================

export class Lever {
  constructor(x, y, onToggle = null) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 32;
    this.isPulled = false;
    this.onToggle = onToggle;
    this.leverAngle = -0.6; // radians
  }

  update(dt, player, input, audio) {
    const interactBox = { x: this.x - 12, y: this.y - 10, w: this.w + 24, h: this.h + 20 };
    const canInteract = (
      player.x + player.w > interactBox.x &&
      player.x < interactBox.x + interactBox.w &&
      player.y + player.h > interactBox.y &&
      player.y < interactBox.y + interactBox.h
    );

    if (canInteract && input.actions.interactJustPressed) {
      this.isPulled = !this.isPulled;
      audio.playLever();
      if (this.onToggle) this.onToggle(this.isPulled);
    }

    // Smooth lever animation
    const targetAngle = this.isPulled ? 0.6 : -0.6;
    this.leverAngle += (targetAngle - this.leverAngle) * (1.0 - Math.exp(-12 * dt));
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);

    // Mounting plate
    ctx.fillStyle = '#12151a';
    ctx.fillRect(-this.w * 0.5, -14, this.w, 14);
    ctx.strokeStyle = '#06070a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.w * 0.5, -14, this.w, 14);

    // Status Indicator LED
    ctx.fillStyle = this.isPulled ? '#44ff66' : '#ff3322';
    ctx.shadowColor = this.isPulled ? '#44ff66' : '#ff3322';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Lever Arm
    ctx.save();
    ctx.translate(0, -4);
    ctx.rotate(this.leverAngle);
    ctx.strokeStyle = '#222830';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.stroke();

    // Lever knob
    ctx.fillStyle = '#cc3322';
    ctx.beginPath();
    ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

export class PressurePlate {
  constructor(x, y, w = 48, onStateChange = null) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = 8;
    this.isPressed = false;
    this.onStateChange = onStateChange;
    this.depression = 0;
  }

  update(dt, player, physics, audio) {
    const triggerBox = { x: this.x + 2, y: this.y - 4, w: this.w - 4, h: 8 };
    let hasWeight = false;

    // Check player
    if (physics.checkOverlap(player, triggerBox)) {
      hasWeight = true;
    }

    // Check pushable crates
    for (const box of physics.pushables) {
      if (physics.checkOverlap(box, triggerBox)) {
        hasWeight = true;
        break;
      }
    }

    if (hasWeight !== this.isPressed) {
      this.isPressed = hasWeight;
      audio.playLever();
      if (this.onStateChange) this.onStateChange(this.isPressed);
    }

    const targetDepression = this.isPressed ? 5 : 0;
    this.depression += (targetDepression - this.depression) * (1.0 - Math.exp(-15 * dt));
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Base trench
    ctx.fillStyle = '#0a0c0f';
    ctx.fillRect(0, 2, this.w, 6);

    // Plate with depression
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(2, this.depression, this.w - 4, 6);
    ctx.strokeStyle = '#06080b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, this.depression, this.w - 4, 6);

    ctx.restore();
  }
}

export class SlidingDoor {
  constructor(x, y, w = 24, h = 120, openOffset = -110) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.baseY = y;
    this.openOffset = openOffset;
    this.isOpen = false;
    this.currentOffset = 0;
  }

  setOpen(open) {
    this.isOpen = open;
  }

  update(dt, solidReference) {
    const targetOffset = this.isOpen ? this.openOffset : 0;
    this.currentOffset += (targetOffset - this.currentOffset) * (1.0 - Math.exp(-4.5 * dt));

    this.y = this.baseY + this.currentOffset;
    if (solidReference) {
      solidReference.y = this.y;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.fillStyle = '#0f1318';
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Iron bulkhead ridges
    ctx.strokeStyle = '#050709';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    ctx.strokeStyle = '#1b2028';
    ctx.lineWidth = 2;
    for (let i = 15; i < this.h - 10; i += 22) {
      ctx.beginPath();
      ctx.moveTo(this.x + 3, this.y + i);
      ctx.lineTo(this.x + this.w - 3, this.y + i);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class ElectricWater {
  constructor(x, y, w = 180, h = 24) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.isElectrified = true;
    this._time = 0;
    this.sparkTimer = 0;
  }

  update(dt, player, audio, camera, particles) {
    this._time += dt;

    if (!this.isElectrified) {
      // Wading splash & water footsteps when safely wading through de-energized pool
      const waterBox = { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 };
      const playerFeet = { x: player.x + 4, y: player.y + player.h - 6, w: player.w - 8, h: 8 };

      if (
        playerFeet.x < waterBox.x + waterBox.w &&
        playerFeet.x + playerFeet.w > waterBox.x &&
        playerFeet.y < waterBox.y + waterBox.h &&
        playerFeet.y + playerFeet.h > waterBox.y
      ) {
        if (Math.abs(player.vx) > 20 && player.onFloor) {
          this.wadeTimer = (this.wadeTimer || 0) + dt;
          if (this.wadeTimer > 0.22) {
            this.wadeTimer = 0;
            particles.spawnSplash(player.x + player.w * 0.5, this.y + 2, 5);
            audio.playFootstep('water', player.isSprinting);
          }
        }
      }
      return;
    }

    // Periodic electric sparks & sound
    this.sparkTimer += dt;
    if (this.sparkTimer > 0.35) {
      this.sparkTimer = 0;
      const sparkX = this.x + Math.random() * this.w;
      particles.spawnSparks(sparkX, this.y + 4, 4);
      audio.playElectricSpark();
    }

    // Lethal water contact
    const waterBox = { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 };
    const playerFeet = { x: player.x + 4, y: player.y + player.h - 6, w: player.w - 8, h: 8 };

    if (
      playerFeet.x < waterBox.x + waterBox.w &&
      playerFeet.x + playerFeet.w > waterBox.x &&
      playerFeet.y < waterBox.y + waterBox.h &&
      playerFeet.y + playerFeet.h > waterBox.y
    ) {
      particles.spawnSparks(player.x + player.w * 0.5, player.y + player.h * 0.5, 20);
      player.die(audio, camera, particles);
    }
  }

  render(ctx) {
    ctx.save();
    // Dark murky water pool
    const waterGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    waterGrad.addColorStop(0, 'rgba(15, 25, 35, 0.7)');
    waterGrad.addColorStop(1, 'rgba(4, 7, 10, 0.95)');

    ctx.fillStyle = waterGrad;
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Surface wave ripple
    ctx.strokeStyle = '#223548';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= this.w; x += 8) {
      const yWave = Math.sin(this._time * 4 + x * 0.08) * 2;
      if (x === 0) ctx.moveTo(this.x + x, this.y + yWave);
      else ctx.lineTo(this.x + x, this.y + yWave);
    }
    ctx.stroke();

    // Electric Arcs if electrified
    if (this.isElectrified) {
      ctx.strokeStyle = '#88ddff';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 10;

      for (let i = 0; i < 3; i++) {
        const ax = this.x + Math.sin(this._time * 12 + i * 2) * (this.w * 0.45) + this.w * 0.5;
        const ay = this.y + 4;
        ctx.beginPath();
        ctx.moveTo(ax - 12, ay);
        ctx.lineTo(ax - 4, ay - 6 + (Math.random() - 0.5) * 8);
        ctx.lineTo(ax + 5, ay + 3 + (Math.random() - 0.5) * 6);
        ctx.lineTo(ax + 14, ay);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
