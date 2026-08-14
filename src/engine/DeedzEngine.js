import { EngineConfig } from './EngineConfig.js';
import { EngineState } from '../shared/constants.js';
import { EventBus } from './events/EventBus.js';
import { Renderer } from './rendering/Renderer.js';
import { GameLoop } from './loop/GameLoop.js';
import { SceneManager } from './scenes/SceneManager.js';
import { InputManager } from './input/InputManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { AssetManager } from './assets/AssetManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkManager } from './networking/NetworkManager.js';
import { SaveManager } from './save/SaveManager.js';
import { PluginManager } from './plugins/PluginManager.js';
import { Diagnostics } from './debug/Diagnostics.js';

export function shouldSimulateWorld(scenes) {
  return Boolean(scenes?.active && !scenes.transitioning && !scenes.active.blocksWorld);
}

export class DeedzEngine {
  constructor(config = {}) {
    this.config = EngineConfig.create(config);
    this.events = new EventBus();
    this.renderer = new Renderer(this.config.renderer, this.events);
    this.loop = new GameLoop(this.config.loop);
    this.input = new InputManager(this.config.input, this.events);
    this.audio = new AudioManager(this.config.audio, this.events);
    this.assets = new AssetManager(this.events);
    this.entities = new EntityManager(this.events);
    this.physics = new PhysicsWorld(this.config.physics, this.events);
    this.ui = null;
    this.network = new NetworkManager(this.config.network, this.events);
    this.save = new SaveManager(this.config.save, this.events);
    this.plugins = new PluginManager(this.events);
    this.scenes = null;
    this.debug = null;
    this.game = null;
    this.state = EngineState.CREATED;
    this.pauseReasons = new Set();
    this._globalErrorHandlers = [];
  }

  get initialized() { return [EngineState.READY, EngineState.STARTING, EngineState.RUNNING, EngineState.STOPPING].includes(this.state); }
  get running() { return this.state === EngineState.RUNNING; }
  get paused() { return this.pauseReasons.size > 0; }

  async initialize(game) {
    if (this.initialized) return this;
    if (!game) throw new Error('DeedzEngine.initialize requires a GameApp');
    this.#setState(EngineState.INITIALIZING);
    this.game = game;
    try {
      await this.renderer.initialize();
      this.ui = new UIManager(this.events);
      this.scenes = new SceneManager(this, this.events);
      this.input.initialize();
      this.audio.initialize();
      await this.assets.initialize(game.assetManifest?.() ?? this.assets.manifest);
      this.save.initialize(game.defaultSaveData?.() ?? {});
      this.network.initialize(game.networkProfile?.(this) ?? this.save.get('profile', {}));
      await game.registerPlugins(this);
      await this.plugins.installAll(this);
      await game.registerScenes(this);
      await game.initialize(this);
      this.debug = new Diagnostics(this, this.config.debug);
      this.debug.initialize();
      this.#installGlobalErrorHandlers();
      this.loop.configure({
        beforeFrame: () => this.input.beginFrame(),
        fixedUpdate: (dt) => this.#fixedUpdate(dt),
        update: (dt) => this.#update(dt),
        render: (alpha) => this.#render(alpha),
        afterFrame: () => this.input.endFrame(),
        onError: (error) => this.#handleFatalError(error, 'game-loop'),
      });
      this.#setState(EngineState.READY);
      this.events.emit('engine:initialized', { engine: this });
      return this;
    } catch (error) {
      this.#setState(EngineState.FAILED);
      this.events.emit('engine:error', { source: 'initialize', error, fatal: true });
      await this.#shutdownServices({ preserveEvents: true });
      throw error;
    }
  }

