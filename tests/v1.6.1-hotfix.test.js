import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSafeSpawn, supportingPlatformForSpawn } from '../src/games/deedz-the-goose/systems/WorldSafetySystem.js';
import { isFlockSenseTargetAvailable } from '../src/games/deedz-the-goose/systems/FlockSenseSystem.js';

function platform(x, y, width, height, extra = {}) {
  const item = { ...extra };
  item.collider = { enabled: true, left: x, right: x + width, top: y, bottom: y + height, width, height };
  return item;
}

function entity(tags, values = {}) {
  return {
    active: true,
    visible: true,
    destroyed: false,
    display: { visible: true },
    tags: new Set(tags),
    hasTag(tag) { return this.tags.has(tag); },
    ...values,
  };
}

test('restart spawn is seated directly on the final supporting platform', () => {
  const ground = platform(0, 920, 1500, 330, { id: 'ground' });
  const collider = { width: 62, height: 48, offset: { y: -4 } };
  const safe = resolveSafeSpawn({ x: 260, y: 760 }, [ground], { width: 9600, height: 1250 }, collider);
  assert.equal(safe.x, 260);
  assert.equal(safe.y, 899);
  assert.equal(supportingPlatformForSpawn(safe, [ground], collider), ground);
});

test('spawn overlapping evolved geometry is lifted and grounded safely', () => {
  const ground = platform(0, 920, 1500, 330, { id: 'ground' });
  const evolved = platform(160, 700, 260, 50, { id: 'evolved' });
  const collider = { width: 62, height: 48, offset: { y: -4 } };
  const safe = resolveSafeSpawn({ x: 260, y: 720 }, [ground, evolved], { width: 9600, height: 1250 }, collider);
  assert.equal(safe.y, 679);
  assert.equal(supportingPlatformForSpawn(safe, [ground, evolved], collider), evolved);
});

test('Flock Sense hides collected and cooling-down objects', () => {
  assert.equal(isFlockSenseTargetAvailable(entity(['collectible'], { available: true, collider: { enabled: true } })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['collectible'], { available: false, collider: { enabled: false } })), false);
  assert.equal(isFlockSenseTargetAvailable(entity(['crystal'], { activated: false })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['crystal'], { activated: true })), false);
  assert.equal(isFlockSenseTargetAvailable(entity(['honk-reactive', 'echo-resonator'], { activated: false, cooldownRemaining: 0 })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['honk-reactive', 'echo-resonator'], { activated: true, cooldownRemaining: 12 })), false);
  assert.equal(isFlockSenseTargetAvailable(entity(['checkpoint'], { activeCheckpoint: false })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['checkpoint'], { activeCheckpoint: true })), false);
});

test('Flock Sense still detects active threats and connected geese', () => {
  assert.equal(isFlockSenseTargetAvailable(entity(['enemy'], { hp: 2 })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['enemy'], { hp: 0 })), false);
  assert.equal(isFlockSenseTargetAvailable(entity(['boss'], { hp: 20, activeFight: true })), true);
  assert.equal(isFlockSenseTargetAvailable(entity(['boss'], { hp: 0, activeFight: false })), false);
  assert.equal(isFlockSenseTargetAvailable(entity(['remote-player'])), true);
});

test('scene simulation is frozen while a destination transition is rebuilding', async () => {
  const { SceneManager } = await import('../src/engine/scenes/SceneManager.js');
  const { EventBus } = await import('../src/engine/events/EventBus.js');
  const manager = new SceneManager({ renderer: { layers: { get: () => ({ addChild() {} }) } } }, new EventBus());
  let fixed = 0;
  let updated = 0;
  manager.stack.push({ fixedUpdate: () => { fixed += 1; }, update: () => { updated += 1; } });
  manager.transitioning = true;
  manager.fixedUpdate(1 / 60);
  manager.update(1 / 60);
  assert.equal(fixed, 0);
  assert.equal(updated, 0);
  manager.transitioning = false;
  manager.fixedUpdate(1 / 60);
  manager.update(1 / 60);
  assert.equal(fixed, 1);
  assert.equal(updated, 1);
});
