import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { distance, signNonZero } from '../../../shared/math.js';
import { HonkPulse, WingBurst } from './ActionEffects.js';

class BreadBomb extends Entity {
  constructor({ x = 0, y = 0, targetX = x, targetY = y, phase = 1 } = {}) {
    super({ name: 'BreadBomb', tags: ['boss-projectile', 'hazard'] });
    this.x = x;
    this.y = y;
    this.life = 0;
    this.duration = 2.8;
    this.hit = false;
    const travel = Math.max(0.65, 1.25 - phase * 0.12);
    this.velocity.x = (targetX - x) / travel;
    this.velocity.y = (targetY - y) / travel - 720;
    this.gravity = 1120;
    this.art = new Graphics();
    this.art.roundRect(-18, -14, 36, 28, 9).fill(0xd69b4f).stroke({ width: 4, color: 0xffd95a });
    this.art.moveTo(-9, -7).lineTo(-3, 7).moveTo(4, -8).lineTo(10, 6).stroke({ width: 3, color: 0x8d552d });
    this.display.addChild(this.art);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.life += dt;
    this.velocity.y += this.gravity * dt;
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
    this.display.rotation += dt * 5;
    const player = engine.entities.findByTag('player')[0];
    if (!this.hit && player && distance(this.x, this.y, player.x, player.y) <= 54) {
      this.hit = true;
      player.takeDamage?.(1, this, engine);
      engine.entities.add(new WingBurst({ x: this.x, y: this.y, color: 0xffd95a, count: 10, label: 'TOASTED!' }), this.display.parent);
      engine.entities.remove(this);
      return;
    }
    if (this.y >= 930 || this.life >= this.duration) {
      if (!this.hit && player && distance(this.x, this.y, player.x, player.y) <= 125) player.takeDamage?.(1, this, engine);
      engine.entities.add(new WingBurst({ x: this.x, y: Math.min(this.y, 930), color: 0xffb34d, count: 7 }), this.display.parent);
      engine.entities.remove(this);
    }
  }
}

export class BreadstormBoss extends Entity {
  constructor({ state = {}, x = 8800, y = 770 } = {}) {
    super({ id: 'boss-baron-breadstorm', name: 'Baron Breadstorm', tags: ['boss', 'enemy', 'damageable', 'fox'] });
    this.x = x;
    this.y = y;
    this.spawn = { x, y };
    this.displayName = 'BARON BREADSTORM';
    this.hp = Number(state.hp) || 40;
    this.maxHp = Number(state.maxHp) || this.hp;
    this.shield = Number(state.shield) || 0;
    this.maxShield = Number(state.maxShield) || this.shield;
    this.phase = Number(state.phase) || 1;
    this.cycle = Number(state.cycle) || 1;
    this.evolutionLevel = Math.max(2, Number(state.evolutionLevel) || this.cycle + 1);
    this.players = Math.max(1, Number(state.players) || 1);
    this.activeFight = state.active !== false;
    this.spawnedAt = Number(state.spawnedAt) || Date.now();
    this.direction = -1;
    this.state = 'arrival';
    this.stateTime = 0;
    this.attackTimer = 1.2;
    this.invulnerable = 0;
    this.collider = new Collider(this, { width: 154, height: 104, layer: 4, mask: 129 });
    this.#draw();
    this.applySharedState(state);
  }

  #draw() {
    this.art = new Container();
    this.aura = new Graphics().circle(0, -20, 100).fill({ color: 0xff7b42, alpha: 0.12 });
    this.tail = new Graphics().moveTo(-58, -5).bezierCurveTo(-135, -82, -150, 38, -76, 42).stroke({ width: 24, color: 0xe87532 });
    this.tail.moveTo(-92, 30).bezierCurveTo(-115, 25, -131, 8, -139, -9).stroke({ width: 12, color: 0xffe8cc });
    this.body = new Graphics();
    this.body.ellipse(0, 0, 72, 45).fill(0xd85f2d).stroke({ width: 6, color: 0xffa65a });
    this.body.circle(58, -45, 39).fill(0xed7b39).stroke({ width: 5, color: 0xffb66c });
    this.body.moveTo(36, -75).lineTo(32, -118).lineTo(66, -82).closePath().fill(0xb94b29);
    this.body.moveTo(72, -78).lineTo(99, -116).lineTo(103, -61).closePath().fill(0xb94b29);
    this.body.moveTo(77, -35).lineTo(118, -20).lineTo(79, -7).closePath().fill(0xffd9b3);
    this.body.circle(69, -54, 7).fill(0x07111f);
    this.body.circle(72, -56, 2.4).fill(0xffffff);
    this.body.moveTo(-40, 32).lineTo(-50, 73).moveTo(32, 34).lineTo(44, 74).stroke({ width: 12, color: 0x472b24 });

