import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import pg from 'pg';
import { WebSocketServer } from 'ws';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || '';
const ROOT = resolve('.');
const STARTED_AT = new Date().toISOString();
const INSTANCE_ID = randomUUID();
const RELEASE = process.env.SOURCE_REVISION || process.env.GIT_COMMIT || 'local';
const MAX_BODY = 8 * 1024;
const WS_OPEN = 1;

if (!DATABASE_URL) {
  console.error('[goose] DATABASE_URL is required. Attach a PostgreSQL database before starting Deedz the Goose Online.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 5, connectionTimeoutMillis: 7000 });
await initializeDatabase();

const server = http.createServer(async (req, res) => {
  const requestId = randomUUID();
  setHeaders(res, requestId);
  try {
    await route(req, res, requestId);
  } catch (error) {
    console.error(JSON.stringify({ event: 'request.error', requestId, path: req.url, message: error.message }));
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'internal_error', requestId });
    else res.end();
  }
});

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws) => {
  broadcastPresence();
  sendSnapshot(ws).catch(() => {});
  ws.on('close', () => broadcastPresence());
  ws.on('error', () => {});
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url || '/', 'http://local').pathname;
  if (pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    event: 'goose.online',
    instanceId: INSTANCE_ID,
    release: RELEASE,
    port: PORT,
    startedAt: STARTED_AT
  }));
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => void shutdown(signal));
}

async function initializeDatabase() {
  await pool.query('SELECT 1');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goose_global (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      honks BIGINT NOT NULL DEFAULT 0,
      plays BIGINT NOT NULL DEFAULT 0,
      completions BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO goose_global(id) VALUES(1)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goose_scores (
      id BIGSERIAL PRIMARY KEY,
      player_name VARCHAR(32) NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0),
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      run_honks INTEGER NOT NULL DEFAULT 0 CHECK (run_honks >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS goose_scores_rank_idx ON goose_scores(score DESC, created_at ASC)');
}

async function route(req, res, requestId) {
  const url = new URL(req.url || '/', 'http://local');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, service: 'deedz-the-goose-online', instanceId: INSTANCE_ID });
  }

  if (req.method === 'GET' && url.pathname === '/readyz') {
    try {
      await pool.query('SELECT 1');
      return sendJson(res, 200, { ok: true, database: 'ready', instanceId: INSTANCE_ID });
    } catch {
      return sendJson(res, 503, { ok: false, database: 'unavailable', instanceId: INSTANCE_ID });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      service: 'Deedz the Goose Online',
      instanceId: INSTANCE_ID,
      release: RELEASE,
      startedAt: STARTED_AT,
      onlinePlayers: wss.clients.size
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/snapshot') {
    return sendJson(res, 200, await snapshot());
  }

  if (req.method === 'POST' && url.pathname === '/api/session/start') {
    await readJson(req);
    await pool.query(`UPDATE goose_global SET plays = plays + 1, updated_at = NOW() WHERE id = 1`);
    const state = await snapshot();
    broadcast({ type: 'snapshot', ...state });
    console.log(JSON.stringify({ event: 'game.play_started', requestId, instanceId: INSTANCE_ID }));
    return sendJson(res, 201, { ok: true, ...state });
  }

  if (req.method === 'POST' && url.pathname === '/api/honks') {
    const body = await readJson(req);
    const count = clampInt(body.count, 1, 50, 1);
    await pool.query(`UPDATE goose_global SET honks = honks + $1, updated_at = NOW() WHERE id = 1`, [count]);
    const state = await snapshot();
    broadcast({ type: 'snapshot', ...state });
    return sendJson(res, 201, { ok: true, accepted: count, ...state });
  }

  if (req.method === 'POST' && url.pathname === '/api/score') {
    const body = await readJson(req);
    const playerName = cleanName(body.playerName);
    const score = clampInt(body.score, 0, 10_000_000, 0);
    const runHonks = clampInt(body.runHonks, 0, 100_000, 0);
    const completed = body.completed === true;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO goose_scores(player_name, score, completed, run_honks) VALUES($1,$2,$3,$4)`,
        [playerName, score, completed, runHonks]
      );
      if (completed) {
        await client.query(`UPDATE goose_global SET completions = completions + 1, updated_at = NOW() WHERE id = 1`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    const state = await snapshot();
    broadcast({ type: 'snapshot', ...state });
    console.log(JSON.stringify({ event: 'game.score_recorded', requestId, playerName, score, completed, runHonks }));
    return sendJson(res, 201, { ok: true, ...state });
  }

  if (req.method === 'GET') return serveStatic(url.pathname, res);
  return sendJson(res, 404, { ok: false, error: 'not_found', requestId });
}

async function snapshot() {
  const [globalResult, scoresResult] = await Promise.all([
    pool.query('SELECT honks, plays, completions, updated_at FROM goose_global WHERE id = 1'),
    pool.query(`
      SELECT player_name, score, completed, run_honks, created_at
      FROM goose_scores
      ORDER BY score DESC, created_at ASC
      LIMIT 10
    `)
  ]);

  const global = globalResult.rows[0] || {};
  return {
    stats: {
      honks: Number(global.honks || 0),
      plays: Number(global.plays || 0),
      completions: Number(global.completions || 0),
      onlinePlayers: wss.clients.size,
      updatedAt: global.updated_at || null
    },
    leaderboard: scoresResult.rows.map((row) => ({
      playerName: row.player_name,
      score: Number(row.score),
      completed: Boolean(row.completed),
      runHonks: Number(row.run_honks),
      createdAt: row.created_at
    }))
  };
}

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const allowed = relative === 'index.html' || relative.startsWith('src/') || relative.startsWith('styles/');
  if (!allowed || relative.includes('/.')) return sendText(res, 404, 'Not found');

  const target = resolve(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return sendText(res, 403, 'Forbidden');

  try {
    const info = await stat(target);
    if (!info.isFile()) return sendText(res, 404, 'Not found');
    const data = await readFile(target);
    res.statusCode = 200;
    res.setHeader('Content-Type', mimeType(target));
    res.setHeader('Cache-Control', relative === 'index.html' ? 'no-cache' : 'public, max-age=300');
    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

async function sendSnapshot(ws) {
  if (ws.readyState !== WS_OPEN) return;
  ws.send(JSON.stringify({ type: 'snapshot', ...(await snapshot()) }));
}

function broadcastPresence() {
  broadcast({ type: 'presence', onlinePlayers: wss.clients.size });
}

function broadcast(value) {
  const payload = JSON.stringify(value);
  for (const client of wss.clients) {
    if (client.readyState === WS_OPEN) client.send(payload);
  }
}

function cleanName(value) {
  const name = String(value || 'Anonymous Goose')
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .slice(0, 24);
  return name || 'Anonymous Goose';
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('request_body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid_json');
  }
}

function setHeaders(res, requestId) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Goose-Request-Id', requestId);
}

function sendJson(res, code, value) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function sendText(res, code, value) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(value);
}

function mimeType(path) {
  const ext = extname(path).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  })[ext] || 'application/octet-stream';
}

async function shutdown(signal) {
  console.log(JSON.stringify({ event: 'goose.shutdown', signal, instanceId: INSTANCE_ID }));
  for (const client of wss.clients) client.close(1001, 'server shutdown');
  await new Promise((resolveShutdown) => server.close(resolveShutdown));
  await pool.end().catch(() => {});
  process.exit(0);
}
