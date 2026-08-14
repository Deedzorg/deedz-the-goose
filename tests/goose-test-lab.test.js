import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyTestBossHit,
  createTestBossState,
  createTestEvolutionState,
  GOOSE_LAB_ACTIONS,
  GOOSE_LAB_ENCOUNTERS,
  MAX_TEST_ECHO,
  normalizeTestEcho,
} from '../src/games/deedz-the-goose/ui/GooseTestLab.js';

test('Goose Lab clamps test travel and creates a ready-to-load Echo save state', () => {
  assert.equal(normalizeTestEcho(0), 1);
  assert.equal(normalizeTestEcho(10), 10);
  assert.equal(normalizeTestEcho(999), MAX_TEST_ECHO);
  assert.deepEqual(createTestEvolutionState({ seed: 4242 }, 10), {
    level: 10,
    xp: 0,
    cycle: 9,
    seed: 4242,
    bossWins: 9,
  });
});

test('Goose Lab exposes level travel, warps, supplies, safety, and encounter test actions', () => {
  for (const action of [
    'previous-echo', 'load-echo', 'next-echo',
    'warp-start', 'warp-boss', 'warp-gate',
    'heal', 'add-crumbs', 'spill-crumbs', 'toggle-invincible',
    'clear-enemies', 'clear-spawned', 'enemy-parade', 'ready-echo',
    'spawn-encounter', 'unlock-geese',
  ]) assert.ok(GOOSE_LAB_ACTIONS.includes(action), `missing Goose Lab action: ${action}`);
});

test('Goose Lab encounter picker includes every enemy and three isolated Breadstorm forms', () => {
  for (const id of ['charger', 'pouncer', 'lobber', 'brute', 'penguin', 'bat', 'toast-captain']) {
    assert.ok(GOOSE_LAB_ENCOUNTERS.some((encounter) => encounter.id === id), `missing encounter: ${id}`);
  }
  assert.deepEqual(
    GOOSE_LAB_ENCOUNTERS.filter((encounter) => encounter.bossLevel).map((encounter) => encounter.id),
    ['breadstorm-first', 'breadstorm-shield', 'breadstorm-phases'],
  );
});

test('private Breadstorm tests reproduce shield counters without touching shared state', () => {
  const first = createTestBossState({ level: 2, cycle: 1 });
  assert.equal(first.shield, 0);
  assert.equal(first.maxHp, 1);

  const shielded = createTestBossState({ level: 5, cycle: 4 });
  assert.ok(shielded.shield > 0);
  const blocked = applyTestBossHit(shielded, { damage: 8, hitType: 'attack' });
  assert.equal(blocked.damageApplied, 0);
  assert.equal(blocked.shieldDamage, 0);
  assert.equal(blocked.state.hp, shielded.hp);
  const honked = applyTestBossHit(shielded, { damage: 8, hitType: 'honk' });
  assert.ok(honked.shieldDamage > 0);
  assert.ok(honked.state.shield < shielded.shield);

  const vulnerable = applyTestBossHit({ ...shielded, shield: 0 }, { damage: 8, hitType: 'peck' });
  assert.ok(vulnerable.damageApplied > 0);
  assert.ok(vulnerable.state.hp < shielded.hp);
});

test('production configuration keeps F3 diagnostics enabled through the current save migrations', async () => {
  const config = await readFile(new URL('../src/games/deedz-the-goose/GooseConfig.js', import.meta.url), 'utf8');
  const game = await readFile(new URL('../src/games/deedz-the-goose/GooseGame.js', import.meta.url), 'utf8');
  assert.match(config, /version:\s*10/);
  assert.match(config, /8:\s*\(data\)\s*=>/);
  assert.match(config, /9:\s*\(data\)\s*=>/);
  assert.match(config, /character:\s*data\.profile\?\.character\s*===\s*'adaboss'\s*\?\s*'guardian'/);
  assert.match(config, /debug:\s*\{\s*enabled:\s*true/);
  assert.match(game, /new GooseTestLab\(engine\)/);
  assert.match(game, /this\.testLab\?\.destroy\(\)/);
});
