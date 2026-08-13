export const MENU_GAMEPAD = Object.freeze({
  select: 0,
  back: 1,
  alternateSelect: 3,
  menu: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
});

function gamepadPressed(input, button) {
  return Boolean(input?.gamepad?.wasPressed?.(button));
}

export function menuDirection(input) {
  if (input?.wasPressed?.('up') || gamepadPressed(input, MENU_GAMEPAD.up)) return 'up';
  if (input?.wasPressed?.('down') || gamepadPressed(input, MENU_GAMEPAD.down)) return 'down';
  if (input?.wasPressed?.('left') || gamepadPressed(input, MENU_GAMEPAD.left)) return 'left';
  if (input?.wasPressed?.('right') || gamepadPressed(input, MENU_GAMEPAD.right)) return 'right';
  return null;
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
