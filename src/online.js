const state = {
  socket: null,
  pendingHonks: 0,
  runHonks: 0,
  runStarted: false,
  flushTimer: null
};

const $ = (id) => document.getElementById(id);

export const gooseOnline = {
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
    state.runStarted = false;
    await flushHonks().catch(() => {});
    try {
      await post('/api/score', {
        playerName: playerName(),
        score: Math.max(0, Math.floor(Number(score) || 0)),
        completed: completed === true,
        runHonks: state.runHonks
      });
    } catch (error) {
      setNetworkState(`Score could not be saved: ${error.message}`);
    }
  }
};

boot();

async function boot() {
  const nameInput = $('playerName');
  if (nameInput) {
    nameInput.value = localStorage.getItem('goosePlayerName') || 'Deedz';
    nameInput.addEventListener('change', () => {
      localStorage.setItem('goosePlayerName', playerName());
      nameInput.value = playerName();
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
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'snapshot') renderSnapshot(message);
      if (message.type === 'presence') renderPresence(message.onlinePlayers);
    } catch {}
  });
  socket.addEventListener('close', () => {
    setNetworkState('Reconnecting…');
    setTimeout(connectSocket, 2500);
  });
  socket.addEventListener('error', () => socket.close());
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

function playerName() {
  const value = String($('playerName')?.value || localStorage.getItem('goosePlayerName') || 'Anonymous Goose')
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .slice(0, 24);
  return value || 'Anonymous Goose';
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
