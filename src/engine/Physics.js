// =========================================================================
// Physics.js - 2D Kinematic & Dynamic Physics Engine with Verlet Ropes
// =========================================================================

export class PhysicsWorld {
  constructor() {
    this.gravity = 980; // pixels / s^2
    this.solids = [];
    this.oneWayPlatforms = [];
    this.pushables = [];
    this.ropes = [];
    this.triggers = [];
  }

  clear() {
    this.solids = [];
    this.oneWayPlatforms = [];
    this.pushables = [];
    this.ropes = [];
    this.triggers = [];
  }

  addSolid(x, y, w, h, properties = {}) {
    const solid = { x, y, w, h, ...properties };
    this.solids.push(solid);
    return solid;
  }

  addOneWay(x, y, w, h) {
    const p = { x, y, w, h };
    this.oneWayPlatforms.push(p);
    return p;
  }

  addPushable(pushable) {
    this.pushables.push(pushable);
    return pushable;
  }

  addRope(rope) {
    this.ropes.push(rope);
    return rope;
  }

  addTrigger(x, y, w, h, onEnter, type = 'generic') {
    const trig = { x, y, w, h, onEnter, type, active: true };
    this.triggers.push(trig);
    return trig;
  }

  // AABB check helper
  checkOverlap(r1, r2) {
    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.y < r2.y + r2.h &&
      r1.y + r1.h > r2.y
    );
  }

  // Raycast against solids
  raycast(x1, y1, x2, y2) {
    let closestHit = null;
    let minT = 1.0;

    for (const solid of this.solids) {
      // Cohen-Sutherland line vs rect intersection
      const hit = this.lineIntersectAABB(x1, y1, x2, y2, solid);
      if (hit && hit.t < minT) {
        minT = hit.t;
        closestHit = hit;
      }
    }
    return closestHit;
  }

  lineIntersectAABB(x1, y1, x2, y2, rect) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    let tMin = 0;
    let tMax = 1;

    // X slab
    if (Math.abs(dx) < 1e-8) {
      if (x1 < rect.x || x1 > rect.x + rect.w) return null;
    } else {
      const invD = 1.0 / dx;
      let t1 = (rect.x - x1) * invD;
      let t2 = (rect.x + rect.w - x1) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }

    // Y slab
    if (Math.abs(dy) < 1e-8) {
      if (y1 < rect.y || y1 > rect.y + rect.h) return null;
    } else {
      const invD = 1.0 / dy;
      let t1 = (rect.y - y1) * invD;
      let t2 = (rect.y + rect.h - y1) * invD;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }

    if (tMin >= 0 && tMin <= 1) {
      return {
        x: x1 + dx * tMin,
        y: y1 + dy * tMin,
        t: tMin,
        solid: rect
      };
    }
    return null;
  }

  // Update dynamic physics objects (crates, ropes, pendulums)
  update(dt) {
    // 1. Update pushables
    for (const box of this.pushables) {
      box.update(dt, this);
    }

    // 2. Update ropes (multi-pass Verlet)
    for (const rope of this.ropes) {
      rope.update(dt);
    }
  }

  // Move a kinematic body with collision resolution
  moveKinematic(body, vx, vy, dt) {
    let onFloor = false;
    let onWall = false;
    let onCeiling = false;

    const dx = vx * dt;
    const dy = vy * dt;

    // Horizontal Movement
    body.x += dx;
    for (const solid of this.solids) {
      if (solid.isHazard) continue;
      if (this.checkOverlap(body, solid)) {
        if (dx > 0) {
          body.x = solid.x - body.w;
          onWall = true;
        } else if (dx < 0) {
          body.x = solid.x + solid.w;
          onWall = true;
        }
      }
    }

    // Also collide with pushables horizontally
    for (const box of this.pushables) {
      if (box === body) continue;
      if (this.checkOverlap(body, box)) {
        if (dx > 0) {
          body.x = box.x - body.w;
          onWall = true;
          // Transfer push force to box
          box.vx = Math.max(box.vx, vx * 0.7);
        } else if (dx < 0) {
          body.x = box.x + box.w;
          onWall = true;
          box.vx = Math.min(box.vx, vx * 0.7);
        }
      }
    }

    // Vertical Movement
    const prevY = body.y;
    body.y += dy;

    // Check Solids
    for (const solid of this.solids) {
      if (solid.isHazard) continue;
      if (this.checkOverlap(body, solid)) {
        if (dy > 0) {
          body.y = solid.y - body.h;
          onFloor = true;
        } else if (dy < 0) {
          body.y = solid.y + solid.h;
          onCeiling = true;
        }
      }
    }

    // Check Pushables vertically (can stand on crates)
    for (const box of this.pushables) {
      if (box === body) continue;
      if (this.checkOverlap(body, box)) {
        if (dy > 0 && prevY + body.h <= box.y + 4) {
          body.y = box.y - body.h;
          onFloor = true;
        } else if (dy < 0) {
          body.y = box.y + box.h;
          onCeiling = true;
        }
      }
    }

    // Check One-way Platforms (only collide if falling through from above)
    if (!body.ignoreOneWay && dy >= 0) {
      for (const plat of this.oneWayPlatforms) {
        if (prevY + body.h <= plat.y + 2 && body.y + body.h >= plat.y) {
          if (body.x + body.w > plat.x && body.x < plat.x + plat.w) {
            body.y = plat.y - body.h;
            onFloor = true;
          }
        }
      }
    }

    return { onFloor, onWall, onCeiling };
  }
}

