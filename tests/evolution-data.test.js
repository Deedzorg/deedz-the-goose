import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evolutionGoal,
  generateEvolutionLayout,
  stageForLevel,
} from '../src/games/deedz-the-goose/data/evolutions.js';

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
