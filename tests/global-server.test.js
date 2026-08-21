import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { DeedzWebSocketServer } from '../server/networking/WebSocketServer.js';
import { LeaderboardStore } from '../server/persistence/LeaderboardStore.js';
import { RoomManager } from '../server/rooms/RoomManager.js';

class SharedHub {
  constructor() { this.entries = []; this.listeners = new Map(); }
}

class FakeDatabase {
  constructor(hub, id) { this.hub = hub; this.instanceId = id; this.enabled = true; }
  async init() {}
  async submitLeaderboard(entry) { this.hub.entries.push(entry); return entry; }
  async topLeaderboard(limit) { return [...this.hub.entries].sort((a, b) => b.score - a.score).slice(0, limit); }
  async subscribe(handler) { this.hub.listeners.set(this.instanceId, handler); }
  async publish(event) {
    for (const [id, handler] of this.hub.listeners) if (id !== this.instanceId) await handler({ ...event, sourceInstanceId: this.instanceId });
  }
  async close() { this.hub.listeners.delete(this.instanceId); }
}

function nextMessage(socket, type, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${type}`)); }, timeout);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const cleanup = () => { clearTimeout(timer); socket.off('message', onMessage); };
    socket.on('message', onMessage);
  });
}

async function startInstance(hub, id, tempDir) {
  const database = new FakeDatabase(hub, id);
  const leaderboard = new LeaderboardStore(path.join(tempDir, `${id}.json`), { database });
  const rooms = new RoomManager({ maxRoomSize: 64 });
  const server = createServer();
  const sockets = new DeedzWebSocketServer({ server, rooms, leaderboard, backplane: database, heartbeatMs: 60000 });
  await database.subscribe((event) => sockets.handleBackplane(event));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { database, leaderboard, rooms, server, sockets, url: `ws://127.0.0.1:${port}/ws` };
}

async function stopInstance(instance) {
  await instance.sockets.close();
  if (instance.server.listening) await new Promise((resolve) => instance.server.close(resolve));
  await instance.database.close();
}

test('global leaderboard is shared and broadcast across server instances', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'deedz-global-'));
  const hub = new SharedHub();
  const a = await startInstance(hub, 'a', tempDir);
  const b = await startInstance(hub, 'b', tempDir);
  const clientA = new WebSocket(a.url);
  const clientB = new WebSocket(b.url);
  try {
    await Promise.all([nextMessage(clientA, 'welcome'), nextMessage(clientB, 'welcome')]);
    clientA.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name: 'A' } } }));
    clientB.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name: 'B' } } }));
    await Promise.all([nextMessage(clientA, 'joined'), nextMessage(clientB, 'joined')]);

    const updateA = nextMessage(clientA, 'leaderboard:update');
    const updateB = nextMessage(clientB, 'leaderboard:update');
    clientA.send(JSON.stringify({ type: 'leaderboard:submit', payload: { name: 'Deedz', score: 12345, character: 'deedz' } }));
    const [messageA, messageB] = await Promise.all([updateA, updateB]);
    assert.equal(messageA.payload.entries[0].name, 'Deedz');
    assert.equal(messageB.payload.entries[0].score, 12345);
    assert.deepEqual(await a.leaderboard.top(20), await b.leaderboard.top(20));
  } finally {
    clientA.close(); clientB.close();
    await Promise.all([stopInstance(a), stopInstance(b)]);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('room actions cross the instance backplane', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'deedz-room-'));
  const hub = new SharedHub();
  const a = await startInstance(hub, 'a', tempDir);
  const b = await startInstance(hub, 'b', tempDir);
  const clientA = new WebSocket(a.url);
  const clientB = new WebSocket(b.url);
  try {
    await Promise.all([nextMessage(clientA, 'welcome'), nextMessage(clientB, 'welcome')]);
    clientA.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name: 'A' } } }));
    clientB.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name: 'B' } } }));
    await Promise.all([nextMessage(clientA, 'joined'), nextMessage(clientB, 'joined')]);

    const remoteAction = nextMessage(clientB, 'action');
    clientA.send(JSON.stringify({ type: 'action', payload: { action: 'honk', x: 10, y: 20, facing: 1 } }));
    const message = await remoteAction;
    assert.equal(message.payload.action, 'honk');
    assert.equal(message.payload.x, 10);
    assert.equal(message.payload.y, 20);
  } finally {
    clientA.close(); clientB.close();
    await Promise.all([stopInstance(a), stopInstance(b)]);
    await rm(tempDir, { recursive: true, force: true });
  }
});
