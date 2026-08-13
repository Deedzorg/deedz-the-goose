import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';
import { Collider } from '../src/engine/physics/Collider.js';
import { CollisionSystem } from '../src/engine/physics/CollisionSystem.js';

function entity(id, x, y) { return { id, x, y, destroyed: false, hasTag: () => false }; }

test('CollisionSystem emits enter, stay, and exit with spatial hashing', () => {
  const events = new EventBus();
  const collision = new CollisionSystem(events, { cellSize: 32 });
  const a = new Collider(entity('a', 0, 0), { width: 20, height: 20 });
  const bEntity = entity('b', 5, 0);
  const b = new Collider(bEntity, { width: 20, height: 20 });
  const seen = [];
  events.on('collision:enter', () => seen.push('enter'));
  events.on('collision:stay', () => seen.push('stay'));
  events.on('collision:exit', () => seen.push('exit'));
  collision.step([a, b]);
  collision.step([a, b]);
  bEntity.x = 100;
  collision.step([a, b]);
  assert.deepEqual(seen, ['enter', 'stay', 'exit']);
  assert.equal(collision.stats.contacts, 0);
});
