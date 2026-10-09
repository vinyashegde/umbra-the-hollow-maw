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
    this.hasTorch = true; // whether player has discovered and equipped the torch
    this.lighterLit = true; // flashlight beam power state (on/off)

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

    // Light source references (spotlight beam + ambient fill)
    this.lightSource = null;
    this.torchSpotlight = null;
    this.torchFillLight = null;

    // Spritesheet Animation System
    this.spriteLoaded = false;
    this.spriteImage = null;
    this.currentAnim = 'idle';
    this.animFrame = 0;
    this.animTimer = 0;
    this.strideDistance = 0;
    this.crawlDistance = 0;
    this.stepDistanceAcc = 0;

    // Animated Torch / Lighter Spritesheet
    this.torchSpriteLoaded = false;
    this.torchSpriteImage = null;
    this.flameFrame = 0;
    this.flameTimer = 0;
    this.flameFps = 12;
    this.emberTimer = 0;

    if (typeof Image !== 'undefined') {
      this.spriteImage = new Image();
      this.spriteImage.src = 'assets/player_spritesheet.png';
      this.spriteImage.onload = () => {
        this.spriteLoaded = true;
      };
      if (this.spriteImage.complete) {
        this.spriteLoaded = true;
      }

      this.torchSpriteImage = new Image();
      this.torchSpriteImage.src = 'assets/torch_fire.png';
      this.torchSpriteImage.onload = () => {
        this.torchSpriteLoaded = true;
      };
      if (this.torchSpriteImage.complete) {
        this.torchSpriteLoaded = true;
      }
    }
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
    this.currentAnim = 'idle';
    this.animFrame = 0;
    this.animTimer = 0;
    this.strideDistance = 0;
    this.crawlDistance = 0;
    this.stepDistanceAcc = 0;
    this.flameFrame = 0;
    this.flameTimer = 0;
    this.emberTimer = 0;
    const isLit = this.hasTorch && this.lighterLit;
    if (this.lightSource) {
      this.lightSource.active = isLit;
    }
    if (this.torchSpotlight) {
      this.torchSpotlight.active = isLit;
    }
    if (this.torchFillLight) {
      this.torchFillLight.active = isLit;
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
    this.currentAnim = 'dead';
    this.animFrame = 0;
    if (this.lightSource) {
      this.lightSource.active = false;
    }
    if (this.torchSpotlight) {
      this.torchSpotlight.active = false;
    }
    if (this.torchFillLight) {
      this.torchFillLight.active = false;
    }
    audio.playDeath();
    camera.addTrauma(0.75);
    particles.spawnLandingDust(this.x + this.w * 0.5, this.y + this.h, 25);
    if (game && typeof game.hitStop === 'function') {
      game.hitStop(0.08);
    }
  }

  checkHiding(physics) {
    if (!this.isCrouching || (this.hasTorch && this.lighterLit)) {
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

    // 1. Flashlight / Torch Toggle
    if (input.actions.lighterJustPressed) {
      if (this.hasTorch) {
        this.lighterLit = !this.lighterLit;
        audio.playLighter();
        if (this.lightSource) {
          this.lightSource.active = this.lighterLit;
        }
        if (this.torchSpotlight) {
          this.torchSpotlight.active = this.lighterLit;
        }
        if (this.torchFillLight) {
          this.torchFillLight.active = this.lighterLit;
        }
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

    // 10. Footstep Foley Timing - Stride Synchronized
    if (this.onFloor && Math.abs(this.vx) > 20) {
      const stepDistThreshold = this.isCrouching ? 42 : 68; // Half-cycle stride distance
      this.stepDistanceAcc = (this.stepDistanceAcc || 0) + Math.abs(this.vx) * dt;
      if (this.stepDistanceAcc >= stepDistThreshold) {
        this.stepDistanceAcc -= stepDistThreshold;
        const material = this.getSurfaceMaterial(physics);
        audio.playFootstep(material, this.isSprinting);
      }
    } else {
      this.stepDistanceAcc = 0;
    }

    // 11. Squash & Stretch Elastic Decay
    this.squash += (1.0 - this.squash) * (1.0 - Math.exp(-14 * dt));
    this.stretch += (1.0 - this.stretch) * (1.0 - Math.exp(-14 * dt));

    // Update animated lighter flame progression
    this.flameTimer += dt;
    if (this.flameTimer >= 1 / this.flameFps) {
      this.flameTimer -= 1 / this.flameFps;
      this.flameFrame = (this.flameFrame + 1) % 8;
    }

    // Update attached dynamic flashlight and lights to match real-time hand anchor
    const hand = this.getHandAnchor();
    const handWorldX = this.x + this.w * 0.5 + this.facing * hand.x;
    const handWorldY = this.y + this.h + hand.y;
    const isLit = this.hasTorch && this.lighterLit;

    if (this.lightSource) {
      this.lightSource.x = handWorldX;
      this.lightSource.y = handWorldY - 6;
      this.lightSource.active = isLit;
    }

    if (this.torchSpotlight) {
      this.torchSpotlight.x = handWorldX;
      this.torchSpotlight.y = handWorldY - 2;
      let beamAngle = (this.facing === 1) ? 0.05 : (Math.PI - 0.05);
      if (this.isCrouching) {
        beamAngle += this.facing * 0.14;
      }
      if (!this.onFloor) {
        beamAngle += this.facing * Math.min(0.2, Math.max(-0.2, this.vy * 0.0004));
      }
      this.torchSpotlight.angle = beamAngle;
      this.torchSpotlight.active = isLit;
    }

    if (this.torchFillLight) {
      this.torchFillLight.x = this.x + this.w * 0.5;
      this.torchFillLight.y = this.y + this.h * 0.55;
      this.torchFillLight.active = isLit;
    }

    // Subtle atmospheric dust motes around flashlight lens when turned on
    if (isLit && particles && typeof particles.spawnFlameEmbers === 'function') {
      this.emberTimer = (this.emberTimer || 0) + dt;
      if (this.emberTimer >= 0.45) {
        this.emberTimer = 0;
        const emberX = handWorldX + this.facing * 10;
        const emberY = handWorldY - 2;
        particles.spawnFlameEmbers(emberX, emberY, 1);
      }
    }

    // 12. Update Spritesheet Animation State (Motion-Matched)
    this.updateAnimation(dt);
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
    this.updateAnimation(dt);

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

    this.updateAnimation(dt);
  }

  updateAnimation(dt) {
    let anim = 'idle';
    let fps = 4;
    let loop = true;

    if (this.isDead) {
      anim = 'dead';
      fps = 0;
      loop = false;
    } else if (this.isHanging) {
      anim = 'hang';
      fps = 0;
      loop = false;
    } else if (this.grabbedRope) {
      anim = 'crawl';
      fps = 6;
      loop = true;
    } else if (this.isSliding) {
      anim = 'slide';
      fps = 0;
      loop = false;
    } else if (this.isCrouching) {
      anim = 'crawl';
      fps = 0; // Handled by motion matching below
      loop = true;
    } else if (!this.onFloor) {
      anim = 'jump';
      fps = 0; // Velocity-mapped
    } else if (Math.abs(this.vx) > 10) {
      anim = 'run';
      fps = 0; // Handled by motion matching below
      loop = true;
    } else {
      anim = 'idle';
      fps = 4.0; // Calm, atmospheric breathing cycle (~1.5s per loop)
      loop = true;
    }

    if (anim !== this.currentAnim) {
      this.currentAnim = anim;
      this.animFrame = 0;
      this.animTimer = 0;
      if (anim === 'run') {
        this.strideDistance = 0;
      } else if (anim === 'crawl') {
        this.crawlDistance = 0;
      }
    }

    // Motion-matched stride synchronization for grounded movement
    if (anim === 'run') {
      // 136px of horizontal floor displacement per 8-frame cycle (17px/frame)
      const STRIDE_PER_CYCLE = 136;
      this.strideDistance += Math.abs(this.vx) * dt;
      const frameIdx = Math.floor((this.strideDistance % STRIDE_PER_CYCLE) / (STRIDE_PER_CYCLE / 8));
      this.animFrame = frameIdx % 8;
    } else if (anim === 'crawl') {
      // 84px of horizontal floor displacement per 6-frame crawl cycle (14px/frame)
      const CRAWL_PER_CYCLE = 84;
      if (Math.abs(this.vx) > 10) {
        this.crawlDistance += Math.abs(this.vx) * dt;
        const frameIdx = Math.floor((this.crawlDistance % CRAWL_PER_CYCLE) / (CRAWL_PER_CYCLE / 6));
        this.animFrame = frameIdx % 6;
      } else {
        this.animFrame = 0; // steady low crouch pose when stationary
      }
    } else if (anim === 'jump') {
      // Velocity-mapped jump animation (6 frames)
      if (this.vy < -350) this.animFrame = 0; // launch anticipation
      else if (this.vy < -120) this.animFrame = 1; // rising leap
      else if (this.vy < 100) this.animFrame = 2; // apex float
      else if (this.vy < 280) this.animFrame = 3; // glide
      else if (this.vy < 520) this.animFrame = 4; // fall descent
      else this.animFrame = 5; // landing anticipation
    } else if (anim === 'slide') {
      this.animFrame = 3; // low streamlined crawl frame
    } else if (anim === 'hang') {
      this.animFrame = 2; // natural hanging grip frame
    } else if (fps > 0) {
      // Time-based frame advancement for idle breathing and rope climbing
      this.animTimer += dt;
      const frameDuration = 1 / fps;
      if (this.animTimer >= frameDuration) {
        this.animTimer -= frameDuration;
        const totalFrames = this.getFrameCount(anim);
        if (loop) {
          this.animFrame = (this.animFrame + 1) % totalFrames;
        } else {
          this.animFrame = Math.min(totalFrames - 1, this.animFrame + 1);
        }
      }
    }
  }

  getFrameCount(anim) {
    switch (anim) {
      case 'idle': return 6;
      case 'run': return 8;
      case 'jump': return 6;
      case 'crawl': return 6;
      case 'hang': return 6;
      default: return 6;
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

  getHandAnchor() {
    // Exact hand coordinates relative to feet center (0, 0), where head top is -44, eyes are -32, chin is -26.
    // Hands are held forward at waist/hip height (y = -12 to -16), strictly below the neck and face!
    const HAND_OFFSETS = {
      idle: [
        { x: 10.5, y: -12.5 },
        { x: 10.5, y: -12.8 },
        { x: 10.5, y: -12.5 },
        { x: 10.8, y: -12.3 },
        { x: 10.5, y: -12.5 },
        { x: 10.5, y: -12.8 }
      ],
      run: [
        { x: 16.0, y: -12.5 },
        { x: 18.5, y: -14.5 },
        { x: 20.5, y: -16.0 },
        { x: 19.5, y: -15.0 },
        { x: 12.0, y: -14.0 },
        { x: 18.5, y: -15.0 },
        { x: 15.5, y: -12.0 },
        { x: 13.0, y: -13.0 }
      ],
      jump: [
        { x: 11.0, y: -16.0 },
        { x: 13.5, y: -15.0 },
        { x: 16.0, y: -17.0 },
        { x: 15.0, y: -14.0 },
        { x: 18.0, y: -16.0 },
        { x: 13.0, y: -15.0 }
      ],
      crawl: [
        { x: 14.0, y: -5.0 },
        { x: 14.0, y: -5.0 },
        { x: 12.0, y: -5.0 },
        { x: 19.0, y: -9.0 },
        { x: 17.0, y: -9.0 },
        { x: 16.0, y: -8.0 }
      ],
      slide: [
        { x: 19.0, y: -9.0 }
      ],
      hang: [
        { x: 8.0, y: -8.0 },
        { x: 8.0, y: -8.0 },
        { x: 8.0, y: -8.0 },
        { x: 8.0, y: -8.0 },
        { x: 8.0, y: -8.0 },
        { x: 8.0, y: -8.0 }
      ]
    };

    const animList = HAND_OFFSETS[this.currentAnim] || HAND_OFFSETS.idle;
    const frameIdx = Math.min(animList.length - 1, Math.max(0, this.animFrame || 0));
    return animList[frameIdx] || { x: 10.5, y: -12.5 };
  }

  renderTorch(ctx, handX, handY) {
    if (!this.hasTorch || !this.lighterLit) return;

    ctx.save();
    ctx.translate(handX, handY);

    // Draft wind tilt when moving horizontally
    const windTilt = -(this.vx / 240) * 0.14;
    if (Math.abs(windTilt) > 0.01) {
      ctx.rotate(windTilt);
    }

    // 1. Atmospheric Volumetric Light Cone on the canvas (soft forward illumination)
    const coneLen = 135;
    const coneHalfSpread = 26;
    const coneGrad = ctx.createRadialGradient(8, -1, 0, coneLen * 0.65, -1, coneLen);
    coneGrad.addColorStop(0, 'rgba(235, 245, 255, 0.28)');
    coneGrad.addColorStop(0.35, 'rgba(215, 235, 255, 0.14)');
    coneGrad.addColorStop(0.7, 'rgba(190, 220, 255, 0.05)');
    coneGrad.addColorStop(1, 'rgba(190, 220, 255, 0)');

    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(9, -2.5);
    ctx.lineTo(coneLen, -coneHalfSpread);
    ctx.lineTo(coneLen, coneHalfSpread);
    ctx.lineTo(9, 2.5);
    ctx.closePath();
    ctx.fill();

    // Floating micro-dust motes in flashlight beam
    const t = this.animTime;
    for (let i = 0; i < 4; i++) {
      const moteX = 16 + ((t * 24 + i * 33) % 90);
      const moteSpread = (moteX / coneLen) * coneHalfSpread * 0.75;
      const moteY = -1 + Math.sin(t * 3.5 + i * 2.3) * moteSpread;
      const moteAlpha = Math.sin((moteX / 110) * Math.PI) * 0.45;
      ctx.fillStyle = `rgba(255, 255, 255, ${moteAlpha})`;
      ctx.beginPath();
      ctx.arc(moteX, moteY, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Flashlight Body (Dark Matte Metal Industrial Casing)
    // Barrel / Handle
    ctx.fillStyle = '#10141a';
    ctx.beginPath();
    ctx.roundRect(-7, -2.2, 12, 4.4, 1.2);
    ctx.fill();

    // Knurled grip grooves
    ctx.strokeStyle = '#222c3a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-4, 2);
    ctx.moveTo(-1, -2);
    ctx.lineTo(-1, 2);
    ctx.moveTo(2, -2);
    ctx.lineTo(2, 2);
    ctx.stroke();

    // Specular barrel highlight
    ctx.strokeStyle = '#4a596e';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-6, -1.8);
    ctx.lineTo(4, -1.8);
    ctx.stroke();

    // Rear tail-cap
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(-8.5, -2, 1.8, 4);

    // Front Flared Bezel / Reflector Head
    ctx.fillStyle = '#26303f';
    ctx.beginPath();
    ctx.moveTo(5, -2.2);
    ctx.lineTo(8.5, -3.8);
    ctx.lineTo(9.5, -3.8);
    ctx.lineTo(9.5, 3.8);
    ctx.lineTo(8.5, 3.8);
    ctx.lineTo(5, 2.2);
    ctx.closePath();
    ctx.fill();

    // Reflector inner bowl rim
    ctx.fillStyle = '#50637d';
    ctx.beginPath();
    ctx.ellipse(8.8, 0, 1.2, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Piercing Illuminated Glass Lens & Radial Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(9.2, 0, 0.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Intense lens flare core
    const lensGlow = ctx.createRadialGradient(9.2, 0, 0, 9.2, 0, 7);
    lensGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    lensGlow.addColorStop(0.3, 'rgba(220, 240, 255, 0.6)');
    lensGlow.addColorStop(1, 'rgba(180, 220, 255, 0)');
    ctx.fillStyle = lensGlow;
    ctx.beginPath();
    ctx.arc(9.2, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // 4. Frail Boy Hand Gripping the Flashlight Casing
    ctx.fillStyle = '#080a0e';
    ctx.beginPath();
    ctx.ellipse(-1.5, 0.5, 3.4, 2.6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#080a0e';
    ctx.beginPath();
    ctx.arc(-1.5, -1.2, 1.8, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();

    ctx.restore();
  }

  render(ctx) {
    if (this.spriteLoaded && this.spriteImage) {
      this.renderSprite(ctx);
      return;
    }
    this.renderProcedural(ctx);
  }

  renderSprite(ctx) {
    if (this.isDead) {
      ctx.save();
      ctx.fillStyle = '#08090b';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w * 0.5, this.y + this.h - 6, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);
    ctx.scale(this.facing * (this.squash || 1), this.stretch || 1);

    const CELL_SIZE = 160;
    const PIVOT_X = 80;
    const PIVOT_Y = 144;
    let row = 0;
    let col = this.animFrame;

    if (this.currentAnim === 'run') {
      row = 1;
    } else if (this.currentAnim === 'jump') {
      row = 2;
    } else if (this.currentAnim === 'crawl') {
      row = 3;
    } else if (this.currentAnim === 'slide') {
      row = 3;
      col = 3;
    } else if (this.currentAnim === 'hang') {
      row = 4;
      col = Math.min(5, Math.max(1, this.animFrame));
    } else {
      row = 0; // idle
    }

    const sx = col * CELL_SIZE;
    const sy = row * CELL_SIZE;
    const scale = 44 / 118; // ~0.373 to scale 118px sprite height to 44px character height

    const drawW = CELL_SIZE * scale;
    const drawH = CELL_SIZE * scale;
    const drawX = -PIVOT_X * scale;
    const drawY = -PIVOT_Y * scale;

    ctx.drawImage(this.spriteImage, sx, sy, CELL_SIZE, CELL_SIZE, drawX, drawY, drawW, drawH);

    // Dynamic flashlight beam rendering when acquired and turned on
    if (this.hasTorch && this.lighterLit) {
      const hand = this.getHandAnchor();
      this.renderTorch(ctx, hand.x, hand.y);
    }

    ctx.restore();
  }

  // Fallback Procedural Silhouette Character: Subtly thin, frail boy (Limbo inspired)
  renderProcedural(ctx) {
    if (this.isDead) {
      // Slumped frail boy silhouette on floor
      ctx.save();
      ctx.fillStyle = '#060709';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w * 0.5, this.y + this.h - 5, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Messy hair tuft on floor
      ctx.beginPath();
      ctx.arc(this.x + this.w * 0.5 - this.facing * 9, this.y + this.h - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (this.isHanging) {
      // Limbo boy clinging to ledge: slender frail arms clutching the lip, thin dangling body, scruffy hair, glowing eyes
      ctx.save();
      ctx.translate(this.x + this.w * 0.5, this.y + this.h);

      const topY = -this.h;
      const lipX = this.facing * 8;
      const lipY = topY - 3;

      // 1. Slender Dangling Legs
      ctx.strokeStyle = '#06080b';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      // Back leg
      ctx.beginPath();
      ctx.moveTo(-this.facing * 1.5, -12);
      ctx.lineTo(-this.facing * 3.5, -1);
      ctx.stroke();
      // Front leg
      ctx.beginPath();
      ctx.moveTo(this.facing * 1.5, -12);
      ctx.lineTo(this.facing * 2.5, -3);
      ctx.stroke();

      // 2. Frail Slender Boy Torso
      ctx.fillStyle = '#080a0d';
      ctx.beginPath();
      ctx.roundRect(-this.facing * 2.5, topY + 12, 5, 15, [1.5, 1.5, 1, 1]);
      ctx.fill();

      // 3. Slender Arms Grasping Ledge Lip
      ctx.strokeStyle = '#080a0d';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      // Back arm
      ctx.beginPath();
      ctx.moveTo(-this.facing * 1.5, topY + 13);
      ctx.lineTo(lipX - this.facing * 2, lipY);
      ctx.stroke();
      // Front arm
      ctx.beginPath();
      ctx.moveTo(this.facing * 1.5, topY + 13);
      ctx.lineTo(lipX + this.facing * 1.5, lipY);
      ctx.stroke();

      // Hands gripping the lip
      ctx.fillStyle = '#06070a';
      ctx.beginPath();
      ctx.arc(lipX, lipY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 4. Boy Head with Messy Scruffy Hair (Limbo Style)
      const headX = this.facing * 1.5;
      const headY = topY + 8;
      ctx.fillStyle = '#06070a';
      ctx.beginPath();
      ctx.ellipse(headX, headY, 5.2, 5.8, this.facing * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Scruffy hair tufts at back and crown
      ctx.beginPath();
      ctx.moveTo(headX - this.facing * 4, headY - 2);
      ctx.lineTo(headX - this.facing * 7, headY - 4);
      ctx.lineTo(headX - this.facing * 4.5, headY);
      ctx.lineTo(headX - this.facing * 6.5, headY + 3);
      ctx.lineTo(headX - this.facing * 3.5, headY + 4);
      ctx.fill();

      // Crown tufts
      ctx.beginPath();
      ctx.moveTo(headX - this.facing * 2, headY - 5);
      ctx.lineTo(headX - this.facing * 2.5, headY - 8.5);
      ctx.lineTo(headX, headY - 5.5);
      ctx.lineTo(headX + this.facing * 1.5, headY - 8);
      ctx.lineTo(headX + this.facing * 2.5, headY - 5);
      ctx.fill();

      // 5. Piercing White Glowing Eyes Looking Up at Ledge
      const eyeX = headX + this.facing * 2.4;
      const eyeY = headY - 1.2;

      const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 6);
      eyeGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      eyeGlow.addColorStop(0.35, 'rgba(220, 240, 255, 0.45)');
      eyeGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 1.8, 1.3, -this.facing * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x + this.w * 0.5, this.y + this.h);
    ctx.scale(this.squash, this.stretch);

    const isMoving = Math.abs(this.vx) > 10 && this.onFloor;
    const stride = isMoving ? Math.sin(this.animTime * (this.isSprinting ? 18 : 12)) : 0;
    const breathe = Math.sin(this.animTime * 3) * 1.0;
    const isCrouch = this.isCrouching || this.isSliding;

    const topY = -this.h + (isCrouch ? 0 : breathe);

    // 1. Back Slender Leg
    ctx.strokeStyle = '#05070a';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    if (isCrouch) {
      // Bent crouch back leg
      ctx.beginPath();
      ctx.moveTo(-this.facing * 4, -10);
      ctx.lineTo(-this.facing * 8, -4);
      ctx.lineTo(-this.facing * 4, 0);
      ctx.stroke();
    } else {
      // Standing / running back leg
      ctx.beginPath();
      ctx.moveTo(-this.facing * 2.5, -14);
      ctx.lineTo(-this.facing * 2.5 - stride * 7.5, 0);
      ctx.stroke();
    }

    // 2. Frail Slender Boy Torso
    ctx.fillStyle = '#080a0d';
    if (isCrouch) {
      // Arched forward crouch torso
      ctx.beginPath();
      ctx.roundRect(-this.facing * 6, -18, 12, 9, [3, 3, 2, 2]);
      ctx.fill();
    } else {
      // Upright slender boy torso (slight natural waist taper)
      ctx.beginPath();
      ctx.roundRect(-this.facing * 3, topY + 13, 6.2, 17, [2, 2, 1, 1]);
      ctx.fill();
    }

    // 3. Front Slender Leg
    if (isCrouch) {
      ctx.beginPath();
      ctx.moveTo(this.facing * 2, -10);
      ctx.lineTo(this.facing * 6, -4);
      ctx.lineTo(this.facing * 3, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(this.facing * 2.5, -14);
      ctx.lineTo(this.facing * 2.5 + stride * 7.5, 0);
      ctx.stroke();
    }

    // 4. Boy Head with Messy Scruffy Hair (Iconic Limbo Boy)
    const headX = isCrouch ? this.facing * 5 : this.facing * 1.5;
    const headY = isCrouch ? -16 : (topY + 8);

    ctx.fillStyle = '#06070a';
    ctx.beginPath();
    ctx.ellipse(headX, headY, 5.4, 6.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scruffy hair tufts (messy spikes radiating backward & crown)
    ctx.beginPath();
    // Back spikes
    ctx.moveTo(headX - this.facing * 4, headY - 1);
    ctx.lineTo(headX - this.facing * 7.5, headY - 3.5);
    ctx.lineTo(headX - this.facing * 4.5, headY + 1);
    ctx.lineTo(headX - this.facing * 7, headY + 3);
    ctx.lineTo(headX - this.facing * 3.5, headY + 4);
    ctx.fill();

    // Top crown spikes
    ctx.beginPath();
    ctx.moveTo(headX - this.facing * 2.5, headY - 5);
    ctx.lineTo(headX - this.facing * 3.5, headY - 9);
    ctx.lineTo(headX - this.facing * 0.5, headY - 6);
    ctx.lineTo(headX + this.facing * 1.5, headY - 9);
    ctx.lineTo(headX + this.facing * 3, headY - 5.5);
    ctx.fill();

    // 5. Piercing White Glowing Eyes (Limbo Style)
    const eyeX = headX + this.facing * 2.6;
    const eyeY = headY + 0.5;

    // Soft eye glow aura
    const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 6.5);
    eyeGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    eyeGlow.addColorStop(0.35, 'rgba(220, 240, 255, 0.5)');
    eyeGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Piercing white eye slit / circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 2.0, 1.5, this.facing * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 6. Handheld Electric Flashlight 🔦
    if (this.hasTorch && this.lighterLit) {
      const hand = this.getHandAnchor();
      ctx.save();
      ctx.scale(this.facing, 1);
      this.renderTorch(ctx, hand.x, hand.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
