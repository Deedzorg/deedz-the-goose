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
      resolve(message.payload);
    };
    socket.on('message', onMessage);
  });
}

async function connectAndJoin(url, name) {
  const socket = new WebSocket(url);
  const welcome = waitForMessage(socket, 'welcome');
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  await welcome;
  const joined = waitForMessage(socket, 'joined');
  socket.send(JSON.stringify({ type: 'join', payload: { room: 'goose-lobby', profile: { name } } }));
  return { socket, joined: await joined };
}

test('authoritative Breadstorm events reach sender, peers, and late joiners', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deedz-boss-network-'));
  const instance = createDeedzServer({ port: 0, host: '127.0.0.1', leaderboardPath: path.join(directory, 'leaderboard.json') });
  const address = await instance.start();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const sockets = [];
  try {
    const a = await connectAndJoin(url, 'Deedz'); sockets.push(a.socket);
    const b = await connectAndJoin(url, 'Sweet'); sockets.push(b.socket);

    for (let index = 0; index < 10; index += 1) {
      const own = waitForMessage(a.socket, 'world:event', (payload) => payload.event === 'flock-energy');
      a.socket.send(JSON.stringify({ type: 'world:event', payload: { event: 'flock-energy', amount: 30, reason: 'test', evolutionLevel: 5 } }));
      await own;
    }

    const senderBoss = waitForMessage(a.socket, 'world:event', (payload) => payload.event === 'flock-energy' && payload.boss?.active);
    const peerBoss = waitForMessage(b.socket, 'world:event', (payload) => payload.event === 'flock-energy' && payload.boss?.active);
    a.socket.send(JSON.stringify({ type: 'world:event', payload: { event: 'flock-energy', amount: 30, reason: 'summon', evolutionLevel: 5 } }));
    const [senderState, peerState] = await Promise.all([senderBoss, peerBoss]);
    assert.equal(senderState.boss.id, peerState.boss.id);
    assert.equal(senderState.boss.cycle, 4);
    assert.equal(senderState.boss.phase, 1);

    const senderHit = waitForMessage(a.socket, 'world:event', (payload) => payload.event === 'boss-hit');
    const peerHit = waitForMessage(b.socket, 'world:event', (payload) => payload.event === 'boss-hit');
    a.socket.send(JSON.stringify({ type: 'world:event', payload: { event: 'boss-hit', bossId: 'baron-breadstorm', damage: 8, hitType: 'attack' } }));
    const [blockedForSender, blockedForPeer] = await Promise.all([senderHit, peerHit]);
    assert.equal(blockedForSender.damageApplied, 0);
    assert.equal(blockedForPeer.boss.hp, blockedForPeer.boss.maxHp);

    const c = await connectAndJoin(url, 'MortalKrumbat'); sockets.push(c.socket);
    assert.equal(c.joined.worldState.boss.active, true);
    assert.equal(c.joined.worldState.flockEnergy, c.joined.worldState.flockGoal);
  } finally {
    for (const socket of sockets) socket.close();
    await instance.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
