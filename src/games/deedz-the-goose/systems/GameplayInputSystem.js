import { lockPlayerForSpawn, screenOwnsControllerNavigation } from './GameplayPolishSystem.js';

export class GameplayInputSystem {
  constructor(engine) {
    this.engine = engine;
    this.mousePointerId = null;
    this.spawnRestore = null;

    this.originalUiUpdate = engine.ui.update;
    this.uiUpdateWrapper = (input) => {
      if (screenOwnsControllerNavigation(engine.ui.activeScreen?.id)) return;
      return this.originalUiUpdate.call(engine.ui, input);
    };
    engine.ui.update = this.uiUpdateWrapper;

    this.canvas = engine.renderer.canvas;
    this._pointerDown = (event) => this.#pointerDown(event);
    this._pointerUp = (event) => this.#pointerUp(event);
    this._blur = () => this.#releaseMouseThrow();
    this.canvas?.addEventListener('pointerdown', this._pointerDown, { passive: false });
    this.canvas?.addEventListener('pointerup', this._pointerUp, { passive: false });
    this.canvas?.addEventListener('pointercancel', this._pointerUp, { passive: false });
    this.canvas?.addEventListener('lostpointercapture', this._pointerUp, { passive: false });
    window.addEventListener('blur', this._blur);

    this.unsubscribers = [
      engine.events.on('mission:started', () => this.#missionStarted(), { priority: 250 }),
      engine.events.on('scene:pushed', () => this.#syncPointerState()),
      engine.events.on('scene:popped', () => this.#syncPointerState()),
      engine.events.on('scene:changed', () => this.#syncPointerState()),
    ];
  }

  #world() { return this.engine.scenes?.get?.('world') ?? null; }

  #missionStarted() {
    const world = this.#world();
    if (!world?.player) return;
    this.spawnRestore?.();
    this.spawnRestore = lockPlayerForSpawn(world.player, this.engine, 8);
    this.engine.ui.toast('Controls ready: controller, keyboard, touch, or hold left mouse to charge a crumb throw.', { duration: 3200 });
  }

  #pointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.engine.scenes?.active?.id !== 'world') return;
    event.preventDefault();
    this.mousePointerId = event.pointerId;
    this.canvas?.setPointerCapture?.(event.pointerId);
    this.engine.input.setVirtualAction('throw', 1);
  }

  #pointerUp(event) {
    if (event.pointerType !== 'mouse' || (this.mousePointerId !== null && event.pointerId !== this.mousePointerId)) return;
    event.preventDefault();
    this.#releaseMouseThrow();
  }

  #releaseMouseThrow() {
    if (this.mousePointerId === null && !this.engine.input.isDown?.('throw')) return;
    this.mousePointerId = null;
    this.engine.input.releaseVirtualAction('throw');
  }

  #syncPointerState() {
    if (this.engine.scenes?.active?.id !== 'world') this.#releaseMouseThrow();
  }

  destroy() {
    this.spawnRestore?.();
    this.spawnRestore = null;
    this.#releaseMouseThrow();
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.canvas?.removeEventListener('pointerdown', this._pointerDown);
    this.canvas?.removeEventListener('pointerup', this._pointerUp);
    this.canvas?.removeEventListener('pointercancel', this._pointerUp);
    this.canvas?.removeEventListener('lostpointercapture', this._pointerUp);
    window.removeEventListener('blur', this._blur);
    if (this.engine.ui.update === this.uiUpdateWrapper) this.engine.ui.update = this.originalUiUpdate;
  }
}
