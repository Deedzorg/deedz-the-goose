import { Container } from 'pixi.js';

export class Scene {
  constructor(id, { blocksWorld = false, transparent = false } = {}) {
    if (!id) throw new Error('Scene requires an id');
    this.id = id;
    this.engine = null;
    this.active = false;
    this.loaded = false;
    this.blocksWorld = blocksWorld;
    this.transparent = transparent;
    this.data = null;
    this.root = new Container({ label: `scene:${id}` });
    this.abortController = new AbortController();
  }

  get signal() { return this.abortController.signal; }
  on(eventName, listener, options = {}) {
    return this.engine.events.on(eventName, listener, { ...options, signal: this.signal });
  }

  async load(_data) { this.loaded = true; }
  async enter(data) { this.active = true; this.root.visible = true; this.data = data; }
  pause() { this.active = false; }
  resume(result) { this.active = true; this.result = result; }
  fixedUpdate(_dt) {}
  update(_dt) {}
  render(_alpha) {}
  async exit() { this.active = false; this.root.visible = false; }
  async unload() { this.loaded = false; }

  destroy() {
    this.abortController.abort();
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }
}
