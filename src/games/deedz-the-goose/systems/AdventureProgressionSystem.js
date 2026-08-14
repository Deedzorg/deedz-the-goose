import { evolutionGoal } from '../data/evolutions.js';
import { BREADSTORM_ENCOUNTER, bossTargetForLevel, nextEchoPreview } from '../data/progression.js';
import { progressionDirective } from '../data/progressionDirective.js';
import { gooseClasses, gooseUnlockProgressFromSave, isGooseClassUnlocked } from '../data/characters.js';

export { bossTargetForLevel } from '../data/progression.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function adventureScore({ level = 1, xp = 0, crumbs = 0, enemies = 0, collectibles = 0 } = {}) {
  return Math.max(0,
    (Math.max(1, Number(level) || 1) - 1) * 1500
    + Math.max(0, Number(xp) || 0) * 2
    + Math.max(0, Number(crumbs) || 0) * 4
    + Math.max(0, Number(enemies) || 0) * 75
    + Math.max(0, Number(collectibles) || 0) * 35,
  );
}

export function nextAdventureDirective(options = {}) {
  return progressionDirective(options);
}

export class AdventureProgressionSystem {
  constructor(engine) {
    this.engine = engine;
    this.lastState = null;
    this.renderQueued = false;
    this.bossChargeTimer = null;
    this.originalSendState = engine.network.sendState;
    this.sendStateWrapper = (state, intervalMs) => this.originalSendState.call(engine.network, { ...state, ...this.#networkFields() }, intervalMs);
    engine.network.sendState = this.sendStateWrapper;

    this.unsubscribers = [
      engine.events.on('mission:started', () => this.#onMissionStarted(), { priority: -500 }),
      engine.events.on('evolution:changed', (state) => this.#onEvolution(state), { priority: -500 }),
      engine.events.on('evolution:advanced', ({ state }) => this.#onAdvanced(state), { priority: -500 }),
      engine.events.on('objective:changed', () => this.#queueRender(), { priority: -500 }),
      engine.events.on('crystal:activated', (event) => this.#onCrystalActivated(event), { priority: -500 }),
      engine.events.on('net:state', () => this.#queueRender(), { priority: -500 }),
      engine.events.on('net:joined', () => this.#onNetworkState(), { priority: -500 }),
      engine.events.on('net:world-event', () => this.#onNetworkState(), { priority: -500 }),
      engine.events.on('net:peer-join', () => this.#queueRender(), { priority: -500 }),
      engine.events.on('net:peer-leave', () => this.#queueRender(), { priority: -500 }),
      engine.events.on('scene:pushed', ({ id }) => { if (id === 'pause') this.#queueRender(); }, { priority: -500 }),
      engine.events.on('scene:changed', ({ id }) => { if (id === 'main-menu') this.#queueRender(); }, { priority: -500 }),
    ];
  }

  #world() { return this.engine.scenes?.get?.('world') ?? null; }

  #state() {
    const worldState = this.#world()?.evolution?.snapshot?.();
    if (worldState) return worldState;
    if (this.lastState) return this.lastState;
    const saved = this.engine.save.get('progress.evolution', {});
    const level = Math.max(1, Number(saved.level) || 1);
    return {
      level,
      xp: Math.max(0, Number(saved.xp) || 0),
      goal: evolutionGoal(level),
      bossWins: Math.max(0, Number(saved.bossWins) || 0),
      shared: {},
    };
  }

  #scoreSnapshot(state = this.#state()) {
    return {
      level: state.level,
      xp: state.xp,
      crumbs: this.engine.save.get('progress.crumbs', 0),
      enemies: this.engine.save.get('progress.enemies', 0),
      collectibles: this.engine.save.get('progress.collectibles', 0),
    };
  }

  #networkFields() {
    const state = this.#state();
    return {
      score: adventureScore(this.#scoreSnapshot(state)),
      echoXp: Math.max(0, Number(state.xp) || 0),
      bossWins: Math.max(0, Number(state.bossWins) || 0),
    };
  }

  #savedCrystalIds() {
    const value = this.engine.save.get('progress.activatedCrystals', []);
    return [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || '').trim()).filter(Boolean))];
  }

  #onMissionStarted() {
    this.#restoreCrystals();
    const state = this.#state();
    this.#enforceExitLock(state);
    this.#updateRecords(state);
    this.#maybeChargeBoss(state);
    const message = bossTargetForLevel(state.level) === 0
      ? 'Adventure progress saves automatically. Awaken crystals, earn Echo XP, then evolve at the gate. Breadstorm arrives in Echo Layer 2.'
      : `Adventure progress saves automatically. Charge the Echo, defeat Breadstorm in ${BREADSTORM_ENCOUNTER.zone}, then evolve at the gate.`;
    this.engine.ui.toast(message, { type: 'success', duration: 5200 });
    this.#queueRender();
  }

  #onEvolution(state = {}) {
    this.lastState = state;
    this.#enforceExitLock(state);
    this.#updateRecords(state);
    this.#maybeChargeBoss(state);
    this.#queueRender();
  }

  #onAdvanced(state = {}) {
    this.lastState = state;
    this.engine.save.set('progress.evolution', {
      level: Math.max(1, Number(state.level) || 1),
      xp: Math.max(0, Number(state.xp) || 0),
      cycle: Math.max(0, Number(state.cycle) || 0),
      seed: Number(state.seed) || 1337,
      bossWins: Math.max(0, Number(state.bossWins) || 0),
    }, { immediate: true });
    this.#updateRecords(state);
    this.#enforceExitLock(state);
    this.#queueRender();
  }

  #onCrystalActivated({ crystal } = {}) {
    const id = String(crystal?.crystalId || '').trim();
    if (!id) return;
    const ids = this.#savedCrystalIds();
    if (!ids.includes(id)) {
      ids.push(id);
      this.engine.save.set('progress.activatedCrystals', ids, { immediate: true });
    }
    this.#queueRender();
  }

  #restoreCrystals() {
    for (const id of this.#savedCrystalIds()) {
      this.engine.entities.get(`crystal-${id}`)?.activate?.(this.engine, { synced: true, persisted: true });
    }
  }

  #onNetworkState() {
    this.#maybeChargeBoss(this.#state());
    this.#queueRender();
  }

  #maybeChargeBoss(state = this.#state()) {
    if (this.bossChargeTimer) return;
    const world = this.#world();
    const evolution = world?.evolution;
    if (!evolution) return;
    const required = world.level?.requiredCrystals ?? 3;
    const prerequisitesReady = this.#activeCrystals() >= required && Number(state.xp) >= Number(state.goal ?? evolutionGoal(state.level));
    const bossRequired = Number(state.bossWins) < bossTargetForLevel(state.level);
    if (!prerequisitesReady || !bossRequired || state.shared?.boss?.active) return;
    const energy = Math.max(0, Number(state.shared?.flockEnergy) || 0);
    const goal = Math.max(1, Number(state.shared?.flockGoal) || 180);
    if (energy >= goal) return;
    this.bossChargeTimer = setTimeout(() => {
      this.bossChargeTimer = null;
      const latest = this.#state();
      const missing = Math.max(0, Number(latest.shared?.flockGoal) - Number(latest.shared?.flockEnergy));
      if (missing > 0) evolution.contributeFlockEnergy(Math.min(30, missing), 'Echo Gate surge');
    }, 160);
  }

  #activeCrystals() {
    return this.engine.entities.findByTag('crystal').filter((crystal) => crystal.activated).length;
  }

  #enforceExitLock(state = this.#state()) {
    const world = this.#world();
    if (!world?.levelExit) return;
    const required = world.level?.requiredCrystals ?? 3;
    const crystals = this.#activeCrystals();
    const xpReady = Number(state.xp) >= Number(state.goal ?? evolutionGoal(state.level));
    const bossRequired = Number(state.bossWins) < bossTargetForLevel(state.level);
    const bossReady = !bossRequired;
    world.levelExit.setLocked(crystals < required || !xpReady || !bossReady);
  }

  #updateRecords(state = this.#state()) {
    const snapshot = this.#scoreSnapshot(state);
    const score = adventureScore(snapshot);
    const previous = this.engine.save.get('progress.records', {});
    const next = {
      ...previous,
      bestScore: Math.max(Number(previous.bestScore) || 0, score),
      highestLayer: Math.max(Number(previous.highestLayer) || 1, Number(snapshot.level) || 1),
      mostCrumbs: Math.max(Number(previous.mostCrumbs) || 0, Number(snapshot.crumbs) || 0),
      mostFoxes: Math.max(Number(previous.mostFoxes) || 0, Number(snapshot.enemies) || 0),
    };
    if (JSON.stringify(previous) !== JSON.stringify(next)) this.engine.save.set('progress.records', next);
    return next;
  }

