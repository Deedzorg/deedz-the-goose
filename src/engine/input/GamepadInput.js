export class GamepadInput {
  constructor({ deadZone = 0.18 } = {}, events = null) {
    this.deadZone = deadZone;
    this.events = events;
    this.index = null;
    this.currentButtons = [];
    this.previousButtons = [];
    this.axes = [];
    this.info = null;
    this._connected = (event) => {
      if (this.index === null) this.index = event.gamepad.index;
      this.info = { id: event.gamepad.id, index: event.gamepad.index, mapping: event.gamepad.mapping };
      this.events?.emit('gamepad:connected', this.info);
    };
    this._disconnected = (event) => {
      if (this.index === event.gamepad.index) this.index = null;
      this.events?.emit('gamepad:disconnected', { id: event.gamepad.id, index: event.gamepad.index });
      this.info = null;
    };
  }

  initialize() {
    window.addEventListener('gamepadconnected', this._connected);
    window.addEventListener('gamepaddisconnected', this._disconnected);
  }

  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = this.index !== null ? pads[this.index] : [...pads].find(Boolean);
    if (!pad) {
      const previousInfo = this.info;
      this.index = null;
      this.previousButtons = this.currentButtons;
      this.currentButtons = [];
      this.axes = [];
      this.info = null;
      if (previousInfo) this.events?.emit('gamepad:disconnected', previousInfo);
      return;
    }
    const discovered = !this.info || this.info.index !== pad.index || this.info.id !== pad.id;
    this.index = pad.index;
    this.info = { id: pad.id, index: pad.index, mapping: pad.mapping };
    if (discovered) this.events?.emit('gamepad:connected', this.info);
    this.previousButtons = this.currentButtons;
    this.currentButtons = pad.buttons.map((button) => button.value);
    this.axes = pad.axes.map((value) => Math.abs(value) < this.deadZone ? 0 : value);
  }

  isDown(button) { return (this.currentButtons[button] ?? 0) > 0.5; }
  wasPressed(button) { return this.isDown(button) && (this.previousButtons[button] ?? 0) <= 0.5; }
  wasReleased(button) { return !this.isDown(button) && (this.previousButtons[button] ?? 0) > 0.5; }
  axis(index) { return this.axes[index] ?? 0; }

  destroy() {
    window.removeEventListener('gamepadconnected', this._connected);
    window.removeEventListener('gamepaddisconnected', this._disconnected);
    this.currentButtons = [];
    this.previousButtons = [];
    this.axes = [];
  }
}