    this.crown = new Graphics();
    this.crown.moveTo(24, -92).lineTo(34, -137).lineTo(54, -110).lineTo(72, -147).lineTo(91, -106).lineTo(113, -136).lineTo(110, -88).closePath().fill(0xffd95a).stroke({ width: 6, color: 0x8d552d });
    this.crown.circle(70, -116, 8).fill(0xb94cff);

    this.toastArmor = new Graphics();
    this.toastArmor.roundRect(-34, -48, 68, 62, 15).fill(0xd69b4f).stroke({ width: 6, color: 0xffd95a });
    this.toastArmor.moveTo(-18, -33).lineTo(-7, -3).moveTo(4, -36).lineTo(17, -5).stroke({ width: 5, color: 0x92562e });

    this.shieldArt = new Graphics().circle(0, -18, 94).fill({ color: 0x55d6ff, alpha: 0.1 }).stroke({ width: 7, color: 0x8de7ff, alpha: 0.78 });
    this.nameText = new Text({ text: this.displayName, style: { fill: 0xffd95a, fontSize: 20, fontWeight: '900', letterSpacing: 2, stroke: { color: 0x07111f, width: 6 } } });
    this.nameText.anchor.set(0.5);
    this.nameText.y = -174;
    this.phaseText = new Text({ text: 'PHASE I', style: { fill: 0xffffff, fontSize: 13, fontWeight: '900', stroke: { color: 0x07111f, width: 4 } } });
    this.phaseText.anchor.set(0.5);
    this.phaseText.y = -148;
    this.healthBar = new Graphics();
    this.healthBar.y = -132;

