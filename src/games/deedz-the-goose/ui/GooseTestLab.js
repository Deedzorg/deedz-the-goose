import { BREADSTORM_ENCOUNTER, bossTargetForLevel } from '../data/progression.js';
import { enemyArchetypes } from '../data/enemies.js';
import { Enemy } from '../entities/Enemy.js';
import { BreadstormBoss } from '../entities/BreadstormBoss.js';
import { WingBurst } from '../entities/ActionEffects.js';
import {
  breadstormHeartDamage,
  breadstormPhaseShield,
  breadstormPhaseShieldUnlocked,
  breadstormShieldDamage,
  breadstormShieldUnlocked,
  breadstormStats,
} from '../../../../server/shared/bossBalance.js';

export const MAX_TEST_ECHO = 50;

export const GOOSE_LAB_ACTIONS = Object.freeze([
  'previous-echo',
  'load-echo',
  'next-echo',
  'warp-start',
  'warp-boss',
  'warp-gate',
  'heal',
  'add-crumbs',
  'spill-crumbs',
  'toggle-invincible',
  'clear-enemies',
  'clear-spawned',
  'enemy-parade',
  'ready-echo',
  'spawn-encounter',
  'unlock-geese',
]);

export const GOOSE_LAB_ENCOUNTERS = Object.freeze([
  ...Object.values(enemyArchetypes).map((definition) => Object.freeze({
    id: definition.id,
    label: definition.name,
    archetype: definition.id,
    rank: 'scout',
  })),
  Object.freeze({ id: 'toast-captain', label: 'Crowned Toast Captain', archetype: 'brute', rank: 'captain' }),
  Object.freeze({ id: 'breadstorm-first', label: 'Breadstorm: First Form', bossLevel: 2, cycle: 1 }),
  Object.freeze({ id: 'breadstorm-shield', label: 'Breadstorm: Shield Form', bossLevel: 5, cycle: 4 }),
  Object.freeze({ id: 'breadstorm-phases', label: 'Breadstorm: Full Phases', bossLevel: 7, cycle: 6 }),
]);

export function createTestBossState({ level = 2, cycle = Math.max(1, Number(level) - 1) } = {}) {
  const evolutionLevel = Math.max(2, Math.floor(Number(level) || 2));
  const normalizedCycle = Math.max(1, Math.floor(Number(cycle) || 1));
  const { maxHp, maxShield } = breadstormStats({ cycle: normalizedCycle, players: 1, evolutionLevel });
  const shieldEnabled = breadstormShieldUnlocked(evolutionLevel);
  const phaseShieldsEnabled = breadstormPhaseShieldUnlocked(evolutionLevel);
  return {
    id: `goose-lab-breadstorm-${normalizedCycle}`,
    active: true,
    defeated: false,
    hp: maxHp,
    maxHp,
    phase: 1,
    shield: shieldEnabled ? maxShield : 0,
    maxShield: shieldEnabled ? maxShield : 0,
    shieldEnabled,
    phaseShieldsEnabled,
    evolutionLevel,
    players: 1,
    cycle: normalizedCycle,
    spawnedAt: Date.now(),
  };
}

export function applyTestBossHit(state = {}, { damage = 1, hitType = 'attack' } = {}) {
  const next = { ...state };
  let damageApplied = 0;
  let shieldDamage = 0;
  if (!next.active || next.defeated) return { state: next, damageApplied, shieldDamage };
  if (next.shield > 0) {
    if (hitType === 'honk') {
      shieldDamage = Math.min(next.shield, breadstormShieldDamage(damage));
      next.shield = Math.max(0, next.shield - shieldDamage);
    }
  } else {
    damageApplied = Math.min(next.hp, breadstormHeartDamage(damage));
    next.hp = Math.max(0, next.hp - damageApplied);
    const ratio = next.hp / Math.max(1, next.maxHp);
    const nextPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    if (nextPhase > next.phase && next.hp > 0) {
      next.phase = nextPhase;
      next.maxShield = breadstormPhaseShield({
        phase: nextPhase,
        cycle: next.cycle,
        evolutionLevel: next.evolutionLevel,
        phaseShieldsEnabled: next.phaseShieldsEnabled,
      });
      next.shield = next.maxShield;
    }
  }
  if (next.hp <= 0) {
    next.active = false;
    next.defeated = true;
    next.defeatedAt = Date.now();
  }
  return { state: next, damageApplied, shieldDamage };
}

