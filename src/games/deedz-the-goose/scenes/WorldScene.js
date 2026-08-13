import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { PlayerGoose } from '../entities/PlayerGoose.js';
import { Enemy } from '../entities/Enemy.js';
import { CatCompanion } from '../entities/CatCompanion.js';
import { Collectible } from '../entities/Collectible.js';
import { Checkpoint, Hazard, HonkCrystal, Scenery } from '../entities/AdventureObjects.js';
import { LevelExit, Platform } from '../entities/WorldObjects.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { CollectibleSystem } from '../systems/CollectibleSystem.js';
import { ContactDamageSystem } from '../systems/ContactDamageSystem.js';
import { GooseInteractionSystem } from '../systems/GooseInteractionSystem.js';
import { NetworkPlayerSystem } from '../systems/NetworkPlayerSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { StorySystem } from '../systems/StorySystem.js';
import { WorldEvolutionSystem } from '../systems/WorldEvolutionSystem.js';
import { WorldSafetySystem, resolveSafeSpawn, supportingPlatformForSpawn } from '../systems/WorldSafetySystem.js';
import { FlockSenseSystem } from '../systems/FlockSenseSystem.js';
import { TouchControls } from '../ui/TouchControls.js';
import { achievements } from '../data/achievements.js';
import { characters } from '../data/characters.js';
import { levels } from '../data/levels.js';

export class WorldScene extends Scene {
  constructor() {
    super('world');
    this.level = levels[0];
    this.platforms = [];
    this.finished = false;
    this.startedAt = 0;
    this.respawnPoint = { ...this.level.spawn };
    this.exitWarningCooldown = 0;
    this.crystalGateAnnounced = false;
    this.spawnGuardFrames = 0;
  }

