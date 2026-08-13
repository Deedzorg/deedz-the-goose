import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/rooms/RoomManager.js';

function client(id) { return { id, socket: { readyState: 1, sent: [], send(value) { this.sent.push(JSON.parse(value)); } } }; }

test('RoomManager sanitizes profiles, state, and enforces capacity', () => {
  const rooms = new RoomManager({ maxRoomSize: 2 });
  const a = client('a');
  const b = client('b');
  const c = client('c');
  const joined = rooms.join(a, 'goose room!', { name: '<Deedz>', character: 'deedz' });
  assert.equal(joined.roomId, 'goose-room-');
  rooms.join(b, joined.roomId, { name: 'Sweet', character: 'sweet' });
  assert.throws(() => rooms.join(c, joined.roomId), /Room is full/);
  const state = rooms.updateState(a, { x: Infinity, y: '42', facing: -1, crouching: true });
  assert.equal(state.x, 0);
  assert.equal(state.y, 42);
  assert.equal(state.crouching, true);
  rooms.broadcastFrom(a, { type: 'state', payload: state });
  assert.equal(b.socket.sent.length, 1);
  assert.equal(rooms.stats().clients, 2);
});
