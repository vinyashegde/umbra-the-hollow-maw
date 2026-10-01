// =========================================================================
// Particles.js - Atmospheric Motes, Fog, Sparks, Splashes & Impact Dust
// =========================================================================

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.ambientMotes = [];
    this.maxMotes = 65;
  }

  clear() {
    this.particles = [];
  }

  // Spawn landing dust puff
  spawnLandingDust(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 1.6; // upward/outward fan
      const speed = 30 + Math.random() * 85;
      this.particles.push({
        x,
        y: y - 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.4,
        size: 3 + Math.random() * 4,
        color: 'rgba(180, 190, 200,',
        alpha: 0.6,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        gravity: -10 // subtle rise
      });
    }
  }

  // Spawn electrical sparks
  spawnSparks(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: 'rgba(180, 230, 255,',
        alpha: 1.0,
        life: 0.15 + Math.random() * 0.25,
        maxLife: 0.4,
        gravity: 400
      });
    }
  }

  // Spawn water splash droplets
  spawnSplash(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2.5,
        color: 'rgba(190, 215, 240,',
        alpha: 0.8,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        gravity: 650
      });
    }
  }

  // Spawn shattered glass shards
  spawnGlass(x, y, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: 'rgba(230, 245, 255,',
        alpha: 0.9,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        gravity: 800
      });
    }
  }

  // Initialize atmospheric floating dust motes
  initAmbientMotes(bounds) {
    this.ambientMotes = [];
    for (let i = 0; i < this.maxMotes; i++) {
      this.ambientMotes.push({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        size: 1 + Math.random() * 2.5,
        speedX: -8 + Math.random() * 16,
        speedY: -6 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.35
      });
    }
  }

  update(dt, camera) {
    // 1. Update transient particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 2. Update ambient motes (recycle near camera)
    const viewW = camera.viewportWidth / camera.zoom;
    const viewH = camera.viewportHeight / camera.zoom;
    const margin = 200;

    for (const m of this.ambientMotes) {
      m.phase += dt * 1.5;
      m.x += m.speedX * dt;
      m.y += (m.speedY + Math.sin(m.phase) * 6) * dt;

      // Wrap around camera view
      if (m.x < camera.x - viewW * 0.5 - margin) m.x = camera.x + viewW * 0.5 + margin;
      if (m.x > camera.x + viewW * 0.5 + margin) m.x = camera.x - viewW * 0.5 - margin;
      if (m.y < camera.y - viewH * 0.5 - margin) m.y = camera.y + viewH * 0.5 + margin;
      if (m.y > camera.y + viewH * 0.5 + margin) m.y = camera.y - viewH * 0.5 - margin;
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Render ambient dust motes
    for (const m of this.ambientMotes) {
      const alpha = m.alpha * (0.6 + 0.4 * Math.sin(m.phase));
      ctx.fillStyle = `rgba(220, 230, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render transient particles
    for (const p of this.particles) {
      const progress = p.life / p.maxLife;
      const alpha = p.alpha * progress;
      ctx.fillStyle = `${p.color} ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