  #liveLeaderboard(state = this.#state()) {
    const localScore = adventureScore(this.#scoreSnapshot(state));
    const rows = [{
      id: this.engine.network.clientId ?? 'local',
      name: this.engine.save.get('profile.name', 'Deedz'),
      score: localScore,
      level: Math.max(1, Number(state.level) || 1),
      local: true,
    }];
    for (const peer of this.engine.network.peers.values()) {
      const peerState = peer.state ?? {};
      const level = Math.max(1, Number(peerState.evolutionLevel) || 1);
      const echoXp = Math.max(0, Number(peerState.echoXp) || 0);
      const reported = Number(peerState.score);
      rows.push({
        id: peer.id,
        name: peer.profile?.name || 'Anonymous Goose',
        score: Number.isFinite(reported) ? Math.max(0, reported) : (level - 1) * 1500 + echoXp * 2,
        level,
        local: false,
      });
    }
    rows.sort((a, b) => b.score - a.score || b.level - a.level || String(a.name).localeCompare(String(b.name)));
    return rows;
  }

  #renderWorld(state = this.#state()) {
    const world = this.#world();
    const adventure = document.querySelector?.('[data-adventure]');
    if (!world || !adventure) return;
    const required = world.level?.requiredCrystals ?? 3;
    const activeCrystals = this.#activeCrystals();
    const directive = nextAdventureDirective({
      activeCrystals,
      requiredCrystals: required,
      level: state.level,
      xp: state.xp,
      xpGoal: state.goal ?? evolutionGoal(state.level),
      bossWins: state.bossWins,
      bossTarget: bossTargetForLevel(state.level),
      flockEnergy: state.shared?.flockEnergy,
      flockGoal: state.shared?.flockGoal,
      boss: state.shared?.boss,
    });

