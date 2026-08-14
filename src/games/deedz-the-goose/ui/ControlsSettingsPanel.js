import { DEFAULT_INPUT_BINDINGS } from '../../../engine/input/InputMap.js';
import { CONTROL_ACTIONS, bindingLabel } from '../data/controls.js';

function cloneBindings(bindings) {
  return Object.fromEntries(Object.entries(bindings).map(([action, list]) => [action, list.map((binding) => ({ ...binding }))]));
}

export class ControlsSettingsPanel {
  constructor(engine) {
    this.engine = engine;
    this.rows = new Map();
    this.capture = null;
    this.gamepadArmed = false;
    this._onCaptureKey = (event) => this.#captureKey(event);
    this.controlsElement = document.createElement('section');
    this.settingsElement = document.createElement('section');
    this.controlsElement.className = 'deedz-control-settings';
    this.settingsElement.className = 'deedz-control-settings';
    this.element = document.createElement('div');
    this.element.append(this.controlsElement, this.settingsElement);
    this.#buildControls();
    this.#buildSettings();
  }

  #buildControls() {
    this.controlsElement.innerHTML = `
      <div class="deedz-section-title">Remappable Controls</div>
      <p class="deedz-help deedz-help--compact">Select a binding, then press the key or controller button you want. Movement keeps left-stick support.</p>
      <div class="deedz-control-grid" data-control-grid></div>
      <div class="deedz-control-actions">
        <button type="button" class="deedz-button" data-reset-controls>Reset Default Controls</button>
      </div>
      <p class="deedz-capture-status" data-capture-status aria-live="polite"></p>`;

