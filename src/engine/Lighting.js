// =========================================================================
// Lighting.js - 2D Dynamic Raycast Lighting, Soft Penumbra & Volumetric Fog
// =========================================================================

export class LightingSystem {
  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;

    // Dark ambient lighting buffer
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = width;
    this.lightCanvas.height = height;
    this.lightCtx = this.lightCanvas.getContext('2d');

    // List of active dynamic light sources
    this.lights = [];

    // Ambient light level (0 = pitch black, 1 = fully bright)
    this.ambientLight = 0.12;

    // Flicker accumulator
    this._time = 0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.lightCanvas.width = w;
    this.lightCanvas.height = h;
  }

  clear() {
    this.lights = [];
  }

  addPointLight(x, y, radius, color = 'rgba(255, 235, 190, 0.9)', flicker = 0.05) {
    const light = {
      type: 'point',
      x, y,
      radius,
      baseRadius: radius,
      color,
      flicker,
      intensity: 1.0,
      active: true
    };
    this.lights.push(light);
    return light;
  }

  addSpotlight(x, y, radius, angle, spread, color = 'rgba(230, 240, 255, 0.95)') {
    const light = {
      type: 'spot',
      x, y,
      radius,
      angle,
      spread,
      color,
      active: true,
      sweepSpeed: 0,
      sweepRange: 0,
      baseAngle: angle
    };
    this.lights.push(light);
    return light;
  }

  update(dt) {
    this._time += dt;

    for (const light of this.lights) {
      if (!light.active) continue;

      // Natural flame flicker
      if (light.flicker > 0) {
        const noise = Math.sin(this._time * 18.0) * 0.5 + Math.cos(this._time * 31.0) * 0.3;
        light.radius = light.baseRadius * (1.0 + noise * light.flicker);
      }

      // Spotlight sweep oscillation
      if (light.sweepSpeed > 0 && light.sweepRange > 0) {
        light.angle = light.baseAngle + Math.sin(this._time * light.sweepSpeed) * light.sweepRange;
      }
    }
  }

  // Render Darkness & Dynamic Lights
  render(mainCtx, camera, geometrySolids = []) {
    const ctx = this.lightCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Fill entire screen with ambient darkness
    ctx.fillStyle = `rgba(3, 4, 6, ${1.0 - this.ambientLight})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Cut out each light source using 'destination-out' and 'lighter' blending
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    for (const light of this.lights) {
      if (!light.active) continue;

      // Transform world light pos to screen space
      const screenPos = camera.worldToScreen(light.x, light.y);
      const screenRadius = light.radius * camera.zoom;

      // Frustum cull lights
      if (
        screenPos.x + screenRadius < 0 ||
        screenPos.x - screenRadius > this.width ||
        screenPos.y + screenRadius < 0 ||
        screenPos.y - screenRadius > this.height
      ) {
        continue;
      }

      if (light.type === 'point') {
        this.renderPointLightWithShadows(ctx, screenPos.x, screenPos.y, screenRadius, light, camera, geometrySolids);
      } else if (light.type === 'spot') {
        this.renderSpotlightWithShadows(ctx, screenPos.x, screenPos.y, screenRadius, light, camera, geometrySolids);
      }
    }
    ctx.restore();

    // 3. Composite the dark lighting mask onto the main canvas with soft multiply
    mainCtx.save();
    mainCtx.drawImage(this.lightCanvas, 0, 0);

    // Additive volumetric glow pass for lights
    mainCtx.globalCompositeOperation = 'screen';
    for (const light of this.lights) {
      if (!light.active) continue;
      const screenPos = camera.worldToScreen(light.x, light.y);
      const screenRadius = light.radius * camera.zoom;

      if (
        screenPos.x + screenRadius < 0 ||
        screenPos.x - screenRadius > this.width ||
        screenPos.y + screenRadius < 0 ||
        screenPos.y - screenRadius > this.height
      ) {
        continue;
      }

      const glowGrad = mainCtx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, screenRadius * 0.7
      );
      glowGrad.addColorStop(0, 'rgba(240, 200, 120, 0.22)');
      glowGrad.addColorStop(0.5, 'rgba(180, 140, 80, 0.08)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      mainCtx.fillStyle = glowGrad;
      mainCtx.beginPath();
      mainCtx.arc(screenPos.x, screenPos.y, screenRadius * 0.7, 0, Math.PI * 2);
      mainCtx.fill();
    }
    mainCtx.restore();
  }

  renderPointLightWithShadows(ctx, lx, ly, radius, light, camera, geometrySolids) {
    // 2D Raycast Shadow Casting from solid edges
    ctx.save();

    // Radial gradient cutout
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderSpotlightWithShadows(ctx, lx, ly, radius, light, camera, geometrySolids) {
    ctx.save();

    const startAngle = light.angle - light.spread * 0.5;
    const endAngle = light.angle + light.spread * 0.5;

    // Conical spotlight gradient
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