export function normalizeTestEcho(value, fallback = 1) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return Math.max(1, Math.min(MAX_TEST_ECHO, Math.floor(Number(fallback) || 1)));
  return Math.max(1, Math.min(MAX_TEST_ECHO, parsed));
}

export function createTestEvolutionState(current = {}, targetLevel = 1) {
  const level = normalizeTestEcho(targetLevel, current.level);
  return {
    level,
    xp: 0,
    cycle: Math.max(0, level - 1),
    seed: Number(current.seed) || 1337,
    bossWins: Math.max(0, level - 1),
  };
}

export class GooseTestLab {
  constructor(engine) {
    this.engine = engine;
    this.visible = false;
    this.invincible = false;
    this.busy = false;
    this.spawnCounter = 0;
    this.element = document.createElement('aside');
    this.element.className = 'deedz-test-lab';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Goose Lab developer tools');
    this.#build();
    document.querySelector('#ui-root')?.appendChild(this.element);
    this._onClick = (event) => this.#handleClick(event);
    this.element.addEventListener('click', this._onClick);
    this.unsubscribers = [
      engine.events.on('debug:visibility', ({ visible }) => this.setVisible(visible)),
      engine.events.on('scene:changed', () => this.#onSceneChanged()),
      engine.events.on('scene:pushed', () => this.refresh()),
      engine.events.on('scene:popped', () => this.refresh()),
      engine.events.on('evolution:changed', () => this.refresh()),
      engine.events.on('player:health', () => this.refresh()),
      engine.events.on('player:ammo', () => this.refresh()),
    ];
  }

  #build() {
    this.element.innerHTML = `
      <header class="deedz-test-lab__header">
        <div><span class="deedz-kicker">PRIVATE PLAYTEST TOOLS</span><h2>Goose Lab</h2></div>
        <button type="button" class="deedz-test-lab__close" data-lab-close aria-label="Close Goose Lab">×</button>
      </header>
      <p class="deedz-test-lab__summary" data-lab-summary>Waiting for the flock…</p>

      <section class="deedz-test-lab__section">
        <strong>Echo travel</strong>
        <div class="deedz-test-lab__echo-row">
          <button type="button" data-lab-action="previous-echo">− Echo</button>
          <label>Echo <input type="number" min="1" max="${MAX_TEST_ECHO}" step="1" value="1" data-lab-echo></label>
          <button type="button" data-lab-action="next-echo">+ Echo</button>
        </div>
        <div class="deedz-test-lab__presets">
          <button type="button" data-lab-echo-preset="1">1</button>
          <button type="button" data-lab-echo-preset="2">2</button>
          <button type="button" data-lab-echo-preset="5">5</button>
          <button type="button" data-lab-echo-preset="10">10</button>
          <button type="button" class="is-primary" data-lab-action="load-echo">Load Echo</button>
        </div>
      </section>

      <section class="deedz-test-lab__section">
        <strong>World shortcuts</strong>
        <div class="deedz-test-lab__grid">
          <button type="button" data-world-only data-lab-action="warp-start">Warp: Start</button>
          <button type="button" data-world-only data-lab-action="warp-boss">Warp: Boss</button>
          <button type="button" data-world-only data-lab-action="warp-gate">Warp: Gate</button>
          <button type="button" data-world-only data-lab-action="ready-echo">Ready Echo</button>
        </div>
      </section>

      <section class="deedz-test-lab__section">
        <strong>Encounter spawner</strong>
        <div class="deedz-test-lab__spawn-row">
          <select data-world-only data-lab-encounter aria-label="Enemy or boss to spawn">
            ${GOOSE_LAB_ENCOUNTERS.map((encounter) => `<option value="${encounter.id}">${encounter.label}</option>`).join('')}
          </select>
          <button type="button" class="is-primary" data-world-only data-lab-action="spawn-encounter">Spawn</button>
        </div>
        <div class="deedz-test-lab__grid">
          <button type="button" data-world-only data-lab-action="enemy-parade">Enemy Parade</button>
          <button type="button" data-world-only data-lab-action="clear-spawned">Clear Spawned</button>
        </div>
      </section>

      <section class="deedz-test-lab__section">
        <strong>Gameplay checks</strong>
        <div class="deedz-test-lab__grid">
          <button type="button" data-world-only data-lab-action="heal">Full Heal</button>
          <button type="button" data-world-only data-lab-action="add-crumbs">+10 Crumbs</button>
          <button type="button" data-world-only data-lab-action="spill-crumbs">Spill Crumbs</button>
          <button type="button" data-world-only data-lab-action="toggle-invincible" data-lab-invincible aria-pressed="false">Invincible: Off</button>
          <button type="button" data-world-only data-lab-action="clear-enemies">Clear Enemies</button>
          <button type="button" data-lab-action="unlock-geese" data-lab-unlock-geese>Unlock All Geese</button>
        </div>
      </section>

      <p class="deedz-test-lab__status" data-lab-status aria-live="polite">F3 closes Goose Lab.</p>`;
    this.echoInput = this.element.querySelector('[data-lab-echo]');
    this.summary = this.element.querySelector('[data-lab-summary]');
    this.status = this.element.querySelector('[data-lab-status]');
    this.invincibleButton = this.element.querySelector('[data-lab-invincible]');
    this.encounterSelect = this.element.querySelector('[data-lab-encounter]');
    this.unlockGeeseButton = this.element.querySelector('[data-lab-unlock-geese]');
  }

