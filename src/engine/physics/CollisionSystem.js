import { SpatialHash } from './SpatialHash.js';

export class CollisionSystem {
  constructor(events, { cellSize = 128 } = {}) {
    this.events = events;
    this.activePairs = new Map();
    this.spatialHash = new SpatialHash(cellSize);
    this.stats = { colliders: 0, candidates: 0, contacts: 0 };
  }

  step(colliders) {
    const enabled = colliders.filter((collider) => collider.enabled && !collider.entity.destroyed);
    this.spatialHash.rebuild(enabled);
    const candidates = this.spatialHash.candidatePairs();
    const nextPairs = new Map();
    let contacts = 0;

    for (const [a, b, key] of candidates) {
      if (!a.canCollide(b) || !a.intersects(b)) continue;
      const contact = { key, a, b, trigger: a.trigger || b.trigger };
      nextPairs.set(key, contact);
      contacts += 1;
      this.events.emit(this.activePairs.has(key) ? 'collision:stay' : 'collision:enter', contact);
    }

    for (const [key, contact] of this.activePairs) {
      if (!nextPairs.has(key)) this.events.emit('collision:exit', contact);
    }

    this.activePairs = nextPairs;
    this.stats = { colliders: enabled.length, candidates: candidates.length, contacts };
  }

  clear() { this.activePairs.clear(); this.spatialHash.clear(); }
}
