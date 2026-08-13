export class EventBus {
  #listeners = new Map();

  on(eventName, listener, options = {}) {
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function');
    const listeners = this.#listeners.get(eventName) ?? new Set();
    const entry = {
      listener,
      once: Boolean(options.once),
      priority: Number(options.priority) || 0,
      signal: options.signal ?? null,
    };
    listeners.add(entry);
    this.#listeners.set(eventName, listeners);

    const unsubscribe = () => {
      const removed = listeners.delete(entry);
      if (listeners.size === 0) this.#listeners.delete(eventName);
      entry.signal?.removeEventListener?.('abort', unsubscribe);
      return removed;
    };

    if (entry.signal) {
      if (entry.signal.aborted) unsubscribe();
      else entry.signal.addEventListener('abort', unsubscribe, { once: true });
    }
    return unsubscribe;
  }

  once(eventName, listener, options = {}) {
    return this.on(eventName, listener, { ...options, once: true });
  }

  off(eventName, listener) {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) return false;
    for (const entry of listeners) {
      if (entry.listener === listener) {
        listeners.delete(entry);
        if (listeners.size === 0) this.#listeners.delete(eventName);
        return true;
      }
    }
    return false;
  }

  emit(eventName, payload) {
    const direct = [...(this.#listeners.get(eventName) ?? [])];
    const wildcard = [...(this.#listeners.get('*') ?? [])];
    const entries = [...direct, ...wildcard].sort((a, b) => b.priority - a.priority);
    let count = 0;
    for (const entry of entries) {
      try {
        entry.listener(wildcard.includes(entry) ? { eventName, payload } : payload);
        count += 1;
      } catch (error) {
        if (eventName !== 'engine:error') {
          console.error(`[EventBus] Listener failed for "${eventName}"`, error);
          this.emit('engine:error', { source: 'event-bus', eventName, error });
        }
      }
      if (entry.once) this.off(eventName, entry.listener) || this.off('*', entry.listener);
    }
    return count;
  }

  async emitAsync(eventName, payload) {
    const entries = [...(this.#listeners.get(eventName) ?? [])].sort((a, b) => b.priority - a.priority);
    const results = [];
    for (const entry of entries) {
      results.push(await entry.listener(payload));
      if (entry.once) this.off(eventName, entry.listener);
    }
    return results;
  }

  listenerCount(eventName) { return this.#listeners.get(eventName)?.size ?? 0; }

  clear(eventName) {
    if (eventName) this.#listeners.delete(eventName);
    else this.#listeners.clear();
  }

  destroy() { this.clear(); }
}
