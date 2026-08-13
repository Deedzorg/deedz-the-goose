import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RoomManager } from './rooms/RoomManager.js';
import { DeedzWebSocketServer } from './networking/WebSocketServer.js';
import { LeaderboardStore } from './persistence/LeaderboardStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export function createDeedzServer({
  port = Number(process.env.PORT || 8080),
  host = process.env.HOST || '0.0.0.0',
  production = process.env.NODE_ENV === 'production' || process.argv.includes('--production'),
  leaderboardPath = path.join(__dirname, 'data', 'leaderboard.json'),
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

  const leaderboard = new LeaderboardStore(leaderboardPath);
  const rooms = new RoomManager({ maxRoomSize: 64 });
  const startedAt = Date.now();

  app.get('/api/health', (_req, res) => res.json({
    ok: true,
    service: 'deedz-engine-server',
    version: '1.6.1',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    rooms: rooms.stats(),
    time: new Date().toISOString(),
  }));

  app.get('/api/leaderboard', async (req, res, next) => {
    try { res.json({ entries: await leaderboard.top(req.query.limit) }); }
    catch (error) { next(error); }
  });

  app.post('/api/leaderboard', async (req, res, next) => {
    try {
      const entry = await leaderboard.submit(req.body);
      res.status(201).json({ entry, entries: await leaderboard.top(20) });
    } catch (error) { next(error); }
  });

  // API misses must be handled before the production SPA fallback, otherwise
  // an unknown /api route would incorrectly return index.html with a 200 status.
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
  const sockets = new DeedzWebSocketServer({ server, rooms, leaderboard });
  let closing = false;

  const start = () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      console.log(`[Deedz Engine] Server listening on http://${host}:${typeof address === 'object' ? address.port : port}`);
      resolve(address);
    });
  });

  const stop = async () => {
    if (closing) return;
    closing = true;
    await sockets.close();
    await new Promise((resolve) => server.close(resolve));
  };

  return { app, server, sockets, rooms, leaderboard, start, stop };
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