    const hud = adventure.closest('.deedz-hud');
    hud?.classList.add('deedz-hud--progression');
    adventure.textContent = `${directive.title} — ${directive.detail}`;

    const evolution = document.querySelector?.('[data-evolution]');
    if (evolution) evolution.textContent = `Echo ${state.level} · ${state.stage?.name || 'Living World'} · ${state.xp}/${state.goal ?? evolutionGoal(state.level)} XP`;

    const bossTarget = bossTargetForLevel(state.level);
    const bossRequired = Number(state.bossWins) < bossTarget;
    const flock = document.querySelector?.('[data-flock]');
    if (flock) {
      flock.hidden = !bossRequired;
      flock.textContent = `Boss Charge ${state.shared?.flockEnergy ?? 0}/${state.shared?.flockGoal ?? 180}`;
    }
    const boss = document.querySelector?.('[data-boss]');
    if (boss) boss.hidden = !bossRequired;

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
      rank.textContent = `Room Rank #${localIndex + 1}/${board.length} · ${board[localIndex]?.score ?? 0} pts`;
    }
    this.#enforceExitLock(state);
  }

  #renderPauseRecords(state = this.#state()) {
    const target = document.querySelector?.('[data-tab-panel="records"]');
    if (!target) return;
    const board = this.#liveLeaderboard(state);
    const records = this.#updateRecords(state);
    const next = nextEchoPreview(state.level);
    target.innerHTML = `
      <div class="deedz-records-grid">
        <section class="deedz-record-card">
          <div class="deedz-section-title">Live Room Leaderboard</div>
          <ol class="deedz-leaderboard">${board.slice(0, 5).map((row, index) => `<li class="${row.local ? 'is-you' : ''}"><strong>#${index + 1} ${escapeHtml(row.name)}</strong><span>${row.score} pts · Echo ${row.level}</span></li>`).join('')}</ol>
        </section>
        <section class="deedz-record-card">
          <div class="deedz-section-title">Persistent Personal Records</div>
          <div class="deedz-record-stats"><span>Best score <strong>${records.bestScore || 0}</strong></span><span>Highest Echo <strong>${records.highestLayer || 1}</strong></span><span>Most crumbs <strong>${records.mostCrumbs || 0}</strong></span><span>Enemies defeated <strong>${records.mostFoxes || 0}</strong></span></div>
        </section>
      </div>
      <section class="deedz-next-echo-card">
        <div class="deedz-kicker">WHAT'S NEXT</div>
        <strong>Echo Layer ${next.level} · ${next.name}</strong>
        <p>${next.description}</p>
        <small>Awakened crystals, Echo Layer, XP, checkpoints, class, color, and personal records save automatically on this browser.</small>
      </section>`;
  }

  #renderMainMenu(state = this.#state()) {
    const panel = document.querySelector?.('.deedz-launch-panel');
    if (!panel) return;
    const records = this.#updateRecords(state);
    const score = adventureScore(this.#scoreSnapshot(state));
    const unlockProgress = gooseUnlockProgressFromSave(this.engine.save);
    const unlockedGeese = gooseClasses.filter((character) => isGooseClassUnlocked(character, unlockProgress)).length;
    const progress = panel.querySelector('[data-progress]');
    if (progress) progress.textContent = `Echo Layer ${state.level} · ${state.xp}/${state.goal ?? evolutionGoal(state.level)} XP · Score ${score} · Best ${records.bestScore || 0} · ${unlockedGeese}/${gooseClasses.length} geese unlocked`;
    let card = panel.querySelector('[data-next-echo-card]');
    if (!card) {
      card = document.createElement('section');
      card.className = 'deedz-next-echo-card deedz-next-echo-card--menu';
      card.dataset.nextEchoCard = '';
      panel.querySelector('[data-actions]')?.before(card);
    }
    const next = nextEchoPreview(state.level);
    const route = bossTargetForLevel(state.level) === 0
      ? 'Awaken crystals, earn the displayed Echo XP, then reach Foxfire Gate. Breadstorm makes his first appearance in Echo Layer 2.'
      : `Awaken crystals, earn the displayed Echo XP, defeat Breadstorm in ${BREADSTORM_ENCOUNTER.zone}, then reach Foxfire Gate.`;
    card.innerHTML = `<div><span class="deedz-kicker">KEEP THE ADVENTURE MOVING</span><strong>Next: Echo Layer ${next.level} · ${next.name}</strong></div><p>${route} ${next.description}</p>`;
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
    if (this.bossChargeTimer) clearTimeout(this.bossChargeTimer);
    this.bossChargeTimer = null;
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    if (this.engine.network.sendState === this.sendStateWrapper) this.engine.network.sendState = this.originalSendState;
  }
}
