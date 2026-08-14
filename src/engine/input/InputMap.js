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
  attack: [{ type: 'key', code: 'KeyJ' }, { type: 'gamepad-button', button: 3 }],
  peck: [{ type: 'key', code: 'KeyE' }, { type: 'gamepad-button', button: 5 }],
  throw: [{ type: 'key', code: 'KeyX' }, { type: 'gamepad-button', button: 2 }],
  honk: [{ type: 'key', code: 'KeyR' }, { type: 'gamepad-button', button: 1 }],
  dash: [{ type: 'key', code: 'ShiftLeft' }, { type: 'gamepad-button', button: 7 }],
  sense: [{ type: 'key', code: 'KeyQ' }, { type: 'gamepad-button', button: 6 }],
  interact: [{ type: 'key', code: 'KeyF' }, { type: 'gamepad-button', button: 4 }],
  pause: [{ type: 'key', code: 'Escape' }, { type: 'gamepad-button', button: 9 }],
  debug: [{ type: 'key', code: 'F3' }],
});

export function cloneDefaultInputBindings() {
  return Object.fromEntries(Object.entries(DEFAULT_INPUT_BINDINGS).map(([action, list]) => [action, list.map((binding) => ({ ...binding }))]));
}

const LEGACY_GAMEPAD_DEFAULTS = Object.freeze({
  jump: [5],
  attack: [0, 7],
  peck: [3],
  dash: [5],
  interact: [3],
});

export function migrateDefaultControllerLayout(bindings = {}) {
  const migrated = Object.fromEntries(Object.entries(bindings ?? {}).map(([action, list]) => [
    action,
    Array.isArray(list) ? list.map((binding) => ({ ...binding })) : [],
  ]));
  for (const [action, oldButtons] of Object.entries(LEGACY_GAMEPAD_DEFAULTS)) {
    const replacement = DEFAULT_INPUT_BINDINGS[action].find((binding) => binding.type === 'gamepad-button');
    migrated[action] = (migrated[action] ?? []).map((binding) => (
      binding.type === 'gamepad-button' && oldButtons.includes(binding.button) ? { ...replacement } : binding
    ));
  }
  const legacyKeyboardDefaults = { honk: 'KeyH', peck: 'KeyK', interact: 'KeyE' };
  for (const [action, legacyCode] of Object.entries(legacyKeyboardDefaults)) {
    const stillUsesLegacyKey = migrated[action]?.some((binding) => binding.type === 'key' && binding.code === legacyCode);
    if (stillUsesLegacyKey) {
      const replacement = DEFAULT_INPUT_BINDINGS[action].find((binding) => binding.type === 'key');
      migrated[action] = (migrated[action] ?? []).map((binding) => binding.type === 'key' ? { ...replacement } : binding);
    }
  }
  // The Goose Lab is intentionally fixed and omitted from the public controls
  // screen so an old or partial save cannot strand the testing shortcut.
  for (const [action, list] of Object.entries(migrated)) {
    if (action !== 'debug') migrated[action] = list.filter((binding) => !(binding.type === 'key' && binding.code === 'F3'));
  }
  migrated.debug = DEFAULT_INPUT_BINDINGS.debug.map((binding) => ({ ...binding }));
  if (!migrated.peck?.length) migrated.peck = DEFAULT_INPUT_BINDINGS.peck.map((binding) => ({ ...binding }));
  return { ...cloneDefaultInputBindings(), ...migrated };
}
