import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evolutionGoal,
  evolutionLayoutXpBudget,
  generateEvolutionLayout,
} from '../src/games/deedz-the-goose/data/evolutions.js';

test('every Echo Layer contains enough renewable progress to evolve again', () => {
  for (let level = 1; level <= 24; level += 1) {
    const layout = generateEvolutionLayout({ level, cycle: level - 1, seed: 442211, width: 9600, groundY: 920 });
    const goal = evolutionGoal(level);
    assert.ok(evolutionLayoutXpBudget(layout) >= Math.ceil(goal * 1.28), `layer ${level} budget should exceed its goal`);
    assert.ok(layout.collectibles.length > 0, `layer ${level} should contain collectibles`);
    assert.ok(layout.collectibles.every((item) => item.respawnSeconds > 0), `layer ${level} pickups should renew`);
    assert.ok(layout.resonators.length >= 2, `layer ${level} should include repeatable resonators`);
  }
});

test('layer five specifically cannot exhaust its progression sources', () => {
  const layout = generateEvolutionLayout({ level: 5, cycle: 4, seed: 1337, width: 9600, groundY: 920 });
  assert.ok(layout.xpBudget >= Math.ceil(evolutionGoal(5) * 1.28));
  assert.ok(layout.collectibles.some((item) => item.type === 'echo-cache'));
  assert.ok(layout.platforms.some((platform) => platform.type === 'phase' || platform.type === 'updraft'));
});
