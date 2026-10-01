// =========================================================================
// Enemy.js - The Caretaker (Long-Arm Stalker) AI with Hearing & Vision
// Built following game-ai skill best practices (FSM + Sensor System)
// =========================================================================

export class StalkerEnemy {
  constructor(x, y, patrolMinX = 500, patrolMaxX = 900) {
    this.x = x;
    this.y = y;
    this.w = 38;
    this.h = 76; // towering over player

    this.patrolMinX = patrolMinX;
    this.patrolMaxX = patrolMaxX;

    this.vx = 0;
    this.vy = 0;
    this.facing = 1;

    // Movement speeds
    this.walkSpeed = 58;
    this.investigateSpeed = 75;
    this.chaseSpeed = 155;

    // FSM State: 'PATROL', 'INVESTIGATE', 'ALERT', 'CHASE', 'KILL'
    this.state = 'PATROL';
    this.targetNoise = null;
    this.investigateTimer = 0;
    this.alertTimer = 0;

    // Senses
    this.hearingRadiusSprint = 240;
    this.hearingRadiusNormal = 90;
    this.visionDistance = 280;
    this.visionAngle = 0.85; // radians spread

    // Procedural animation
    this.animTime = 0;
    this.stepTimer = 0;
    this.armReachX = 0;
    this.armReachY = 0;

    // Sighting line of sight
    this.canSeePlayer = false;
  }

  // Hear noise event (e.g. shattered bottle or loud sprint)
  hearNoise(nx, ny, intensity = 1.0) {
    const dist = Math.hypot(nx - (this.x + this.w * 0.5), ny - (this.y + this.h * 0.5));
    const effectiveRadius = 800 * intensity;

    if (dist <= effectiveRadius) {
      this.targetNoise = { x: nx, y: ny };
      if (this.state !== 'CHASE') {
        this.state = 'INVESTIGATE';
        this.investigateTimer = 4.0;
        this.facing = nx > this.x ? 1 : -1;
      }
    }
  }

  update(dt, player, physics, audio, camera, particles) {
    this.animTime += dt;

    const myCenterX = this.x + this.w * 0.5;
    const myCenterY = this.y + this.h * 0.4;
    const playerCenterX = player.x + player.w * 0.5;
    const playerCenterY = player.y + player.h * 0.5;

    const distToPlayer = Math.hypot(playerCenterX - myCenterX, playerCenterY - myCenterY);

    // 1. Line of Sight & Vision Detection
    this.canSeePlayer = false;
    if (!player.isHiding && !player.isDead) {
      const dirToPlayer = Math.sign(playerCenterX - myCenterX);
      if (dirToPlayer === this.facing && distToPlayer < this.visionDistance) {
        // Check if raycast blocked by solids
        const hit = physics.raycast(myCenterX, myCenterY, playerCenterX, playerCenterY);
        if (!hit || hit.t >= 0.95) {
          this.canSeePlayer = true;
        }
      }
    }

    // 2. Hearing Detection (Sprint footsteps or moving nearby)
    if (!player.isDead && !player.isHiding) {
      if (player.isSprinting && distToPlayer < this.hearingRadiusSprint) {
        this.hearNoise(playerCenterX, playerCenterY, 0.6);
      } else if (player.isSliding && distToPlayer < 140) {
        this.hearNoise(playerCenterX, playerCenterY, 0.45);
      } else if (Math.abs(player.vx) > 30 && !player.isCrouching && distToPlayer < this.hearingRadiusNormal) {
        this.hearNoise(playerCenterX, playerCenterY, 0.35);
      }
    }

    // 3. FSM State Updates
    switch (this.state) {
      case 'PATROL':
        if (this.canSeePlayer) {
          this.triggerAlert(playerCenterX, audio);
          break;
        }

        // Patrol back and forth between bounds
        if (this.facing > 0 && this.x >= this.patrolMaxX) {
          this.facing = -1;
        } else if (this.facing < 0 && this.x <= this.patrolMinX) {
          this.facing = 1;
        }
        this.vx = this.facing * this.walkSpeed;
        break;

      case 'INVESTIGATE':
        if (this.canSeePlayer) {
          this.triggerAlert(playerCenterX, audio);
          break;
        }

        if (this.targetNoise) {
          const dx = this.targetNoise.x - myCenterX;
          if (Math.abs(dx) > 18) {
            this.facing = Math.sign(dx);
            this.vx = this.facing * this.investigateSpeed;
          } else {
            // Reached noise source, search around
            this.vx = 0;
            this.investigateTimer -= dt;
            if (this.investigateTimer <= 0) {
              this.state = 'PATROL';
              this.targetNoise = null;
            }
          }
        } else {
          this.state = 'PATROL';
        }
        break;

      case 'ALERT':
        this.vx = 0;
        this.alertTimer -= dt;
        if (this.alertTimer <= 0) {
          this.state = 'CHASE';
        }
        break;

      case 'CHASE':
        if (!player.isDead) {
          const dx = playerCenterX - myCenterX;
          this.facing = Math.sign(dx);
          this.vx = this.facing * this.chaseSpeed;

          // If lost sight and player is hiding
          if (!this.canSeePlayer && distToPlayer > 320) {
            this.state = 'INVESTIGATE';
            this.targetNoise = { x: playerCenterX, y: playerCenterY };
            this.investigateTimer = 3.0;
          }
        } else {
          this.vx = 0;
          this.state = 'PATROL';
        }
        break;
    }

    // 4. Movement & Physics
    this.vy = Math.min(650, this.vy + physics.gravity * dt);
    const simBody = { x: this.x, y: this.y, w: this.w, h: this.h };
    physics.moveKinematic(simBody, this.vx, this.vy, dt);
    this.x = simBody.x;
    this.y = simBody.y;

    // 5. Heavy Footsteps & Screen Jitter
    if (Math.abs(this.vx) > 15) {
      this.stepTimer += dt;
      const stepInterval = this.state === 'CHASE' ? 0.32 : 0.6;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        audio.playFootstep('metal', true);
        if (distToPlayer < 350) {
          camera.addTrauma(0.12 * (1.0 - distToPlayer / 350));
        }
      }
    }

