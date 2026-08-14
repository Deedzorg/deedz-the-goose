export const MENU_GAMEPAD = Object.freeze({
  select: 0,
  back: 1,
  alternateSelect: 3,
  tabPrevious: 4,
  tabNext: 5,
  menu: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
});

function gamepadPressed(input, button) {
  return Boolean(input?.gamepad?.wasPressed?.(button));
}

function gamepadDown(input, button) {
  return Boolean(input?.gamepad?.isDown?.(button));
}

export function menuDirection(input) {
  if (input?.wasPressed?.('up') || gamepadPressed(input, MENU_GAMEPAD.up)) return 'up';
  if (input?.wasPressed?.('down') || gamepadPressed(input, MENU_GAMEPAD.down)) return 'down';
  if (input?.wasPressed?.('left') || gamepadPressed(input, MENU_GAMEPAD.left)) return 'left';
  if (input?.wasPressed?.('right') || gamepadPressed(input, MENU_GAMEPAD.right)) return 'right';
  return null;
}

export function menuHeldDirection(input) {
  const held = (action, button) => Math.abs(Number(input?.value?.(action)) || 0) > 0.55 || gamepadDown(input, button);
  if (held('up', MENU_GAMEPAD.up)) return 'up';
  if (held('down', MENU_GAMEPAD.down)) return 'down';
  if (held('left', MENU_GAMEPAD.left)) return 'left';
  if (held('right', MENU_GAMEPAD.right)) return 'right';
  return null;
}

export function createMenuRepeatState() {
  return { direction: null, nextAt: 0 };
}

export function menuRepeatDirection(input, state, now = globalThis.performance?.now?.() ?? Date.now(), { initialDelay = 280, repeatEvery = 105 } = {}) {
  const pressed = menuDirection(input);
  if (pressed) {
    state.direction = pressed;
    state.nextAt = now + initialDelay;
    return pressed;
  }

  const held = menuHeldDirection(input);
  if (!held) {
    state.direction = null;
    state.nextAt = 0;
    return null;
  }
  if (held !== state.direction) {
    state.direction = held;
    state.nextAt = now + initialDelay;
    return held;
  }
  if (now >= state.nextAt) {
    state.nextAt = now + repeatEvery;
    return held;
  }
  return null;
}

export function menuTabDirection(input) {
  if (gamepadPressed(input, MENU_GAMEPAD.tabPrevious)) return -1;
  if (gamepadPressed(input, MENU_GAMEPAD.tabNext)) return 1;
  return 0;
}

export function menuSelectPressed(input) {
  return Boolean(
    input?.wasPressed?.('jump')
    || input?.wasPressed?.('interact')
    || gamepadPressed(input, MENU_GAMEPAD.select)
    || gamepadPressed(input, MENU_GAMEPAD.alternateSelect)
  );
}

export function menuBackPressed(input) {
  return Boolean(input?.wasPressed?.('honk') || gamepadPressed(input, MENU_GAMEPAD.back));
}

export function menuStartPressed(input) {
  return Boolean(input?.wasPressed?.('pause') || gamepadPressed(input, MENU_GAMEPAD.menu));
}
