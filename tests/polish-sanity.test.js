import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gooseClasses } from '../src/games/deedz-the-goose/data/characters.js';
import { levels } from '../src/games/deedz-the-goose/data/levels.js';
import { MENU_GAMEPAD, createMenuRepeatState, menuBackPressed, menuDirection, menuRepeatDirection, menuSelectPressed, menuStartPressed, menuTabDirection } from '../src/games/deedz-the-goose/data/menuNavigation.js';
import { bossGuidanceLabel } from '../src/games/deedz-the-goose/systems/BossGuidanceSystem.js';
import { flockScore, nextEchoPreview } from '../src/games/deedz-the-goose/data/progression.js';
import { progressionDirective } from '../src/games/deedz-the-goose/data/progressionDirective.js';
import { shouldSimulateWorld } from '../src/engine/DeedzEngine.js';
import { RoomManager } from '../server/rooms/RoomManager.js';

function fakeInput({ actions = [], buttons = [], heldActions = [], heldButtons = [] } = {}) {
  const actionSet = new Set(actions);
  const buttonSet = new Set(buttons);
  const heldActionSet = new Set(heldActions);
  const heldButtonSet = new Set(heldButtons);
  return {
    wasPressed: (action) => actionSet.has(action),
    value: (action) => heldActionSet.has(action) ? 1 : 0,
    gamepad: {
      wasPressed: (button) => buttonSet.has(button),
      isDown: (button) => heldButtonSet.has(button),
    },
  };
}

test('controller menu navigation maps D-pad, selection, back, Menu, and shoulder page switching', () => {
  assert.equal(MENU_GAMEPAD.up, 12);
  assert.equal(MENU_GAMEPAD.down, 13);
  assert.equal(MENU_GAMEPAD.left, 14);
  assert.equal(MENU_GAMEPAD.right, 15);
  assert.equal(MENU_GAMEPAD.tabPrevious, 4);
  assert.equal(MENU_GAMEPAD.tabNext, 5);
  assert.equal(menuDirection(fakeInput({ buttons: [12] })), 'up');
  assert.equal(menuDirection(fakeInput({ buttons: [15] })), 'right');
  assert.equal(menuTabDirection(fakeInput({ buttons: [4] })), -1);
  assert.equal(menuTabDirection(fakeInput({ buttons: [5] })), 1);
  assert.equal(menuSelectPressed(fakeInput({ buttons: [0] })), true);
  assert.equal(menuSelectPressed(fakeInput({ buttons: [3] })), true);
  assert.equal(menuBackPressed(fakeInput({ buttons: [1] })), true);
  assert.equal(menuStartPressed(fakeInput({ buttons: [9] })), true);
});

test('held stick or D-pad repeats menu movement after a deliberate initial delay', () => {
  const repeat = createMenuRepeatState();
  assert.equal(menuRepeatDirection(fakeInput({ actions: ['down'], heldActions: ['down'] }), repeat, 1000), 'down');
  assert.equal(menuRepeatDirection(fakeInput({ heldActions: ['down'] }), repeat, 1100), null);
  assert.equal(menuRepeatDirection(fakeInput({ heldActions: ['down'] }), repeat, 1281), 'down');
  assert.equal(menuRepeatDirection(fakeInput({ heldActions: ['down'] }), repeat, 1387), 'down');
  assert.equal(menuRepeatDirection(fakeInput(), repeat, 1400), null);
  assert.equal(repeat.direction, null);
});

test('pause destination changes are atomic and global gameplay simulation freezes during transitions', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/scenes/PauseScene.js', import.meta.url), 'utf8');
  assert.equal(source.includes('await this.engine.scenes.pop'), false, 'restart/main-menu must not resume the old world between transitions');
  assert.match(source, /await this\.engine\.scenes\.change\(sceneId, data\)/);
  assert.equal(shouldSimulateWorld({ transitioning: true, active: { blocksWorld: false } }), false);
  assert.equal(shouldSimulateWorld({ transitioning: false, active: { blocksWorld: true } }), false);
  assert.equal(shouldSimulateWorld({ transitioning: false, active: { blocksWorld: false } }), true);
  assert.match(source, /id: 'records'/);
  assert.match(source, /menuTabDirection/);
});

test('shareable goose roster fills all eight play-style slots', () => {
  const names = gooseClasses.map((item) => item.name.toLowerCase()).join(' ');
  assert.equal(names.includes('sweetbloodrazor'), false);
  assert.equal(names.includes('mortalkrumbat'), false);
  assert.equal(gooseClasses.length, 8);
  assert.ok(gooseClasses.some((item) => item.name === 'Ember Goose' && item.projectileStyle === 'ember-bolt'));
});

test('progression gives one clear next objective and teases the next Echo layer', () => {
  const crystalStep = progressionDirective({ activeCrystals: 1, requiredCrystals: 3, level: 1, xp: 20, xpGoal: 120 });
  assert.equal(crystalStep.phase, 'crystals');
  assert.match(crystalStep.title, /CRYSTALS 1\/3/);

  const xpStep = progressionDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 90, xpGoal: 120, flockEnergy: 120, flockGoal: 180 });
  assert.equal(xpStep.phase, 'xp');
  assert.match(xpStep.detail, /30 XP/);

  const summonStep = progressionDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 120, xpGoal: 120, bossWins: 0, bossTarget: 1, flockEnergy: 150, flockGoal: 180 });
  assert.equal(summonStep.phase, 'summon');

  const fightStep = progressionDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 120, xpGoal: 120, boss: { active: true, phase: 2, hp: 30, maxHp: 50, shield: 4 } });
  assert.equal(fightStep.phase, 'boss-shield');
  assert.match(fightStep.detail, /HONK/);

  const gateStep = progressionDirective({ activeCrystals: 3, requiredCrystals: 3, level: 1, xp: 120, xpGoal: 120, bossWins: 1, bossTarget: 1 });
  assert.equal(gateStep.phase, 'gate');
  assert.match(gateStep.title, /ECHO LAYER 2/);
  assert.equal(nextEchoPreview(1).level, 2);
});

