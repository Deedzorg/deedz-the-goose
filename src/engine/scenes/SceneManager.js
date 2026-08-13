export class SceneManager {
  constructor(engine, events) {
    this.engine = engine;
    this.events = events;
    this.factories = new Map();
    this.stack = [];
    this.transitioning = false;
    this.transitionQueue = Promise.resolve();
  }

  register(id, factory) {
    if (!id || !factory) throw new Error('Scene registration requires an id and factory');
    if (this.factories.has(id)) throw new Error(`Scene already registered: ${id}`);
    this.factories.set(id, factory);
    return this;
  }

  unregister(id) { return this.factories.delete(id); }
  get active() { return this.stack.at(-1) ?? null; }
  get depth() { return this.stack.length; }
  get(id) { return this.stack.find((scene) => scene.id === id); }
  has(id) { return this.factories.has(id); }

  change(id, data) { return this.#enqueue(() => this.#change(id, data)); }
  push(id, data) { return this.#enqueue(() => this.#push(id, data)); }
  pop(result) { return this.#enqueue(() => this.#pop(result)); }
  reset(id, data) { return this.change(id, data); }

  #enqueue(operation) {
    const next = this.transitionQueue.then(operation, operation);
    this.transitionQueue = next.catch(() => {});
    return next;
  }

  async #create(id, data) {
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`Scene not registered: ${id}`);
    const scene = typeof factory === 'function' ? await factory(data) : factory;
    if (!scene || scene.id !== id) throw new Error(`Scene factory for "${id}" returned an invalid scene`);
    scene.engine = this.engine;
    if (!scene.loaded) await scene.load(data);
    return scene;
  }

  async #dispose(scene) {
    if (!scene) return;
    await scene.exit();
    await scene.unload();
    scene.destroy();
  }

  async #change(id, data) {
    this.transitioning = true;
    this.events.emit('scene:transitionStart', { type: 'change', id, data });
    try {
      while (this.stack.length) await this.#dispose(this.stack.pop());
      const scene = await this.#create(id, data);
      this.stack.push(scene);
      this.engine.renderer.layers.get('world').addChild(scene.root);
      await scene.enter(data);
      this.events.emit('scene:changed', { id, scene, depth: this.depth });
      return scene;
    } catch (error) {
      this.events.emit('scene:error', { type: 'change', id, error });
      throw error;
    } finally {
      this.transitioning = false;
      this.events.emit('scene:transitionEnd', { type: 'change', id });
    }
  }

  async #push(id, data) {
    this.transitioning = true;
    this.events.emit('scene:transitionStart', { type: 'push', id, data });
    const previous = this.active;
    let scene = null;
    try {
      previous?.pause();
      scene = await this.#create(id, data);
      this.stack.push(scene);
      this.engine.renderer.layers.get('world').addChild(scene.root);
      await scene.enter(data);
      this.events.emit('scene:pushed', { id, scene, depth: this.depth });
      return scene;
    } catch (error) {
      if (scene && this.stack.at(-1) === scene) this.stack.pop();
      if (scene) await this.#dispose(scene).catch(() => {});
      previous?.resume();
      this.events.emit('scene:error', { type: 'push', id, error });
      throw error;
    } finally {
      this.transitioning = false;
      this.events.emit('scene:transitionEnd', { type: 'push', id });
    }
  }

  async #pop(result) {
    if (this.stack.length <= 1) return null;
    this.transitioning = true;
    const scene = this.stack.pop();
    this.events.emit('scene:transitionStart', { type: 'pop', id: scene.id, result });
    try {
      await this.#dispose(scene);
      this.active?.resume(result);
      this.events.emit('scene:popped', { id: scene.id, result, active: this.active, depth: this.depth });
      return this.active;
    } finally {
      this.transitioning = false;
      this.events.emit('scene:transitionEnd', { type: 'pop', id: scene.id });
    }
  }

  fixedUpdate(dt) { if (!this.transitioning) this.active?.fixedUpdate(dt); }
  update(dt) { if (!this.transitioning) this.active?.update(dt); }
  render(alpha) { for (const scene of this.stack) scene.render(alpha); }

  async destroy() {
    await this.transitionQueue.catch(() => {});
    while (this.stack.length) await this.#dispose(this.stack.pop());
    this.factories.clear();
  }
}
