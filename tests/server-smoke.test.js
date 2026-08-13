import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createDeedzServer } from '../server/index.js';

function waitForMessage(socket, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3000);
    const onMessage = (buffer) => {
      const message = JSON.parse(buffer.toString());
      if (message.type !== type) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

test('HTTP health and WebSocket join paths work together', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deedz-engine-'));
  const instance = createDeedzServer({ port: 0, host: '127.0.0.1', leaderboardPath: path.join(directory, 'leaderboard.json') });
  const address = await instance.start();
  const port = address.port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const welcomePromise = waitForMessage(socket, 'welcome');
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    await welcomePromise;
    socket.send(JSON.stringify({ type: 'join', payload: { room: 'test', profile: { name: 'Deedz' } } }));
    const joined = await waitForMessage(socket, 'joined');
    assert.equal(joined.payload.room, 'test');
    socket.close();
  } finally {
    await instance.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