test('Flock Score rewards real advancement more than incidental counters', () => {
  const base = flockScore({ level: 1, xp: 100, bossWins: 0, crumbs: 20, enemies: 2, collectibles: 3 });
  const evolved = flockScore({ level: 2, xp: 0, bossWins: 1, crumbs: 20, enemies: 2, collectibles: 3 });
  assert.ok(evolved > base);
});

test('room state preserves bounded leaderboard fields for connected geese', () => {
  const manager = new RoomManager({ maxRoomSize: 4 });
  const client = { id: 'ranked-goose', socket: { readyState: 1, send() {} } };
  manager.join(client, 'goose-lobby', { name: 'Ranked Goose', character: 'classic--snow' });
  const state = manager.updateState(client, { x: 2, y: 3, evolutionLevel: 4, score: 9876, bossWins: 3, echoXp: 222 });
  assert.equal(state.evolutionLevel, 4);
  assert.equal(state.score, 9876);
  assert.equal(state.bossWins, 3);
  assert.equal(state.echoXp, 222);
});

test('base adventure contains enough solo Flock Energy to summon Breadstorm', () => {
  const level = levels[0];
  const crumbEnergy = level.collectibles.length * 3;
  const enemyEnergy = level.enemies.reduce((sum, enemy) => sum + (enemy.rank === 'captain' ? 14 : 7), 0);
  const crystalEnergy = level.crystals.length * 18;
  const potential = crumbEnergy + enemyEnergy + crystalEnergy;
  assert.ok(potential >= 180, `expected solo energy potential >= 180, got ${potential}`);
});

test('boss guidance clearly distinguishes dormant, shield, and damage phases', () => {
  assert.match(bossGuidanceLabel({ shared: { flockEnergy: 90, flockGoal: 180, boss: null } }), /Flock 90\/180/);
  assert.match(bossGuidanceLabel({ shared: { boss: { active: true, phase: 1, hp: 50, maxHp: 50, shield: 7 } } }), /HONK/);
  assert.match(bossGuidanceLabel({ shared: { boss: { active: true, phase: 1, hp: 42, maxHp: 50, shield: 0 } } }), /ATTACK/);
});

test('server-authoritative Breadstorm lifecycle grows after each victory', () => {
  const manager = new RoomManager({ maxRoomSize: 4 });
  const client = { id: 'solo-goose', socket: { readyState: 1, send() {} } };
  manager.join(client, 'goose-lobby', { name: 'Solo Goose', character: 'classic--snow' });

  let result;
  for (let index = 0; index < 6; index += 1) result = manager.applyWorldEvent(client, { event: 'flock-energy', amount: 30, reason: 'sanity' });
  assert.equal(result.flockEnergy, 180);
  assert.equal(result.boss.active, true);
  const firstMaxHp = result.boss.maxHp;
  const firstMaxShield = result.boss.maxShield;

  const blocked = manager.applyWorldEvent(client, { event: 'boss-hit', bossId: result.boss.id, damage: 8, hitType: 'attack' });
  assert.equal(blocked.damageApplied, 0);
  assert.equal(blocked.boss.hp, blocked.boss.maxHp);
  assert.ok(blocked.boss.shield > 0);

  let boss = blocked.boss;
  let sawHpDamage = false;
  let sawPhaseShield = false;
  let guard = 0;
  while (boss.active && guard < 80) {
    guard += 1;
    const before = { ...boss };
    const event = boss.shield > 0
      ? { event: 'boss-hit', bossId: boss.id, damage: 8, hitType: 'honk' }
      : { event: 'boss-hit', bossId: boss.id, damage: 8, hitType: 'attack' };
    const next = manager.applyWorldEvent(client, event);
    boss = next.boss;
    if (next.damageApplied > 0) sawHpDamage = true;
    if (boss?.phase > before.phase && boss.shield > 0) sawPhaseShield = true;
  }

  assert.ok(guard < 80, 'boss lifecycle should terminate');
  assert.equal(boss.defeated, true);
  assert.equal(boss.active, false);
  assert.equal(sawHpDamage, true);
  assert.equal(sawPhaseShield, true);
  const world = manager.getWorldState('goose-lobby');
  assert.equal(world.bossWins, 1);
  assert.equal(world.flockEnergy, 0);
  assert.equal(world.flockGoal, 225);

  let second;
  for (let index = 0; index < 8; index += 1) second = manager.applyWorldEvent(client, { event: 'flock-energy', amount: 30, reason: 'second-cycle' });
  assert.equal(second.boss.active, true);
  assert.equal(second.boss.cycle, 2);
  assert.ok(second.boss.maxHp > firstMaxHp, 'next Breadstorm should gain HP');
  assert.ok(second.boss.maxShield > firstMaxShield, 'next Breadstorm should gain shield strength');
});
