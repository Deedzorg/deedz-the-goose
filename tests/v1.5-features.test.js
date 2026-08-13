import test from 'node:test';
import assert from 'node:assert/strict';
import { chargedThrowProfile } from '../src/games/deedz-the-goose/data/throwing.js';
import { movementSpeedForStance } from '../src/games/deedz-the-goose/entities/PlayerGoose.js';
import { playerEscapeReason } from '../src/games/deedz-the-goose/systems/WorldSafetySystem.js';
import { adaptiveMusicProfile } from '../src/engine/audio/MusicSystem.js';
import { PAUSE_TABS } from '../src/games/deedz-the-goose/scenes/PauseScene.js';

test('charged crumb throws scale from near taps to far power throws', () => {
  const tap = chargedThrowProfile(0.02);
  const medium = chargedThrowProfile(0.55);
  const full = chargedThrowProfile(1.2);
  assert.ok(tap.strength < medium.strength);
  assert.ok(medium.strength < full.strength);
  assert.ok(tap.lift < full.lift);
  assert.equal(tap.damage, 1);
  assert.equal(full.damage, 2);
  assert.equal(full.charge, 1);
});

test('crouch walking preserves movement at a deliberately slower speed', () => {
  assert.equal(movementSpeedForStance(380, { crouching: false, grounded: true }), 380);
  assert.ok(Math.abs(movementSpeedForStance(380, { crouching: true, grounded: true }) - 136.8) < 1e-9);
  assert.equal(movementSpeedForStance(380, { crouching: true, grounded: false }), 380);
});

test('world safety identifies map escapes and burial beneath thick terrain', () => {
  const level = { width: 9600, height: 1250 };
  const basePlayer = { x: 100, y: 800, collider: { left: 70, right: 130, top: 770, bottom: 830 } };
  assert.equal(playerEscapeReason({ ...basePlayer, x: -400 }, level), 'left-world');
  assert.equal(playerEscapeReason({ ...basePlayer, y: 1210 }, level), 'below-world');
  const platform = { collider: { enabled: true, width: 1000, height: 330, left: 0, right: 1000, top: 920, bottom: 1250 } };
  const buried = { ...basePlayer, x: 500, y: 1080, collider: { left: 470, right: 530, top: 1050, bottom: 1110 } };
  assert.equal(playerEscapeReason(buried, level, [platform]), 'inside-ground');
  assert.equal(playerEscapeReason(basePlayer, level, [platform]), null);
});

test('adaptive music evolves by Echo Layer and intensifies for bosses', () => {
  const layerOne = adaptiveMusicProfile({ level: 1, stage: { id: 'moonlit' } });
  const layerFive = adaptiveMusicProfile({ level: 5, stage: { id: 'golden' } });
  const boss = adaptiveMusicProfile({ level: 5, stage: { id: 'golden' }, intensity: 1 });
  assert.notEqual(layerOne.root, layerFive.root);
  assert.ok(layerFive.tempo > layerOne.tempo);
  assert.ok(boss.tempo > layerFive.tempo);
  assert.ok(boss.volume > layerFive.volume);
});

test('pause menu keeps mission, controls, and settings in separate tabs', () => {
  assert.deepEqual(PAUSE_TABS.map((tab) => tab.id), ['mission', 'controls', 'settings']);
});
