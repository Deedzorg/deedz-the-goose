import { SocketClient } from './SocketClient.js';
import { NetEvents } from './NetEvents.js';

export function localNetworkEventName(type = '') {
  return type === NetEvents.WORLD_EVENT ? 'net:world-event' : `net:${type}`;
}

export class NetworkManager {
  constructor(config, events) {
    this.config = config;
    this.events = events;
    this.client = null;
    this.clientId = null;
    this.room = config.room;
    this.profile = {};
    this.peers = new Map();
    this.lastStateSentAt = 0;
    this.lastPingAt = 0;
    this.latency = null;
    this.status = config.enabled ? 'idle' : 'disabled';
    this.worldState = { activatedCrystals: [], defeatedEnemies: [], flockEnergy: 0, flockGoal: 180, bossWins: 0, boss: null };
    this.unsubscribers = [];
    this._boundOnMessage = this.#onMessage.bind(this);
  }

  initialize(profile = {}) {
    this.profile = structuredClone(profile ?? {});
    if (!this.config.enabled) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultUrl = `${protocol}//${location.host}/ws`;
    this.client = new SocketClient({ ...this.config, url: this.config.url || defaultUrl }, this.events);
    this.unsubscribers = [
      this.events.on(NetEvents.MESSAGE, this._boundOnMessage),
      this.events.on(NetEvents.OPEN, () => this.join(this.room, this.profile)),
      this.events.on(NetEvents.STATUS, ({ status }) => { this.status = status; }),
    ];
    this.client.connect();
  }

  setProfile(profile, { rejoin = true } = {}) {
    this.profile = structuredClone(profile ?? {});
    if (rejoin && this.client?.connected) this.join(this.room, this.profile);
  }

  join(room = this.room, profile = this.profile) {
    this.room = String(room || this.config.room);
    this.profile = structuredClone(profile ?? {});
    this.send(NetEvents.JOIN, { room: this.room, profile: this.profile });
  }

  send(type, payload = {}) { return this.client?.send({ type, payload, sentAt: Date.now() }) ?? false; }

  sendState(state, intervalMs = this.config.stateIntervalMs) {
    const now = performance.now();
    if (now - this.lastStateSentAt < intervalMs) return false;
    this.lastStateSentAt = now;
    return this.send(NetEvents.STATE, state);
  }

  sendAction(action, data = {}) { return this.send(NetEvents.ACTION, { action, ...data }); }

  sendWorldEvent(event, data = {}) { return this.send(NetEvents.WORLD_EVENT, { event, ...data }); }

  update() {
    if (!this.client?.connected) return;
    const now = performance.now();
    if (now - this.lastPingAt >= this.config.pingIntervalMs) {
      this.lastPingAt = now;
      this.send(NetEvents.PING, { clientTime: Date.now() });
    }
  }

  #onMessage(message) {
    const { type, payload } = message ?? {};
    if (!type) return;
    if (type === NetEvents.WELCOME) this.clientId = payload.id;
    if (type === NetEvents.JOINED) {
      this.room = payload.room;
      this.peers.clear();
      for (const peer of payload.peers ?? []) this.peers.set(peer.id, peer);
      this.worldState = payload.worldState ?? { activatedCrystals: [], defeatedEnemies: [], flockEnergy: 0, flockGoal: 180, bossWins: 0, boss: null };
    }
    if (type === NetEvents.PEER_JOIN) this.peers.set(payload.id, payload);
    if (type === NetEvents.PEER_LEAVE) this.peers.delete(payload.id);
    if (type === NetEvents.STATE && payload.id) {
      const peer = this.peers.get(payload.id) ?? { id: payload.id };
      this.peers.set(payload.id, { ...peer, state: payload });
    }
    if (type === NetEvents.PONG && payload.echo?.clientTime) this.latency = Math.max(0, Date.now() - payload.echo.clientTime);
    this.events.emit(localNetworkEventName(type), payload);
  }

  destroy() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.client?.close();
    this.client = null;
    this.peers.clear();
    this.status = 'closed';
  }
}
