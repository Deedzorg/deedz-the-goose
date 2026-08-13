import { Application, Container } from 'pixi.js';
import { LayerManager } from './LayerManager.js';
import { Camera } from './Camera.js';
import { WORLD_LAYER_NAMES } from '../../shared/constants.js';

export class Renderer {
  constructor(config, events) {
    this.config = config;
    this.events = events;
    this.app = null;
    this.root = null;
    this.viewport = null;
    this.layers = null;
    this.camera = null;
    this._boundResize = this.#onResize.bind(this);
  }

  async initialize() {
    this.root = document.querySelector(this.config.root);
    if (!this.root) throw new Error(`Renderer root not found: ${this.config.root}`);

    const options = {
      resizeTo: this.root,
      background: this.config.background,
      antialias: this.config.antialias,
      autoDensity: this.config.autoDensity,
      resolution: Math.min(globalThis.devicePixelRatio || 1, this.config.maxResolution),
      preference: this.config.preference,
      roundPixels: this.config.roundPixels,
    };
    this.app = new Application();
    try {
      await this.app.init(options);
    } catch (error) {
      if (!this.config.allowCanvasFallback || this.config.preference === 'canvas') throw error;
      this.events.emit('renderer:fallback', { from: this.config.preference, to: 'canvas', error });
      try { this.app.destroy(true, { children: true }); } catch {}
      this.app = new Application();
      await this.app.init({ ...options, preference: 'canvas' });
    }
    this.app.ticker.stop();
    this.app.canvas.setAttribute('aria-label', 'Deedz Engine canvas');
    this.app.canvas.setAttribute('tabindex', '0');
    this.root.replaceChildren(this.app.canvas);

    this.viewport = new Container({ label: 'engine:viewport' });
    this.app.stage.addChild(this.viewport);
    this.layers = new LayerManager(this.viewport, WORLD_LAYER_NAMES);
    this.camera = new Camera(this.viewport, this.app.renderer);
    window.addEventListener('resize', this._boundResize);
    this.#onResize();
    this.events.emit('renderer:initialized', { renderer: this });
    return this;
  }

  get width() { return this.app?.renderer?.width ?? 0; }
  get height() { return this.app?.renderer?.height ?? 0; }
  get stage() { return this.app?.stage; }
  get canvas() { return this.app?.canvas; }
  render() { this.app?.renderer.render(this.app.stage); }

  #onResize() {
    queueMicrotask(() => this.events.emit('renderer:resize', { width: this.width, height: this.height, resolution: this.app?.renderer?.resolution ?? 1 }));
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize);
    this.app?.destroy(true, { children: true, texture: false, textureSource: false });
    this.app = null;
    this.layers = null;
    this.viewport = null;
    this.camera = null;
    this.root = null;
  }
}
