import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evolutionGoal,
  generateEvolutionLayout,
  stageForLevel,
} from '../src/games/deedz-the-goose/data/evolutions.js';
import { enemyArchetypesForLevel } from '../src/games/deedz-the-goose/data/enemies.js';

test('personal Echo Layers are deterministic and escalate forever', () => {
  const options = { level: 3, cycle: 2, seed: 424242, width: 9600, groundY: 920 };
  const first = generateEvolutionLayout(options);
  const second = generateEvolutionLayout(options);
  assert.deepEqual(first, second);

  const early = generateEvolutionLayout({ ...options, level: 1 });
  const late = generateEvolutionLayout({ ...options, level: 8 });
  assert.ok(late.platforms.length > early.platforms.length);
  assert.ok(late.enemies.length > early.enemies.length);
  assert.ok(evolutionGoal(8) > evolutionGoal(1));
  assert.equal(stageForLevel(999).id, 'infinite-flock');

  for (const platform of late.platforms) {
    assert.ok(platform.x >= 0 && platform.x <= 9600);
    assert.ok(platform.y >= 280 && platform.y <= 920);
  }
});

test('Echo Layers introduce distinct enemy behaviors without removing earlier counters', () => {
  assert.deepEqual(enemyArchetypesForLevel(1), ['charger', 'pouncer']);
  assert.deepEqual(enemyArchetypesForLevel(2), ['charger', 'pouncer', 'lobber']);
  assert.deepEqual(enemyArchetypesForLevel(3), ['charger', 'pouncer', 'lobber', 'brute']);
  const first = generateEvolutionLayout({ level: 1, cycle: 0, seed: 7 });
  const third = generateEvolutionLayout({ level: 3, cycle: 2, seed: 7 });
  assert.deepEqual(new Set(first.enemies.map((enemy) => enemy.archetype)), new Set(['charger', 'pouncer']));
  assert.deepEqual(new Set(third.enemies.map((enemy) => enemy.archetype)), new Set(['charger', 'pouncer', 'lobber', 'brute']));
});
