import test from 'node:test';
import assert from 'node:assert/strict';
import { InputMap, cloneDefaultInputBindings } from '../src/engine/input/InputMap.js';
import { InputManager } from '../src/engine/input/InputManager.js';
import { CONTROL_ACTIONS, bindingLabel } from '../src/games/deedz-the-goose/data/controls.js';

test('default controls include a distinct X crumb throw and complete pause explainer data', () => {
  const defaults = cloneDefaultInputBindings();
  assert.deepEqual(defaults.throw, [
    { type: 'key', code: 'KeyX' },
    { type: 'gamepad-button', button: 2 },
  ]);
  assert.ok(defaults.attack.some((binding) => binding.type === 'gamepad-button' && binding.button === 7));
  assert.ok(CONTROL_ACTIONS.some((action) => action.id === 'throw'));
  assert.equal(bindingLabel(defaults.throw, 'key'), 'X');
  assert.equal(bindingLabel(defaults.throw, 'gamepad-button'), 'X');

  const map = new InputMap(defaults);
  map.set('honk', [{ type: 'key', code: 'KeyQ' }]);
  assert.equal(map.toJSON().honk[0].code, 'KeyQ');
  assert.equal(cloneDefaultInputBindings().honk[0].code, 'KeyH');
});


test('custom bindings persist as unique actions without double-trigger conflicts', () => {
  const events = { emit() {} };
  const input = new InputManager({ gamepadDeadZone: 0.18, pressBufferMs: 110, preventDefault: [] }, events);
  const bindings = input.rebind('honk', { type: 'key', code: 'KeyX' });
  assert.equal(bindings.honk.find((binding) => binding.type === 'key').code, 'KeyX');
  assert.ok(!bindings.throw.some((binding) => binding.type === 'key' && binding.code === 'KeyX'));
  assert.ok(bindings.throw.some((binding) => binding.type === 'gamepad-button' && binding.button === 2));
});