  #world() { return this.engine.scenes?.get?.('world') ?? null; }

  #savedEvolution() {
    return this.engine.save.get('progress.evolution', { level: 1, xp: 0, cycle: 0, seed: 1337, bossWins: 0 });
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.element.hidden = !this.visible;
    if (this.visible) this.refresh();
  }

  refresh() {
    if (!this.element) return;
    const world = this.#world();
    const evolution = world?.evolution?.snapshot?.() ?? this.#savedEvolution();
    const player = world?.player;
    const ammo = Math.max(0, Number(this.engine.save.get('progress.crumbAmmo', 0)) || 0);
    const allGeeseUnlocked = Boolean(this.engine.save.get('progress.debugUnlockAllGeese', false));
    this.summary.textContent = player
      ? `Echo ${evolution.level || 1} · HP ${player.hp}/${player.maxHp} · Crumbs ${ammo} · Geese ${allGeeseUnlocked ? '8/8' : 'progression'}`
      : `Echo ${evolution.level || 1} · ${allGeeseUnlocked ? 'All geese unlocked.' : 'Load an Echo to enter the test world.'}`;
    if (!this.busy && document.activeElement !== this.echoInput) this.echoInput.value = String(normalizeTestEcho(evolution.level, 1));
    this.element.querySelectorAll('[data-world-only]').forEach((button) => { button.disabled = !world || this.busy; });
    this.element.querySelectorAll('button:not([data-world-only])').forEach((button) => { button.disabled = this.busy; });
    this.invincibleButton.textContent = `Invincible: ${this.invincible ? 'On' : 'Off'}`;
    this.invincibleButton.setAttribute('aria-pressed', String(this.invincible));
    this.unlockGeeseButton.textContent = allGeeseUnlocked ? 'All Geese Unlocked' : 'Unlock All Geese';
    this.unlockGeeseButton.setAttribute('aria-pressed', String(allGeeseUnlocked));
    this.unlockGeeseButton.disabled = this.busy || allGeeseUnlocked;
  }

  async #handleClick(event) {
    const close = event.target.closest('[data-lab-close]');
    if (close) {
      this.engine.debug?.toggle(false);
      return;
    }
    const preset = event.target.closest('[data-lab-echo-preset]');
    if (preset) {
      this.echoInput.value = preset.dataset.labEchoPreset;
      return;
    }
    const button = event.target.closest('[data-lab-action]');
    if (!button || this.busy) return;
    const action = button.dataset.labAction;
    if (!GOOSE_LAB_ACTIONS.includes(action)) return;
    this.busy = true;
    this.element.setAttribute('aria-busy', 'true');
    this.refresh();
    try {
      await this.#run(action);
    } catch (error) {
      this.status.textContent = `Test command failed: ${error?.message ?? 'unknown error'}`;
      this.engine.ui.toast('Goose Lab command failed. Check diagnostics.', { type: 'danger' });
    } finally {
      this.busy = false;
      this.element.removeAttribute('aria-busy');
      this.refresh();
    }
  }

  async #run(action) {
    const currentLevel = normalizeTestEcho(this.#world()?.evolution?.state?.level ?? this.#savedEvolution().level, 1);
    if (action === 'previous-echo') return this.#loadEcho(currentLevel - 1);
    if (action === 'next-echo') return this.#loadEcho(currentLevel + 1);
    if (action === 'load-echo') return this.#loadEcho(this.echoInput.value);
    if (action === 'warp-start') return this.#warp('start');
    if (action === 'warp-boss') return this.#warp('boss');
    if (action === 'warp-gate') return this.#warp('gate');
    if (action === 'heal') return this.#heal();
    if (action === 'add-crumbs') return this.#addCrumbs();
    if (action === 'spill-crumbs') return this.#spillCrumbs();
    if (action === 'toggle-invincible') return this.#toggleInvincible();
    if (action === 'clear-enemies') return this.#clearEnemies();
    if (action === 'clear-spawned') return this.#clearSpawned();
    if (action === 'enemy-parade') return this.#enemyParade();
    if (action === 'ready-echo') return this.#readyEcho();
    if (action === 'spawn-encounter') return this.#spawnEncounter(this.encounterSelect.value);
    if (action === 'unlock-geese') return this.#unlockAllGeese();
    return false;
  }

  async #loadEcho(value) {
    const current = this.#savedEvolution();
    const next = createTestEvolutionState(current, value);
    this.engine.save.set('progress.evolution', next, { immediate: true });
    this.engine.save.set('progress.checkpoint', null, { immediate: true });
    this.status.textContent = `Loading Echo ${next.level}…`;
    this.engine.debug?.toggle(false);
    await this.engine.scenes.change('world', { gooseLab: true, echo: next.level });
    this.#applyInvincibility();
    this.status.textContent = `Echo ${next.level} loaded. Press F3 whenever you need the lab.`;
    this.engine.ui.toast(`Goose Lab loaded Echo ${next.level}.`, { type: 'success', duration: 2200 });
    return next;
  }

  #requireWorld() {
    const world = this.#world();
    if (!world?.player) throw new Error('Load an Echo before using this command');
    return world;
  }

  #warp(destination) {
    const world = this.#requireWorld();
    const destinations = {
      start: { ...world.level.spawn, label: 'start' },
      boss: { x: BREADSTORM_ENCOUNTER.x - 260, y: BREADSTORM_ENCOUNTER.y, label: 'boss arena' },
      gate: { x: world.level.exit.x - 210, y: world.level.exit.y, label: 'Foxfire Gate' },
    };
    const target = destinations[destination];
    world.player.x = target.x;
    world.player.y = target.y;
    world.player.velocity.x = 0;
    world.player.velocity.y = 0;
    world.player.grounded = false;
    world.player.groundPlatform = null;
    if (!this.invincible) world.player.invulnerable = Math.max(world.player.invulnerable, 1.2);
    this.engine.renderer.camera.setPosition(target.x, target.y, true);
    this.status.textContent = `Warped to ${target.label}.`;
    return true;
  }

  #heal() {
    const { player } = this.#requireWorld();
    player.hp = player.maxHp;
    this.engine.events.emit('player:health', { hp: player.hp, maxHp: player.maxHp, source: 'goose-lab' });
    this.status.textContent = 'Health restored.';
    return player.hp;
  }

  #addCrumbs() {
    this.#requireWorld();
    const ammo = Math.max(0, Number(this.engine.save.get('progress.crumbAmmo', 0)) || 0) + 10;
    this.engine.save.set('progress.crumbAmmo', ammo, { immediate: true });
    this.engine.events.emit('player:ammo', { ammo, gained: 10, source: 'goose-lab' });
    this.status.textContent = 'Added 10 throwable crumbs.';
    return ammo;
  }

  #spillCrumbs() {
    const { player } = this.#requireWorld();
    const lost = player.dropRecoverableCrumbs?.(this.engine, { source: { debug: true }, maximum: 3 }) ?? 0;
    this.status.textContent = lost ? `Spilled ${lost} recoverable crumbs.` : 'Add crumbs first, then test the spill.';
    return lost;
  }

  #toggleInvincible() {
    this.#requireWorld();
    this.invincible = !this.invincible;
    this.#applyInvincibility();
    this.status.textContent = `Invincibility ${this.invincible ? 'enabled' : 'disabled'}.`;
    return this.invincible;
  }

  #applyInvincibility() {
    const player = this.#world()?.player;
    if (!player) return;
    if (this.invincible) player.invulnerable = Number.POSITIVE_INFINITY;
    else if (!Number.isFinite(player.invulnerable)) player.invulnerable = 0;
  }

  #clearEnemies() {
    this.#requireWorld();
    const enemies = this.engine.entities.findByTag('enemy').filter((enemy) => !enemy.hasTag?.('boss') && typeof enemy.defeat === 'function');
    for (const enemy of enemies) enemy.defeat(this.engine, { cause: 'debug', reward: false, dropCrumbs: false });
    this.status.textContent = `Cleared ${enemies.length} non-boss enemies.`;
    return enemies.length;
  }

  #unlockAllGeese() {
    this.engine.save.set('progress.debugUnlockAllGeese', true, { immediate: true });
    this.status.textContent = 'All eight geese are unlocked for private playtesting.';
    this.engine.ui.toast('GOOSE LAB: All geese unlocked.', { type: 'success', duration: 3200 });
    return true;
  }

  #spawnEncounter(encounterId) {
    const encounter = GOOSE_LAB_ENCOUNTERS.find((item) => item.id === encounterId) ?? GOOSE_LAB_ENCOUNTERS[0];
    return encounter.bossLevel ? this.#spawnTestBoss(encounter) : this.#spawnTestEnemy(encounter);
  }

  #spawnTestEnemy(encounter, { slot = 0 } = {}) {
    const world = this.#requireWorld();
    const { player } = world;
    const facing = Number(player.facing) < 0 ? -1 : 1;
    const distance = 240 + Math.max(0, slot) * 125;
    const x = Math.max(140, Math.min(world.level.width - 140, player.x + facing * distance));
    const y = player.y - (encounter.archetype === 'bat' ? 170 : 35);
    const enemy = new Enemy({
      id: `goose-lab-${Date.now()}-${this.spawnCounter += 1}`,
      x,
      y,
      patrol: 90,
      rank: encounter.rank ?? 'scout',
      archetype: encounter.archetype,
      name: encounter.label,
      level: Math.max(1, Number(world.evolution?.state?.level) || 1),
    });
    enemy.addTag('goose-lab-spawn');
    this.engine.entities.addImmediate(enemy, world.root);
    this.engine.physics.addBody(enemy, { gravityScale: enemy.hasTag('flying-enemy') ? 0 : 1, maxSpeedY: 1350 });
    this.engine.physics.addCollider(enemy.collider);
    this.status.textContent = `Spawned ${encounter.label} ${distance}px ahead.`;
    return enemy;
  }

  #spawnTestBoss(encounter) {
    const world = this.#requireWorld();
    const { player } = world;
    const facing = Number(player.facing) < 0 ? -1 : 1;
    const x = Math.max(260, Math.min(world.level.width - 260, player.x + facing * 430));
    const y = Math.max(250, player.y - 10);
    const state = createTestBossState({ level: encounter.bossLevel, cycle: encounter.cycle });
    const suffix = `${Date.now()}-${this.spawnCounter += 1}`;
    const boss = new BreadstormBoss({
      state,
      x,
      y,
      entityId: `boss-goose-lab-${suffix}`,
      bossId: `goose-lab-breadstorm-${suffix}`,
      hitHandler: (payload, entity) => this.#hitTestBoss(payload, entity),
    });
    boss.addTag('goose-lab-spawn');
    this.engine.entities.addImmediate(boss, world.root);
    this.engine.physics.addCollider(boss.collider);
    this.status.textContent = `Spawned ${encounter.label}. This private boss will not alter the shared room.`;
    this.engine.ui.toast(`${encounter.label} spawned for local testing.`, { type: 'warning', duration: 2800 });
    return boss;
  }

  #hitTestBoss(payload, boss) {
    const current = {
      id: boss.bossId,
      active: boss.activeFight,
      defeated: !boss.activeFight && boss.hp <= 0,
      hp: boss.hp,
      maxHp: boss.maxHp,
      shield: boss.shield,
      maxShield: boss.maxShield,
      phase: boss.phase,
      cycle: boss.cycle,
      evolutionLevel: boss.evolutionLevel,
      players: boss.players,
      phaseShieldsEnabled: breadstormPhaseShieldUnlocked(boss.evolutionLevel),
      spawnedAt: boss.spawnedAt,
    };
    const result = applyTestBossHit(current, payload);
    boss.applySharedState(result.state);
    if (result.shieldDamage > 0) this.status.textContent = `Test shield -${result.shieldDamage}. ${result.state.shield} remains.`;
    else if (result.damageApplied > 0) this.status.textContent = `Test boss -${result.damageApplied} heart. ${result.state.hp}/${result.state.maxHp} remains.`;
    else if (result.state.shield > 0) this.status.textContent = 'The test shield blocked that hit. Honk it first.';
    if (result.state.defeated) {
      boss.collider.enabled = false;
      this.engine.entities.add(new WingBurst({ x: boss.x, y: boss.y - 30, color: 0xffd95a, count: 34, label: 'TEST CLEARED!' }), boss.display.parent);
      this.engine.entities.remove(boss);
      this.status.textContent = 'Private Breadstorm test defeated. Shared progression was unchanged.';
      this.engine.ui.toast('GOOSE LAB: Breadstorm test cleared!', { type: 'success', duration: 3000 });
    }
    return true;
  }

  #enemyParade() {
    const encounters = GOOSE_LAB_ENCOUNTERS.filter((item) => item.archetype && item.id !== 'toast-captain');
    const spawned = encounters.map((encounter, slot) => this.#spawnTestEnemy(encounter, { slot }));
    this.status.textContent = `Enemy Parade ready: ${spawned.map((enemy) => enemy.displayName).join(', ')}.`;
    return spawned;
  }

  #clearSpawned() {
    this.#requireWorld();
    const spawned = this.engine.entities.findByTag('goose-lab-spawn');
    for (const entity of spawned) this.engine.entities.removeImmediate(entity);
    this.status.textContent = `Removed ${spawned.length} Goose Lab encounter${spawned.length === 1 ? '' : 's'}.`;
    return spawned.length;
  }

  #readyEcho() {
    const world = this.#requireWorld();
    const evolution = world.evolution;
    for (const crystal of this.engine.entities.findByTag('crystal')) crystal.activate?.(this.engine, { debug: true });
    const missingXp = Math.max(0, evolution.goal - evolution.state.xp);
    if (missingXp) evolution.addXp(missingXp, 'Goose Lab', { flockEnergy: 0 });
    const bossTarget = bossTargetForLevel(evolution.state.level);
    evolution.state.bossWins = bossTarget;
    evolution.shared.bossWins = bossTarget;
    evolution.shared.boss = null;
    if (evolution.boss && !evolution.boss.destroyed) this.engine.entities.removeImmediate(evolution.boss);
    evolution.boss = null;
    this.engine.save.set('progress.evolution', { ...evolution.state }, { immediate: true });
    world.levelExit?.setLocked(false);
    this.engine.events.emit('evolution:changed', evolution.snapshot());
    this.status.textContent = 'Crystals, XP, and gate requirements are ready.';
    return evolution.snapshot();
  }

  #onSceneChanged() {
    this.#applyInvincibility();
    this.refresh();
  }

  destroy() {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.element?.removeEventListener('click', this._onClick);
    this.element?.remove();
    this.element = null;
  }
}