  async enter(data) {
    await super.enter(data);
    this.startedAt = performance.now();
    this.worldArt = new Container();
    this.root.addChild(this.worldArt);
    this.#buildBackdrop();
    this.#buildWorld(data);
    this.#buildHud();

    this.combat = new CombatSystem(this.engine, this.root);
    this.collectibles = new CollectibleSystem(this.engine);
    this.contactDamage = new ContactDamageSystem(this.engine);
    this.objectives = new ObjectiveSystem(this.engine);
    this.story = new StorySystem(this.engine, this.level.story);
    this.networkPlayers = new NetworkPlayerSystem(this.engine, this.root);
    this.interactions = new GooseInteractionSystem(this.engine, this.player, this.networkPlayers, this.root);
    this.evolution = new WorldEvolutionSystem(this.engine, this, this.level);
    this.#stabilizeSpawn(Boolean(data?.restartMission));
    this.flockSense = new FlockSenseSystem(this.engine, this.player, this.root);
    this.touchControls = new TouchControls(this.engine);
    this.safety = new WorldSafetySystem(this.engine, {
      player: this.player,
      level: this.level,
      platforms: () => this.platforms,
      recover: (reason) => this.#respawn(false, reason),
    });
    this.musicIntensity = 0;

    this.unsubscribers = [
      this.engine.events.on('objective:changed', (state) => this.#updateHud(state)),
      this.engine.events.on('player:health', ({ hp }) => { this.hudHp.textContent = `♥ ${hp}/${this.player.maxHp}`; }),
      this.engine.events.on('player:jump', () => this.#updateJumpHud()),
      this.engine.events.on('player:jump-refill', () => this.#updateJumpHud()),
      this.engine.events.on('player:ammo', ({ ammo }) => { if (this.hudAmmo) this.hudAmmo.textContent = `Crumbs ${ammo}`; }),
      this.engine.events.on('achievement:unlock', ({ id }) => this.#unlockAchievement(id)),
      this.engine.events.on('player:defeated', () => this.#respawn(true)),
      this.engine.events.on('network:status', () => this.#updateNetworkHud()),
      this.engine.events.on('multiplayer:count', () => this.#updateNetworkHud()),
      this.engine.events.on('crystal:activated', () => this.#updateCrystalHud()),
      this.engine.events.on('evolution:changed', (state) => this.#updateEvolutionHud(state)),
      this.engine.events.on('net:joined', ({ worldState }) => this.#applyWorldState(worldState)),
      this.engine.events.on('collision:enter', (contact) => this.#handleCollision(contact)),
      this.engine.events.on('settings:music-changed', () => this.updateEvolutionMusic()),
      this.engine.events.on('settings:adaptive-music-changed', () => this.updateEvolutionMusic()),
    ];

    this.#applyWorldState(this.engine.network.worldState);
    this.engine.renderer.camera.follow(this.player, { smoothing: 7.5, offsetY: -80 });
    this.engine.renderer.camera.setBounds({ x: 0, y: 0, width: this.level.width, height: this.level.height });
    this.engine.renderer.camera.setPosition(this.player.x, this.player.y - 80, true);
    this.updateEvolutionMusic();
    this.engine.events.emit('mission:started', { level: this.level });
    this.engine.ui.toast('The living world is ready. Pause anytime to view or remap every control.', { type: 'success', duration: 3600 });
  }

  #buildBackdrop() {
    this.skyTop = new Graphics().rect(0, 0, this.level.width, this.level.height * 0.48).fill(0x0c2444);
    this.skyBottom = new Graphics().rect(0, this.level.height * 0.48, this.level.width, this.level.height * 0.52).fill(0x17445c);
    this.worldArt.addChild(this.skyTop, this.skyBottom);

    this.moon = new Graphics().circle(1050, 170, 108).fill(0xfff3ba).circle(1015, 140, 92).fill({ color: 0xd9e9d8, alpha: 0.18 });
    this.worldArt.addChild(this.moon);

    this.stars = new Graphics();
    for (let index = 0; index < 110; index += 1) {
      const x = 90 + ((index * 389) % Math.floor(this.level.width - 180));
      const y = 45 + ((index * 97) % 410);
      this.stars.circle(x, y, 1.4 + (index % 4) * 0.65).fill({ color: index % 7 === 0 ? 0xffd95a : 0xd6f6ff, alpha: 0.55 + (index % 3) * 0.14 });
    }
    this.worldArt.addChild(this.stars);

    this.farMountains = new Graphics();
    this.farMountains.moveTo(0, 760);
    for (let x = 0; x <= this.level.width; x += 300) {
      this.farMountains.lineTo(x, 530 + Math.sin(x * 0.0022) * 100 + Math.sin(x * 0.006) * 45);
    }
    this.farMountains.lineTo(this.level.width, 1050).lineTo(0, 1050).closePath().fill(0x16384d);
    this.worldArt.addChild(this.farMountains);

    this.nearHills = new Graphics();
    this.nearHills.moveTo(0, 880);
    for (let x = 0; x <= this.level.width; x += 220) {
      this.nearHills.lineTo(x, 710 + Math.sin(x * 0.004) * 72 + Math.cos(x * 0.009) * 28);
    }
    this.nearHills.lineTo(this.level.width, 1120).lineTo(0, 1120).closePath().fill(0x1c4e53);
    this.worldArt.addChild(this.nearHills);

    this.cloudLayer = new Container();
    for (let index = 0; index < 18; index += 1) {
      const cloud = new Graphics();
      const x = 360 + index * 520;
      const y = 250 + (index % 5) * 90;
      cloud.circle(x, y, 32).circle(x + 38, y - 10, 42).circle(x + 84, y + 4, 30).roundRect(x - 20, y, 126, 30, 15).fill({ color: 0xd8f4ff, alpha: 0.14 });
      this.cloudLayer.addChild(cloud);
    }
    this.worldArt.addChild(this.cloudLayer);

    this.zoneLabels = new Container();
    const labels = [
      [420, 310, 'WINDMILL MEADOW'], [1880, 270, 'CLOUDSTEP CROSSING'], [3110, 300, 'WHISPERING RUINS'],
      [4350, 250, 'MOONWATER RAVINE'], [5630, 280, 'LANTERN WOODS'], [6870, 280, 'BREAD FOX PASS'], [8140, 260, 'FOXFIRE FORTRESS'],
    ];
    for (const [x, y, label] of labels) {
      const text = new Text({ text: label, style: { fill: 0x9edce6, fontSize: 24, fontWeight: '900', letterSpacing: 3, stroke: { color: 0x07111f, width: 5 } } });
      text.position.set(x, y);
      text.alpha = 0.48;
      this.zoneLabels.addChild(text);
    }
    this.worldArt.addChild(this.zoneLabels);
  }

  applyEvolutionVisuals(visual = {}, level = 1) {
    this.skyTop?.clear().rect(0, 0, this.level.width, this.level.height * 0.48).fill(visual.skyTop ?? 0x0c2444);
    this.skyBottom?.clear().rect(0, this.level.height * 0.48, this.level.width, this.level.height * 0.52).fill(visual.skyBottom ?? 0x17445c);
    if (this.farMountains) {
      this.farMountains.clear().moveTo(0, 760);
      for (let x = 0; x <= this.level.width; x += 300) this.farMountains.lineTo(x, 530 + Math.sin(x * 0.0022) * 100 + Math.sin(x * 0.006) * 45);
      this.farMountains.lineTo(this.level.width, 1050).lineTo(0, 1050).closePath().fill(visual.mountain ?? 0x16384d);
    }
    if (this.nearHills) {
      this.nearHills.clear().moveTo(0, 880);
      for (let x = 0; x <= this.level.width; x += 220) this.nearHills.lineTo(x, 710 + Math.sin(x * 0.004) * 72 + Math.cos(x * 0.009) * 28);
      this.nearHills.lineTo(this.level.width, 1120).lineTo(0, 1120).closePath().fill(visual.horizon ?? 0x1c4e53);
    }
    if (this.moon) {
      this.moon.clear().circle(1050, 170, 108).fill(visual.moon ?? 0xfff3ba).circle(1015, 140, 92).fill({ color: visual.tint ?? 0xd9e9d8, alpha: 0.16 });
      const scale = 1 + Math.min(0.24, Math.max(0, level - 1) * 0.015);
      this.moon.scale.set(scale);
      this.moon.rotation = (level % 7) * 0.025;
    }
    if (this.stars) {
      this.stars.tint = visual.accent ?? 0xffffff;
      this.stars.alpha = Math.min(1, 0.62 + level * 0.025);
    }
    if (this.cloudLayer) {
      this.cloudLayer.tint = visual.tint ?? 0xffffff;
      this.cloudLayer.alpha = 0.72 + Math.sin(level * 1.7) * 0.12;
    }
    if (this.zoneLabels) for (const label of this.zoneLabels.children) label.style.fill = visual.accent ?? 0x9edce6;
  }


  updateEvolutionMusic(stage = this.evolution?.stage, level = this.evolution?.state?.level ?? 1, intensity = this.musicIntensity ?? 0) {
    if (!this.engine.save.get('settings.music', true)) {
      this.engine.audio.music.stop();
      return false;
    }
    if (this.engine.save.get('settings.adaptiveMusic', true)) {
      return this.engine.audio.music.playEvolutionScore({ level, stage: stage ?? {}, intensity });
    }
    return this.engine.audio.music.playToneBed({ root: 92, tempo: 92, volume: 0.035 });
  }

  #buildWorld(options = {}) {
    this.engine.entities.clear();
    this.engine.physics.clear();
    this.platforms = [];
    this.checkpoints = [];

    for (const data of this.level.scenery ?? []) this.engine.entities.addImmediate(new Scenery(data), this.root);

    for (const data of this.level.platforms) {
      const platform = new Platform(data);
      this.platforms.push(platform);
      this.engine.entities.addImmediate(platform, this.root);
      this.engine.physics.addBody(platform, { static: true });
      this.engine.physics.addCollider(platform.collider);
    }

    for (const data of this.level.hazards ?? []) {
      const hazard = new Hazard(data);
      this.engine.entities.addImmediate(hazard, this.root);
      this.engine.physics.addBody(hazard, { static: true });
      this.engine.physics.addCollider(hazard.collider);
    }

    for (const data of this.level.checkpoints ?? []) {
      const checkpoint = new Checkpoint(data);
      this.checkpoints.push(checkpoint);
      this.engine.entities.addImmediate(checkpoint, this.root);
      this.engine.physics.addBody(checkpoint, { static: true });
      this.engine.physics.addCollider(checkpoint.collider);
    }

    for (const data of this.level.crystals ?? []) this.engine.entities.addImmediate(new HonkCrystal(data), this.root);

    const restartMission = Boolean(options?.restartMission);
    if (restartMission) this.engine.save.set('progress.checkpoint', null, { immediate: true });
    const selectedId = this.engine.save.get('profile.character', 'deedz');
    const character = characters.find((item) => item.id === selectedId) ?? characters[0];
    const savedCheckpointId = restartMission ? null : this.engine.save.get('progress.checkpoint', null);
    const savedCheckpoint = this.checkpoints.find((checkpoint) => checkpoint.checkpointId === savedCheckpointId);
    if (savedCheckpoint) savedCheckpoint.activate();
    const spawn = savedCheckpoint ? { x: savedCheckpoint.x, y: savedCheckpoint.y - 115 } : this.level.spawn;
    this.respawnPoint = { ...spawn };
    this.player = new PlayerGoose({ character, ...spawn });
    this.engine.entities.addImmediate(this.player, this.root);
    this.engine.physics.addBody(this.player, { gravityScale: 1, maxSpeedY: 1350 });
    this.engine.physics.addCollider(this.player.collider);

    const cat = new CatCompanion({ target: this.player, x: this.player.x - 80, y: this.player.y });
    this.engine.entities.addImmediate(cat, this.root);

    for (const item of this.level.collectibles) {
      const collectible = new Collectible(item);
      this.engine.entities.addImmediate(collectible, this.root);
      this.engine.physics.addBody(collectible, { static: true });
      this.engine.physics.addCollider(collectible.collider);
    }

    for (const data of this.level.enemies) {
      const enemy = new Enemy(data);
      this.engine.entities.addImmediate(enemy, this.root);
      this.engine.physics.addBody(enemy, { gravityScale: 1, maxSpeedY: 1350 });
      this.engine.physics.addCollider(enemy.collider);
    }

    this.exit = new LevelExit(this.level.exit);
    this.exit.setLocked(true);
    this.engine.entities.addImmediate(this.exit, this.root);
    this.engine.physics.addBody(this.exit, { static: true });
    this.engine.physics.addCollider(this.exit.collider);
  }

  #stabilizeSpawn(restarted = false) {
    const safe = resolveSafeSpawn(this.respawnPoint, this.platforms, this.level, this.player.collider);
    this.respawnPoint = { ...safe };
    this.#seatPlayerAtSpawn(safe);
    // Keep the player seated for several fixed frames after a full scene
    // transition. This prevents gravity or stale input from moving the new
    // goose before the rebuilt Echo geometry and physics broad phase settle.
    this.spawnGuardFrames = 5;
    if (restarted) this.engine.events.emit('mission:restarted', { spawn: safe, level: this.level });
  }

  #seatPlayerAtSpawn(position = this.respawnPoint) {
    const safe = resolveSafeSpawn(position, this.platforms, this.level, this.player.collider);
    const support = supportingPlatformForSpawn(safe, this.platforms, this.player.collider);
    this.player.cancelThrowCharge?.(this.engine);
    this.player.x = safe.x;
    this.player.y = safe.y;
    this.player.velocity.x = 0;
    this.player.velocity.y = 0;
    if (support) this.player.land(safe.y, support);
    else {
      this.player.grounded = false;
      this.player.groundPlatform = null;
      this.player.jumpsRemaining = this.player.maxJumps;
    }
    this.player.previousPosition.x = safe.x;
    this.player.previousPosition.y = safe.y;
    return safe;
  }

  #buildHud() {
    this.hud = new Screen({ id: 'world-hud', label: 'Mission status' });
    this.hud.element.innerHTML = `
      <div class="deedz-hud deedz-hud--clean">
        <div class="deedz-hud__group deedz-hud__group--primary">
          <span class="deedz-chip deedz-chip--health" data-hp>♥ ${this.player.hp}/${this.player.maxHp}</span>
          <span class="deedz-chip" data-jumps>Flaps ${this.player.jumpsRemaining}/${this.player.maxJumps}</span>
          <span class="deedz-chip" data-ammo>Crumbs ${this.engine.save.get('progress.crumbAmmo', 12)}</span>
          <span class="deedz-chip deedz-chip--echo" data-evolution>Echo L1 · 0/120</span>
        </div>
        <div class="deedz-hud__group deedz-hud__group--secondary">
          <span class="deedz-chip deedz-chip--quest" data-adventure>Adventure · 0 crumbs · 0 finds · 0 foxes · 0/${this.level.requiredCrystals} echoes</span>
          <span class="deedz-chip" data-flock>Flock 0/180</span>
          <span class="deedz-chip deedz-chip--boss" data-boss>Boss Dormant</span>
          <span class="deedz-chip deedz-chip--network" data-network>● ${this.engine.network.status} · ${this.engine.network.peers.size + 1} geese</span>
        </div>
      </div>`;
    this.engine.ui.register(this.hud);
    this.engine.ui.show(this.hud.id);
    this.hudHp = this.hud.element.querySelector('[data-hp]');
    this.hudJumps = this.hud.element.querySelector('[data-jumps]');
    this.hudAmmo = this.hud.element.querySelector('[data-ammo]');
    this.hudAdventure = this.hud.element.querySelector('[data-adventure]');
    this.hudEvolution = this.hud.element.querySelector('[data-evolution]');
    this.hudFlock = this.hud.element.querySelector('[data-flock]');
    this.hudBoss = this.hud.element.querySelector('[data-boss]');
    this.hudNetwork = this.hud.element.querySelector('[data-network]');
    this.objectiveState = {
      crumbs: this.engine.save.get('progress.crumbs', 0),
      collectibles: this.engine.save.get('progress.collectibles', 0),
      enemies: this.engine.save.get('progress.enemies', 0),
    };
    this.activeCrystals = 0;
    this.#updateAdventureHud();
  }

  #updateAdventureHud() {
    if (!this.hudAdventure) return;
    const state = this.objectiveState ?? {};
    this.hudAdventure.textContent = `Adventure · ${state.crumbs ?? 0} crumbs · ${state.collectibles ?? 0} finds · ${state.enemies ?? 0} foxes · ${this.activeCrystals ?? 0}/${this.level.requiredCrystals} echoes`;
  }

  #updateHud(state) {
    this.objectiveState = { ...(this.objectiveState ?? {}), ...(state ?? {}) };
    if (this.hudAmmo) this.hudAmmo.textContent = `Crumbs ${this.engine.save.get('progress.crumbAmmo', 0)}`;
    this.#updateAdventureHud();
  }

  #updateJumpHud() {
    if (this.hudJumps) this.hudJumps.textContent = `Flaps ${this.player.jumpsRemaining}/${this.player.maxJumps}`;
  }

  #updateCrystalHud() {
    const active = this.engine.entities.findByTag('crystal').filter((crystal) => crystal.activated).length;
    this.activeCrystals = active;
    this.#updateAdventureHud();
    this.exit?.setLocked(active < this.level.requiredCrystals || !this.evolution?.ready || Boolean(this.evolution?.shared?.boss?.active));
    if (active === this.level.requiredCrystals && !this.crystalGateAnnounced) {
      this.crystalGateAnnounced = true;
      this.engine.ui.toast('All Echo Crystals are awake! Fill the Echo meter to evolve the world at Foxfire Gate.', { type: 'success', duration: 4200 });
      this.engine.events.emit('achievement:unlock', { id: 'echo-master' });
    }
  }

  #updateEvolutionHud(state = this.evolution?.snapshot?.()) {
    if (!state) return;
    if (this.hudEvolution) this.hudEvolution.textContent = `Echo L${state.level} · ${state.xp}/${state.goal}${state.ready ? ' READY' : ''}`;
    if (this.hudFlock) this.hudFlock.textContent = `Flock ${state.shared.flockEnergy}/${state.shared.flockGoal}`;
    if (this.hudBoss) {
      const boss = state.shared.boss;
      this.hudBoss.textContent = boss?.active
        ? `Breadstorm P${boss.phase} · ${boss.hp}/${boss.maxHp}${boss.shield > 0 ? ` · Shield ${boss.shield}` : ''}`
        : `Boss Wins ${state.shared.bossWins}`;
      const nextIntensity = boss?.active ? Math.min(1, 0.34 + (Number(boss.phase) || 1) * 0.2) : 0;
      if (Math.abs(nextIntensity - (this.musicIntensity ?? 0)) > 0.05) {
        this.musicIntensity = nextIntensity;
        this.updateEvolutionMusic(state.stage, state.level, nextIntensity);
      }
    }
    this.#updateCrystalHud();
  }

  #updateNetworkHud() {
    if (!this.hudNetwork) return;
    const latency = this.engine.network.latency === null ? '' : ` · ${this.engine.network.latency}ms`;
    this.hudNetwork.textContent = `● ${this.engine.network.status}${latency} · ${this.engine.network.peers.size + 1} geese`;
  }