// Verlet Rope Simulation Class
export class VerletRope {
  constructor(anchorX, anchorY, segmentCount = 10, segmentLength = 16) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.segmentLength = segmentLength;
    this.nodes = [];

    for (let i = 0; i < segmentCount; i++) {
      this.nodes.push({
        x: anchorX,
        y: anchorY + i * segmentLength,
        oldX: anchorX,
        oldY: anchorY + i * segmentLength,
        pinned: i === 0
      });
    }
  }

  update(dt) {
    const gravity = 800;
    const damping = 0.985;

    // 1. Verlet Integration
    for (const node of this.nodes) {
      if (node.pinned) continue;
      const vx = (node.x - node.oldX) * damping;
      const vy = (node.y - node.oldY) * damping;

      node.oldX = node.x;
      node.oldY = node.y;

      node.x += vx;
      node.y += vy + gravity * dt * dt;
    }

    // 2. Solve Distance Constraints (multiple iterations for stiffness)
    const iterations = 8;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < this.nodes.length - 1; i++) {
        const n1 = this.nodes[i];
        const n2 = this.nodes[i + 1];

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1e-5;
        const diff = (dist - this.segmentLength) / dist;

        if (n1.pinned) {
          n2.x -= dx * diff;
          n2.y -= dy * diff;
        } else if (n2.pinned) {
          n1.x += dx * diff;
          n1.y += dy * diff;
        } else {
          n1.x += dx * diff * 0.5;
          n1.y += dy * diff * 0.5;
          n2.x -= dx * diff * 0.5;
          n2.y -= dy * diff * 0.5;
        }
      }
    }
  }

  // Apply lateral impulse to the rope (for swinging)
  applyImpulse(fx, nodeIdx) {
    const targetIdx = (nodeIdx !== undefined && nodeIdx >= 0 && nodeIdx < this.nodes.length)
      ? nodeIdx
      : this.nodes.length - 1;
    const target = this.nodes[targetIdx];
    if (target && !target.pinned) {
      target.x += fx;
    }
  }

  // Get nearest node to a given point
  getNearestNodeIndex(px, py, maxDist = 32) {
    let nearestIdx = -1;
    let minDist = maxDist;

    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const dist = Math.hypot(n.x - px, n.y - py);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }

  render(ctx) {
    if (this.nodes.length < 2) return;

    ctx.save();
    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.nodes[0].x, this.nodes[0].y);

    for (let i = 1; i < this.nodes.length; i++) {
      ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
    }
    ctx.stroke();

    // Subtle frayed rope fibers
    ctx.strokeStyle = '#2c3138';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
