import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RoomManager } from './rooms/RoomManager.js';
import { DeedzWebSocketServer } from './networking/WebSocketServer.js';
import { LeaderboardStore } from './persistence/LeaderboardStore.js';
import { PostgresRuntime } from './persistence/PostgresRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export function createDeedzServer({
  port = Number(process.env.PORT || 8080),
  host = process.env.HOST || '0.0.0.0',
  production = process.env.NODE_ENV === 'production' || process.argv.includes('--production'),
  leaderboardPath = path.join(__dirname, 'data', 'leaderboard.json'),
  databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));

  const database = new PostgresRuntime(databaseUrl);
  const leaderboard = new LeaderboardStore(leaderboardPath, { database });
  const rooms = new RoomManager({ maxRoomSize: 64 });
  const startedAt = Date.now();

  app.get('/api/health', (_req, res) => res.json({
    ok: true,
    service: 'deedz-engine-server',
    version: '1.6.2',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    rooms: rooms.stats(),
    globalPersistence: database.enabled ? 'postgres' : 'local-fallback',
    crossInstanceBackplane: database.enabled,
    time: new Date().toISOString(),
  }));

  app.get('/api/leaderboard', async (req, res, next) => {
    try { res.json({ entries: await leaderboard.top(req.query.limit) }); }
    catch (error) { next(error); }
  });

  let sockets;
  app.post('/api/leaderboard', async (req, res, next) => {
    try {
      const entry = await leaderboard.submit(req.body);
      const entries = await leaderboard.top(20);
      await sockets?.broadcastLeaderboard(entries);
      res.status(201).json({ entry, entries });
    } catch (error) { next(error); }
  });

  app.use('/api/*splat', (_req, res) => res.status(404).json({ error: 'API route not found' }));

  if (production) {
    const dist = path.join(projectRoot, 'dist');
    app.use(express.static(dist, { maxAge: '1h', etag: true, immutable: false }));
    app.get('*splat', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.json({ service: 'deedz-engine-server', development: true, client: 'http://localhost:5173' }));
  }
  app.use((error, _req, res, _next) => {
    const isSyntaxError = error instanceof SyntaxError && 'body' in error;
    if (!isSyntaxError) console.error('[HTTP]', error);
    res.status(isSyntaxError ? 400 : 500).json({ error: isSyntaxError ? 'Invalid JSON body' : 'Internal server error' });
  });

  const server = createServer(app);
  sockets = new DeedzWebSocketServer({ server, rooms, leaderboard, backplane: database });
  let closing = false;

  const start = async () => {
    await database.init();
    await leaderboard.load();
    await database.subscribe((event) => sockets.handleBackplane(event));
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        const address = server.address();
        console.log(`[Deedz Engine] Server listening on http://${host}:${typeof address === 'object' ? address.port : port}`);
        console.log(`[Deedz Engine] Global persistence: ${database.enabled ? 'Postgres + LISTEN/NOTIFY' : 'local fallback (development only)'}`);
        resolve(address);
      });
    });
  };

  const stop = async () => {
    if (closing) return;
    closing = true;
    await sockets.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await database.close();
  };

  return { app, server, sockets, rooms, leaderboard, database, start, stop };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const deedzServer = createDeedzServer();
  try {
    await deedzServer.start();
  } catch (error) {
    console.error(`[Deedz Engine] Server failed to start: ${error.message}`);
    process.exit(1);
  }
  const shutdown = async (signal) => {
    console.log(`[Deedz Engine] ${signal} received; shutting down.`);
    const forceTimer = setTimeout(() => process.exit(1), 5000);
    forceTimer.unref();
    await deedzServer.stop();
    clearTimeout(forceTimer);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
