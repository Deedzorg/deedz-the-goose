const keyboard = new Set();
const touch = new Set();
const pressed = new Set();
const gamepadHeld = new Map();

const keyActions = new Map([
  ['Space', 'jump'], ['KeyW', 'jump'], ['ArrowUp', 'jump'],
  ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
  ['KeyH', 'honk'], ['KeyJ', 'stick'], ['KeyK', 'crumb'],
  ['Escape', 'pause'], ['Enter', 'confirm']
]);

addEventListener('keydown', (event) => {
  if (!keyboard.has(event.code)) {
    const action = keyActions.get(event.code);
    if (action) pressed.add(action);
  }
  keyboard.add(event.code);
});

addEventListener('keyup', (event) => keyboard.delete(event.code));
addEventListener('blur', () => {
  keyboard.clear();
  touch.clear();
});

export const controls = {
  controllerName: null,

  update() {
    const pads = navigator.getGamepads?.() || [];
    const pad = Array.from(pads).find(Boolean);
    this.controllerName = pad?.id || null;
    if (!pad) {
      gamepadHeld.clear();
      return;
    }

    const mapping = [
      [0, 'jump'],       // A
      [1, 'dash'],       // B
      [2, 'crumb'],      // X
      [3, 'stick'],      // Y
      [4, 'honk'],       // LB
      [5, 'honk'],       // RB
      [7, 'crumb'],      // RT
      [9, 'pause']       // Menu / Start
    ];

    for (const [index, action] of mapping) {
      const active = Boolean(pad.buttons[index]?.pressed || pad.buttons[index]?.value > 0.55);
      const key = `${index}:${action}`;
      if (active && !gamepadHeld.get(key)) pressed.add(action);
      gamepadHeld.set(key, active);
    }
  },

  axisX() {
    let value = 0;
    if (keyboard.has('KeyA') || keyboard.has('ArrowLeft') || touch.has('left')) value -= 1;
    if (keyboard.has('KeyD') || keyboard.has('ArrowRight') || touch.has('right')) value += 1;

    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (pad) {
      const stick = Math.abs(pad.axes[0] || 0) > 0.2 ? pad.axes[0] : 0;
      const dpad = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      if (Math.abs(stick) > Math.abs(value)) value = stick;
      if (dpad) value = dpad;
    }
    return Math.max(-1, Math.min(1, value));
  },

  down(action) {
    if (touch.has(action)) return true;
    if (action === 'stick' && keyboard.has('KeyJ')) return true;
    if (action === 'left') return this.axisX() < -0.1;
    if (action === 'right') return this.axisX() > 0.1;

    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (!pad) return false;
    if (action === 'stick') return Boolean(pad.buttons[3]?.pressed);
    return false;
  },

  consume(action) {
    if (!pressed.has(action)) return false;
    pressed.delete(action);
    return true;
  },

  trigger(action) {
    pressed.add(action);
  },

  setTouch(action, active) {
    if (active) {
      if (!touch.has(action) && !['left', 'right'].includes(action)) pressed.add(action);
      touch.add(action);
    } else {
      touch.delete(action);
    }
  }
};

export function bindTouchControls(root = document) {
  for (const button of root.querySelectorAll('[data-control]')) {
    const action = button.dataset.control;
    const down = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      controls.setTouch(action, true);
    };
    const up = (event) => {
      event.preventDefault();
      controls.setTouch(action, false);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  }
}
