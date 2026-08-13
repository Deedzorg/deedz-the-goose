import { Container } from 'pixi.js';
import { createId } from '../../shared/utils.js';

export class Entity {
  constructor({ id = createId('entity'), name = 'Entity', tags = [] } = {}) {
    this.id = id;
    this.name = name;
    this.tags = new Set(tags);
    this.active = true;
    this.visible = true;
    this.started = false;
    this.destroyed = false;
    this.display = new Container({ label: `${name}:${id}` });
    this.components = new Map();
    this.velocity = { x: 0, y: 0 };
    this.previousPosition = { x: 0, y: 0 };
  }

  get x() { return this.display.x; }
  set x(value) { this.display.x = Number(value) || 0; }
  get y() { return this.display.y; }
  set y(value) { this.display.y = Number(value) || 0; }
  get position() { return this.display.position; }

  addTag(tag) { this.tags.add(tag); return this; }
  removeTag(tag) { this.tags.delete(tag); return this; }
  hasTag(tag) { return this.tags.has(tag); }

  addComponent(name, component) {
    if (this.components.has(name)) this.removeComponent(name);
    this.components.set(name, component);
    component.onAttach(this);
    return component;
  }

  getComponent(name) { return this.components.get(name); }
  hasComponent(name) { return this.components.has(name); }
  removeComponent(name) {
    const component = this.components.get(name);
    component?.destroy();
    return this.components.delete(name);
  }

  start(engine) {
    if (this.started || this.destroyed) return;
    this.started = true;
    for (const component of this.components.values()) if (!component.started) component.start(engine);
  }

  fixedUpdate(dt, engine) {
    if (!this.active || this.destroyed) return;
    if (!this.started) this.start(engine);
    for (const component of this.components.values()) if (component.enabled) component.fixedUpdate(dt, engine);
  }

  update(dt, engine) {
    if (!this.active || this.destroyed) return;
    this.display.visible = this.visible;
    if (!this.started) this.start(engine);
    for (const component of this.components.values()) if (component.enabled) component.update(dt, engine);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    for (const component of this.components.values()) component.destroy();
    this.components.clear();
    this.display.removeFromParent();
    this.display.destroy({ children: true });
  }
}
