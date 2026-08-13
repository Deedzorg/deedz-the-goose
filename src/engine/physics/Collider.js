import { createId } from '../../shared/utils.js';

export class Collider {
  constructor(entity, { x = 0, y = 0, width = 32, height = 32, trigger = false, layer = 1, mask = 0xffffffff, data = {} } = {}) {
    if (!entity) throw new Error('Collider requires an entity');
    this.id = createId('collider');
    this.entity = entity;
    this.offset = { x, y };
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.trigger = trigger;
    this.layer = layer;
    this.mask = mask;
    this.data = data;
    this.enabled = true;
  }

  get centerX() { return this.entity.x + this.offset.x; }
  get centerY() { return this.entity.y + this.offset.y; }
  get left() { return this.centerX - this.width / 2; }
  get right() { return this.centerX + this.width / 2; }
  get top() { return this.centerY - this.height / 2; }
  get bottom() { return this.centerY + this.height / 2; }
  get bounds() { return { x: this.left, y: this.top, width: this.width, height: this.height }; }

  intersects(other) {
    return this.left < other.right && this.right > other.left && this.top < other.bottom && this.bottom > other.top;
  }

  containsPoint(x, y) { return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom; }
  canCollide(other) { return this.enabled && other.enabled && !this.entity.destroyed && !other.entity.destroyed && (this.mask & other.layer) !== 0 && (other.mask & this.layer) !== 0; }
}