  #unlockAchievement(id) {
    const unlocked = new Set(this.engine.save.get('achievements', []));
    if (unlocked.has(id)) return;
    unlocked.add(id);
    this.engine.save.set('achievements', [...unlocked]);
    const achievement = achievements.find((item) => item.id === id);
    this.engine.ui.toast(`Achievement: ${achievement?.name ?? id}`, { type: 'success' });
  }

  #respawn(defeated = false, safetyReason = null) {
    this.player.hp = this.player.maxHp;
    this.player.invulnerable = 1.2;
    const safe = this.#seatPlayerAtSpawn(this.respawnPoint);
    this.respawnPoint = { ...safe };
    this.spawnGuardFrames = 4;
    this.safety?.reset();
    this.engine.events.emit('player:health', { hp: this.player.hp, maxHp: this.player.maxHp });
    this.#updateJumpHud();
    const message = defeated
      ? 'Goose down. The flock returns from the last Goose Post.'
      : safetyReason
        ? 'Map escape detected! Deedz was safely returned to the last Goose Post.'
        : 'Returned to the last Goose Post.';
    this.engine.ui.toast(message, { type: 'warning', duration: safetyReason ? 3000 : 2200 });
  }

  #handleCollision({ a, b }) {
    const player = a.entity.hasTag('player') ? a.entity : b.entity.hasTag('player') ? b.entity : null;
    if (!player) return;
    const other = a.entity === player ? b.entity : a.entity;
    if (other.hasTag('level-exit')) this.#checkExit();
    else if (other.hasTag('checkpoint')) this.#activateCheckpoint(other);
    else if (other.hasTag('hazard')) {
      if (this.player.takeDamage(1, other, this.engine)) this.#respawn(false);
    }
  }

  #activateCheckpoint(checkpoint) {
    if (!checkpoint.activate()) return;
    this.respawnPoint = { x: checkpoint.x, y: checkpoint.y - 115 };
    this.engine.save.set('progress.checkpoint', checkpoint.checkpointId);
    this.engine.ui.toast(`${checkpoint.checkpointId.replaceAll('-', ' ')} reached. Respawn point updated!`, { type: 'success', duration: 2600 });
  }

  #checkExit() {
    if (this.exitWarningCooldown > 0) return;
    const activeCrystals = this.engine.entities.findByTag('crystal').filter((crystal) => crystal.activated).length;
    if (activeCrystals < this.level.requiredCrystals) {
      this.exitWarningCooldown = 2;
      this.engine.ui.toast(`The Foxfire Gate needs ${this.level.requiredCrystals - activeCrystals} more Echo Crystal${this.level.requiredCrystals - activeCrystals === 1 ? '' : 's'}. HONK!`, { type: 'warning', duration: 2600 });
      return;
    }
    if (this.evolution?.shared?.boss?.active) {
      this.exitWarningCooldown = 2;
      this.engine.ui.toast('Baron Breadstorm is warping the gate. Defeat the boss with the flock first!', { type: 'danger', duration: 3000 });
      return;
    }
    if (!this.evolution?.ready) {
      const needed = Math.max(0, this.evolution.goal - this.evolution.state.xp);
      this.exitWarningCooldown = 2;
      this.engine.ui.toast(`Your Echo Layer needs ${needed} more XP. Explore, collect, honk, and defeat foxes!`, { type: 'warning', duration: 3000 });
      return;
    }
    this.exitWarningCooldown = 2.5;
    this.evolution.completeEvolution();
  }

  #applyWorldState(worldState = {}) {
    for (const crystalId of worldState?.activatedCrystals ?? []) {
      this.engine.entities.get(`crystal-${crystalId}`)?.activate?.(this.engine, { synced: true });
    }
    for (const enemyId of worldState?.defeatedEnemies ?? []) {
      const enemy = this.engine.entities.get(`enemy-${enemyId}`);
      if (enemy) this.engine.entities.remove(enemy);
    }
    this.evolution?.applySharedState(worldState);
    this.#updateCrystalHud();
  }

  fixedUpdate(dt) {
    this.exitWarningCooldown = Math.max(0, this.exitWarningCooldown - dt);
    if (this.engine.input.wasPressed('pause')) {
      this.engine.scenes.push('pause');
      return;
    }
    if (this.spawnGuardFrames > 0) {
      this.spawnGuardFrames -= 1;
      const safe = this.#seatPlayerAtSpawn(this.respawnPoint);
      this.respawnPoint = { ...safe };
      this.safety?.reset();
      return;
    }
    this.#resolvePlatforms();
    if (this.safety?.fixedUpdate(dt)) return;
    for (const enemy of this.engine.entities.findByTag('enemy')) {
      if (enemy.y > this.level.height + 260) {
        enemy.x = enemy.spawn.x;
        enemy.y = enemy.spawn.y;
        enemy.velocity.x = 0;
        enemy.velocity.y = 0;
        enemy.grounded = false;
      }
    }
    this.story.update(this.player);
    this.#updateJumpHud();
    this.engine.network.sendState({
      x: Math.round(this.player.x * 10) / 10,
      y: Math.round(this.player.y * 10) / 10,
      facing: this.player.facing,
      character: this.player.character.id,
      velocityX: Math.round(this.player.velocity.x),
      velocityY: Math.round(this.player.velocity.y),
      grounded: this.player.grounded,
      crouching: this.player.crouching,
      evolutionLevel: this.evolution?.state.level ?? 1,
    });
  }

  update(dt) {
    this.#updateNetworkHud();
    this.evolution?.update();
    this.flockSense?.update(dt);
  }

  #resolvePlatforms() {
    const movers = [this.player, ...this.engine.entities.findByTag('enemy').filter((enemy) => !enemy.hasTag('boss'))];
    for (const entity of movers) {
      const previousGround = entity.groundPlatform;
      if (entity.grounded && previousGround && !previousGround.destroyed) {
        entity.x += previousGround.delta.x;
        entity.y += previousGround.delta.y;
      }
      entity.grounded = false;
      entity.groundPlatform = null;
      const collider = entity.collider;
      if (!collider || entity.velocity.y < 0) continue;
      for (const platform of this.platforms) {
        const p = platform.collider;
        if (!p.enabled) continue;
        const previousPlatformTop = p.top - platform.delta.y;
        const previousBottom = entity.previousPosition.y + collider.offset.y + collider.height / 2;
        const wasAbove = previousBottom <= previousPlatformTop + 12;
        const overlapsX = collider.right > p.left && collider.left < p.right;
        const tolerance = Math.max(42, entity.velocity.y * 0.04 + Math.abs(platform.delta.y) + 10);
        if (wasAbove && overlapsX && collider.bottom >= p.top && collider.bottom <= p.top + tolerance) {
          if (entity.land) entity.land(p.top - collider.offset.y - collider.height / 2, platform);
          else {
            entity.y = p.top - collider.offset.y - collider.height / 2;
            entity.velocity.y = platform.bounce ? -platform.bounce : 0;
            entity.grounded = !platform.bounce;
            entity.groundPlatform = platform.bounce ? null : platform;
          }
          break;
        }
      }
    }
  }

  async exit() {
    this.unsubscribers?.forEach((off) => off());
    this.combat?.destroy();
    this.collectibles?.destroy();
    this.contactDamage?.destroy();
    this.objectives?.destroy();
    this.interactions?.destroy();
    this.networkPlayers?.destroy();
    this.evolution?.destroy();
    this.safety?.destroy();
    this.flockSense?.destroy();
    this.touchControls?.destroy();
    this.engine.audio.music.stop();
    this.engine.ui.remove(this.hud?.id);
    this.engine.entities.clear();
    this.engine.physics.clear();
    this.engine.renderer.camera.unfollow();
    this.engine.renderer.camera.setBounds(null);
    await super.exit();
  }
}
