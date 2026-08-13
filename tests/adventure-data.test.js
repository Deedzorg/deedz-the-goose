import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/games/deedz-the-goose/data/levels.js';

test('Great Goose Adventure data has valid shared-world identifiers and progression gates', () => {
  const level = levels[0];
  assert.ok(level.width >= 9000);
  assert.equal(level.crystals.length, level.requiredCrystals);
  assert.equal(new Set(level.crystals.map((item) => item.id)).size, level.crystals.length);
  assert.equal(new Set(level.enemies.map((item) => item.id)).size, level.enemies.length);
  assert.equal(new Set(level.checkpoints.map((item) => item.id)).size, level.checkpoints.length);
  assert.ok(level.platforms.some((item) => item.type === 'trampoline'));
  assert.ok(level.platforms.some((item) => item.type === 'moving'));
  assert.ok(level.platforms.some((item) => item.type === 'cloud'));
  assert.ok(level.hazards.length >= 4);
  assert.ok(level.enemies.some((item) => item.rank === 'captain'));
  assert.ok(level.exit.x < level.width && level.exit.x > level.width * 0.9);
  for (const item of [...level.crystals, ...level.enemies, ...level.checkpoints]) assert.ok(item.id && !item.id.includes(' '));
});
