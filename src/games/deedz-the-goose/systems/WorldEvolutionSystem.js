import { Graphics, Text } from 'pixi.js';
import { Platform } from '../entities/WorldObjects.js';
import { Collectible } from '../entities/Collectible.js';
import { Enemy } from '../entities/Enemy.js';
import { BreadstormBoss } from '../entities/BreadstormBoss.js';
import { WingBurst } from '../entities/ActionEffects.js';
import { EchoResonator, Scenery } from '../entities/AdventureObjects.js';
import { collectibleDefinition, collectibleXpValue } from '../data/collectibles.js';
import {
  breadstormHeartDamage,
  breadstormPhaseShield,
  breadstormPhaseShieldUnlocked,
  breadstormShieldDamage,
  breadstormShieldUnlocked,
  breadstormStats,
} from '../../../../server/shared/bossBalance.js';
import { BREADSTORM_ENCOUNTER, bossTargetForLevel } from '../data/progression.js';
import { ADVANCED_GOOSE_UNLOCK_LEVEL, advancedGooseUnlocks } from '../data/characters.js';
import {
  createEvolutionSeed,
  evolutionGoal,
  generateEvolutionLayout,
  stageForLevel,
} from '../data/evolutions.js';

function normalizeEvolution(value = {}, profileName = 'Deedz') {
  const level = Math.max(1, Math.floor(Number(value.level) || 1));
  return {
    level,
    xp: Math.max(0, Math.floor(Number(value.xp) || 0)),
    cycle: Math.max(0, Math.floor(Number(value.cycle) || 0)),
    seed: Number(value.seed) || createEvolutionSeed(profileName, 1337),
    bossWins: Math.max(0, Math.floor(Number(value.bossWins) || 0)),
  };
}

