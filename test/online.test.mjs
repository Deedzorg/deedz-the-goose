import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const PORT = 34871;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws`;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required for online integration tests');

let child;

test.before(async () => {
  child = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_URL },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer();
});

test.after(async () => {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
});

test('health, readiness, database stats and leaderboard work', async () => {
  const health = await json('/healthz');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);

  const ready = await json('/readyz');
  assert.equal(ready.response.status, 200);
  assert.equal(ready.body.database, 'ready');

  const before = await json('/api/snapshot');
  await json('/api/session/start', { method: 'POST', body: '{}' });
  await json('/api/honks', { method: 'POST', body: JSON.stringify({ count: 3 }) });

  const playerName = `CI Goose ${Date.now()}`;
  const scored = await json('/api/score', {
    method: 'POST',
    body: JSON.stringify({ playerName, score: 4242, completed: true, runHonks: 3 })
  });
  assert.equal(scored.response.status, 201);

  const after = await json('/api/snapshot');
  assert.ok(after.body.stats.plays >= before.body.stats.plays + 1);
  assert.ok(after.body.stats.honks >= before.body.stats.honks + 3);
  assert.ok(after.body.stats.completions >= before.body.stats.completions + 1);
  assert.ok(after.body.leaderboard.some((row) => row.playerName === playerName && row.score === 4242));
});

test('two WebSocket players synchronize identity, movement, action and leave', async () => {
  const a = await connectPeer();
  a.ws.send(JSON.stringify({ type: 'join', profile: { name: 'Alpha Goose', color: '#dc2626', accent: '#facc15' } }));

  const b = await connectPeer();
  const existingA = await waitForMessage(b.ws, (message) => message.type === 'peer-join' && message.playerId === a.playerId);
  assert.equal(existingA.profile.name, 'Alpha Goose');

  b.ws.send(JSON.stringify({ type: 'join', profile: { name: 'Bravo Goose', color: '#2563eb', accent: '#67e8f9' } }));
  const joinedB = await waitForMessage(a.ws, (message) => message.type === 'peer-join' && message.playerId === b.playerId);
  assert.equal(joinedB.profile.name, 'Bravo Goose');

  a.ws.send(JSON.stringify({
    type: 'player-state',
    state: { x: 777, y: 444, vx: 50, vy: -10, facing: 1, hp: 6, score: 120, state: 'run', mode: 'play' }
  }));
  const moved = await waitForMessage(b.ws, (message) => message.type === 'peer-state' && message.playerId === a.playerId);
  assert.equal(moved.state.x, 777);
  assert.equal(moved.state.y, 444);
  assert.equal(moved.state.mode, 'play');

  a.ws.send(JSON.stringify({
    type: 'player-action',
    action: { type: 'honk', x: 777, y: 444, facing: 1 }
  }));
  const action = await waitForMessage(b.ws, (message) => message.type === 'peer-action' && message.playerId === a.playerId);
  assert.equal(action.action.type, 'honk');

  a.ws.close();
  const left = await waitForMessage(b.ws, (message) => message.type === 'peer-leave' && message.playerId === a.playerId);
  assert.equal(left.playerId, a.playerId);
  b.ws.close();
});

async function connectPeer() {
  const ws = new WebSocket(WS_URL);
  const helloPromise = waitForMessage(ws, (message) => message.type === 'hello');
  await once(ws, 'open');
  const hello = await helloPromise;
  return { ws, playerId: hello.playerId };
}

function waitForMessage(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);
    const onMessage = (raw) => {
      let value;
      try { value = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(value)) return;
      cleanup();
      resolve(value);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };
    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

async function json(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: init.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init.headers,
    ...init
  });
  const body = await response.json();
  return { response, body };
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('server did not become healthy');
}
