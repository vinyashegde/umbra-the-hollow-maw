// =========================================================================
// Player.js - Kinematic Controller, Movement Feel, Procedural Silhouette & Rig
// Built following platformer and game-feel skill specifications
// =========================================================================

export class Player {
  constructor(x = 100, y = 300) {
    this.x = x;
    this.y = y;
    this.w = 22; // collision width
    this.h = 44; // stand height
    this.standHeight = 44;
    this.crouchHeight = 24;

    // Velocities
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left

    // --- Kinematic Jump Math (Tuned via platformer skill) ---
    // Target: jump height ~104px (reach ledges and crates easily), time to apex 0.34s
    const JUMP_HEIGHT = 104;
    const TIME_TO_APEX = 0.33;
    this.riseGravity = (2 * JUMP_HEIGHT) / (TIME_TO_APEX * TIME_TO_APEX); // ~1910 px/s^2
    this.fallGravity = this.riseGravity * 1.85; // Snappy fall (~3530 px/s^2)
    this.jumpVelocity = -(2 * JUMP_HEIGHT) / TIME_TO_APEX; // ~-630 px/s
    this.maxFallSpeed = 750;

    // Movement speeds
    this.walkSpeed = 160;
    this.runSpeed = 240;
    this.crouchSpeed = 85;
    this.accel = 2400;
    this.friction = 2800;
    this.airControl = 0.65;

    // Timers & States
    this.coyoteTimer = 0;
    this.COYOTE_MAX = 0.12; // 120ms coyote window

    this.onFloor = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isGrabbing = false;
    this.grabbedObject = null;
    this.grabbedRope = null;
    this.ropeNodeIdx = -1;
    this.ropeCooldown = 0;

    // Ledge Grab & Mantle
    this.isHanging = false;
    this.hangingLedge = null;

    this.isHiding = false;
    this.isDead = false;
    this.lighterLit = true; // start with lighter on

    // Sprint-Slide Traversal Mechanic
    this.isSliding = false;
    this.slideTimer = 0;
    this.SLIDE_DURATION = 0.4;

    // Item holding
    this.heldItem = null;

    // Animation & Feel
    this.animTime = 0;
    this.stepTimer = 0;
    this.squash = 1.0;
    this.stretch = 1.0;
    this.cloakSwing = 0;

    // Light source reference (lighter)
    this.lightSource = null;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.h = this.standHeight;
    this.onFloor = false;
    this.isCrouching = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.isGrabbing = false;
    this.grabbedObject = null;
    this.grabbedRope = null;
    this.ropeCooldown = 0;
    this.isHanging = false;
    this.hangingLedge = null;
    this.isHiding = false;
    this.isDead = false;
    this.heldItem = null;
    this.squash = 1.0;
    this.stretch = 1.0;
    if (this.lightSource) {
      this.lightSource.active = this.lighterLit;
    }
  }

