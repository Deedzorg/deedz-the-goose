export function isTouchCapable(environment = globalThis) {
  const nav = environment.navigator ?? {};
  const coarse = environment.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return Number(nav.maxTouchPoints || 0) > 0 || coarse || 'ontouchstart' in environment;
}

export function shouldShowTouchControls({ mode = 'auto', touchCapable = false, gamepadConnected = false, worldActive = true } = {}) {
  if (!worldActive || mode === 'off') return false;
  if (mode === 'on') return true;
  return Boolean(touchCapable && !gamepadConnected);
}

const BUTTONS = Object.freeze([
  ['jump', 'FLAP'],
  ['attack', 'WHAP'],
  ['throw', 'CRUMB'],
  ['honk', 'HONK'],
  ['dash', 'DASH'],
  ['interact', 'BUMP'],
  ['sense', 'SENSE'],
]);

export class TouchControls {
  constructor(engine) {
    this.engine = engine;
    this.activePointers = new Map();
    this.touchCapable = isTouchCapable(window);
    this.root = document.createElement('div');
    this.root.className = 'deedz-touch-controls';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'On-screen game controls');
    this.root.innerHTML = `
      <div class="deedz-touch-controls__top">
        <button type="button" class="deedz-touch-button deedz-touch-button--pause" data-action="pause">Ⅱ</button>
      </div>
      <div class="deedz-touch-pad" aria-label="Movement controls">
        <button type="button" class="deedz-touch-button" data-action="left">◀</button>
        <button type="button" class="deedz-touch-button" data-action="down">▼</button>
        <button type="button" class="deedz-touch-button" data-action="right">▶</button>
      </div>
      <div class="deedz-touch-actions" aria-label="Action controls"></div>`;

    const actions = this.root.querySelector('.deedz-touch-actions');
    for (const [action, label] of BUTTONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `deedz-touch-button deedz-touch-button--${action}`;
      button.dataset.action = action;
      button.textContent = label;
      actions.appendChild(button);
    }

    this._pointerDown = (event) => this.#press(event);
    this._pointerUp = (event) => this.#release(event);
    this._contextMenu = (event) => event.preventDefault();
    this.root.addEventListener('pointerdown', this._pointerDown, { passive: false });
    this.root.addEventListener('pointerup', this._pointerUp, { passive: false });
    this.root.addEventListener('pointercancel', this._pointerUp, { passive: false });
    this.root.addEventListener('lostpointercapture', this._pointerUp, { passive: false });
    this.root.addEventListener('contextmenu', this._contextMenu);
    document.querySelector('#ui-root')?.appendChild(this.root);

    const refresh = () => requestAnimationFrame(() => this.refresh());
    this.unsubscribers = [
      engine.events.on('settings:touch-controls-changed', refresh),
      engine.events.on('gamepad:connected', refresh),
      engine.events.on('gamepad:disconnected', refresh),
      engine.events.on('scene:pushed', refresh),
      engine.events.on('scene:popped', refresh),
      engine.events.on('scene:changed', refresh),
    ];
    this.refresh();
  }

  #press(event) {
    const button = event.target.closest('[data-action]');
    if (!button || this.root.hidden) return;
    event.preventDefault();
    const action = button.dataset.action;
    button.setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, { action, button });
    button.classList.add('is-active');
    this.engine.input.setVirtualAction(action, 1);
  }

  #release(event) {
    const active = this.activePointers.get(event.pointerId);
    if (!active) return;
    event.preventDefault();
    this.activePointers.delete(event.pointerId);
    active.button.classList.remove('is-active');
    const stillHeld = [...this.activePointers.values()].some((entry) => entry.action === active.action);
    if (!stillHeld) this.engine.input.releaseVirtualAction(active.action);
  }

  refresh() {
    const mode = this.engine.save.get('settings.touchControls', 'auto');
    const worldActive = this.engine.scenes?.active?.id === 'world';
    const gamepadConnected = Boolean(this.engine.input.gamepad.info);
    const show = shouldShowTouchControls({ mode, touchCapable: this.touchCapable, gamepadConnected, worldActive });
    this.root.hidden = !show;
    this.root.classList.toggle('is-forced', mode === 'on');
    if (!show) this.releaseAll();
    this.engine.events.emit('touch-controls:visibility', { visible: show, mode, touchCapable: this.touchCapable, gamepadConnected });
    return show;
  }

  releaseAll() {
    for (const { action, button } of this.activePointers.values()) {
      button.classList.remove('is-active');
      this.engine.input.releaseVirtualAction(action);
    }
    this.activePointers.clear();
  }

  destroy() {
    this.releaseAll();
    this.unsubscribers.forEach((off) => off());
    this.root.removeEventListener('pointerdown', this._pointerDown);
    this.root.removeEventListener('pointerup', this._pointerUp);
    this.root.removeEventListener('pointercancel', this._pointerUp);
    this.root.removeEventListener('lostpointercapture', this._pointerUp);
    this.root.removeEventListener('contextmenu', this._contextMenu);
    this.root.remove();
  }
}
