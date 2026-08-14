import test from 'node:test';
import assert from 'node:assert/strict';
import { InputMap, cloneDefaultInputBindings, migrateDefaultControllerLayout } from '../src/engine/input/InputMap.js';
import { InputManager } from '../src/engine/input/InputManager.js';
import { CONTROL_ACTIONS, bindingLabel } from '../src/games/deedz-the-goose/data/controls.js';

test('default controls use RB flap, RT dash, A whap, Y peck, and X crumb throw', () => {
  const defaults = cloneDefaultInputBindings();
  assert.deepEqual(defaults.throw, [
    { type: 'key', code: 'KeyX' },
    { type: 'gamepad-button', button: 2 },
  ]);
  assert.ok(defaults.jump.some((binding) => binding.type === 'gamepad-button' && binding.button === 5));
  assert.ok(defaults.dash.some((binding) => binding.type === 'gamepad-button' && binding.button === 7));
  assert.ok(defaults.attack.some((binding) => binding.type === 'gamepad-button' && binding.button === 0));
  assert.ok(defaults.peck.some((binding) => binding.type === 'gamepad-button' && binding.button === 3));
  assert.ok(defaults.interact.some((binding) => binding.type === 'gamepad-button' && binding.button === 4));
  assert.ok(CONTROL_ACTIONS.some((action) => action.id === 'throw'));
  assert.equal(bindingLabel(defaults.throw, 'key'), 'X');
  assert.equal(bindingLabel(defaults.throw, 'gamepad-button'), 'X');
  assert.equal(bindingLabel(defaults.peck, 'key'), 'K');
  assert.equal(bindingLabel(defaults.peck, 'gamepad-button'), 'Y');

  const map = new InputMap(defaults);
  map.set('honk', [{ type: 'key', code: 'KeyQ' }]);
  assert.equal(map.toJSON().honk[0].code, 'KeyQ');
  assert.equal(cloneDefaultInputBindings().honk[0].code, 'KeyH');
});

test('legacy controller defaults migrate while custom keyboard choices survive', () => {
  const legacy = cloneDefaultInputBindings();
  legacy.jump = [{ type: 'key', code: 'KeyW' }, { type: 'gamepad-button', button: 0 }];
  legacy.attack = [{ type: 'key', code: 'KeyF' }, { type: 'gamepad-button', button: 7 }];
  legacy.dash = [{ type: 'key', code: 'ControlLeft' }, { type: 'gamepad-button', button: 5 }];
  delete legacy.peck;
  const migrated = migrateDefaultControllerLayout(legacy);
  assert.equal(migrated.jump.find((binding) => binding.type === 'key').code, 'KeyW');
  assert.equal(migrated.attack.find((binding) => binding.type === 'key').code, 'KeyF');
  assert.equal(migrated.dash.find((binding) => binding.type === 'key').code, 'ControlLeft');
  assert.equal(migrated.jump.find((binding) => binding.type === 'gamepad-button').button, 5);
  assert.equal(migrated.attack.find((binding) => binding.type === 'gamepad-button').button, 0);
  assert.equal(migrated.dash.find((binding) => binding.type === 'gamepad-button').button, 7);
  assert.equal(migrated.peck.find((binding) => binding.type === 'gamepad-button').button, 3);
});


test('custom bindings persist as unique actions without double-trigger conflicts', () => {
  const events = { emit() {} };
  const input = new InputManager({ gamepadDeadZone: 0.18, pressBufferMs: 110, preventDefault: [] }, events);
  const bindings = input.rebind('honk', { type: 'key', code: 'KeyX' });
  assert.equal(bindings.honk.find((binding) => binding.type === 'key').code, 'KeyX');
  assert.ok(!bindings.throw.some((binding) => binding.type === 'key' && binding.code === 'KeyX'));
  assert.ok(bindings.throw.some((binding) => binding.type === 'gamepad-button' && binding.button === 2));
});
