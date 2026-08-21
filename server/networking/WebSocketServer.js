import { WebSocket, WebSocketServer as WsServer } from 'ws';

const MAX_MESSAGE_BYTES = 16 * 1024;
const ALLOWED_TYPES = new Set(['join', 'state', 'action', 'world:event', 'leaderboard:request', 'leaderboard:submit', 'ping']);

export class DeedzWebSocketServer {
  constructor({ server, rooms, leaderboard, backplane = null, path = '/ws', heartbeatMs = 30000 }) {
    this.rooms = rooms;
    this.leaderboard = leaderboard;
    this.backplane = backplane?.enabled ? backplane : null;
    this.wss = new WsServer({ server, path, maxPayload: MAX_MESSAGE_BYTES });
    this.wss.on('connection', (socket, request) => this.#onConnection(socket, request));
    this.wss.on('error', (error) => console.error('[WebSocket Server]', error.message));
    this.heartbeat = setInterval(() => this.#heartbeat(), heartbeatMs);
    this.heartbeat.unref?.();
  }

  #send(socket, type, payload = {}) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, payload, sentAt: Date.now() }));
  }

  #broadcastAll(type, payload = {}) {
    const encoded = JSON.stringify({ type, payload, sentAt: Date.now() });
    for (const socket of this.wss.clients) if (socket.readyState === WebSocket.OPEN) socket.send(encoded);
  }

  async broadcastLeaderboard(entries, { publish = true } = {}) {
    this.#broadcastAll('leaderboard:update', { entries });
    if (publish && this.backplane) await this.backplane.publish({ kind: 'leaderboard-update', entries });
  }

  async handleBackplane(event) {
    if (!event || typeof event !== 'object') return;
    if (event.kind === 'leaderboard-update' && Array.isArray(event.entries)) {
      this.#broadcastAll('leaderboard:update', { entries: event.entries });
      return;
    }
    if (event.kind !== 'room-broadcast' || !event.roomId || !event.message) return;
    const room = this.rooms.rooms.get(event.roomId);
    if (!room) return;
    const encoded = JSON.stringify({ ...event.message, sentAt: Date.now() });
    for (const member of room.values()) {
      if ((!event.includeSender && member.id === event.senderId) || member.socket.readyState !== WebSocket.OPEN) continue;
      member.socket.send(encoded);
    }
  }

  async #broadcastRoom(client, message, { includeSender = false } = {}) {
    const roomId = this.rooms.clientRoom.get(client.id);
    this.rooms.broadcastFrom(client, message, { includeSender });
    if (roomId && this.backplane) {
      await this.backplane.publish({ kind: 'room-broadcast', roomId, senderId: client.id, includeSender, message });
    }
  }

  #onConnection(socket, request) {
    const client = {
      id: crypto.randomUUID(), socket, ip: request.socket.remoteAddress,
      messages: 0, windowStartedAt: Date.now(), joined: false,
    };
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    this.#send(socket, 'welcome', { id: client.id });

    socket.on('message', async (buffer) => {
      if (!this.#withinRateLimit(client)) return socket.close(1008, 'rate limit');
      let message;
      try { message = JSON.parse(buffer.toString()); }
      catch { return this.#send(socket, 'error', { message: 'Invalid JSON' }); }
      if (!message || typeof message.type !== 'string' || !ALLOWED_TYPES.has(message.type)) return this.#send(socket, 'error', { message: 'Unsupported message type' });
      try { await this.#handle(client, message); }
      catch (error) {
        console.error('[WebSocket]', error);
        this.#send(socket, 'error', { message: error.message === 'Room is full' ? error.message : 'Server error' });
      }
    });

    socket.on('close', async () => {
      const roomId = this.rooms.clientRoom.get(client.id);
      if (roomId) await this.#broadcastRoom(client, { type: 'peer-leave', payload: { id: client.id } });
      this.rooms.leave(client);
    });
    socket.on('error', (error) => console.warn('[WebSocket] client error:', error.message));
  }

  #withinRateLimit(client) {
    const now = Date.now();
    if (now - client.windowStartedAt > 1000) { client.windowStartedAt = now; client.messages = 0; }
    client.messages += 1;
    return client.messages <= 75;
  }

  async #handle(client, { type, payload = {} }) {
    if (type === 'join') {
      const result = this.rooms.join(client, payload.room, payload.profile);
      client.joined = true;
      this.#send(client.socket, 'joined', { room: result.roomId, peers: result.peers, worldState: result.worldState });
      await this.#broadcastRoom(client, { type: 'peer-join', payload: { id: client.id, profile: result.member.profile } });
      return;
    }
    if (type !== 'ping' && !client.joined) return this.#send(client.socket, 'error', { message: 'Join a room first' });
    if (type === 'state') {
      const state = this.rooms.updateState(client, payload);
      await this.#broadcastRoom(client, { type: 'state', payload: { id: client.id, ...state } });
    } else if (type === 'action') {
      const action = String(payload.action || '').slice(0, 32);
      const actionPayload = {
        id: client.id, action,
        x: Math.max(-100000, Math.min(100000, Number(payload.x) || 0)),
        y: Math.max(-100000, Math.min(100000, Number(payload.y) || 0)),
        facing: payload.facing === -1 ? -1 : 1,
        targetId: String(payload.targetId || '').slice(0, 64),
        strength: Math.max(0, Math.min(1200, Number(payload.strength) || 0)),
        range: Math.max(0, Math.min(500, Number(payload.range) || 0)),
        lift: Math.max(0, Math.min(400, Number(payload.lift) || 0)),
        duration: Math.max(0.6, Math.min(3.5, Number(payload.duration) || 2.2)),
        charge: Math.max(0, Math.min(1, Number(payload.charge) || 0)),
        damage: Math.max(1, Math.min(3, Number(payload.damage) || 1)),
      };
      await this.#broadcastRoom(client, { type: 'action', payload: actionPayload });
    } else if (type === 'world:event') {
      const event = this.rooms.applyWorldEvent(client, payload);
      const includeSender = ['flock-energy', 'boss-hit'].includes(event.event);
      await this.#broadcastRoom(client, { type: 'world:event', payload: { id: client.id, ...event } }, { includeSender });
    } else if (type === 'leaderboard:request') {
      this.#send(client.socket, 'leaderboard:update', { entries: await this.leaderboard.top(payload.limit) });
    } else if (type === 'leaderboard:submit') {
      await this.leaderboard.submit(payload);
      await this.broadcastLeaderboard(await this.leaderboard.top(20));
    } else if (type === 'ping') {
      this.#send(client.socket, 'pong', { echo: payload, serverTime: Date.now() });
    }
  }

  #heartbeat() {
    for (const socket of this.wss.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (socket.isAlive === false) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }

  close() {
    clearInterval(this.heartbeat);
    for (const socket of this.wss.clients) socket.close(1001, 'server shutdown');
    return new Promise((resolve) => {
      const timer = setTimeout(() => { for (const socket of this.wss.clients) socket.terminate(); resolve(); }, 1000);
      this.wss.close(() => { clearTimeout(timer); resolve(); });
    });
  }
}
