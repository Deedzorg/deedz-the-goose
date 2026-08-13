import { CollisionSystem } from './CollisionSystem.js';

export class PhysicsWorld {
  constructor(config, events) {
    this.gravity = { x: config.gravityX, y: config.gravityY };
    this.events = events;
    this.bodies = new Map();
    this.colliders = new Map();
    this.collisions = new CollisionSystem(events, { cellSize: config.cellSize });
    this._offEntityRemoving = events.on('entity:removing', ({ entity }) => this.removeBody(entity));
  }

  addBody(entity, { gravityScale = 1, static: isStatic = false, drag = 0, maxSpeedX = Infinity, maxSpeedY = Infinity } = {}) {
    this.bodies.set(entity.id, { entity, gravityScale, static: isStatic, drag, maxSpeedX, maxSpeedY });
    return entity;
  }

  getBody(entityOrId) { return this.bodies.get(typeof entityOrId === 'string' ? entityOrId : entityOrId.id); }

  removeBody(entityOrId) {
    const id = typeof entityOrId === 'string' ? entityOrId : entityOrId?.id;
    if (!id) return false;
    this.colliders.delete(id);
    return this.bodies.delete(id);
  }

  addCollider(collider) {
    const list = this.colliders.get(collider.entity.id) ?? [];
    if (!list.includes(collider)) list.push(collider);
    this.colliders.set(collider.entity.id, list);
    return collider;
  }

  removeCollider(collider) {
    const list = this.colliders.get(collider.entity.id);
    if (!list) return false;
    const index = list.indexOf(collider);
    if (index >= 0) list.splice(index, 1);
    if (!list.length) this.colliders.delete(collider.entity.id);
    return index >= 0;
  }

  getColliders(entityOrId) { return this.colliders.get(typeof entityOrId === 'string' ? entityOrId : entityOrId.id) ?? []; }
  allColliders() { return [...this.colliders.values()].flat(); }

  fixedUpdate(dt) {
    for (const [id, body] of [...this.bodies]) {
      const { entity } = body;
      if (entity.destroyed) { this.removeBody(id); continue; }
      if (!entity.active || body.static) continue;
      entity.previousPosition.x = entity.x;
      entity.previousPosition.y = entity.y;
      entity.velocity.x += this.gravity.x * body.gravityScale * dt;
      entity.velocity.y += this.gravity.y * body.gravityScale * dt;
      if (body.drag > 0) {
        const factor = Math.max(0, 1 - body.drag * dt);
        entity.velocity.x *= factor;
        entity.velocity.y *= factor;
      }
      entity.velocity.x = Math.max(-body.maxSpeedX, Math.min(body.maxSpeedX, entity.velocity.x));
      entity.velocity.y = Math.max(-body.maxSpeedY, Math.min(body.maxSpeedY, entity.velocity.y));
      entity.x += entity.velocity.x * dt;
      entity.y += entity.velocity.y * dt;
    }
    this.collisions.step(this.allColliders());
  }

  clear() {
    this.bodies.clear();
    this.colliders.clear();
    this.collisions.clear();
  }

  destroy() { this._offEntityRemoving?.(); this.clear(); }
}
