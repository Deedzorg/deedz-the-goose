import test from 'node:test';
import assert from 'node:assert/strict';
import { gooseClasses } from '../src/games/deedz-the-goose/data/characters.js';
import { levels } from '../src/games/deedz-the-goose/data/levels.js';
import { MENU_GAMEPAD, menuBackPressed, menuDirection, menuSelectPressed, menuStartPressed } from '../src/games/deedz-the-goose/data/menuNavigation.js';
import { bossGuidanceLabel } from '../src/games/deedz-the-goose/systems/BossGuidanceSystem.js';
import { RoomManager } from '../server/rooms/RoomManager.js';

function fakeInput({ actions = [], buttons = [] } = {}) {
  const actionSet = new Set(actions);
  const buttonSet = new Set(buttons);
  return { wasPressed: (action) => actionSet.has(action), gamepad: { wasPressed: (button) => buttonSet.has(button) } };
}

test('controller menu navigation maps Xbox D-pad, A, B, Y, and Menu', () => {
  assert.equal(MENU_GAMEPAD.up, 12);
  assert.equal(MENU_GAMEPAD.down, 13);
  assert.equal(MENU_GAMEPAD.left, 14);
  assert.equal(MENU_GAMEPAD.right, 15);
  assert.equal(menuDirection(fakeInput({ buttons: [12] })), 'up');
  assert.equal(menuDirection(fakeInput({ buttons: [15] })), 'right');
  assert.equal(menuSelectPressed(fakeInput({ buttons: [0] })), true);
  assert.equal(menuSelectPressed(fakeInput({ buttons: [3] })), true);
  assert.equal(menuBackPressed(fakeInput({ buttons: [1] })), true);
  assert.equal(menuStartPressed(fakeInput({ buttons: [9] })), true);
});

test('shareable goose roster remains generic', () => {
  const names = gooseClasses.map((item) => item.name.toLowerCase()).join(' ');
  assert.equal(names.includes('sweetbloodrazor'), false);
  assert.equal(names.includes('mortalkrumbat'), false);
  assert.equal(gooseClasses.length, 7);
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

test('server-authoritative Breadstorm lifecycle can summon, break shields, change phases, and be defeated', () => {
  const manager = new RoomManager({ maxRoomSize: 4 });
  const client = { id: 'solo-goose', socket: { readyState: 1, send() {} } };
  manager.join(client, 'goose-lobby', { name: 'Solo Goose', character: 'classic--snow' });

  let result;
  for (let index = 0; index < 6; index += 1) result = manager.applyWorldEvent(client, { event: 'flock-energy', amount: 30, reason: 'sanity' });
  assert.equal(result.flockEnergy, 180);
  assert.equal(result.boss.active, true);
  assert.equal(result.boss.phase, 1);

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
});
