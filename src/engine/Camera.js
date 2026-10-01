// =========================================================================
// Camera.js - Cinematic 2D Follow Camera with Deadzone, Look-Ahead & Trauma
// Built following camera-systems and game-feel best practices
// =========================================================================

export class Camera {
  constructor(viewportWidth = 1280, viewportHeight = 720) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // Camera world position (center of view)
    this.x = 0;
    this.y = 0;

    // Smoothed focus point
    this.focusX = 0;
    this.focusY = 0;

    // Target reference
    this.target = null;

    // Smoothing rate (frame-rate independent)
    this.smoothingRate = 6.5;

    // Deadzone half-extents (pixels)
    this.deadzoneX = 45;
    this.deadzoneY = 35;

    // Look-ahead distance
    this.lookAheadMax = 110;
    this.lookAheadCurrent = 0;
    this.lookAheadRate = 4.0;

    // Dynamic zoom
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.zoomRate = 2.5;

    // Level boundaries (pixels)
    this.bounds = {
      minX: 0,
      maxX: 10000,
      minY: -2000,
      maxY: 1200
    };

    // Trauma & Screen Shake model (quadratic decay)
    this.trauma = 0;
    this.traumaDecay = 1.6; // trauma lost per second
    this.maxShakeOffset = 18; // maximum pixel offset at trauma=1
    this.maxShakeRoll = 0.04; // maximum radians rotation at trauma=1
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;
    this._time = 0;

    // Setting toggle
    this.enableShake = true;
  }

  setViewport(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  setBounds(minX, maxX, minY, maxY) {
    this.bounds.minX = minX;
    this.bounds.maxX = maxX;
    this.bounds.minY = minY;
    this.bounds.maxY = maxY;
  }

  setTarget(target) {
    this.target = target;
    if (target) {
      const targetW = target.w || target.width || 0;
      const targetH = target.h || target.height || 0;
      const cx = target.x + targetW * 0.5;
      const cy = target.y + targetH * 0.5;
      this.focusX = cx;
      this.focusY = cy;
      this.x = cx;
      this.y = cy;
    }
  }

  setZoom(targetZoom) {
    this.targetZoom = targetZoom;
  }

  addTrauma(amount) {
    if (!this.enableShake) return;
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  update(dt) {
    this._time += dt;

    // 1. Process Target & Deadzone
    if (this.target) {
      const targetW = this.target.w || this.target.width || 0;
      const targetH = this.target.h || this.target.height || 0;
      const targetCenterX = this.target.x + targetW * 0.5;
      const targetCenterY = this.target.y + targetH * 0.5;

      const dx = targetCenterX - this.focusX;
      const dy = targetCenterY - this.focusY;

      // Only shift focus if target escapes deadzone
      if (Math.abs(dx) > this.deadzoneX) {
        this.focusX += (Math.abs(dx) - this.deadzoneX) * Math.sign(dx);
      }
      if (Math.abs(dy) > this.deadzoneY) {
        this.focusY += (Math.abs(dy) - this.deadzoneY) * Math.sign(dy);
      }

      // Look-ahead based on facing / velocity
      const targetDir = this.target.facing || 1;
      const targetSpeedRatio = Math.min(1, Math.abs(this.target.vx || 0) / 180);
      const desiredLookAhead = targetDir * this.lookAheadMax * targetSpeedRatio;

      const tLook = 1.0 - Math.exp(-this.lookAheadRate * dt);
      this.lookAheadCurrent += (desiredLookAhead - this.lookAheadCurrent) * tLook;
    }

    // 2. Exponential Zoom Smoothing
    const tZoom = 1.0 - Math.exp(-this.zoomRate * dt);
    this.zoom += (this.targetZoom - this.zoom) * tZoom;

    // 3. Exponential Follow Smoothing
    const desiredX = this.focusX + this.lookAheadCurrent;
    const desiredY = this.focusY - 20; // slight vertical lead upward
    const tFollow = 1.0 - Math.exp(-this.smoothingRate * dt);

    this.x += (desiredX - this.x) * tFollow;
    this.y += (desiredY - this.y) * tFollow;

    // 4. Clamping to Level Bounds
    const halfW = (this.viewportWidth / (2 * this.zoom));
    const halfH = (this.viewportHeight / (2 * this.zoom));

    if (this.bounds.maxX - this.bounds.minX > this.viewportWidth / this.zoom) {
      this.x = Math.max(this.bounds.minX + halfW, Math.min(this.bounds.maxX - halfW, this.x));
    }
    if (this.bounds.maxY - this.bounds.minY > this.viewportHeight / this.zoom) {
      this.y = Math.max(this.bounds.minY + halfH, Math.min(this.bounds.maxY - halfH, this.y));
    }

    // 5. Update Screen Shake Trauma
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      const shake = this.trauma * this.trauma; // quadratic punch
      const freq = 28.0;

      this.shakeOffsetX = this.maxShakeOffset * shake * Math.sin(this._time * freq * 1.3);
      this.shakeOffsetY = this.maxShakeOffset * shake * Math.cos(this._time * freq * 1.7);
      this.shakeRotation = this.maxShakeRoll * shake * Math.sin(this._time * freq * 0.9);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
    }
  }

  // Convert World Coordinate to Screen Coordinate
  worldToScreen(wx, wy) {
    const cx = this.viewportWidth * 0.5;
    const cy = this.viewportHeight * 0.5;
    const sx = cx + (wx - this.x) * this.zoom + this.shakeOffsetX;
    const sy = cy + (wy - this.y) * this.zoom + this.shakeOffsetY;
    return { x: sx, y: sy };
  }

  // Convert Screen Coordinate to World Coordinate
  screenToWorld(sx, sy) {
    const cx = this.viewportWidth * 0.5;
    const cy = this.viewportHeight * 0.5;
    const wx = this.x + (sx - cx - this.shakeOffsetX) / this.zoom;
    const wy = this.y + (sy - cy - this.shakeOffsetY) / this.zoom;
    return { x: wx, y: wy };
  }

  // Apply Camera Transform to Canvas Context
  apply(ctx) {
    ctx.save();
    ctx.translate(this.viewportWidth * 0.5 + this.shakeOffsetX, this.viewportHeight * 0.5 + this.shakeOffsetY);
    if (this.shakeRotation !== 0) {
      ctx.rotate(this.shakeRotation);
    }
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  // Check if an AABB in world space is visible on screen (frustum culling)
  isRectVisible(rx, ry, rw, rh, margin = 100) {
    const halfW = (this.viewportWidth / (2 * this.zoom)) + margin;
    const halfH = (this.viewportHeight / (2 * this.zoom)) + margin;
    return (
      rx + rw >= this.x - halfW &&
      rx <= this.x + halfW &&
      ry + rh >= this.y - halfH &&
      ry <= this.y + halfH
    );
  }
}
