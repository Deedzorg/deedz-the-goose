import { Container } from 'pixi.js';

export class LayerManager {
  constructor(stage, names = []) {
    this.stage = stage;
    this.layers = new Map();
    names.forEach((name) => this.create(name));
  }

  create(name, options = {}) {
    if (this.layers.has(name)) return this.layers.get(name);
    const layer = new Container({ label: `layer:${name}`, sortableChildren: true, ...options });
    this.layers.set(name, layer);
    this.stage.addChild(layer);
    return layer;
  }

  has(name) { return this.layers.has(name); }

  get(name) {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`Unknown render layer: ${name}`);
    return layer;
  }

  add(name, displayObject, zIndex = null) {
    if (zIndex !== null) displayObject.zIndex = zIndex;
    this.get(name).addChild(displayObject);
    return displayObject;
  }

  remove(name, displayObject, { destroy = false } = {}) {
    const layer = this.get(name);
    if (displayObject.parent === layer) layer.removeChild(displayObject);
    if (destroy) displayObject.destroy({ children: true });
  }

  clear(name, { destroy = true } = {}) {
    const children = this.get(name).removeChildren();
    if (destroy) for (const child of children) child.destroy({ children: true });
  }

  destroy() {
    for (const layer of this.layers.values()) layer.destroy({ children: true });
    this.layers.clear();
  }
}