  async start() {
    if (this.state !== EngineState.READY) throw new Error(`Cannot start engine from state: ${this.state}`);
    this.#setState(EngineState.STARTING);
    try {
      await this.plugins.startAll(this);
      await this.game.start(this);
      this.#setState(EngineState.RUNNING);
      this.loop.start();
      this.events.emit('engine:started', { engine: this });
    } catch (error) {
      this.#setState(EngineState.FAILED);
      this.events.emit('engine:error', { source: 'start', error, fatal: true });
      throw error;
    }
  }

  #fixedUpdate(dt) {
    this.plugins.fixedUpdate(dt, this);
    if (shouldSimulateWorld(this.scenes)) {
      this.entities.fixedUpdate(dt, this);
      this.physics.fixedUpdate(dt);
    }
    this.scenes.fixedUpdate(dt);
  }

  #update(dt) {
    this.debug?.update();
    this.ui?.update(this.input);
    this.network.update(dt);
    this.plugins.update(dt, this);
    if (shouldSimulateWorld(this.scenes)) this.entities.update(dt, this);
    this.scenes.update(dt);
    this.renderer.camera.update(dt);
  }

  #render(alpha) {
    this.scenes.render(alpha);
    this.debug?.render();
    this.renderer.render();
  }

  pause(reason = 'manual') {
    this.pauseReasons.add(reason);
    this.loop.setPaused(true);
    this.events.emit('engine:pauseChanged', { paused: true, reasons: [...this.pauseReasons] });
  }

  resume(reason = 'manual') {
    this.pauseReasons.delete(reason);
    this.loop.setPaused(this.paused);
    this.events.emit('engine:pauseChanged', { paused: this.paused, reasons: [...this.pauseReasons] });
  }

  setPaused(paused, reason = 'manual') { paused ? this.pause(reason) : this.resume(reason); }
  setTimeScale(scale) { this.loop.setTimeScale(scale); this.events.emit('engine:timeScale', { scale: this.loop.time.scale }); }

  #setState(state) {
    const previous = this.state;
    this.state = state;
    this.events.emit('engine:state', { previous, state });
  }

  #installGlobalErrorHandlers() {
    const onError = (event) => this.events.emit('engine:error', { source: 'window', error: event.error ?? new Error(event.message), fatal: false });
    const onRejection = (event) => this.events.emit('engine:error', { source: 'promise', error: event.reason, fatal: false });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    this._globalErrorHandlers = [['error', onError], ['unhandledrejection', onRejection]];
  }

  #removeGlobalErrorHandlers() {
    for (const [type, handler] of this._globalErrorHandlers) window.removeEventListener(type, handler);
    this._globalErrorHandlers = [];
  }

  #handleFatalError(error, source) {
    this.loop.stop();
    this.#setState(EngineState.FAILED);
    this.events.emit('engine:error', { source, error, fatal: true });
    console.error(`[Deedz Engine] Fatal ${source} error`, error);
  }

  async shutdown() {
    if ([EngineState.STOPPED, EngineState.CREATED].includes(this.state)) return;
    this.#setState(EngineState.STOPPING);
    this.loop.stop();
    try { await this.game?.shutdown?.(this); }
    finally {
      await this.#shutdownServices();
      this.#setState(EngineState.STOPPED);
    }
  }

  async #shutdownServices({ preserveEvents = false } = {}) {
    this.#removeGlobalErrorHandlers();
    await this.scenes?.destroy().catch((error) => console.warn('[Deedz Engine] Scene shutdown failed', error));
    await this.plugins?.destroy(this).catch((error) => console.warn('[Deedz Engine] Plugin shutdown failed', error));
    this.debug?.destroy();
    this.network?.destroy();
    this.save?.destroy();
    await this.assets?.destroy().catch(() => {});
    await this.audio?.destroy().catch(() => {});
    this.physics?.destroy();
    this.entities?.destroy();
    this.input?.destroy();
    this.ui?.destroy();
    this.renderer?.destroy();
    this.loop?.destroy();
    if (!preserveEvents) this.events?.destroy();
    this.pauseReasons.clear();
  }
}
