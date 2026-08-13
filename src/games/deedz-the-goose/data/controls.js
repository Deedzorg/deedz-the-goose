export const CONTROL_ACTIONS = Object.freeze([
  { id: 'left', label: 'Move Left', description: 'Move or steer left.', keyboard: true, gamepad: false },
  { id: 'right', label: 'Move Right', description: 'Move or steer right.', keyboard: true, gamepad: false },
  { id: 'up', label: 'Look / Menu Up', description: 'Navigate upward.', keyboard: true, gamepad: false },
  { id: 'down', label: 'Crouch-Walk / Menu Down', description: 'Hold down to crouch; move left or right to sneak.', keyboard: true, gamepad: false },
  { id: 'jump', label: 'Jump / Triple Flap', description: 'Jump three times; hold the third flap to glide.', keyboard: true, gamepad: true },
  { id: 'attack', label: 'Wing Whap', description: 'Close-range wing attack.', keyboard: true, gamepad: true },
  { id: 'throw', label: 'Charge & Throw Crumb', description: 'Tap for a nearby toss or hold for a powerful long throw.', keyboard: true, gamepad: true },
  { id: 'honk', label: 'Honk', description: 'Knock back enemies, break shields, and activate crystals.', keyboard: true, gamepad: true },
  { id: 'dash', label: 'Dash', description: 'Burst forward through danger. RB remains your fast escape.', keyboard: true, gamepad: true },
  { id: 'sense', label: 'Flock Sense', description: 'Hold to reveal nearby collectibles, crystals, foxes, and geese.', keyboard: true, gamepad: true },
  { id: 'interact', label: 'Interact / Wing-Bump', description: 'Interact or wing-bump a nearby goose.', keyboard: true, gamepad: true },
  { id: 'pause', label: 'Pause', description: 'Open Mission Control.', keyboard: true, gamepad: true },
  { id: 'debug', label: 'Diagnostics', description: 'Toggle engine diagnostics.', keyboard: true, gamepad: false },
]);

const KEY_NAMES = Object.freeze({
  Space: 'Space',
  Escape: 'Esc',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  F3: 'F3',
});

const GAMEPAD_NAMES = Object.freeze({
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'View',
  9: 'Menu',
  10: 'L3',
  11: 'R3',
  12: 'D-pad Up',
  13: 'D-pad Down',
  14: 'D-pad Left',
  15: 'D-pad Right',
});

export function formatKeyCode(code = '') {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Numpad ${code.slice(6)}`;
  return code || 'Unbound';
}

export function formatGamepadButton(button) {
  return GAMEPAD_NAMES[button] ?? `Button ${Number(button) + 1}`;
}

export function bindingLabel(bindings = [], type) {
  const matching = bindings.filter((binding) => binding.type === type);
  if (!matching.length) return 'Unbound';
  if (type === 'key') return matching.map((binding) => formatKeyCode(binding.code)).join(' / ');
  if (type === 'gamepad-button') return matching.map((binding) => formatGamepadButton(binding.button)).join(' / ');
  if (type === 'gamepad-axis') return matching.map((binding) => `Stick ${binding.axis + 1}${binding.direction < 0 ? '−' : '+'}`).join(' / ');
  return 'Unbound';
}
