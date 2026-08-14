import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adventureScore, nextAdventureDirective } from '../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js';

test('core advancement introduces the gate first, Breadstorm second, and shields after the early forms', () => {
  const crystals = nextAdventureDirective({ activeCrystals: 1, requiredCrystals: 3, level: 1, xp: 0, xpGoal: 120 });
  assert.equal(crystals.phase, 'crystals');
  assert.match(crystals.title, /CRYSTALS 1\/3/);

  const xp = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 90, xpGoal: 120 });
  assert.equal(xp.phase, 'xp');
  assert.match(xp.detail, /30 XP/);

  const firstGate = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 120, xpGoal: 120, bossWins: 0, bossTarget: 0 });
  assert.equal(firstGate.phase, 'gate');

  const summon = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 2, xp: 165, xpGoal: 165, bossWins: 0, bossTarget: 1, flockEnergy: 150, flockGoal: 180 });
  assert.equal(summon.phase, 'summon');

  const firstBoss = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 2, xp: 165, xpGoal: 165, bossWins: 0, bossTarget: 1, boss: { active: true, hp: 1, maxHp: 1, phase: 1, shield: 0, shieldEnabled: false } });
  assert.equal(firstBoss.phase, 'boss-fight');
  assert.match(firstBoss.detail, /no shield/);

  const shield = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 5, xp: 315, xpGoal: 315, bossWins: 3, bossTarget: 4, boss: { active: true, hp: 4, maxHp: 4, phase: 1, shield: 1, shieldEnabled: true } });
  assert.equal(shield.phase, 'boss-shield');
  assert.match(shield.detail, /HONK/);

  const gate = nextAdventureDirective({ activeCrystals: 3, requiredCrystals: 3, level: 2, xp: 165, xpGoal: 165, bossWins: 1, bossTarget: 1 });
  assert.equal(gate.phase, 'gate');
  assert.match(gate.title, /ECHO LAYER 3/);
});

test('adventure score rewards persistent progression and play', () => {
  const start = adventureScore({ level: 1, xp: 10, crumbs: 2, enemies: 0, collectibles: 1 });
  const progressed = adventureScore({ level: 2, xp: 10, crumbs: 2, enemies: 0, collectibles: 1 });
  const fighter = adventureScore({ level: 1, xp: 10, crumbs: 2, enemies: 4, collectibles: 1 });
  assert.ok(progressed > start);
  assert.ok(fighter > start);
});

test('live game boots persistent progression, input polish, and boss guidance', async () => {
  const gooseGame = await readFile(new URL('../src/games/deedz-the-goose/GooseGame.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(gooseGame, /AdventureProgressionSystem/);
  assert.match(gooseGame, /GameplayInputSystem/);
  assert.doesNotMatch(gooseGame, /new ProgressionDirectorSystem/);
  assert.doesNotMatch(gooseGame, /new GameplayPolishSystem/);
  assert.match(gooseGame, /BossGuidanceSystem/);
});

test('awakened Echo crystals are saved and restored instead of living only in room memory', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js', import.meta.url), 'utf8');
  assert.match(source, /progress\.activatedCrystals/);
  assert.match(source, /crystal\?\.crystalId/);
  assert.match(source, /activate\?\.\(this\.engine, \{ synced: true, persisted: true \}\)/);
  assert.match(source, /immediate: true/);
});

test('boss charge is visible and auto-completes after layer prerequisites', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js', import.meta.url), 'utf8');
  assert.match(source, /#maybeChargeBoss/);
  assert.match(source, /evolution\.contributeFlockEnergy/);
  assert.match(source, /Boss Charge/);
  assert.match(source, /flock\.hidden = !bossRequired/);
  assert.match(source, /boss\.hidden = !bossRequired/);
  assert.doesNotMatch(source, /#disableLegacyBossGate/);
});
