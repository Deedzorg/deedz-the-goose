import { clamp, lerp } from '../../shared/math.js';

export class Camera {
  constructor(worldContainer, renderer) {
    this.world = worldContainer;
    this.renderer = renderer;
    this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
    this.zoom = 1; this.targetZoom = 1;
    this.followTarget = null;
    this.followOffset = { x: 0, y: 0 };
    this.smoothing = 10;
    this.bounds = null;
    this.shakeTime = 0; this.shakeStrength = 0;
  }

  follow(target, { smoothing = 10, offsetX = 0, offsetY = 0 } = {}) {
    this.followTarget = target;
    this.smoothing = smoothing;
    this.followOffset = { x: offsetX, y: offsetY };
    return this;
  }
  unfollow() { this.followTarget = null; }
  setBounds(bounds) { this.bounds = bounds ? { ...bounds } : null; return this; }
  setPosition(x, y, immediate = false) { this.targetX = x; this.targetY = y; if (immediate) { this.x = x; this.y = y; } return this; }
  setZoom(value, immediate = false) { this.targetZoom = clamp(value, 0.25, 4); if (immediate) this.zoom = this.targetZoom; return this; }
  shake(strength = 8, duration = 0.2) { this.shakeStrength = Math.max(this.shakeStrength, strength); this.shakeTime = Math.max(this.shakeTime, duration); }

  #clampTarget() {
    if (!this.bounds) return;
    const halfW = this.renderer.width / (2 * this.targetZoom);
    const halfH = this.renderer.height / (2 * this.targetZoom);
    const minX = this.bounds.x + halfW;
    const maxX = this.bounds.x + this.bounds.width - halfW;
    const minY = this.bounds.y + halfH;
    const maxY = this.bounds.y + this.bounds.height - halfH;
    this.targetX = minX > maxX ? this.bounds.x + this.bounds.width / 2 : clamp(this.targetX, minX, maxX);
    this.targetY = minY > maxY ? this.bounds.y + this.bounds.height / 2 : clamp(this.targetY, minY, maxY);
  }

  update(dt) {
    if (this.followTarget) {
      const pos = this.followTarget.position ?? this.followTarget;
      this.targetX = pos.x + this.followOffset.x;
      this.targetY = pos.y + this.followOffset.y;
    }
    this.#clampTarget();
    const t = this.smoothing <= 0 ? 1 : 1 - Math.exp(-this.smoothing * dt);
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);
    this.zoom = lerp(this.zoom, this.targetZoom, t);

    let shakeX = 0, shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      shakeX = (Math.random() * 2 - 1) * this.shakeStrength;
      shakeY = (Math.random() * 2 - 1) * this.shakeStrength;
      this.shakeStrength *= Math.pow(0.04, dt);
    }

    this.world.scale.set(this.zoom);
    this.world.position.set(
      this.renderer.width / 2 - this.x * this.zoom + shakeX,
      this.renderer.height / 2 - this.y * this.zoom + shakeY,
    );
  }

  screenToWorld(x, y) {
    return { x: (x - this.world.x) / this.zoom, y: (y - this.world.y) / this.zoom };
  }

  worldToScreen(x, y) {
    return { x: x * this.zoom + this.world.x, y: y * this.zoom + this.world.y };
  }
}