export class WorldEvolutionSystem {
  constructor(engine, scene, level) {
    this.engine = engine;
    this.scene = scene;
    this.level = level;
    this.generated = [];
    this.generatedPlatforms = [];
    this.boss = null;
    this.lastBossRewardKey = null;
    this.lastLayout = null;
    this.profileName = engine.save.get('profile.name', 'Deedz');
    this.state = normalizeEvolution(engine.save.get('progress.evolution', {}), this.profileName);
    this.shared = {
      flockEnergy: 0,
      flockGoal: 180,
      bossWins: 0,
      boss: null,
      ...(engine.network.worldState ?? {}),
    };
    this.shared.bossWins = Math.max(Number(this.shared.bossWins) || 0, this.state.bossWins);
    this.shared.flockGoal = Math.max(Number(this.shared.flockGoal) || 180, Math.min(900, 180 + this.state.bossWins * 45));
    this.#createAtmosphere();
    this.#applyLayer({ announce: false });
    this.applySharedState(this.shared);
    this.unsubscribers = [
      engine.events.on('collectible:collected', ({ item, definition = collectibleDefinition(item?.type) }) => {
        if (!item) return;
        const xp = collectibleXpValue(item.type, item.value);
        this.addXp(xp, definition.label, { flockEnergy: Math.max(1, definition.flockEnergy * item.value) });
      }),
      engine.events.on('resonator:activated', ({ resonator, xp }) => {
        this.addXp(Number(xp) || resonator?.xp || 30, 'Echo Resonator harmony', { flockEnergy: 9 });
        this.engine.entities.add(new WingBurst({ x: resonator.x, y: resonator.y, color: resonator.accent, count: 16, label: 'RESONANCE!' }), this.scene.root);
      }),
      engine.events.on('enemy:defeated', ({ enemy }) => {
        if (!enemy || enemy.hasTag?.('boss')) return;
        const rankXp = enemy.rank === 'captain' ? 38 : enemy.rank === 'guard' ? 24 : 16;
        this.addXp(rankXp, `${enemy.displayName || 'Bread Fox'} defeated`, { flockEnergy: enemy.rank === 'captain' ? 14 : 7 });
      }),
      engine.events.on('crystal:activated', ({ source }) => {
        if (source?.remote || source?.synced) return;
        this.addXp(35, 'Echo Crystal awakened', { flockEnergy: 18 });
      }),
      engine.events.on('goose:social', () => this.addXp(10, 'Flock interaction', { flockEnergy: 7 })),
      engine.events.on('net:world-event', (event) => this.#applySharedEvent(event)),
      engine.events.on('net:joined', ({ worldState }) => this.applySharedState(worldState)),
      engine.events.on('boss:hit-request', (payload) => this.#applyOfflineBossHit(payload)),
    ];
    this.#emitState();
  }

  #createAtmosphere() {
    this.atmosphere = new Graphics();
    this.atmosphere.eventMode = 'none';
    this.scene.worldArt.addChild(this.atmosphere);
    this.stageLabel = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 3,
        stroke: { color: 0x07111f, width: 6 },
      },
    });
    this.stageLabel.anchor.set(0.5);
    this.stageLabel.position.set(this.level.width / 2, 150);
    this.stageLabel.alpha = 0.42;
    this.scene.worldArt.addChild(this.stageLabel);
  }

  get goal() { return evolutionGoal(this.state.level); }
  get ready() { return this.state.xp >= this.goal; }
  get stage() { return stageForLevel(this.state.level); }

  snapshot() {
    return {
      ...this.state,
      goal: this.goal,
      ready: this.ready,
      stage: this.stage,
      xpBudget: this.lastLayout?.xpBudget ?? 0,
      mutations: this.lastLayout?.mutations ?? [],
      shared: {
        flockEnergy: Number(this.shared.flockEnergy) || 0,
        flockGoal: Number(this.shared.flockGoal) || 180,
        bossWins: Number(this.shared.bossWins) || 0,
        boss: this.shared.boss ? structuredClone(this.shared.boss) : null,
      },
    };
  }

  addXp(amount, reason = 'Adventure progress', { flockEnergy = 0 } = {}) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    if (!gain) return this.snapshot();
    const wasReady = this.ready;
    this.state.xp += gain;
    this.#persist();
    this.engine.events.emit('evolution:xp', { amount: gain, reason, state: this.snapshot() });
    if (!wasReady && this.ready) {
      const bossRequired = this.state.bossWins < bossTargetForLevel(this.state.level);
      this.engine.ui.toast(
        bossRequired
          ? `Echo Layer charged! Breadstorm is invading ${BREADSTORM_ENCOUNTER.zone}.`
          : 'Echo Layer charged! The Foxfire Gate can now evolve the world.',
        { type: 'success', duration: 4200 },
      );
      this.engine.audio.sfx.tone({ frequency: 420, slide: 380, duration: 0.32, type: 'triangle', volume: 0.09 });
    }
    if (flockEnergy > 0 && this.state.bossWins < bossTargetForLevel(this.state.level)) this.contributeFlockEnergy(flockEnergy, reason);
    this.#emitState();
    return this.snapshot();
  }

  contributeFlockEnergy(amount, reason = 'Adventure') {
    const contribution = Math.max(1, Math.min(30, Math.floor(Number(amount) || 0)));
    if (this.engine.network.client?.connected) {
      this.engine.network.sendWorldEvent('flock-energy', {
        amount: contribution,
        reason: String(reason).slice(0, 48),
        evolutionLevel: this.state.level,
      });
      return;
    }
    const nextEnergy = Math.min(this.shared.flockGoal, this.shared.flockEnergy + contribution);
    this.#applySharedEvent({ event: 'flock-energy', flockEnergy: nextEnergy, flockGoal: this.shared.flockGoal, boss: nextEnergy >= this.shared.flockGoal ? this.#createOfflineBossState() : this.shared.boss });
  }

  completeEvolution() {
    if (!this.ready || this.state.bossWins < bossTargetForLevel(this.state.level)) return false;
    const oldStage = this.stage;
    const oldLevel = this.state.level;
    this.state.xp = Math.max(0, this.state.xp - this.goal);
    this.state.level += 1;
    this.state.cycle += 1;
    this.state.seed = (Math.imul(this.state.seed >>> 0, 1664525) + 1013904223) >>> 0;
    this.#persist(true);
    this.#applyLayer({ announce: true });
    this.scene.player.heal?.(this.scene.player.maxHp, this.engine);
    this.scene.player.jumpsRemaining = this.scene.player.maxJumps;
    const ammo = Math.max(0, Number(this.engine.save.get('progress.crumbAmmo', 0)) || 0);
    const supply = 3 + Math.min(3, Math.floor(this.state.level / 2));
    this.engine.save.set('progress.crumbAmmo', ammo + supply);
    this.engine.events.emit('player:ammo', { ammo: ammo + supply, gained: supply });
    this.engine.entities.add(new WingBurst({
      x: this.scene.player.x,
      y: this.scene.player.y - 30,
      color: this.stage.accent,
      count: 28,
      label: 'WORLD EVOLVED!',
    }), this.scene.root);
    this.engine.events.emit('evolution:advanced', { from: oldStage, state: this.snapshot() });
    this.engine.events.emit('achievement:unlock', { id: 'world-evolved' });
    this.engine.network.sendAction('evolution', { x: this.scene.player.x, y: this.scene.player.y, strength: this.state.level });
    const mutations = this.lastLayout?.mutations?.length ? ` ${this.lastLayout.mutations.join(' · ')}.` : '';
    this.engine.ui.toast(`${this.stage.name} has emerged! Echo Supply +${supply} crumbs. New routes, collectibles, foxes, and scenery now fill Goose Green.${mutations}`, { type: 'success', duration: 6200 });
    if (oldLevel < ADVANCED_GOOSE_UNLOCK_LEVEL && this.state.level >= ADVANCED_GOOSE_UNLOCK_LEVEL) {
      const names = advancedGooseUnlocks().map((item) => item.name).join(' + ');
      this.engine.ui.toast(`ADVANCED GEESE UNLOCKED! ${names} are now selectable from the main menu.`, { type: 'success', duration: 7000 });
    }
    this.#emitState();
    return true;
  }

  #persist(immediate = false) {
    this.engine.save.set('progress.evolution', { ...this.state }, { immediate });
  }

  #applyLayer({ announce = false } = {}) {
    for (const entity of this.generated) this.engine.entities.removeImmediate(entity);
    this.generated = [];
    const generatedIds = new Set(this.generatedPlatforms.map((platform) => platform.id));
    this.scene.platforms = this.scene.platforms.filter((platform) => !generatedIds.has(platform.id));
    this.generatedPlatforms = [];

    const layout = generateEvolutionLayout({
      level: this.state.level,
      cycle: this.state.cycle,
      seed: this.state.seed,
      width: this.level.width,
      groundY: 920,
    });
    this.lastLayout = layout;

    for (const data of layout.decorations ?? []) {
      const decoration = new Scenery(data);
      decoration.addTag('evolution-generated');
      decoration.evolutionId = data.id;
      this.generated.push(decoration);
      this.engine.entities.addImmediate(decoration, this.scene.worldArt);
    }

    for (const data of layout.platforms) {
      const platform = new Platform(data);
      platform.addTag('evolution-generated');
      platform.evolutionId = data.id;
      this.generated.push(platform);
      this.generatedPlatforms.push(platform);
      this.scene.platforms.push(platform);
      this.engine.entities.addImmediate(platform, this.scene.root);
      this.engine.physics.addBody(platform, { static: true });
      this.engine.physics.addCollider(platform.collider);
    }

    for (const data of layout.collectibles) {
      const collectible = new Collectible(data);
      collectible.addTag('evolution-generated');
      collectible.evolutionId = data.id;
      this.generated.push(collectible);
      this.engine.entities.addImmediate(collectible, this.scene.root);
      this.engine.physics.addBody(collectible, { static: true });
      this.engine.physics.addCollider(collectible.collider);
    }

    for (const data of layout.resonators ?? []) {
      const resonator = new EchoResonator(data);
      resonator.addTag('evolution-generated');
      resonator.evolutionId = data.id;
      this.generated.push(resonator);
      this.engine.entities.addImmediate(resonator, this.scene.root);
    }

    for (const data of layout.enemies) {
      const enemy = new Enemy(data);
      enemy.addTag('evolution-generated');
      this.generated.push(enemy);
      this.engine.entities.addImmediate(enemy, this.scene.root);
      this.engine.physics.addBody(enemy, { gravityScale: 1, maxSpeedY: 1350 });
      this.engine.physics.addCollider(enemy.collider);
    }

    this.scene.player.gravityMultiplier = layout.stage.gravity;
    this.scene.player.movementMultiplier = layout.stage.speed;
    this.scene.applyEvolutionVisuals?.(layout.visual, this.state.level);
    this.scene.updateEvolutionMusic?.(layout.stage, this.state.level);
    this.#drawAtmosphere(layout);
    this.stageLabel.text = `ECHO LAYER ${this.state.level} · ${layout.stage.name.toUpperCase()}`;
    this.stageLabel.style.fill = layout.stage.accent;
    if (announce) this.engine.renderer.camera.shake(12, 0.55);
  }

  #drawAtmosphere(layout) {
    this.atmosphere.clear();
    const alpha = 0.035 + Math.min(0.09, this.state.level * 0.006);
    this.atmosphere.rect(0, 0, this.level.width, this.level.height).fill({ color: layout.stage.tint, alpha });
    for (let band = 0; band < 4; band += 1) {
      const y = 130 + band * 105 + ((this.state.level * 41 + band * 73) % 85);
      this.atmosphere.moveTo(0, y);
      for (let x = 0; x <= this.level.width; x += 260) {
        this.atmosphere.lineTo(x, y + Math.sin(x * 0.002 + band * 1.7) * (28 + band * 8));
      }
      this.atmosphere.stroke({ width: 18 - band * 3, color: band % 2 ? layout.stage.accent : layout.stage.tint, alpha: 0.035 + band * 0.012 });
    }
    for (const mote of layout.atmosphere ?? []) {
      this.atmosphere.circle(mote.x, mote.y, mote.radius).fill({ color: mote.color, alpha: mote.alpha });
    }
  }

  applySharedState(worldState = {}) {
    if (!worldState) return;
    this.shared = {
      ...this.shared,
      flockEnergy: Math.max(0, Number(worldState.flockEnergy ?? this.shared.flockEnergy) || 0),
      flockGoal: Math.max(
        Math.min(900, 180 + this.state.bossWins * 45),
        Number(worldState.flockGoal ?? this.shared.flockGoal) || 180,
      ),
      bossWins: Math.max(this.state.bossWins, Number(worldState.bossWins ?? this.shared.bossWins) || 0),
      boss: worldState.boss ?? this.shared.boss,
    };
    if (this.shared.boss?.defeated && !this.lastBossRewardKey) {
      this.lastBossRewardKey = `${this.shared.boss.id}:${this.shared.boss.defeatedAt || this.shared.boss.cycle}`;
    }
    this.#syncBoss(this.shared.boss);
    this.#emitState();
  }

  #applySharedEvent(event = {}) {
    if (event.event === 'flock-energy') {
      this.shared.flockEnergy = Math.max(0, Number(event.flockEnergy) || 0);
      this.shared.flockGoal = Math.max(1, Number(event.flockGoal) || this.shared.flockGoal);
      if (event.boss) this.shared.boss = event.boss;
      this.#syncBoss(this.shared.boss);
    } else if (event.event === 'boss-hit') {
      if (event.boss) this.shared.boss = event.boss;
      this.shared.bossWins = Math.max(this.shared.bossWins, Number(event.bossWins) || 0);
      this.#syncBoss(this.shared.boss);
    }
    this.#emitState();
  }

  #createOfflineBossState() {
    if (this.shared.boss?.active) return this.shared.boss;
    const cycle = Math.max(this.shared.bossWins, this.state.bossWins) + 1;
    const evolutionLevel = this.state.level;
    const { maxHp, maxShield } = breadstormStats({ cycle, players: 1, evolutionLevel });
    const shieldEnabled = breadstormShieldUnlocked(evolutionLevel);
    const phaseShieldsEnabled = breadstormPhaseShieldUnlocked(evolutionLevel);
    return { id: `baron-breadstorm-${cycle}`, active: true, defeated: false, hp: maxHp, maxHp, phase: 1, shield: maxShield, maxShield, shieldEnabled, phaseShieldsEnabled, evolutionLevel, players: 1, cycle, spawnedAt: Date.now() };
  }

  #applyOfflineBossHit({ damage = 1, hitType = 'attack' } = {}) {
    const boss = this.shared.boss;
    if (!boss?.active || boss.defeated) return;
    if (boss.shield > 0) {
      if (hitType === 'honk') boss.shield = Math.max(0, boss.shield - breadstormShieldDamage(damage));
    } else {
      boss.hp = Math.max(0, boss.hp - breadstormHeartDamage(damage));
      const ratio = boss.hp / Math.max(1, boss.maxHp);
      const nextPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
      if (nextPhase > boss.phase && boss.hp > 0) {
        boss.phase = nextPhase;
        boss.maxShield = breadstormPhaseShield({
          phase: nextPhase,
          cycle: boss.cycle,
          evolutionLevel: boss.evolutionLevel,
          phaseShieldsEnabled: boss.phaseShieldsEnabled ?? breadstormPhaseShieldUnlocked(boss.evolutionLevel),
        });
        boss.shield = boss.maxShield;
      }
      if (boss.hp <= 0) {
        boss.active = false;
        boss.defeated = true;
        boss.defeatedAt = Date.now();
        this.shared.bossWins = Math.max(this.shared.bossWins + 1, boss.cycle);
      }
    }
    this.#applySharedEvent({ event: 'boss-hit', boss: { ...boss }, bossWins: this.shared.bossWins });
  }

  #syncBoss(bossState) {
    const bossRequired = this.state.bossWins < bossTargetForLevel(this.state.level);
    if (!bossRequired) {
      if (this.boss && !this.boss.destroyed) this.engine.entities.removeImmediate(this.boss);
      this.boss = null;
      return;
    }
    if (bossState?.active && !bossState.defeated) {
      if (!this.boss || this.boss.destroyed) {
        this.boss = new BreadstormBoss({ state: bossState, x: BREADSTORM_ENCOUNTER.x, y: BREADSTORM_ENCOUNTER.y });
        this.engine.entities.addImmediate(this.boss, this.scene.root);
        this.engine.physics.addCollider(this.boss.collider);
        const coOp = Number(bossState.players) > 1 ? ` ${bossState.players} same-Echo geese share his hearts.` : '';
        this.engine.ui.toast(`FLOCK CRISIS! Breadstorm Form ${bossState.cycle || 1} has invaded ${BREADSTORM_ENCOUNTER.zone}!${coOp}`, { type: 'danger', duration: 5200 });
        this.engine.audio.sfx.tone({ frequency: 110, slide: -45, duration: 0.7, type: 'sawtooth', volume: 0.12 });
        this.engine.events.emit('boss:started', { boss: this.boss, state: bossState });
      } else {
        const previousPhase = this.boss.phase;
        this.boss.applySharedState(bossState);
        if (this.boss.phase !== previousPhase) {
          const message = this.boss.shield > 0
            ? `Baron Breadstorm entered Phase ${this.boss.phase}! HONK through the Echo Shield!`
            : `Baron Breadstorm entered Phase ${this.boss.phase}! Keep attacking!`;
          this.engine.ui.toast(message, { type: 'warning', duration: 3600 });
          this.engine.renderer.camera.shake(14, 0.4);
        }
      }
      return;
    }

    if (bossState?.defeated) {
      const rewardKey = `${bossState.id}:${bossState.defeatedAt || bossState.cycle}`;
      if (this.lastBossRewardKey !== rewardKey) {
        this.lastBossRewardKey = rewardKey;
        this.state.bossWins = Math.max(
          this.state.bossWins + 1,
          Number(bossState.cycle) || 0,
          Number(this.shared.bossWins) || 0,
        );
        this.#persist(true);
        this.addXp(120 + this.state.level * 15, 'Baron Breadstorm defeated', { flockEnergy: 0 });
        this.engine.events.emit('achievement:unlock', { id: 'breadstorm-breaker' });
        this.engine.events.emit('boss:defeated', { boss: this.boss, state: bossState });
        this.engine.ui.toast('BARON BREADSTORM DEFEATED! The flock changed Goose Green forever.', { type: 'success', duration: 6000 });
        this.engine.entities.add(new WingBurst({ x: this.boss?.x ?? BREADSTORM_ENCOUNTER.x, y: this.boss?.y ?? BREADSTORM_ENCOUNTER.y, color: 0xffd95a, count: 42, label: 'HONKING VICTORY!' }), this.scene.root);
      }
      if (this.boss && !this.boss.destroyed) this.engine.entities.removeImmediate(this.boss);
      this.boss = null;
      this.shared.flockEnergy = 0;
    }
  }

  #emitState() { this.engine.events.emit('evolution:changed', this.snapshot()); }

  update() {
    if (this.boss?.destroyed) this.boss = null;
  }

  destroy() {
    this.unsubscribers.forEach((off) => off());
    for (const entity of this.generated) this.engine.entities.removeImmediate(entity);
    this.generated = [];
    this.generatedPlatforms = [];
    if (this.boss && !this.boss.destroyed) this.engine.entities.removeImmediate(this.boss);
    this.atmosphere?.destroy();
    this.stageLabel?.destroy();
  }
}
