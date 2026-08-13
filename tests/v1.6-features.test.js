import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSafeSpawn } from '../src/games/deedz-the-goose/systems/WorldSafetySystem.js';
import { shouldShowTouchControls } from '../src/games/deedz-the-goose/ui/TouchControls.js';
import { adaptiveMusicProfile } from '../src/engine/audio/MusicSystem.js';
import { cloneDefaultInputBindings } from '../src/engine/input/InputMap.js';
import { chargedThrowProfile } from '../src/games/deedz-the-goose/data/throwing.js';

function platform(x, y, width, height) {
  return { collider: { enabled: true, left: x, right: x + width, top: y, bottom: y + height, width, height } };
}

test('restart spawn is lifted above final evolved geometry', () => {
  const safe = resolveSafeSpawn(
    { x: 260, y: 950 },
    [platform(0, 920, 1500, 330)],
    { width: 9600, height: 1250 },
    { width: 62, height: 48, offset: { y: -4 } },
  );
  assert.equal(safe.x, 260);
  assert.ok(safe.y < 900, `expected safe y above ground, received ${safe.y}`);
});

test('mobile controls auto-hide for controller players but can be forced', () => {
  assert.equal(shouldShowTouchControls({ mode: 'auto', touchCapable: true, gamepadConnected: false, worldActive: true }), true);
  assert.equal(shouldShowTouchControls({ mode: 'auto', touchCapable: true, gamepadConnected: true, worldActive: true }), false);
  assert.equal(shouldShowTouchControls({ mode: 'on', touchCapable: false, gamepadConnected: true, worldActive: true }), true);
  assert.equal(shouldShowTouchControls({ mode: 'off', touchCapable: true, gamepadConnected: false, worldActive: true }), false);
});

test('LT is assigned to Flock Sense while RB remains dash', () => {
  const controls = cloneDefaultInputBindings();
  assert.ok(controls.dash.some((binding) => binding.type === 'gamepad-button' && binding.button === 5));
  assert.ok(controls.sense.some((binding) => binding.type === 'gamepad-button' && binding.button === 6));
});

test('v1.6 generative score adds orchestration as layers and boss intensity rise', () => {
  const first = adaptiveMusicProfile({ level: 1, stage: { id: 'first' } });
  const evolved = adaptiveMusicProfile({ level: 9, stage: { id: 'evolved' } });
  const boss = adaptiveMusicProfile({ level: 9, stage: { id: 'evolved' }, intensity: 1 });
  assert.ok(evolved.instrumentTiers > first.instrumentTiers);
  assert.ok(evolved.shimmer > first.shimmer);
  assert.ok(boss.percussionDensity >= evolved.percussionDensity);
  assert.equal(boss.bossMode, true);
  assert.equal(first.chordProgression.length, 4);
  assert.equal(first.melodyPattern.length, 16);
});

test('quick crumb throws are faster and recover sooner without losing charge range', () => {
  const tap = chargedThrowProfile(0);
  const full = chargedThrowProfile(0.9);
  assert.ok(tap.strength >= 560);
  assert.ok(full.strength > tap.strength);
  assert.equal(full.charge, 1);
});
