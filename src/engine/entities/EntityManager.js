export class EntityManager {
  constructor(events) {
    this.events = events;
    this.entities = new Map();
    this.pendingAdd = [];
    this.pendingRemove = new Set();
    this.updating = false;
  }

  add(entity, parent = null) {
    if (!entity?.id) throw new Error('EntityManager.add requires an entity with an id');
    if (this.entities.has(entity.id) || this.pendingAdd.some((entry) => entry.entity.id === entity.id)) throw new Error(`Duplicate entity id: ${entity.id}`);
    this.pendingAdd.push({ entity, parent });
    return entity;
  }

  addImmediate(entity, parent = null) {
    this.add(entity, parent);
    this.#flush();
    return entity;
  }

  remove(entityOrId) {
    const id = typeof entityOrId === 'string' ? entityOrId : entityOrId?.id;
    if (id) this.pendingRemove.add(id);
  }

  removeImmediate(entityOrId) {
    this.remove(entityOrId);
    this.#flush();
  }

  get(id) { return this.entities.get(id); }
  has(id) { return this.entities.has(id); }
  all() { return [...this.entities.values()]; }
  findByTag(tag) { return [...this.entities.values()].filter((entity) => entity.hasTag(tag)); }
  find(predicate) { return [...this.entities.values()].find(predicate); }
  filter(predicate) { return [...this.entities.values()].filter(predicate); }

  fixedUpdate(dt, engine) {
    this.#flush();
    this.updating = true;
    for (const entity of [...this.entities.values()]) entity.fixedUpdate(dt, engine);
    this.updating = false;
    this.#flush();
  }

  update(dt, engine) {
    this.#flush();
    this.updating = true;
    for (const entity of [...this.entities.values()]) entity.update(dt, engine);
    this.updating = false;
    this.#flush();
  }

  #flush() {
    for (const { entity, parent } of this.pendingAdd.splice(0)) {
      if (this.pendingRemove.delete(entity.id)) { entity.destroy(); continue; }
      this.entities.set(entity.id, entity);
      parent?.addChild(entity.display);
      this.events.emit('entity:added', { entity, parent });
    }
    for (const id of this.pendingRemove) {
      const entity = this.entities.get(id);
      if (!entity) continue;
      this.events.emit('entity:removing', { entity });
      this.entities.delete(id);
      entity.destroy();
      this.events.emit('entity:removed', { id, entity });
    }
    this.pendingRemove.clear();
  }

  clear() {
    for (const entity of this.entities.values()) {
      this.events.emit('entity:removing', { entity });
      entity.destroy();
    }
    this.entities.clear();
    for (const { entity } of this.pendingAdd) entity.destroy();
    this.pendingAdd = [];
    this.pendingRemove.clear();
    this.events.emit('entities:cleared');
  }

  destroy() { this.clear(); }
}
