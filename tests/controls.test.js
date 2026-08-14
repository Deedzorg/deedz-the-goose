import test from 'node:test';
import assert from 'node:assert/strict';
import { InputMap, cloneDefaultInputBindings, migrateDefaultControllerLayout } from '../src/engine/input/InputMap.js';
import { InputManager } from '../src/engine/input/InputManager.js';
import { CONTROL_ACTIONS, bindingLabel } from '../src/games/deedz-the-goose/data/controls.js';

test('default controls use A jump, RB peck, Y whap, RT dash, X crumb, B honk, and LB interact', () => {
  const defaults = cloneDefaultInputBindings();
  assert.deepEqual(defaults.throw, [
    { type: 'key', code: 'KeyX' },
    { type: 'gamepad-button', button: 2 },
  ]);
  assert.ok(defaults.jump.some((binding) => binding.type === 'gamepad-button' && binding.button === 0));
  assert.ok(defaults.dash.some((binding) => binding.type === 'gamepad-button' && binding.button === 7));
  assert.ok(defaults.attack.some((binding) => binding.type === 'gamepad-button' && binding.button === 3));
  assert.ok(defaults.peck.some((binding) => binding.type === 'gamepad-button' && binding.button === 5));
  assert.ok(defaults.interact.some((binding) => binding.type === 'gamepad-button' && binding.button === 4));
  assert.ok(CONTROL_ACTIONS.some((action) => action.id === 'throw'));
  assert.equal(bindingLabel(defaults.throw, 'key'), 'X');
  assert.equal(bindingLabel(defaults.throw, 'gamepad-button'), 'X');
  assert.equal(bindingLabel(defaults.peck, 'key'), 'E');
  assert.equal(bindingLabel(defaults.jump, 'gamepad-button'), 'A');
  assert.equal(bindingLabel(defaults.attack, 'gamepad-button'), 'Y');
  assert.equal(bindingLabel(defaults.peck, 'gamepad-button'), 'RB');
  assert.equal(bindingLabel(defaults.honk, 'key'), 'R');
  assert.equal(bindingLabel(defaults.interact, 'key'), 'F');
  assert.equal(bindingLabel(defaults.debug, 'key'), 'F3');
  assert.ok(!CONTROL_ACTIONS.some((action) => action.id === 'debug'), 'Goose Lab shortcut should stay out of the public controls screen');

  const map = new InputMap(defaults);
  map.set('honk', [{ type: 'key', code: 'KeyQ' }]);
  assert.equal(map.toJSON().honk[0].code, 'KeyQ');
  assert.equal(cloneDefaultInputBindings().honk[0].code, 'KeyR');
});

test('legacy controller and keyboard defaults migrate while custom choices survive', () => {
  const legacy = cloneDefaultInputBindings();
  legacy.jump = [{ type: 'key', code: 'KeyW' }, { type: 'gamepad-button', button: 5 }];
  legacy.attack = [{ type: 'key', code: 'KeyF' }, { type: 'gamepad-button', button: 7 }];
  legacy.dash = [{ type: 'key', code: 'ControlLeft' }, { type: 'gamepad-button', button: 5 }];
  legacy.honk = [{ type: 'key', code: 'KeyH' }, { type: 'gamepad-button', button: 1 }];
  legacy.peck = [{ type: 'key', code: 'KeyK' }, { type: 'gamepad-button', button: 3 }];
  legacy.interact = [{ type: 'key', code: 'KeyE' }, { type: 'gamepad-button', button: 3 }];
  const migrated = migrateDefaultControllerLayout(legacy);
  assert.equal(migrated.jump.find((binding) => binding.type === 'key').code, 'KeyW');
  assert.equal(migrated.attack.find((binding) => binding.type === 'key').code, 'KeyF');
  assert.equal(migrated.dash.find((binding) => binding.type === 'key').code, 'ControlLeft');
  assert.equal(migrated.jump.find((binding) => binding.type === 'gamepad-button').button, 0);
  assert.equal(migrated.attack.find((binding) => binding.type === 'gamepad-button').button, 3);
  assert.equal(migrated.dash.find((binding) => binding.type === 'gamepad-button').button, 7);
  assert.equal(migrated.peck.find((binding) => binding.type === 'gamepad-button').button, 5);
  assert.equal(migrated.interact.find((binding) => binding.type === 'gamepad-button').button, 4);
  assert.equal(migrated.honk.find((binding) => binding.type === 'key').code, 'KeyR');
  assert.equal(migrated.peck.find((binding) => binding.type === 'key').code, 'KeyE');
  assert.equal(migrated.interact.find((binding) => binding.type === 'key').code, 'KeyF');

  const custom = cloneDefaultInputBindings();
  custom.honk = [{ type: 'key', code: 'KeyZ' }, { type: 'gamepad-button', button: 1 }];
  custom.peck = [{ type: 'key', code: 'KeyE' }, { type: 'gamepad-button', button: 10 }];
  assert.equal(migrateDefaultControllerLayout(custom).honk[0].code, 'KeyZ');
  assert.equal(migrateDefaultControllerLayout(custom).peck.find((binding) => binding.type === 'gamepad-button').button, 10);

  const partiallyMigrated = cloneDefaultInputBindings();
  partiallyMigrated.honk = [{ type: 'key', code: 'KeyR' }, { type: 'gamepad-button', button: 1 }];
  partiallyMigrated.peck = [{ type: 'key', code: 'KeyK' }, { type: 'gamepad-button', button: 5 }];
  partiallyMigrated.interact = [{ type: 'key', code: 'KeyF' }, { type: 'gamepad-button', button: 4 }];
  partiallyMigrated.attack = [{ type: 'key', code: 'F3' }, { type: 'gamepad-button', button: 3 }];
  const repaired = migrateDefaultControllerLayout(partiallyMigrated);
  assert.equal(repaired.peck.find((binding) => binding.type === 'key').code, 'KeyE');
  assert.equal(repaired.debug.find((binding) => binding.type === 'key').code, 'F3');
  assert.ok(!repaired.attack.some((binding) => binding.type === 'key' && binding.code === 'F3'));
});


test('custom bindings persist as unique actions without double-trigger conflicts', () => {
  const events = { emit() {} };
  const input = new InputManager({ gamepadDeadZone: 0.18, pressBufferMs: 110, preventDefault: [] }, events);
  const bindings = input.rebind('honk', { type: 'key', code: 'KeyX' });
  assert.equal(bindings.honk.find((binding) => binding.type === 'key').code, 'KeyX');
  assert.ok(!bindings.throw.some((binding) => binding.type === 'key' && binding.code === 'KeyX'));
  assert.ok(bindings.throw.some((binding) => binding.type === 'gamepad-button' && binding.button === 2));
});