    // 6. Kill Grab Detection
    if (!player.isDead && distToPlayer < 42) {
      if (!player.isHiding || this.state === 'CHASE') {
        this.state = 'KILL';
        this.vx = 0;
        audio.playMonsterGrowl();
        player.die(audio, camera, particles);
      }
    }
  }

  triggerAlert(targetX, audio) {
    this.state = 'ALERT';
    this.alertTimer = 0.35;
    this.facing = targetX > this.x ? 1 : -1;
    audio.playSuspenseStinger();
    audio.playMonsterGrowl();
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);

    const stride = Math.sin(this.animTime * (this.state === 'CHASE' ? 14 : 7)) * 10;
    const hunchBreathe = Math.sin(this.animTime * 2.5) * 2;

    // Vision Cone in Alert/Chase/Investigate
    if (this.state !== 'KILL') {
      const coneGrad = ctx.createRadialGradient(0, -this.h * 0.8, 10, 0, -this.h * 0.8, this.visionDistance);
      const coneColor = this.state === 'CHASE' ? 'rgba(255, 60, 40, ' : (this.state === 'ALERT' ? 'rgba(255, 180, 50, ' : 'rgba(200, 220, 240, ');
      coneGrad.addColorStop(0, `${coneColor}0.18)`);
      coneGrad.addColorStop(1, `${coneColor}0.0)`);

      ctx.save();
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, -this.h * 0.8);
      const angleCenter = this.facing > 0 ? 0 : Math.PI;
      ctx.arc(0, -this.h * 0.8, this.visionDistance, angleCenter - this.visionAngle * 0.5, angleCenter + this.visionAngle * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 1. Back Leg
    ctx.strokeStyle = '#040507';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-this.facing * 8, -25);
    ctx.lineTo(-this.facing * 8 - stride, 0);
    ctx.stroke();

    // 2. Grotesque Hunchback Torso
    ctx.fillStyle = '#06070a';
    ctx.beginPath();
    const neckY = -this.h + 8 + hunchBreathe;
    ctx.moveTo(this.facing * 10, neckY); // hunched head
    ctx.quadraticCurveTo(-this.facing * 28, neckY - 8, -this.facing * 14, -22); // giant hunch
    ctx.lineTo(this.facing * 12, -22); // waist
    ctx.quadraticCurveTo(this.facing * 24, neckY + 18, this.facing * 10, neckY);
    ctx.closePath();
    ctx.fill();

    // 3. Front Leg
    ctx.beginPath();
    ctx.moveTo(this.facing * 6, -25);
    ctx.lineTo(this.facing * 6 + stride, 0);
    ctx.stroke();

    // 4. Elongated Knotted Arms (Reaching down past knees)
    const armSwing = Math.sin(this.animTime * 6) * 12;
    const reachForward = this.state === 'CHASE' ? this.facing * 28 : 0;

    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 5;
    ctx.beginPath();
    // Shoulder
    ctx.moveTo(this.facing * 4, neckY + 12);
    // Elbow (hanging low)
    const elbowX = this.facing * 8 + reachForward * 0.5;
    const elbowY = -28;
    ctx.lineTo(elbowX, elbowY);
    // Long claw hand
    const handX = this.facing * 16 + reachForward + armSwing * 0.5;
    const handY = -4;
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Claw fingers
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + this.facing * 8, handY + 4);
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + this.facing * 7, handY + 8);
    ctx.stroke();

    // 5. Sunken Glowing Red/Amber Eyes
    const eyeX = this.facing * 14;
    const eyeY = neckY + 3;
    ctx.fillStyle = this.state === 'CHASE' ? '#ff2211' : '#e5a93b';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
