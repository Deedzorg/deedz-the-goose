export class InputMap {
  constructor(bindings = {}) {
    this.bindings = new Map(Object.entries(bindings).map(([action, list]) => [action, list.map((binding) => ({ ...binding }))]));
  }

  bind(action, binding) {
    const list = this.bindings.get(action) ?? [];
    this.bindings.set(action, [...list, { ...binding }]);
    return this;
  }

  unbind(action, predicate = null) {
    if (!predicate) return this.bindings.delete(action);
    const list = this.get(action).filter((binding) => !predicate(binding));
    this.bindings.set(action, list);
    return this;
  }

  set(action, bindings) { this.bindings.set(action, bindings.map((binding) => ({ ...binding }))); return this; }
  get(action) { return this.bindings.get(action) ?? []; }
  actions() { return this.bindings.keys(); }
  has(action) { return this.bindings.has(action); }
  toJSON() { return Object.fromEntries([...this.bindings].map(([action, list]) => [action, list.map((binding) => ({ ...binding }))])); }
}

export const DEFAULT_INPUT_BINDINGS = Object.freeze({
  left: [{ type: 'key', code: 'KeyA' }, { type: 'key', code: 'ArrowLeft' }, { type: 'gamepad-axis', axis: 0, direction: -1 }],
  right: [{ type: 'key', code: 'KeyD' }, { type: 'key', code: 'ArrowRight' }, { type: 'gamepad-axis', axis: 0, direction: 1 }],
  up: [{ type: 'key', code: 'KeyW' }, { type: 'key', code: 'ArrowUp' }, { type: 'gamepad-axis', axis: 1, direction: -1 }],
  down: [{ type: 'key', code: 'KeyS' }, { type: 'key', code: 'ArrowDown' }, { type: 'gamepad-axis', axis: 1, direction: 1 }],
  jump: [{ type: 'key', code: 'Space' }, { type: 'gamepad-button', button: 0 }],
  attack: [{ type: 'key', code: 'KeyJ' }, { type: 'gamepad-button', button: 7 }],
  throw: [{ type: 'key', code: 'KeyX' }, { type: 'gamepad-button', button: 2 }],
  honk: [{ type: 'key', code: 'KeyH' }, { type: 'gamepad-button', button: 1 }],
  dash: [{ type: 'key', code: 'ShiftLeft' }, { type: 'gamepad-button', button: 5 }],
  sense: [{ type: 'key', code: 'KeyQ' }, { type: 'gamepad-button', button: 6 }],
  interact: [{ type: 'key', code: 'KeyE' }, { type: 'gamepad-button', button: 3 }],
  pause: [{ type: 'key', code: 'Escape' }, { type: 'gamepad-button', button: 9 }],
  debug: [{ type: 'key', code: 'F3' }],
});

export function cloneDefaultInputBindings() {
  return Object.fromEntries(Object.entries(DEFAULT_INPUT_BINDINGS).map(([action, list]) => [action, list.map((binding) => ({ ...binding }))]));
}
