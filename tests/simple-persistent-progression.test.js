import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adventureScore, nextAdventureDirective } from '../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js';

test('core advancement is crystals then XP then the Foxfire Gate with no boss requirement', () => {
  const crystals = nextAdventureDirective({ activeCrystals: 1, requiredCrystals: 3, level: 1, xp: 0, xpGoal: 120 });
  assert.equal(crystals.phase, 'crystals');
  assert.match(crystals.title, /CRYSTALS 1\/3/);

  const xp = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 90, xpGoal: 120 });
  assert.equal(xp.phase, 'xp');
  assert.match(xp.detail, /30 XP/);

  const gate = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 120, xpGoal: 120 });
  assert.equal(gate.phase, 'gate');
  assert.match(gate.title, /ECHO LAYER 2/);

  const combined = JSON.stringify([crystals, xp, gate]);
  assert.doesNotMatch(combined, /Breadstorm|Flock Energy|Boss Charge/i);
});

test('adventure score rewards persistent progression and play', () => {
  const start = adventureScore({ level: 1, xp: 10, crumbs: 2, enemies: 0, collectibles: 1 });
  const progressed = adventureScore({ level: 2, xp: 10, crumbs: 2, enemies: 0, collectibles: 1 });
  const fighter = adventureScore({ level: 1, xp: 10, crumbs: 2, enemies: 4, collectibles: 1 });
  assert.ok(progressed > start);
  assert.ok(fighter > start);
});

test('live game boots simple progression and input polish instead of legacy mandatory boss systems', async () => {
  const gooseGame = await readFile(new URL('../src/games/deedz-the-goose/GooseGame.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(gooseGame, /AdventureProgressionSystem/);
  assert.match(gooseGame, /GameplayInputSystem/);
  assert.doesNotMatch(gooseGame, /new ProgressionDirectorSystem/);
  assert.doesNotMatch(gooseGame, /new GameplayPolishSystem/);
  assert.doesNotMatch(main, /BossGuidanceSystem/);
});

test('awakened Echo crystals are saved and restored instead of living only in room memory', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js', import.meta.url), 'utf8');
  assert.match(source, /progress\.activatedCrystals/);
  assert.match(source, /crystal\?\.crystalId/);
  assert.match(source, /activate\?\.\(this\.engine, \{ synced: true, persisted: true \}\)/);
  assert.match(source, /immediate: true/);
});

test('legacy multiplayer boss charge is disabled in the active progression runtime', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js', import.meta.url), 'utf8');
  assert.match(source, /evolution\.contributeFlockEnergy = \(\) => evolution\.snapshot\(\)/);
  assert.match(source, /evolution\.shared\.boss = null/);
  assert.match(source, /flock\.hidden = true/);
  assert.match(source, /boss\.hidden = true/);
});
