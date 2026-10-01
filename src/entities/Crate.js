// =========================================================================
// Crate.js - Pushable Heavy Physics Objects (Wood Boxes, Metal Carts)
// =========================================================================

export class Crate {
  constructor(x, y, w = 40, h = 40, type = 'wood') {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // 'wood' or 'metal'

    this.vx = 0;
    this.vy = 0;
    this.onFloor = false;
    this.isBeingPushed = false;
    this.friction = 750;
    this.weight = type === 'metal' ? 2.5 : 1.0;
  }

  update(dt, physics) {
    // 1. Gravity integration
    this.vy = Math.min(650, this.vy + physics.gravity * dt);

    // 2. Friction when on floor
    if (this.onFloor) {
      const f = this.friction * dt;
      if (Math.abs(this.vx) <= f) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * f;
    }

    // 3. Move horizontally with solid collision resolution
    this.x += this.vx * dt;
    for (const solid of physics.solids) {
      if (physics.checkOverlap(this, solid)) {
        if (this.vx > 0) this.x = solid.x - this.w;
        else if (this.vx < 0) this.x = solid.x + solid.w;
        this.vx = 0;
      }
    }

    // Also collide horizontally with other pushables
    for (const other of physics.pushables) {
      if (other === this) continue;
      if (physics.checkOverlap(this, other)) {
        if (this.vx > 0) this.x = other.x - this.w;
        else if (this.vx < 0) this.x = other.x + other.w;
        this.vx = 0;
      }
    }

    // 4. Move vertically with strict top-landing check (prevent popping on top of walls)
    const prevY = this.y;
    this.y += this.vy * dt;
    this.onFloor = false;

    for (const solid of physics.solids) {
      if (physics.checkOverlap(this, solid)) {
        if (this.vy > 0) {
          // Only land on top of solid if we were actually ABOVE it before this frame
          if (prevY + this.h <= solid.y + 6) {
            this.y = solid.y - this.h;
            this.onFloor = true;
            this.vy = 0;
          } else {
            // Otherwise we bumped into a vertical wall side, push out horizontally
            if (this.x + this.w * 0.5 < solid.x + solid.w * 0.5) {
              this.x = solid.x - this.w;
            } else {
              this.x = solid.x + solid.w;
            }
          }
        } else if (this.vy < 0) {
          if (prevY >= solid.y + solid.h - 4) {
            this.y = solid.y + solid.h;
            this.vy = 0;
          }
        }
      }
    }

    // Pushable on top of other pushables
    for (const other of physics.pushables) {
      if (other === this) continue;
      if (physics.checkOverlap(this, other)) {
        if (this.vy > 0 && prevY + this.h <= other.y + 6) {
          this.y = other.y - this.h;
          this.onFloor = true;
          this.vy = 0;
        }
      }
    }
  }

  render(ctx) {
    ctx.save();
    ctx.fillStyle = this.type === 'metal' ? '#14181c' : '#1e1913';
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Dark silhouette border
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    // Wood plank / metal cross bracing details
    ctx.strokeStyle = this.type === 'metal' ? '#232930' : '#2b231a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x + 3, this.y + 3);
    ctx.lineTo(this.x + this.w - 3, this.y + this.h - 3);
    ctx.moveTo(this.x + this.w - 3, this.y + 3);
    ctx.lineTo(this.x + 3, this.y + this.h - 3);
    ctx.stroke();

    ctx.restore();
  }
}