    const grid = this.controlsElement.querySelector('[data-control-grid]');
    for (const action of CONTROL_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'deedz-control-row';
      row.innerHTML = `
        <div class="deedz-control-row__copy"><strong>${action.label}</strong><small>${action.description}</small></div>
        <button type="button" class="deedz-binding" data-keyboard ${action.keyboard ? '' : 'disabled'}></button>
        <button type="button" class="deedz-binding" data-gamepad ${action.gamepad ? '' : 'disabled'}></button>`;
      row.querySelector('[data-keyboard]').addEventListener('click', () => this.#startCapture(action.id, 'key'));
      row.querySelector('[data-gamepad]').addEventListener('click', () => this.#startCapture(action.id, 'gamepad-button'));
      grid.appendChild(row);
      this.rows.set(action.id, row);
    }

    this.controlsElement.querySelector('[data-reset-controls]').addEventListener('click', () => {
      this.#cancelCapture();
      const defaults = cloneBindings(DEFAULT_INPUT_BINDINGS);
      this.engine.input.setBindings(defaults);
      this.engine.save.set('settings.controls', defaults, { immediate: true });
      this.refresh();
      this.engine.ui.toast('Controls restored to Deedz defaults.', { type: 'success' });
    });
    this.status = this.controlsElement.querySelector('[data-capture-status]');
    this.refresh();
  }

  #buildSettings() {
    this.settingsElement.innerHTML = `
      <div class="deedz-section-title">Game & Audio Settings</div>
      <p class="deedz-help deedz-help--compact">Tune the flock without leaving the adventure. Adaptive music changes harmony and tempo with every Echo Layer.</p>
      <div class="deedz-settings deedz-settings--stacked" data-game-settings></div>`;
    const settings = this.settingsElement.querySelector('[data-game-settings]');
    settings.append(
      this.#toggle('Music', 'settings.music', true, (enabled) => {
        this.engine.audio.setVolumes({ music: enabled ? this.engine.save.get('settings.musicVolume', 0.55) : 0 });
        this.engine.events.emit('settings:music-changed', { enabled });
      }),
      this.#toggle('Adaptive layer music', 'settings.adaptiveMusic', true, (enabled) => this.engine.events.emit('settings:adaptive-music-changed', { enabled })),
      this.#toggle('Sound effects', 'settings.sfx', true, (enabled) => this.engine.audio.setVolumes({ sfx: enabled ? this.engine.save.get('settings.sfxVolume', 0.8) : 0 })),
      this.#toggle('Screen shake', 'settings.screenShake', true),
      this.#select('On-screen controls', 'settings.touchControls', 'auto', [
        ['auto', 'Auto (touch without controller)'],
        ['on', 'Always on'],
        ['off', 'Off'],
      ], (value) => this.engine.events.emit('settings:touch-controls-changed', { mode: value })),
      this.#slider('Master volume', 'settings.master', 0.75, (value) => this.engine.audio.setVolumes({ master: value })),
      this.#slider('Music volume', 'settings.musicVolume', 0.55, (value) => {
        if (this.engine.save.get('settings.music', true)) this.engine.audio.setVolumes({ music: value });
      }),
      this.#slider('Effects volume', 'settings.sfxVolume', 0.8, (value) => {
        if (this.engine.save.get('settings.sfx', true)) this.engine.audio.setVolumes({ sfx: value });
      }),
    );
  }


  #select(label, path, fallback, options, onChange = null) {
    const wrapper = document.createElement('label');
    wrapper.className = 'deedz-select-setting';
    const title = document.createElement('span');
    title.textContent = label;
    const select = document.createElement('select');
    for (const [value, text] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    }
    select.value = this.engine.save.get(path, fallback);
    select.addEventListener('change', () => {
      this.engine.save.set(path, select.value);
      onChange?.(select.value);
    });
    wrapper.append(title, select);
    return wrapper;
  }

  #toggle(label, path, fallback, onChange = null) {
    const wrapper = document.createElement('label');
    wrapper.className = 'deedz-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.engine.save.get(path, fallback);
    const text = document.createElement('span');
    text.textContent = label;
    input.addEventListener('change', () => {
      this.engine.save.set(path, input.checked);
      onChange?.(input.checked);
    });
    wrapper.append(input, text);
    return wrapper;
  }

  #slider(label, path, fallback, onChange) {
    const wrapper = document.createElement('label');
    wrapper.className = 'deedz-slider';
    const title = document.createElement('span');
    const value = document.createElement('strong');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(this.engine.save.get(path, fallback));
    const sync = () => {
      const next = Math.max(0, Math.min(1, Number(input.value) || 0));
      value.textContent = `${Math.round(next * 100)}%`;
      this.engine.save.set(path, next);
      onChange?.(next);
    };
    title.textContent = label;
    value.textContent = `${Math.round(Number(input.value) * 100)}%`;
    input.addEventListener('input', sync);
    wrapper.append(title, input, value);
    return wrapper;
  }

  #startCapture(action, type) {
    this.#cancelCapture();
    const row = this.rows.get(action);
    const button = row?.querySelector(type === 'key' ? '[data-keyboard]' : '[data-gamepad]');
    if (!button || button.disabled) return;
    this.capture = { action, type, button };
    button.classList.add('is-listening');
    button.textContent = type === 'key' ? 'Press a key…' : 'Press a button…';
    this.status.textContent = `Remapping ${CONTROL_ACTIONS.find((item) => item.id === action)?.label ?? action}. Press Escape to cancel.`;
    this.engine.input.setEnabled(false);
    window.addEventListener('keydown', this._onCaptureKey, { capture: true });
    if (type === 'gamepad-button') this.gamepadArmed = false;
  }

  #captureKey(event) {
    if (!this.capture) return;
    if (this.capture.type !== 'key' && event.code !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.code === 'Escape') {
      this.#cancelCapture();
      return;
    }
    if (event.code === 'F3') {
      this.status.textContent = 'That key is reserved. Press another key or Escape to cancel.';
      return;
    }
    this.#commitBinding({ type: 'key', code: event.code });
  }

  #commitBinding(binding) {
    if (!this.capture) return;
    const { action } = this.capture;
    const bindings = this.engine.input.rebind(action, binding, { unique: true });
    this.engine.save.set('settings.controls', bindings, { immediate: true });
    this.status.textContent = `${CONTROL_ACTIONS.find((item) => item.id === action)?.label ?? action} remapped.`;
    this.#finishCapture(false);
    this.refresh();
  }

  #finishCapture(clearStatus = true) {
    window.removeEventListener('keydown', this._onCaptureKey, { capture: true });
    this.capture?.button?.classList.remove('is-listening');
    this.capture = null;
    this.gamepadArmed = false;
    this.engine.input.setEnabled(true);
    if (clearStatus) this.status.textContent = '';
  }

  #cancelCapture() {
    if (!this.capture) return;
    this.#finishCapture();
    this.refresh();
  }

  refresh() {
    const bindings = this.engine.input.exportBindings();
    for (const action of CONTROL_ACTIONS) {
      const row = this.rows.get(action.id);
      if (!row) continue;
      const list = bindings[action.id] ?? [];
      const keyboard = row.querySelector('[data-keyboard]');
      const gamepad = row.querySelector('[data-gamepad]');
      keyboard.textContent = action.keyboard ? `Keyboard: ${bindingLabel(list, 'key')}` : 'Keyboard: Fixed';
      const gamepadButton = bindingLabel(list, 'gamepad-button');
      const gamepadAxis = bindingLabel(list, 'gamepad-axis');
      gamepad.textContent = action.gamepad
        ? `Controller: ${gamepadButton}`
        : `Controller: ${gamepadAxis !== 'Unbound' ? gamepadAxis : 'Fixed'}`;
    }
  }

  update() {
    if (!this.capture || this.capture.type !== 'gamepad-button') return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find(Boolean);
    if (!pad) {
      this.status.textContent = 'Connect a controller, then press a button. Escape cancels.';
      return;
    }
    const pressedIndex = pad.buttons.findIndex((button) => button.value > 0.72);
    if (!this.gamepadArmed) {
      if (pressedIndex === -1) this.gamepadArmed = true;
      return;
    }
    if (pressedIndex >= 0) this.#commitBinding({ type: 'gamepad-button', button: pressedIndex });
  }

  destroy() {
    this.#cancelCapture();
    this.element.remove();
    this.controlsElement.remove();
    this.settingsElement.remove();
  }
}
