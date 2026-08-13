import { flockScore, nextEchoPreview } from '../data/progression.js';
import { progressionDirective } from '../data/progressionDirective.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export class ProgressionDirectorSystem {
  constructor(engine) {
    this.engine = engine;
    this.lastState = null;
    this.renderQueued = false;
    this.echoReadyHintedLevel = null;
    this.originalSendState = engine.network.sendState;
    this.sendStateWrapper = (state, intervalMs) => this.originalSendState.call(engine.network, { ...state, ...this.#networkFields() }, intervalMs);
    engine.network.sendState = this.sendStateWrapper;
    this.unsubscribers = [
      engine.events.on('mission:started', () => this.#onMissionStarted(), { priority: -200 }),
      engine.events.on('evolution:changed', (state) => this.#onEvolution(state), { priority: -200 }),
      engine.events.on('evolution:advanced', ({ state }) => this.#onAdvanced(state), { priority: -200 }),
      engine.events.on('objective:changed', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('crystal:activated', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('net:state', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('net:joined', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('net:peer-join', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('net:peer-leave', () => this.#queueRender(), { priority: -200 }),
      engine.events.on('scene:pushed', ({ id }) => { if (id === 'pause') this.#queueRender(); }, { priority: -200 }),
      engine.events.on('scene:changed', ({ id }) => { if (id === 'main-menu') this.#queueRender(); }, { priority: -200 }),
    ];
  }

  #world() { return this.engine.scenes?.get?.('world') ?? null; }

  #state() {
    const worldState = this.#world()?.evolution?.snapshot?.();
    if (worldState) return worldState;
    if (this.lastState) return this.lastState;
    const saved = this.engine.save.get('progress.evolution', {});
    return {
      level: Math.max(1, Number(saved.level) || 1),
      xp: Math.max(0, Number(saved.xp) || 0),
      goal: 120,
      bossWins: Math.max(0, Number(saved.bossWins) || 0),
      shared: this.engine.network.worldState ?? {},
    };
  }

  #scoreSnapshot(state = this.#state()) {
    return {
      level: state.level,
      xp: state.xp,
      bossWins: state.bossWins,
      crumbs: this.engine.save.get('progress.crumbs', 0),
      enemies: this.engine.save.get('progress.enemies', 0),
      collectibles: this.engine.save.get('progress.collectibles', 0),
    };
  }

  #networkFields() {
    const state = this.#state();
    return { score: flockScore(this.#scoreSnapshot(state)), bossWins: Number(state.bossWins) || 0, echoXp: Number(state.xp) || 0 };
  }

  #bossTarget(state = this.#state()) {
    let target = Number(this.engine.save.get('progress.bossGateTarget', 0)) || 0;
    if (target < 1) {
      const wins = Math.max(0, Number(state.bossWins) || 0);
      target = wins > 0 ? wins : 1;
      this.engine.save.set('progress.bossGateTarget', target, { immediate: true });
    }
    return target;
  }

  #bossGateComplete(state = this.#state()) {
    return Math.max(0, Number(state.bossWins) || 0) >= this.#bossTarget(state);
  }

  #onMissionStarted() {
    this.#patchEvolutionGate();
    this.#queueRender();
  }

  #onEvolution(state = {}) {
    this.lastState = state;
    this.#updateRecords(state);
    this.#enforceExitLock(state);
    const world = this.#world();
    const activeCrystals = this.#activeCrystals();
    if (state.ready && !this.#bossGateComplete(state) && activeCrystals >= (world?.level?.requiredCrystals ?? 3) && !state.shared?.boss?.active && this.echoReadyHintedLevel !== state.level) {
      this.echoReadyHintedLevel = state.level;
      this.engine.ui.toast('Echo charged. One challenge remains: fill Flock Energy and defeat Baron Breadstorm before the Foxfire Gate will evolve.', { type: 'warning', duration: 5200 });
    }
    this.#queueRender();
  }

  #onAdvanced(state = {}) {
    this.lastState = state;
    const target = Math.max(0, Number(state.bossWins) || 0) + 1;
    this.engine.save.set('progress.bossGateTarget', target, { immediate: true });
    this.echoReadyHintedLevel = null;
    this.#updateRecords(state);
    this.#queueRender();
  }

  #patchEvolutionGate() {
    const evolution = this.#world()?.evolution;
    if (!evolution || evolution.__deedzProgressionGate) return;
    const original = evolution.completeEvolution.bind(evolution);
    evolution.completeEvolution = () => {
      const state = evolution.snapshot();
      if (!this.#bossGateComplete(state)) {
        const shared = state.shared ?? {};
        const message = shared.boss?.active
          ? 'The Foxfire Gate is waiting on Breadstorm. Finish the boss challenge first.'
          : `The Echo is charged, but this layer still needs a Breadstorm victory. Flock Energy ${shared.flockEnergy || 0}/${shared.flockGoal || 180}.`;
        this.engine.ui.toast(message, { type: 'warning', duration: 4200 });
        this.#renderWorld(state);
        return false;
      }
      return original();
    };
    evolution.__deedzProgressionGate = true;
  }

  #activeCrystals() {
    return this.engine.entities.findByTag('crystal').filter((crystal) => crystal.activated).length;
  }

  #enforceExitLock(state = this.#state()) {
    const world = this.#world();
    if (!world?.exit) return;
    const required = world.level?.requiredCrystals ?? 3;
    const crystals = this.#activeCrystals();
    const bossActive = Boolean(state.shared?.boss?.active && !state.shared?.boss?.defeated);
    world.exit.setLocked(crystals < required || Number(state.xp) < Number(state.goal) || bossActive || !this.#bossGateComplete(state));
  }

  #updateRecords(state = this.#state()) {
    const snapshot = this.#scoreSnapshot(state);
    const score = flockScore(snapshot);
    const previous = this.engine.save.get('progress.records', {});
    const next = {
      bestScore: Math.max(Number(previous.bestScore) || 0, score),
      highestLayer: Math.max(Number(previous.highestLayer) || 1, Number(snapshot.level) || 1),
      mostBossWins: Math.max(Number(previous.mostBossWins) || 0, Number(snapshot.bossWins) || 0),
      mostCrumbs: Math.max(Number(previous.mostCrumbs) || 0, Number(snapshot.crumbs) || 0),
    };
    if (JSON.stringify(previous) !== JSON.stringify(next)) this.engine.save.set('progress.records', next);
    return next;
  }

  #liveLeaderboard(state = this.#state()) {
    const localScore = flockScore(this.#scoreSnapshot(state));
    const rows = [{
      id: this.engine.network.clientId ?? 'local',
      name: this.engine.save.get('profile.name', 'Deedz'),
      score: localScore,
      level: Math.max(1, Number(state.level) || 1),
      bossWins: Math.max(0, Number(state.bossWins) || 0),
      local: true,
    }];
    for (const peer of this.engine.network.peers.values()) {
      const peerState = peer.state ?? {};
      const level = Math.max(1, Number(peerState.evolutionLevel) || 1);
      const bossWins = Math.max(0, Number(peerState.bossWins) || 0);
      const echoXp = Math.max(0, Number(peerState.echoXp) || 0);
      const reported = Number(peerState.score);
      rows.push({ id: peer.id, name: peer.profile?.name || 'Anonymous Goose', score: Number.isFinite(reported) ? Math.max(0, reported) : (level - 1) * 1500 + bossWins * 700 + echoXp * 2, level, bossWins, local: false });
    }
    rows.sort((a, b) => b.score - a.score || b.level - a.level || b.bossWins - a.bossWins || String(a.name).localeCompare(String(b.name)));
    return rows;
  }

  #renderWorld(state = this.#state()) {
    const world = this.#world();
    const adventure = document.querySelector?.('[data-adventure]');
    if (!world || !adventure) return;
    const required = world.level?.requiredCrystals ?? 3;
    const activeCrystals = this.#activeCrystals();
    const shared = state.shared ?? {};
    const directive = progressionDirective({
      activeCrystals,
      requiredCrystals: required,
      level: state.level,
      xp: state.xp,
      xpGoal: state.goal,
      bossWins: state.bossWins,
      bossTarget: this.#bossTarget(state),
      flockEnergy: shared.flockEnergy,
      flockGoal: shared.flockGoal,
      boss: shared.boss,
    });
    const hud = adventure.closest('.deedz-hud');
    hud?.classList.add('deedz-hud--progression');
    adventure.textContent = `${directive.title} — ${directive.detail}`;
    const evolution = document.querySelector?.('[data-evolution]');
    if (evolution) evolution.textContent = `Echo ${state.level} · ${state.stage?.name || 'Living World'} · ${state.xp}/${state.goal} XP`;
    const flock = document.querySelector?.('[data-flock]');
    if (flock) flock.textContent = `Breadstorm ${Math.max(0, Number(shared.flockEnergy) || 0)}/${Math.max(1, Number(shared.flockGoal) || 180)}`;
    const boss = document.querySelector?.('[data-boss]');
    if (boss) boss.hidden = !shared.boss?.active || Boolean(shared.boss?.defeated);
    const secondary = hud?.querySelector('.deedz-hud__group--secondary');
    let rank = secondary?.querySelector('[data-flock-rank]');
    if (!rank && secondary) {
      rank = document.createElement('span');
      rank.className = 'deedz-chip deedz-chip--rank';
      rank.dataset.flockRank = '';
      secondary.appendChild(rank);
    }
    if (rank) {
      const board = this.#liveLeaderboard(state);
      const localIndex = Math.max(0, board.findIndex((row) => row.local));
      rank.textContent = `Flock Rank #${localIndex + 1}/${board.length} · ${board[localIndex]?.score ?? 0} pts`;
    }
    this.#enforceExitLock(state);
  }

  #renderPauseRecords(state = this.#state()) {
    const target = document.querySelector?.('[data-tab-panel="records"]');
    if (!target) return;
    const board = this.#liveLeaderboard(state);
    const records = this.#updateRecords(state);
    const next = nextEchoPreview(state.level);
    const nextFlockGoal = Math.min(900, 180 + (Math.max(0, Number(state.shared?.bossWins) || 0) + 1) * 45);
    target.innerHTML = `
      <div class="deedz-records-grid">
        <section class="deedz-record-card">
          <div class="deedz-section-title">Live Flock Leaderboard</div>
          <ol class="deedz-leaderboard">${board.slice(0, 5).map((row, index) => `<li class="${row.local ? 'is-you' : ''}"><strong>#${index + 1} ${escapeHtml(row.name)}</strong><span>${row.score} pts · Echo ${row.level} · ${row.bossWins} crowns</span></li>`).join('')}</ol>
        </section>
        <section class="deedz-record-card">
          <div class="deedz-section-title">Personal Records</div>
          <div class="deedz-record-stats"><span>Best score <strong>${records.bestScore}</strong></span><span>Highest Echo <strong>${records.highestLayer}</strong></span><span>Breadstorm crowns <strong>${records.mostBossWins}</strong></span><span>Most crumbs <strong>${records.mostCrumbs}</strong></span></div>
        </section>
      </div>
      <section class="deedz-next-echo-card">
        <div class="deedz-kicker">WHAT'S NEXT</div>
        <strong>Echo Layer ${next.level} · ${next.name}</strong>
        <p>${next.description}</p>
        <small>Next Echo target: ${next.xpGoal} XP. Breadstorm also grows with every crown; the next shared Flock target can rise toward ${nextFlockGoal}.</small>
      </section>`;
  }

  #renderMainMenu(state = this.#state()) {
    const panel = document.querySelector?.('.deedz-launch-panel');
    if (!panel) return;
    const records = this.#updateRecords(state);
    const score = flockScore(this.#scoreSnapshot(state));
    const progress = panel.querySelector('[data-progress]');
    if (progress) progress.textContent = `Flock Score ${score} · Best ${records.bestScore} · Highest Echo ${records.highestLayer} · ${records.mostBossWins} Breadstorm crowns`;
    let card = panel.querySelector('[data-next-echo-card]');
    if (!card) {
      card = document.createElement('section');
      card.className = 'deedz-next-echo-card deedz-next-echo-card--menu';
      card.dataset.nextEchoCard = '';
      panel.querySelector('[data-actions]')?.before(card);
    }
    const next = nextEchoPreview(state.level);
    card.innerHTML = `<div><span class="deedz-kicker">KEEP THE FLOCK MOVING</span><strong>Next: Echo Layer ${next.level} · ${next.name}</strong></div><p>${next.description} Each layer raises the Echo target and each Breadstorm victory raises the challenge.</p>`;
  }

  #queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      const active = this.engine.scenes?.active?.id;
      const state = this.#state();
      this.#renderWorld(state);
      if (active === 'pause') this.#renderPauseRecords(state);
      if (active === 'main-menu') this.#renderMainMenu(state);
    });
  }

  destroy() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    if (this.engine.network.sendState === this.sendStateWrapper) this.engine.network.sendState = this.originalSendState;
  }
}
