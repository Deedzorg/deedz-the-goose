import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';

function client(id) {
  return { id, socket: { readyState: 1, send() {} } };
}

test('shared flock energy summons and resolves a multi-phase Breadstorm boss', () => {
  const rooms = new RoomManager();
  const deedz = client('deedz');
  const sweet = client('sweet');
  rooms.join(deedz, 'goose-lobby', { name: 'Deedz' });
  rooms.join(sweet, 'goose-lobby', { name: 'Sweet' });

  let event;
  for (let index = 0; index < 6; index += 1) {
    event = rooms.applyWorldEvent(deedz, { event: 'flock-energy', amount: 30, reason: 'test' });
  }
  assert.equal(event.flockEnergy, event.flockGoal);
  assert.equal(event.boss.active, true);
  assert.equal(event.boss.phase, 1);
  assert.ok(event.boss.maxHp >= 50);

  const blocked = rooms.applyWorldEvent(deedz, { event: 'boss-hit', damage: 8, hitType: 'attack' });
  assert.equal(blocked.damageApplied, 0);
  assert.equal(blocked.boss.hp, blocked.boss.maxHp);

  let state = blocked;
  let guard = 0;
  while (state.boss.active && guard < 100) {
    state = rooms.applyWorldEvent(deedz, {
      event: 'boss-hit',
      damage: 8,
      hitType: state.boss.shield > 0 ? 'honk' : 'attack',
    });
    guard += 1;
  }

  assert.ok(guard < 100, 'boss fight should terminate');
  assert.equal(state.boss.defeated, true);
  assert.equal(state.bossWins, 1);
  assert.equal(state.flockEnergy, 0);
  assert.ok(state.flockGoal > 180);

  const late = client('late');
  const joined = rooms.join(late, 'goose-lobby', { name: 'Late Goose' });
  assert.equal(joined.worldState.bossWins, 1);
  assert.equal(joined.worldState.boss.defeated, true);
});
