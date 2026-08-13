export class SocketClient {
  constructor({ url, reconnect = true, queueLimit = 128 } = {}, events) {
    this.url = url;
    this.reconnect = reconnect;
    this.queueLimit = queueLimit;
    this.events = events;
    this.socket = null;
    this.connected = false;
    this.manualClose = false;
    this.retry = 0;
    this.maxRetryDelay = 10000;
    this.queue = [];
    this.reconnectTimer = null;
    this.generation = 0;
  }

  connect() {
    if (!this.url || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    this.manualClose = false;
    clearTimeout(this.reconnectTimer);
    const generation = ++this.generation;
    this.events.emit('network:status', { status: 'connecting', retry: this.retry });
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (generation !== this.generation) return socket.close();
      this.connected = true;
      this.retry = 0;
      for (const payload of this.queue.splice(0)) socket.send(payload);
      this.events.emit('network:open');
      this.events.emit('network:status', { status: 'online' });
    });

    socket.addEventListener('message', (event) => {
      try { this.events.emit('network:message', JSON.parse(event.data)); }
      catch (error) { this.events.emit('network:error', { error, phase: 'parse' }); }
    });

    socket.addEventListener('error', (error) => this.events.emit('network:error', { error, phase: 'socket' }));
    socket.addEventListener('close', (event) => {
      if (generation !== this.generation) return;
      this.connected = false;
      this.events.emit('network:close', event);
      this.events.emit('network:status', { status: this.manualClose ? 'closed' : 'offline', code: event.code });
      if (this.reconnect && !this.manualClose) this.#scheduleReconnect();
    });
  }

  send(message) {
    const payload = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) { this.socket.send(payload); return true; }
    if (this.queue.length >= this.queueLimit) this.queue.shift();
    this.queue.push(payload);
    return false;
  }

  #scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(500 * 2 ** this.retry++, this.maxRetryDelay) + Math.random() * 300;
    this.events.emit('network:status', { status: 'reconnecting', delay, retry: this.retry });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  close() {
    this.manualClose = true;
    this.generation += 1;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'client shutdown');
    this.socket = null;
    this.connected = false;
    this.queue = [];
  }
}