    this.art.addChild(this.aura, this.tail, this.body, this.toastArmor, this.crown, this.shieldArt, this.healthBar, this.nameText, this.phaseText);
    this.display.addChild(this.art);
    this.#redrawStatus();
  }

  #redrawStatus() {
    const healthRatio = Math.max(0, this.hp / Math.max(1, this.maxHp));
    this.healthBar.clear();
    this.healthBar.roundRect(-92, 0, 184, 16, 8).fill(0x07111f).stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
    this.healthBar.roundRect(-88, 4, 176 * healthRatio, 8, 4).fill(this.phase >= 3 ? 0xff5f67 : this.phase === 2 ? 0xffa24c : 0xffd95a);
    if (this.shield > 0) this.healthBar.roundRect(-88, 18, 176 * Math.min(1, this.shield / Math.max(1, this.maxShield)), 5, 3).fill(0x55d6ff);
    this.shieldArt.visible = this.shield > 0;
    const flock = this.players > 1 ? ` · ${this.players} GEESE` : '';
    this.phaseText.text = `PHASE ${['I', 'II', 'III'][Math.min(2, Math.max(0, this.phase - 1))]} · FORM ${this.cycle}${flock}`;
  }

  applySharedState(state = {}) {
    const previousPhase = this.phase;
    this.hp = Math.max(0, Number(state.hp ?? this.hp));
    this.maxHp = Math.max(1, Number(state.maxHp ?? this.maxHp));
    this.shield = Math.max(0, Number(state.shield ?? this.shield));
    this.maxShield = Math.max(0, Number(state.maxShield ?? this.maxShield));
    this.phase = Math.max(1, Math.min(3, Number(state.phase ?? this.phase)));
    this.cycle = Math.max(1, Number(state.cycle ?? this.cycle));
    this.evolutionLevel = Math.max(2, Number(state.evolutionLevel ?? this.evolutionLevel));
    this.players = Math.max(1, Number(state.players ?? this.players));
    this.spawnedAt = Number(state.spawnedAt ?? this.spawnedAt) || Date.now();
    this.activeFight = state.active !== false && !state.defeated;
    if (this.phase !== previousPhase) {
      this.state = 'phase-shift';
      this.stateTime = 0;
    }
    this.#redrawStatus();
  }

  requestHit(damage, engine, { kind = 'attack', source = null } = {}) {
    if (!this.activeFight || this.invulnerable > 0) return false;
    this.invulnerable = 0.08;
    const payload = {
      bossId: 'baron-breadstorm',
      damage: Math.max(1, Math.min(8, Number(damage) || 1)),
      hitType: kind,
      x: source?.x ?? 0,
      y: source?.y ?? 0,
    };
    const sent = engine.network.sendWorldEvent('boss-hit', payload);
    if (!sent) engine.events.emit('boss:hit-request', payload);
    return true;
  }

  takeDamage(amount, engine, options = {}) { return this.requestHit(amount, engine, options); }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    if (!this.activeFight) return;
    this.stateTime += dt;
    this.attackTimer -= dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    const player = engine.entities.findByTag('player')[0];
    if (!player) return;

    const sharedTime = Math.max(0, (Date.now() - this.spawnedAt) / 1000);
    const sweepRate = 0.42 + this.phase * 0.075;
    this.x = this.spawn.x + Math.sin(sharedTime * sweepRate) * (230 + this.phase * 45);
    this.y = this.spawn.y - 70 + Math.sin(sharedTime * (1.05 + this.phase * 0.08)) * (24 + this.phase * 7);
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.direction = signNonZero(player.x - this.x, this.direction);

    if (this.state === 'arrival' && this.stateTime > 1.0) this.#setState('stalk');
    if (this.state === 'phase-shift') {
      this.aura.scale.set(1 + Math.sin(this.stateTime * 18) * 0.18);
      if (this.stateTime > 1.0) this.#setState('stalk');
    } else if (this.attackTimer <= 0) {
      const attackTier = Math.max(0, Math.floor((this.evolutionLevel - 2) / 2));
      if (this.phase === 1 || attackTier === 0) {
        engine.entities.add(new HonkPulse({ x: this.x, y: this.y, facing: this.direction, radius: 275, color: 0xffd95a, label: 'CROWN CHARGE!' }), this.display.parent);
        if (distance(this.x, this.y, player.x, player.y) <= (attackTier === 0 ? 205 : 235)) {
          player.takeDamage?.(1, this, engine);
          player.applyHonkImpulse?.({ x: this.x, y: this.y, strength: 520 }, engine);
        }
        this.attackTimer = attackTier === 0 ? 1.75 : 1.3;
      } else {
        this.#chooseAttack(player, engine, attackTier);
      }
    }

    this.art.scale.x = Math.abs(this.art.scale.x) * this.direction;
    this.nameText.scale.x = this.direction;
    this.phaseText.scale.x = this.direction;
    this.healthBar.scale.x = this.direction;
    this.shieldArt.scale.x = this.direction;
    this.body.y = Math.sin(sharedTime * (8 + this.phase * 2)) * 3;
    this.tail.rotation = Math.sin(sharedTime * 6) * 0.22;
    this.aura.alpha = 0.7 + Math.sin(sharedTime * 5) * 0.2;
  }

  #chooseAttack(player, engine, attackTier = 1) {
    const roll = Math.random();
    if (roll < (this.phase === 3 ? 0.62 : 0.78)) {
      const bombCount = attackTier === 1 ? 2 : this.phase === 3 ? 6 : 4;
      for (let index = 0; index < bombCount; index += 1) {
        engine.entities.add(new BreadBomb({
          x: this.x + this.direction * 40,
          y: this.y - 100,
          targetX: player.x + (index - (bombCount - 1) / 2) * 105,
          targetY: player.y,
          phase: this.phase,
        }), this.display.parent);
      }
      this.attackTimer = attackTier === 1 ? 2 : this.phase === 3 ? 1.15 : 1.55;
      this.#setState('stalk');
      return;
    }

    engine.entities.add(new HonkPulse({
      x: this.x,
      y: this.y,
      facing: this.direction,
      radius: this.phase === 3 ? 390 : 320,
      color: 0xff7b42,
      label: this.phase === 3 ? 'BREADSTORM!' : 'CRUST BLAST!',
    }), this.display.parent);
    if (distance(this.x, this.y, player.x, player.y) <= (this.phase === 3 ? 390 : 320)) {
      player.applyHonkImpulse?.({ x: this.x, y: this.y, strength: this.phase === 3 ? 780 : 650 }, engine);
      if (distance(this.x, this.y, player.x, player.y) <= (this.phase === 3 ? 285 : 235)) player.takeDamage?.(1, this, engine);
    }
    this.attackTimer = this.phase === 3 ? 1.2 : 1.45;
    this.#setState('stalk');
  }

  #setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }
}
