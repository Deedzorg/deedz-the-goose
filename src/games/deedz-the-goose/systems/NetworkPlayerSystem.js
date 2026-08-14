import { distance } from '../../../shared/math.js';
import { RemoteGoose } from '../entities/RemoteGoose.js';

export class NetworkPlayerSystem {
  constructor(engine, parent) {
    this.engine = engine;
    this.parent = parent;
    this.remotes = new Map();
    this.unsubscribers = [
      engine.events.on('net:joined', ({ peers = [] }) => {
        for (const peer of peers) this.#ensure(peer.id, peer.profile, peer.state);
        this.#announceCount();
      }),
      engine.events.on('net:peer-join', (peer) => {
        this.#ensure(peer.id, peer.profile, peer.state);
        engine.ui.toast(`${peer.profile?.name || 'A goose'} joined the flock!`, { type: 'success', duration: 2200 });
        this.#announceCount();
      }),
      engine.events.on('net:state', (state) => {
        const remote = this.#ensure(state.id, engine.network.peers.get(state.id)?.profile, state);
        remote?.applyState(state);
      }),
      engine.events.on('net:peer-leave', ({ id }) => {
        const name = this.remotes.get(id)?.profile?.name;
        this.#remove(id);
        if (name) engine.ui.toast(`${name} left the flock.`, { duration: 1800 });
        this.#announceCount();
      }),
    ];
    for (const peer of engine.network.peers.values()) this.#ensure(peer.id, peer.profile, peer.state);
    this.#announceCount();
  }

  #ensure(id, profile = {}, state = null) {
    if (!id || id === this.engine.network.clientId) return null;
    let remote = this.remotes.get(id);
    if (!remote) {
      remote = new RemoteGoose({ id, profile, state });
      this.remotes.set(id, remote);
      this.engine.entities.add(remote, this.parent);
    } else remote.applyProfile(profile);
    return remote;
  }

  get(id) { return this.remotes.get(id) ?? null; }
  all() { return [...this.remotes.values()]; }

  nearest(x, y, maxDistance = Infinity) {
    let nearest = null;
    let nearestDistance = maxDistance;
    for (const remote of this.remotes.values()) {
      const currentDistance = distance(x, y, remote.x, remote.y);
      if (currentDistance <= nearestDistance) {
        nearest = remote;
        nearestDistance = currentDistance;
      }
    }
    return nearest;
  }

  #announceCount() {
    this.engine.events.emit('multiplayer:count', { count: this.remotes.size + 1, remotes: this.remotes.size });
  }

  #remove(id) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    this.engine.entities.remove(remote);
    this.remotes.delete(id);
  }

  destroy() {
    this.unsubscribers.forEach((off) => off());
    for (const remote of this.remotes.values()) this.engine.entities.remove(remote);
    this.remotes.clear();
  }
}
