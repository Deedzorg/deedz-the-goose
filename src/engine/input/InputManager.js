import { KeyboardInput } from './KeyboardInput.js';
import { GamepadInput } from './GamepadInput.js';
import { InputMap, DEFAULT_INPUT_BINDINGS, cloneDefaultInputBindings } from './InputMap.js';

export class InputManager {
  constructor(config, events) {
    this.config = config;
    this.events = events;
    this.keyboard = new KeyboardInput(config, events);
    this.gamepad = new GamepadInput({ deadZone: config.gamepadDeadZone }, events);
    this.map = new InputMap(DEFAULT_INPUT_BINDINGS);
    this.actionState = new Map();
    this.consumedPressed = new Set();
    this.consumedReleased = new Set();
    this.virtualValues = new Map();
    this.virtualPressed = new Set();
    this.virtualReleased = new Set();
    this.enabled = true;
  }

  initialize() { this.keyboard.initialize(); this.gamepad.initialize(); }

  beginFrame() {
    this.consumedPressed.clear();
    this.consumedReleased.clear();
    this.gamepad.poll();
    const now = performance.now();
    for (const action of this.map.actions()) {
      const value = this.enabled ? this.#valueFor(action) : 0;
      const previous = this.actionState.get(action) ?? { value: 0, down: false, pressedUntil: 0, releasedUntil: 0 };
      const down = Math.abs(value) > 0.01;
      // Hardware events are included directly so a very fast tap between rendered
      // frames still reaches the action buffer. This is especially important for
      // quick crumb throws and touch buttons.
      const pressed = this.enabled && (this.#sourcePressed(action) || (down && !previous.down));
      const released = this.enabled && (this.#sourceReleased(action) || (!down && previous.down));
      const next = {
        value,
        down,
        pressedUntil: pressed ? now + this.config.pressBufferMs : previous.pressedUntil,
        releasedUntil: released ? now + this.config.pressBufferMs : previous.releasedUntil,
      };
      this.actionState.set(action, next);
      if (pressed) this.events.emit('input:pressed', { action, value });
      if (released) this.events.emit('input:released', { action, value });
    }
  }

  endFrame() {
    this.keyboard.endFrame();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
  }

  value(action) { return this.actionState.get(action)?.value ?? 0; }
  isDown(action) { return this.actionState.get(action)?.down ?? false; }

  wasPressed(action, { consume = true } = {}) {
    if (consume && this.consumedPressed.has(action)) return false;
    const pressed = (this.actionState.get(action)?.pressedUntil ?? 0) >= performance.now();
    if (pressed && consume) {
      this.consumedPressed.add(action);
      const state = this.actionState.get(action);
      if (state) state.pressedUntil = 0;
    }
    return pressed;
  }

  wasReleased(action, { consume = true } = {}) {
    if (consume && this.consumedReleased.has(action)) return false;
    const released = (this.actionState.get(action)?.releasedUntil ?? 0) >= performance.now();
    if (released && consume) {
      this.consumedReleased.add(action);
      const state = this.actionState.get(action);
      if (state) state.releasedUntil = 0;
    }
    return released;
  }

  axis(negativeAction, positiveAction) {
    return Math.max(-1, Math.min(1, this.value(positiveAction) - this.value(negativeAction)));
  }

  setVirtualAction(action, value = 0) {
    if (!action) return 0;
    const next = Math.max(0, Math.min(1, Number(value) || 0));
    const previous = this.virtualValues.get(action) ?? 0;
    if (next > 0.01 && previous <= 0.01) this.virtualPressed.add(action);
    if (next <= 0.01 && previous > 0.01) this.virtualReleased.add(action);
    if (next <= 0.01) this.virtualValues.delete(action);
    else this.virtualValues.set(action, next);
    return next;
  }

  releaseVirtualAction(action) { return this.setVirtualAction(action, 0); }
  clearVirtualActions() {
    for (const [action, value] of this.virtualValues) {
      if (value > 0.01) this.virtualReleased.add(action);
    }
    this.virtualValues.clear();
  }

  setBindings(bindings = {}) {
    const merged = cloneDefaultInputBindings();
    for (const [action, list] of Object.entries(bindings ?? {})) {
      if (Array.isArray(list)) merged[action] = list.map((binding) => ({ ...binding }));
    }
    this.map = new InputMap(merged);
    this.actionState.clear();
    this.consumedPressed.clear();
    this.consumedReleased.clear();
  }

  rebind(action, binding, { unique = true } = {}) {
    if (!action || !binding?.type) throw new Error('InputManager.rebind requires an action and binding');
    const bindings = this.exportBindings();
    const sameBinding = (candidate) => {
      if (candidate.type !== binding.type) return false;
      if (binding.type === 'key') return candidate.code === binding.code;
      if (binding.type === 'gamepad-button') return candidate.button === binding.button;
      if (binding.type === 'gamepad-axis') return candidate.axis === binding.axis && candidate.direction === binding.direction;
      return false;
    };
    if (unique) {
      for (const [otherAction, list] of Object.entries(bindings)) {
        if (otherAction !== action) bindings[otherAction] = list.filter((candidate) => !sameBinding(candidate));
      }
    }
    const current = bindings[action] ?? [];
    bindings[action] = [...current.filter((candidate) => candidate.type !== binding.type), { ...binding }];
    this.setBindings(bindings);
    return this.exportBindings();
  }

  resetBindings() { this.setBindings(DEFAULT_INPUT_BINDINGS); return this.exportBindings(); }
  exportBindings() { return this.map.toJSON(); }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.keyboard.enabled = this.enabled;
    this.actionState.clear();
    this.consumedPressed.clear();
    this.consumedReleased.clear();
    if (!this.enabled) this.clearVirtualActions();
  }

  #valueFor(action) {
    let value = this.virtualValues.get(action) ?? 0;
    for (const binding of this.map.get(action)) {
      if (binding.type === 'key' && this.keyboard.down.has(binding.code)) value = Math.max(value, 1);
      if (binding.type === 'gamepad-button') value = Math.max(value, this.gamepad.currentButtons[binding.button] ?? 0);
      if (binding.type === 'gamepad-axis') {
        const axis = this.gamepad.axis(binding.axis);
        const directed = axis * binding.direction;
        if (directed > 0) value = Math.max(value, directed);
      }
    }
    return value;
  }

  #sourcePressed(action) {
    if (this.virtualPressed.has(action)) return true;
    for (const binding of this.map.get(action)) {
      if (binding.type === 'key' && this.keyboard.pressed.has(binding.code)) return true;
      if (binding.type === 'gamepad-button' && this.gamepad.wasPressed(binding.button)) return true;
    }
    return false;
  }

  #sourceReleased(action) {
    if (this.virtualReleased.has(action)) return true;
    for (const binding of this.map.get(action)) {
      if (binding.type === 'key' && this.keyboard.released.has(binding.code)) return true;
      if (binding.type === 'gamepad-button' && this.gamepad.wasReleased(binding.button)) return true;
    }
    return false;
  }

  destroy() {
    this.keyboard.destroy();
    this.gamepad.destroy();
    this.actionState.clear();
    this.virtualValues.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
  }
}