  die(audio, camera, particles, game = null) {
    if (this.isDead) return;
    this.isDead = true;
    this.vx = 0;
    this.vy = 0;
    this.isHanging = false;
    this.hangingLedge = null;
    this.isGrabbing = false;
    this.grabbedObject = null;
    this.grabbedRope = null;
    this.ropeCooldown = 0;
    this.heldItem = null;
    this.isSliding = false;
    if (this.lightSource) {
      this.lightSource.active = false;
    }
    audio.playDeath();
    camera.addTrauma(0.75);
    particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 25);
    if (game && typeof game.hitStop === 'function') {
      game.hitStop(0.08);
    }
  }

  checkHiding(physics) {
    if (!this.isCrouching || this.lighterLit) {
      this.isHiding = false;
      return false;
    }

    // 1. Underneath a table / low ceiling (roof within 35px above crouch height)
    const overheadBox = { x: this.x + this.w * 0.5 - 6, y: this.y - 35, w: 12, h: 36 };
    const underRoof = physics.solids.some(s => physics.checkOverlap(overheadBox, s));

    // 2. Near a cover obstacle (within 24px of an isCover solid)
    const coverBox = { x: this.x - 24, y: this.y - 6, w: this.w + 48, h: this.h + 12 };
    const nearCover = physics.solids.some(s => s.isCover && physics.checkOverlap(coverBox, s));

    // 3. Crouched behind a pushable crate
    const behindCrate = physics.pushables.some(b => physics.checkOverlap(coverBox, b));

    this.isHiding = underRoof || nearCover || behindCrate;
    return this.isHiding;
  }

  update(dt, input, physics, audio, camera, particles) {
    if (this.isDead) return;

    this.animTime += dt;
    if (this.ropeCooldown > 0) {
      this.ropeCooldown = Math.max(0, this.ropeCooldown - dt);
    }

    // 1. Lighter Toggle
    if (input.actions.lighterJustPressed) {
      this.lighterLit = !this.lighterLit;
      audio.playLighter();
      if (this.lightSource) {
        this.lightSource.active = this.lighterLit;
      }
    }

    // 2. Ledge Hanging & Mantle
    if (this.isHanging) {
      this.updateLedgeHang(dt, input, physics, audio, camera, particles);
      return;
    }

    // 3. Rope Interaction Check
    if (this.grabbedRope) {
      this.updateRopeClimb(dt, input, audio);
      return;
    }

    // 4. Crouching, Sliding & Crawling
    const wantsCrouch = input.actions.crouch && this.onFloor;
    const canStand = !physics.solids.some(s =>
      physics.checkOverlap({ x: this.x, y: this.y - (this.standHeight - this.crouchHeight), w: this.w, h: this.standHeight }, s)
    );

    // Trigger sprint slide if running fast on floor
    if (wantsCrouch && !this.isCrouching && !this.isSliding && !this.isGrabbing && Math.abs(this.vx) > 160) {
      this.isSliding = true;
      this.slideTimer = this.SLIDE_DURATION;
      this.isCrouching = true;
      this.h = this.crouchHeight;
      this.vx = this.facing * 290;
      this.squash = 1.15;
      this.stretch = 0.85;
      particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 8);
      audio.playFootstep(this.getSurfaceMaterial(physics), true);
    } else if (wantsCrouch && !this.isGrabbing) {
      this.isCrouching = true;
      this.h = this.crouchHeight;
    } else if (!this.isSliding) {
      // Check ceiling clearance before uncrouching
      if (this.isCrouching && canStand) {
        this.isCrouching = false;
        this.h = this.standHeight;
      }
    }

    // Process active slide
    if (this.isSliding) {
      this.slideTimer -= dt;
      this.isCrouching = true;
      this.h = this.crouchHeight;
      const slideFriction = 380 * dt;
      if (Math.abs(this.vx) <= slideFriction) {
        this.vx = 0;
      } else {
        this.vx -= Math.sign(this.vx) * slideFriction;
      }

      if (Math.random() < 0.3) {
        particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 1);
      }

      if (this.slideTimer <= 0 || Math.abs(this.vx) < this.crouchSpeed || !this.onFloor) {
        this.isSliding = false;
        if (!wantsCrouch && canStand) {
          this.isCrouching = false;
          this.h = this.standHeight;
        }
      }
    }

    // Update stealth hiding state
    this.checkHiding(physics);

    // 5. Horizontal Movement & Sprinting
    this.isSprinting = input.actions.sprint && !this.isCrouching && !this.isGrabbing && !this.isSliding;
    let targetSpeed = 0;
    if (!this.isSliding) {
      if (input.actions.left) {
        this.facing = -1;
        targetSpeed = -(this.isCrouching ? this.crouchSpeed : (this.isSprinting ? this.runSpeed : this.walkSpeed));
      } else if (input.actions.right) {
        this.facing = 1;
        targetSpeed = (this.isCrouching ? this.crouchSpeed : (this.isSprinting ? this.runSpeed : this.walkSpeed));
      }

      // If grabbing a heavy crate, clamp speed
      if (this.isGrabbing && this.grabbedObject) {
        targetSpeed = Math.max(-95, Math.min(95, targetSpeed));
      }

      // Accelerate / Friction
      const currentAccel = this.onFloor ? this.accel : this.accel * this.airControl;
      const currentFriction = this.onFloor ? this.friction : this.friction * 0.3;

      if (targetSpeed !== 0) {
        this.vx += Math.sign(targetSpeed - this.vx) * currentAccel * dt;
        if (Math.abs(this.vx) > Math.abs(targetSpeed)) this.vx = targetSpeed;
      } else {
        const frictionStep = currentFriction * dt;
        if (Math.abs(this.vx) <= frictionStep) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * frictionStep;
      }
    }

    // 5b. Ground Check & Coyote Time
    if (this.onFloor) {
      this.coyoteTimer = this.COYOTE_MAX;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // 6. Jump Execution (Buffered + Coyote)
    const canJumpFromCrouch = this.isSliding && canStand;
    if (input.actions.jumpJustPressed && this.coyoteTimer > 0 && (!this.isCrouching || canJumpFromCrouch)) {
      this.vy = this.jumpVelocity;
      this.coyoteTimer = 0;
      this.isSliding = false;
      if (canStand) {
        this.isCrouching = false;
        this.h = this.standHeight;
      }
      input.consumeJumpBuffer();
      this.onFloor = false;

      // Squash and stretch feel (volume preserving, avoiding thin distortion)
      this.squash = 0.92;
      this.stretch = 1.10;

      audio.playJump();
      particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 6);

      // Release grabbed object on jump
      if (this.isGrabbing) {
        this.isGrabbing = false;
        this.grabbedObject = null;
      }
    }

    // Variable jump height cut (releasing button early truncates jump arc, with fair minimum tap height)
    if (input.actions.jumpJustReleased && this.vy < 0) {
      const minReleaseSpeed = (input.lastInputWasTouch ? 440 : 390);
      const cutVy = this.vy * 0.6;
      if (this.vy <= -minReleaseSpeed) {
        this.vy = Math.min(cutVy, -minReleaseSpeed);
      } else {
        this.vy = cutVy;
      }
    }

    // 7. Gravity & Apex Float
    let g = this.vy > 0 ? this.fallGravity : this.riseGravity;
    if (Math.abs(this.vy) < 60) {
      g *= 0.55; // Apex hang for micro air control
    }
    this.vy = Math.min(this.maxFallSpeed, this.vy + g * dt);

    // 8. Box Grab / Drag Logic
    if (input.actions.interact) {
      if (!this.isGrabbing) {
        this.checkObjectGrab(physics);
      }
    } else {
      if (this.isGrabbing) {
        this.isGrabbing = false;
        this.grabbedObject = null;
      }
    }

    // Move grabbed object with player (Safely verifying solid bounds)
    if (this.isGrabbing && this.grabbedObject) {
      const dragDx = this.vx * dt;
      if (dragDx !== 0) {
        const testBox = {
          x: this.grabbedObject.x + dragDx,
          y: this.grabbedObject.y,
          w: this.grabbedObject.w,
          h: this.grabbedObject.h
        };
        const blocked = physics.solids.some(s => physics.checkOverlap(testBox, s));
        if (!blocked) {
          this.grabbedObject.x += dragDx;
        } else {
          this.vx = 0;
        }
      }
    }

    // Check Rope Grab
    if (!this.onFloor && !this.grabbedRope && (input.actions.jump || input.actions.up || this.vy > 0)) {
      this.checkRopeGrab(physics, audio);
    }

    // Check Ledge Grab (Mantle) when airborne and near a ledge
    if (!this.onFloor && !this.grabbedRope && !this.isDead) {
      this.checkLedgeGrab(physics, audio);
    }

    // 9. Integrate Kinematic Movement with World Collision
    const prevVy = this.vy;
    const simBody = { x: this.x, y: this.y, w: this.w, h: this.h, ignoreOneWay: input.actions.down && input.actions.jump };
    const res = physics.moveKinematic(simBody, this.vx, this.vy, dt);
    this.x = simBody.x;
    this.y = simBody.y;

    // Detect landing impact
    if (!this.onFloor && res.onFloor && prevVy > 220) {
      this.squash = 1.12;
      this.stretch = 0.90;
      audio.playLand(prevVy / 500);
      camera.addTrauma(Math.min(0.35, prevVy / 1200));
      particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 8);
    }

    this.onFloor = res.onFloor;
    if (res.onFloor && this.vy > 0) this.vy = 0;
    if (res.onCeiling && this.vy < 0) this.vy = 0;

    // 10. Footstep Foley Timing
    if (this.onFloor && Math.abs(this.vx) > 20) {
      this.stepTimer += dt;
      const stepInterval = this.isSprinting ? 0.28 : (this.isCrouching ? 0.48 : 0.38);
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        // Determine surface material under feet
        const material = this.getSurfaceMaterial(physics);
        audio.playFootstep(material, this.isSprinting);
      }
    } else {
      this.stepTimer = 0;
    }

    // 11. Squash & Stretch Elastic Decay
    this.squash += (1.0 - this.squash) * (1.0 - Math.exp(-14 * dt));
    this.stretch += (1.0 - this.stretch) * (1.0 - Math.exp(-14 * dt));

    // Update attached dynamic lighter position
    if (this.lightSource) {
      this.lightSource.x = this.x + this.w * 0.5 + this.facing * 8;
      this.lightSource.y = this.y + this.h * 0.45;
    }
  }

  checkLedgeGrab(physics, audio) {
    if (this.onFloor || this.grabbedRope) return;

    // Never grab ledges while launching upward (vy < -60) to prevent jump arc truncation and teleportation.
    // Ledge grabs should only catch falling players or apex floats!
    if (this.vy < -60) return;

    const handX = this.facing > 0 ? this.x + this.w + 4 : this.x - 4;
    const handY = this.y + 10;

    // Ledge grabs are exclusively for static structural walls & cliffs, NEVER pushable crates or small mounds
    for (const solid of physics.solids) {
      if (solid.isHazard || solid.isCover || solid.h < 55) continue;

      // Corner to grab depends on facing direction
      const cornerX = this.facing > 0 ? solid.x : solid.x + solid.w;
      const cornerY = solid.y;

      const dx = Math.abs(handX - cornerX);
      const dy = handY - cornerY;

      // Allow grab if hand is near lip (-18px to +24px) and body is positioned below ledge top
      if (dx < 26 && dy >= -18 && dy <= 24 && this.y + this.h > cornerY + 12) {
        // Ensure space above ledge is clear for mantling
        const targetX = this.facing > 0 ? solid.x + 4 : solid.x + solid.w - this.w - 4;
        const targetY = cornerY - this.standHeight;
        const headroomBox = { x: targetX, y: targetY, w: this.w, h: this.standHeight };

        const blocked = physics.solids.some(s => s !== solid && physics.checkOverlap(headroomBox, s));
        if (!blocked) {
          this.isHanging = true;
          this.hangingLedge = { cornerX, cornerY, solid, targetX, targetY };
          this.vx = 0;
          this.vy = 0;
          // Position player body hanging naturally below the ledge lip:
          this.x = this.facing > 0 ? cornerX - this.w + 2 : cornerX - 2;
          this.y = cornerY + 4;
          this.squash = 1.0;
          this.stretch = 1.0;
          audio.playLever(); // ledge grasp sound
          break;
        }
      }
    }
  }

  updateLedgeHang(dt, input, physics, audio, camera, particles) {
    this.vx = 0;
    this.vy = 0;

    // Pull up (Mantle) on Jump or Up
    if (input.actions.jumpJustPressed || input.actions.up) {
      this.isHanging = false;
      this.x = this.hangingLedge.targetX;
      this.y = this.hangingLedge.targetY;
      this.onFloor = true;
      this.squash = 1.08;
      this.stretch = 0.94;
      audio.playJump();
      input.consumeJumpBuffer();
      particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 6);
      return;
    }

    // Drop down on Crouch or Down
    if (input.actions.down || input.actions.crouch) {
      this.isHanging = false;
      this.vy = 120;
      this.coyoteTimer = 0;
      return;
    }
  }

  checkObjectGrab(physics) {
    const grabBox = {
      x: this.facing > 0 ? this.x + this.w : this.x - 20,
      y: this.y + 10,
      w: 20,
      h: this.h - 15
    };
    for (const box of physics.pushables) {
      if (physics.checkOverlap(grabBox, box)) {
        this.isGrabbing = true;
        this.grabbedObject = box;
        break;
      }
    }
  }

  checkRopeGrab(physics, audio) {
    if (this.ropeCooldown > 0 || this.grabbedRope || this.onFloor || this.isDead) return;

    const handX = this.x + this.w * 0.5;
    const handY = this.y + 12;

    for (const rope of physics.ropes) {
      const idx = rope.getNearestNodeIndex(handX, handY, 38);
      if (idx > 0) {
        this.grabbedRope = rope;
        this.ropeNodeIdx = idx;
        this.vy = 0;
        this.vx = 0;
        audio.playLever(); // subtle rope creak
        break;
      }
    }
  }

  updateRopeClimb(dt, input, audio) {
    const rope = this.grabbedRope;
    if (!rope || !rope.nodes || rope.nodes.length < 2) {
      this.grabbedRope = null;
      return;
    }

    // Clamp ropeNodeIdx to valid range [1, rope.nodes.length - 1]
    this.ropeNodeIdx = Math.max(1, Math.min(rope.nodes.length - 1.001, this.ropeNodeIdx));

    // Smoothly interpolate between adjacent nodes
    const i0 = Math.floor(this.ropeNodeIdx);
    const i1 = Math.min(rope.nodes.length - 1, i0 + 1);
    const t = this.ropeNodeIdx - i0;

    const n0 = rope.nodes[i0];
    const n1 = rope.nodes[i1];
    const nodeX = n0.x * (1 - t) + n1.x * t;
    const nodeY = n0.y * (1 - t) + n1.y * t;

    // Follow grabbed rope segment
    this.x = nodeX - this.w * 0.5;
    this.y = nodeY - 12;

    // Lateral Swing Impulse (applied directly to currently grabbed node for immediate feedback)
    const currentIdx = Math.floor(this.ropeNodeIdx);
    if (input.actions.left) {
      rope.applyImpulse(-340 * dt, currentIdx);
      this.facing = -1;
    } else if (input.actions.right) {
      rope.applyImpulse(340 * dt, currentIdx);
      this.facing = 1;
    }

    // Climb Up / Down
    if (input.actions.up && this.ropeNodeIdx > 1) {
      this.ropeNodeIdx = Math.max(1, this.ropeNodeIdx - dt * 4);
    } else if (input.actions.down && this.ropeNodeIdx < rope.nodes.length - 1) {
      this.ropeNodeIdx = Math.min(rope.nodes.length - 1, this.ropeNodeIdx + dt * 4);
    }

    // Jump off rope with swinging momentum
    if (input.actions.jumpJustPressed) {
      const swingVx0 = (n0.x - n0.oldX) / (dt || 0.016);
      const swingVx1 = (n1.x - n1.oldX) / (dt || 0.016);
      const swingVx = swingVx0 * (1 - t) + swingVx1 * t;

      this.vy = this.jumpVelocity * 0.85;
      this.vx = swingVx + this.facing * 180;
      this.grabbedRope = null;
      this.ropeCooldown = 0.35; // 350ms cooldown allows player to launch cleanly away without re-grab lock
      input.consumeJumpBuffer();
      audio.playJump();
    }
  }

  getSurfaceMaterial(physics) {
    const footRay = { x: this.x + this.w * 0.5, y: this.y + this.h + 2 };
    for (const solid of physics.solids) {
      if (solid.material && physics.checkOverlap({ x: footRay.x - 2, y: footRay.y, w: 4, h: 4 }, solid)) {
        return solid.material;
      }
    }
    return 'dirt';
  }

  // Render Silhouette Character with Glowing Eyes & Dynamic Cloak
  render(ctx) {
    if (this.isDead) {
      // Slumped silhouette on floor
      ctx.save();
      ctx.fillStyle = '#08090b';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w * 0.5, this.y + this.h - 6, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (this.isHanging) {
      // Clinging to ledge pose: both arms reaching up clutching the lip, hooded silhouette dangling naturally
      ctx.save();
      ctx.translate(this.x + this.w * 0.5, this.y + this.h);

      const topY = -this.h;
      const bodyW = this.w * 0.75;
      const lipX = this.facing * 9;
      const lipY = topY - 4;

      // 1. Back Dangling Leg
      ctx.strokeStyle = '#080a0c';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-this.facing * 3, -14);
      ctx.lineTo(-this.facing * 5, -2);
      ctx.stroke();

      // 2. Dangling Hooded Cloak Body
      ctx.fillStyle = '#060709';
      ctx.beginPath();
      ctx.moveTo(this.facing * 2, topY + 8); // neck/shoulder
      // Cloak back trailing slightly toward wall
      ctx.quadraticCurveTo(-this.facing * bodyW * 0.9, topY + this.h * 0.5, -this.facing * bodyW * 0.6, -10);
      // Hemline
      ctx.lineTo(this.facing * bodyW * 0.5, -10);
      // Front chest rising to chin
      ctx.quadraticCurveTo(this.facing * bodyW * 0.7, topY + this.h * 0.45, this.facing * 5, topY + 12);
      ctx.closePath();
      ctx.fill();

      // 3. Front Dangling Leg (slightly forward)
      ctx.beginPath();
      ctx.moveTo(this.facing * 2, -14);
      ctx.lineTo(this.facing * 3, -4);
      ctx.stroke();

      // 4. Arms Grasping Ledge Lip
      ctx.strokeStyle = '#0e1219';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      // Back arm
      ctx.beginPath();
      ctx.moveTo(-this.facing * 2, topY + 12);
      ctx.quadraticCurveTo(lipX * 0.5, lipY + 4, lipX - this.facing * 3, lipY);
      ctx.stroke();
      // Front arm
      ctx.beginPath();
      ctx.moveTo(this.facing * 3, topY + 10);
      ctx.quadraticCurveTo(lipX * 0.7, lipY + 2, lipX + this.facing * 2, lipY);
      ctx.stroke();

      // Hands gripping the lip
      ctx.fillStyle = '#141a24';
      ctx.beginPath();
      ctx.arc(lipX, lipY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 5. Hooded Head & Glowing White Eyes Peering Up at Ledge
      const eyeX = this.facing * 4;
      const eyeY = topY + 8;

      const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 8);
      eyeGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      eyeGlow.addColorStop(0.4, 'rgba(230, 240, 255, 0.5)');
      eyeGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');

      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 2.2, 1.6, -this.facing * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);
    ctx.scale(this.squash, this.stretch);

    const isMoving = Math.abs(this.vx) > 10 && this.onFloor;
    const stride = isMoving ? Math.sin(this.animTime * (this.isSprinting ? 18 : 12)) : 0;
    const breathe = Math.sin(this.animTime * 3) * 1.5;

    // 1. Back Leg Silhouette
    ctx.strokeStyle = '#080a0c';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-this.facing * 3, -12);
    ctx.lineTo(-this.facing * 3 - stride * 7, 0);
    ctx.stroke();

    // 2. Flowing Hooded Cloak Body
    ctx.fillStyle = '#060709';
    ctx.beginPath();
    const topY = -this.h + breathe;
    const bodyW = this.w * 0.75;

    ctx.moveTo(0, topY); // top of hood
    // Curved back with trailing cape
    const capeDrag = -this.facing * Math.min(12, Math.abs(this.vx) * 0.05);
    ctx.quadraticCurveTo(-this.facing * (bodyW + 4) + capeDrag, topY + this.h * 0.5, -this.facing * bodyW + capeDrag * 1.2, -4);
    // Cloak hemline
    ctx.lineTo(this.facing * bodyW, -4);
    // Front chest
    ctx.quadraticCurveTo(this.facing * (bodyW * 0.6), topY + this.h * 0.4, 0, topY);
    ctx.closePath();
    ctx.fill();

    // 3. Front Leg Silhouette
    ctx.beginPath();
    ctx.moveTo(this.facing * 2, -12);
    ctx.lineTo(this.facing * 2 + stride * 7, 0);
    ctx.stroke();

    // 4. Glowing White Eyes (Iconic Limbo Style)
    const eyeX = this.facing * 4;
    const eyeY = topY + 12;

    // Subtle eye glow
    const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 8);
    eyeGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    eyeGlow.addColorStop(0.4, 'rgba(230, 240, 255, 0.6)');
    eyeGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');

    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Piercing white eye slit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Hand / Lighter Flame
    if (this.lighterLit) {
      const handX = this.facing * 12;
      const handY = topY + 22;

      // Small flickering flame
      const flameNoise = Math.sin(this.animTime * 25) * 1.5;
      const flameGrad = ctx.createRadialGradient(handX, handY - 4, 0, handX, handY - 4, 9);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#ffcc44');
      flameGrad.addColorStop(0.8, '#ff6611');
      flameGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(handX - 3, handY);
      ctx.quadraticCurveTo(handX, handY - 8 + flameNoise, handX, handY - 11 + flameNoise);
      ctx.quadraticCurveTo(handX, handY - 8 + flameNoise, handX + 3, handY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
