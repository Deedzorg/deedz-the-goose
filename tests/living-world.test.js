import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';

function client(id) {
  return { id, socket: { readyState: 1, send() {} } };
}

test('same-Echo geese share an inviting one-heart first Breadstorm fight', () => {
  const rooms = new RoomManager();
  const deedz = client('deedz');
  const sweet = client('sweet');
  rooms.join(deedz, 'goose-lobby', { name: 'Deedz' });
  rooms.join(sweet, 'goose-lobby', { name: 'Sweet' });
  rooms.updateState(deedz, { evolutionLevel: 2 });
  rooms.updateState(sweet, { evolutionLevel: 2 });

  let event;
  for (let index = 0; index < 6; index += 1) {
    event = rooms.applyWorldEvent(deedz, { event: 'flock-energy', amount: 30, reason: 'test' });
  }
  assert.equal(event.flockEnergy, event.flockGoal);
  assert.equal(event.boss.active, true);
  assert.equal(event.boss.phase, 1);
  assert.equal(event.boss.maxHp, 1);
  assert.equal(event.boss.maxShield, 0);
  assert.equal(event.boss.shieldEnabled, false);
  assert.equal(event.boss.players, 2);

  const openingHit = rooms.applyWorldEvent(deedz, { event: 'boss-hit', damage: 8, hitType: 'attack' });
  assert.equal(openingHit.damageApplied, 1);
  const state = openingHit;
  assert.equal(state.boss.defeated, true);
  assert.equal(state.bossWins, 1);
  assert.equal(state.flockEnergy, 0);
  assert.ok(state.flockGoal > 180);

  const late = client('late');
  const joined = rooms.join(late, 'goose-lobby', { name: 'Late Goose' });
  assert.equal(joined.worldState.bossWins, 1);
  assert.equal(joined.worldState.boss.defeated, true);
});

test('a returning Echo 3 player restores the evolved Breadstorm cycle in a fresh room', () => {
  const rooms = new RoomManager({ maxRoomSize: 4 });
  const deedz = client('returning-deedz');
  rooms.join(deedz, 'fresh-goose-lobby', { name: 'Deedz', character: 'classic--snow' });

  let event;
  for (let index = 0; index < 8; index += 1) {
    event = rooms.applyWorldEvent(deedz, {
      event: 'flock-energy',
      amount: 30,
      reason: 'returning-save',
      evolutionLevel: 3,
    });
  }

  assert.equal(event.flockGoal, 225);
  assert.equal(event.bossWins, 1);
  assert.equal(event.boss.cycle, 2);
  assert.equal(event.boss.maxHp, 2);
  assert.equal(event.boss.maxShield, 0);
  assert.equal(event.boss.shieldEnabled, false);

  let state = event;
  let guard = 0;
  while (state.boss.active && guard < 100) {
    const hitType = state.boss.shield > 0 ? 'honk' : 'attack';
    state = rooms.applyWorldEvent(deedz, { event: 'boss-hit', bossId: state.boss.id, damage: 8, hitType });
    guard += 1;
  }

  assert.ok(guard < 100, 'restored boss fight should terminate');
  assert.equal(state.bossWins, 2);
});
