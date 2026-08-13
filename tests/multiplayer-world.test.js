import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createDeedzServer } from '../server/index.js';

function waitForMessage(socket, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 3000);
    const onMessage = (buffer) => {
      const message = JSON.parse(buffer.toString());
      if (message.type !== type || !predicate(message.payload ?? {})) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

async function connect(url) {
  const socket = new WebSocket(url);
  const welcome = waitForMessage(socket, 'welcome');
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const message = await welcome;
  return { socket, id: message.payload.id };
}

async function join(socket, name) {
  const joined = waitForMessage(socket, 'joined');
  socket.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name } } }));
  return (await joined).payload;
}

test('shared room relays goose interactions and persists world progress for late joiners', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deedz-multiplayer-'));
  const instance = createDeedzServer({ port: 0, host: '127.0.0.1', leaderboardPath: path.join(directory, 'leaderboard.json') });
  const address = await instance.start();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const sockets = [];
  try {
    const a = await connect(url); sockets.push(a.socket);
    await join(a.socket, 'Deedz');
    const peerJoin = waitForMessage(a.socket, 'peer-join');
    const b = await connect(url); sockets.push(b.socket);
    await join(b.socket, 'Sweet');
    await peerJoin;

    const wingBump = waitForMessage(b.socket, 'action', (payload) => payload.action === 'wing-bump');
    a.socket.send(JSON.stringify({ type: 'action', payload: { action: 'wing-bump', targetId: b.id, x: 44, y: 55, facing: 1, strength: 360 } }));
    const action = (await wingBump).payload;
    assert.equal(action.targetId, b.id);
    assert.equal(action.strength, 360);

    const crumbThrow = waitForMessage(b.socket, 'action', (payload) => payload.action === 'throw');
    a.socket.send(JSON.stringify({ type: 'action', payload: { action: 'throw', x: 144, y: 255, facing: -1, strength: 1010, lift: 280, duration: 2.4, charge: 0.96, damage: 2 } }));
    const thrown = (await crumbThrow).payload;
    assert.equal(thrown.id, a.id);
    assert.equal(thrown.x, 144);
    assert.equal(thrown.facing, -1);
    assert.equal(thrown.strength, 1010);
    assert.equal(thrown.lift, 280);
    assert.equal(thrown.duration, 2.4);
    assert.equal(thrown.charge, 0.96);
    assert.equal(thrown.damage, 2);

    const crystalBroadcast = waitForMessage(b.socket, 'world:event', (payload) => payload.event === 'crystal-activated');
    a.socket.send(JSON.stringify({ type: 'world:event', payload: { event: 'crystal-activated', crystalId: 'meadow' } }));
    assert.equal((await crystalBroadcast).payload.crystalId, 'meadow');

    const defeatedBroadcast = waitForMessage(b.socket, 'world:event', (payload) => payload.event === 'enemy-defeated');
    a.socket.send(JSON.stringify({ type: 'world:event', payload: { event: 'enemy-defeated', enemyId: 'bread-captain' } }));
    assert.equal((await defeatedBroadcast).payload.enemyId, 'bread-captain');

    const c = await connect(url); sockets.push(c.socket);
    const joined = await join(c.socket, 'MortalKrumbat');
    assert.deepEqual(joined.worldState.activatedCrystals, ['meadow']);
    assert.deepEqual(joined.worldState.defeatedEnemies, ['bread-captain']);
    assert.equal(joined.peers.length, 2);
  } finally {
    for (const socket of sockets) socket.close();
    await instance.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
