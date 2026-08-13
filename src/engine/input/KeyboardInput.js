export class KeyboardInput {
  constructor({ preventDefault = [] } = {}, events = null) {
    this.events = events;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.preventDefault = new Set(preventDefault);
    this.enabled = true;
    this._boundOnDown = this.#onDown.bind(this);
    this._boundOnUp = this.#onUp.bind(this);
    this._boundOnBlur = this.#onBlur.bind(this);
  }

  initialize() {
    window.addEventListener('keydown', this._boundOnDown, { passive: false });
    window.addEventListener('keyup', this._boundOnUp, { passive: false });
    window.addEventListener('blur', this._boundOnBlur);
  }

  #onDown(event) {
    if (!this.enabled) return;
    if (this.preventDefault.has(event.code)) event.preventDefault();
    if (!this.down.has(event.code)) {
      this.pressed.add(event.code);
      this.events?.emit('keyboard:down', { code: event.code, event });
    }
    this.down.add(event.code);
  }

  #onUp(event) {
    if (this.preventDefault.has(event.code)) event.preventDefault();
    if (this.down.has(event.code)) this.events?.emit('keyboard:up', { code: event.code, event });
    this.down.delete(event.code);
    this.released.add(event.code);
  }

  #onBlur() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }

  endFrame() { this.pressed.clear(); this.released.clear(); }

  destroy() {
    window.removeEventListener('keydown', this._boundOnDown);
    window.removeEventListener('keyup', this._boundOnUp);
    window.removeEventListener('blur', this._boundOnBlur);
    this.#onBlur();
  }
}
