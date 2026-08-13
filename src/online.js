const state = {
  socket: null,
  playerId: null,
  pendingHonks: 0,
  runHonks: 0,
  runStarted: false,
  flushTimer: null,
  lastStateSentAt: 0,
  remotes: new Map(),
  profile: loadProfile()
};

const $ = (id) => document.getElementById(id);

export const gooseOnline = {
  get profile() { return state.profile; },

  async startRun() {
    state.runHonks = 0;
    state.pendingHonks = 0;
    state.runStarted = true;
    try {
      await post('/api/session/start', {});
    } catch (error) {
      setNetworkState(`Online stats unavailable: ${error.message}`);
    }
  },

  honk() {
    if (!state.runStarted) return;
    state.pendingHonks++;
    state.runHonks++;
    scheduleHonkFlush();
  },

  async finishRun(score, completed) {
    if (!state.runStarted) return;
    const finalScore = Math.max(0, Math.floor(Number(score) || 0));
    const finalCompleted = completed === true;
    const finalRunHonks = state.runHonks;
    const finalPlayerName = state.profile.name;
    state.runStarted = false;
    await flushHonks().catch(() => {});
    try {
      await post('/api/score', {
        playerName: finalPlayerName,
        score: finalScore,
        completed: finalCompleted,
        runHonks: finalRunHonks
      });
    } catch (error) {
      setNetworkState(`Score could not be saved: ${error.message}`);
    }
  },

  setProfile(next) {
    state.profile = sanitizeProfile({ ...state.profile, ...next });
    localStorage.setItem('gooseProfile', JSON.stringify(state.profile));
    const input = $('playerName');
    if (input && input.value !== state.profile.name) input.value = state.profile.name;
    send({ type: 'profile', profile: state.profile });
    return state.profile;
  },

  publishPlayer(player, mode = 'play') {
    const now = performance.now();
    if (now - state.lastStateSentAt < 50) return;
    state.lastStateSentAt = now;
    send({
      type: 'player-state',
      state: {
        x: player.x, y: player.y, vx: player.vx, vy: player.vy,
        facing: player.facing, hp: player.hp, score: player.score,
        state: player.state, mode
      }
    });
  },

  action(type, player) {
    send({
      type: 'player-action',
      action: { type, x: player.x, y: player.y, facing: player.facing }
    });
  },

  tickRemotes(dt) {
    const now = performance.now();
    for (const remote of state.remotes.values()) {
      const blend = Math.min(1, dt * 12);
      remote.x += (remote.targetX - remote.x) * blend;
      remote.y += (remote.targetY - remote.y) * blend;
      remote.vx += (remote.targetVx - remote.vx) * blend;
      remote.vy += (remote.targetVy - remote.vy) * blend;
      if (remote.actionUntil && remote.actionUntil < now) remote.action = null;
    }
    return Array.from(state.remotes.values());
  }
};

boot();

async function boot() {
  const nameInput = $('playerName');
  if (nameInput) {
    nameInput.value = state.profile.name;
    nameInput.addEventListener('change', () => {
      gooseOnline.setProfile({ name: nameInput.value });
    });
  }

  try {
    renderSnapshot(await get('/api/snapshot'));
  } catch (error) {
    setNetworkState(`Stats loading failed: ${error.message}`);
  }
  connectSocket();
}

function connectSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws`);
  state.socket = socket;

  socket.addEventListener('open', () => setNetworkState('Live'));
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }

    if (message.type === 'hello') {
      state.playerId = message.playerId;
      send({ type: 'join', profile: state.profile });
      return;
    }
    if (message.type === 'snapshot') renderSnapshot(message);
    if (message.type === 'presence') renderPresence(message.onlinePlayers);
    if (message.type === 'peer-join') upsertRemote(message.playerId, message.profile, message.state);
    if (message.type === 'peer-state') upsertRemote(message.playerId, message.profile, message.state);
    if (message.type === 'peer-action') applyRemoteAction(message.playerId, message.profile, message.action);
    if (message.type === 'peer-leave') state.remotes.delete(message.playerId);
  });
  socket.addEventListener('close', () => {
    if (state.socket === socket) state.socket = null;
    state.remotes.clear();
    setNetworkState('Reconnecting…');
    setTimeout(connectSocket, 2000);
  });
  socket.addEventListener('error', () => socket.close());
}

function upsertRemote(playerId, profile, remoteState) {
  if (!playerId || playerId === state.playerId) return;
  const incoming = remoteState || {};
  let remote = state.remotes.get(playerId);
  if (!remote) {
    remote = {
      id: playerId,
      x: Number(incoming.x) || 120,
      y: Number(incoming.y) || 500,
      targetX: Number(incoming.x) || 120,
      targetY: Number(incoming.y) || 500,
      vx: 0, vy: 0, targetVx: 0, targetVy: 0,
      facing: 1, hp: 6, score: 0, state: 'idle', mode: 'start',
      profile: sanitizeProfile(profile), action: null, actionUntil: 0
    };
    state.remotes.set(playerId, remote);
  }
  remote.profile = sanitizeProfile(profile || remote.profile);
  if (remoteState) {
    remote.targetX = Number.isFinite(Number(incoming.x)) ? Number(incoming.x) : remote.targetX;
    remote.targetY = Number.isFinite(Number(incoming.y)) ? Number(incoming.y) : remote.targetY;
    remote.targetVx = Number(incoming.vx) || 0;
    remote.targetVy = Number(incoming.vy) || 0;
    remote.facing = Number(incoming.facing) < 0 ? -1 : 1;
    remote.hp = Number(incoming.hp) || 0;
    remote.score = Number(incoming.score) || 0;
    remote.state = incoming.state || 'idle';
    remote.mode = incoming.mode || 'start';
  }
}

function applyRemoteAction(playerId, profile, action) {
  if (!playerId || !action) return;
  upsertRemote(playerId, profile, action);
  const remote = state.remotes.get(playerId);
  if (!remote) return;
  remote.action = action.type;
  remote.actionUntil = performance.now() + (action.type === 'honk' ? 380 : 220);
  if (Number.isFinite(Number(action.x))) remote.targetX = Number(action.x);
  if (Number.isFinite(Number(action.y))) remote.targetY = Number(action.y);
  remote.facing = Number(action.facing) < 0 ? -1 : 1;
}

function send(value) {
  if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(value));
}

function scheduleHonkFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    flushHonks().catch(() => {});
  }, 900);
}

async function flushHonks() {
  const count = state.pendingHonks;
  if (!count) return;
  state.pendingHonks = 0;
  try {
    await post('/api/honks', { count });
  } catch (error) {
    state.pendingHonks += count;
    throw error;
  }
}

function renderSnapshot(snapshot) {
  if (!snapshot) return;
  const stats = snapshot.stats || {};
  setText('globalHonks', formatNumber(stats.honks));
  setText('globalPlays', formatNumber(stats.plays));
  setText('globalWins', formatNumber(stats.completions));
  renderPresence(stats.onlinePlayers);

  const list = $('leaderboard');
  if (!list) return;
  const rows = Array.isArray(snapshot.leaderboard) ? snapshot.leaderboard : [];
  list.innerHTML = rows.length
    ? rows.map((row, index) => `
        <li>
          <span class="rank">${index + 1}</span>
          <span class="leader-name">${escapeHtml(row.playerName)}</span>
          <strong>${formatNumber(row.score)}</strong>
          ${row.completed ? '<span class="win-badge">WIN</span>' : ''}
        </li>`).join('')
    : '<li class="empty-score">No scores yet. Be the first goose on the board.</li>';
}

function renderPresence(value) {
  setText('onlinePlayers', formatNumber(value));
}

function setNetworkState(value) {
  setText('networkState', value);
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('gooseProfile') || '{}');
    return sanitizeProfile(saved);
  } catch {
    return sanitizeProfile({});
  }
}

function sanitizeProfile(value = {}) {
  const allowedColors = new Set(['#dc2626', '#ec4899', '#eab308', '#2563eb', '#16a34a', '#7c3aed', '#f97316', '#f8fafc']);
  const name = String(value.name || 'Deedz')
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .slice(0, 24) || 'Anonymous Goose';
  const color = allowedColors.has(value.color) ? value.color : '#dc2626';
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(value.accent || '')) ? value.accent : '#facc15';
  return { name, color, accent };
}

async function get(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function post(path, value) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value ?? '—';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
