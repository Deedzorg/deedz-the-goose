import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { approach, distance, signNonZero } from '../../../shared/math.js';
import { enemyDefinition } from '../data/enemies.js';
import { foxCrumbDropCount } from '../data/combat.js';
import { WingBurst } from './ActionEffects.js';
import { Collectible } from './Collectible.js';

class LobbedCrumb extends Entity {
  constructor({ x, y, direction = 1, level = 1 } = {}) {
    super({ name: 'LobbedCrumb', tags: ['enemy-projectile'] });
    this.x = x;
    this.y = y;
    this.life = 0;
    this.velocity.x = direction * (285 + Math.min(120, level * 12));
    this.velocity.y = -390;
    this.gravity = 920;
    this.art = new Graphics().circle(0, 0, 13).fill(0xd9a8ff).stroke({ width: 4, color: 0x6f3e92 });
    this.art.moveTo(-5, -5).lineTo(5, 5).moveTo(5, -5).lineTo(-5, 5).stroke({ width: 2, color: 0xffecb0 });
    this.display.addChild(this.art);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.life += dt;
    this.velocity.y += this.gravity * dt;
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
    this.display.rotation += dt * 7;
    const player = engine.entities.findByTag('player')[0];
    if (player && distance(this.x, this.y, player.x, player.y) <= 46) {
      player.takeDamage?.(1, this, engine);
      engine.entities.add(new WingBurst({ x: this.x, y: this.y, color: 0xd9a8ff, count: 8, label: 'SPLAT!' }), this.display.parent);
      engine.entities.remove(this);
    } else if (this.y >= 930 || this.life >= 2.5) {
      engine.entities.add(new WingBurst({ x: this.x, y: Math.min(this.y, 930), color: 0xd9a8ff, count: 5 }), this.display.parent);
      engine.entities.remove(this);
    }
  }
}

export class Enemy extends Entity {
  constructor({ id = null, x = 0, y = 0, patrol = 170, rank = 'scout', archetype = 'charger', name = null, level = 1 } = {}) {
    const definition = enemyDefinition(archetype);
    super({ id: id ? `enemy-${id}` : undefined, name: definition.name, tags: ['enemy', 'damageable', definition.species ?? 'fox'] });
    if (definition.flying) this.addTag('flying-enemy');
    this.enemyId = id ?? this.id;
    this.x = x;
    this.y = y;
    this.spawn = { x, y };
    this.originX = x;
    this.patrol = Math.max(80, patrol);
    this.rank = rank;
    this.archetype = definition.id;
    this.definition = definition;
    this.displayName = name || this.definition.name;
    this.level = Math.max(1, Math.floor(Number(level) || 1));
    this.direction = 1;
    this.hp = Math.max(2, (rank === 'captain' ? 7 : rank === 'guard' ? 4 : 3) + this.definition.hpBonus + Math.floor((this.level - 1) / 3));
    this.maxHp = this.hp;
    this.state = 'patrol';
    this.stateTime = 0;
    this.stunTimer = 0;
    this.attackCooldown = Math.random() * 0.5;
    this.defeated = false;
    this.lastPlayerImpactAt = Number.NEGATIVE_INFINITY;
    this.grounded = false;
    this.groundPlatform = null;
    const large = rank === 'captain' || this.archetype === 'brute' || this.archetype === 'penguin';
    const flying = this.archetype === 'bat';
    this.collider = new Collider(this, { width: flying ? 68 : large ? 86 : 72, height: flying ? 42 : large ? 60 : 50, layer: 4, mask: 193 });
    this.#draw();
  }

  #draw() {
    this.art = new Container();
    const scale = (this.rank === 'captain' ? 1.18 : 1) * this.definition.scale;
    this.art.scale.set(scale);

    this.tail = new Graphics();
    this.body = new Graphics();
    this.bread = new Graphics();
    if (this.archetype === 'penguin') this.#drawPenguin();
    else if (this.archetype === 'bat') this.#drawBat();
    else this.#drawFox();

    if (this.rank === 'captain') {
      this.crown = new Graphics().moveTo(12, -51).lineTo(20, -70).lineTo(29, -55).lineTo(40, -72).lineTo(46, -49).closePath().fill(0xffd95a).stroke({ width: 3, color: 0x9a6237 });
      this.art.addChild(this.crown);
    }

    if (this.archetype === 'pouncer') {
      this.marker = new Graphics().moveTo(-4, -49).lineTo(6, -66).lineTo(16, -49).closePath().fill(0xff6f8b);
      this.art.addChild(this.marker);
    } else if (this.archetype === 'lobber') {
      this.marker = new Graphics().circle(-24, -26, 12).fill(0x6f3e92).circle(-24, -26, 5).fill(0xd9a8ff);
      this.art.addChild(this.marker);
    } else if (this.archetype === 'brute') {
      this.marker = new Graphics().roundRect(-35, -18, 70, 35, 9).fill({ color: 0x24405f, alpha: 0.72 }).stroke({ width: 4, color: 0x8de7ff });
      this.art.addChild(this.marker);
    }

    this.alert = new Text({ text: '!', style: { fill: 0xffd95a, fontSize: 34, fontWeight: '900', stroke: { color: 0x07111f, width: 6 } } });
    this.alert.anchor.set(0.5);
    this.alert.y = -82;
    this.alert.visible = false;

    this.healthBar = new Graphics();
    this.healthBar.y = this.archetype === 'bat' ? -58 : -70;
    this.art.addChild(this.tail, this.body, this.bread, this.healthBar, this.alert);
    this.display.addChild(this.art);
    this.#drawHealth();
  }

  #drawFox() {
    this.tail.moveTo(-30, -2).bezierCurveTo(-70, -38, -86, 4, -48, 18).stroke({ width: 13, color: 0xf08b42 });
    this.tail.moveTo(-52, 11).bezierCurveTo(-66, 8, -74, 5, -80, -4).stroke({ width: 7, color: 0xffe8cc });
    this.body.ellipse(0, 0, 37, 24).fill(this.definition.bodyColor);
    this.body.circle(29, -21, 19).fill(this.definition.bodyColor);
    this.body.moveTo(18, -34).lineTo(15, -55).lineTo(32, -39).closePath().fill(0xd75f28);
    this.body.moveTo(38, -35).lineTo(50, -53).lineTo(51, -29).closePath().fill(0xd75f28);
    this.body.moveTo(39, -17).lineTo(58, -10).lineTo(40, -5).closePath().fill(0xffd9b3);
    this.body.circle(35, -26, 3).fill(0x07111f);
    this.body.moveTo(-18, 18).lineTo(-24, 35).stroke({ width: 6, color: 0x472b24 });
    this.body.moveTo(18, 18).lineTo(23, 35).stroke({ width: 6, color: 0x472b24 });
    this.bread.roundRect(-12, -23, 27, 24, 8).fill(this.definition.breadColor).stroke({ width: 3, color: 0xf7ca76 });
    this.bread.moveTo(-6, -18).lineTo(-2, -7).moveTo(3, -18).lineTo(7, -7).stroke({ width: 2, color: 0x9a6237 });
  }

  #drawPenguin() {
    this.tail.ellipse(-33, 2, 11, 29).fill(0x172333).stroke({ width: 3, color: 0x8de7ff });
    this.body.ellipse(0, 0, 34, 40).fill(this.definition.bodyColor).stroke({ width: 4, color: 0x8de7ff });
    this.body.ellipse(5, 6, 23, 30).fill(0xf1f7ff);
    this.body.circle(8, -31, 22).fill(0x172333);
    this.body.circle(14, -35, 3).fill(0xffffff);
    this.body.circle(15, -35, 1.5).fill(0x07111f);
    this.body.moveTo(27, -29).lineTo(47, -22).lineTo(26, -15).closePath().fill(0xffa62b);
    this.body.ellipse(-14, 39, 18, 6).fill(0xffa62b);
    this.body.ellipse(18, 39, 18, 6).fill(0xffa62b);
    this.bread.roundRect(-21, -5, 42, 11, 5).fill(this.definition.breadColor).stroke({ width: 3, color: 0xffffff });
  }

  #drawBat() {
    this.tail.moveTo(-12, -3).bezierCurveTo(-48, -34, -64, -18, -48, 8).bezierCurveTo(-30, -1, -24, 22, -8, 8).closePath().fill(0x704f9a).stroke({ width: 3, color: 0xb794ff });
    this.body.moveTo(12, -3).bezierCurveTo(48, -34, 64, -18, 48, 8).bezierCurveTo(30, -1, 24, 22, 8, 8).closePath().fill(0x704f9a).stroke({ width: 3, color: 0xb794ff });
    this.body.ellipse(0, 0, 22, 28).fill(this.definition.bodyColor);
    this.body.moveTo(-14, -20).lineTo(-19, -39).lineTo(-3, -24).closePath().fill(0x39254f);
    this.body.moveTo(14, -20).lineTo(19, -39).lineTo(3, -24).closePath().fill(0x39254f);
    this.body.circle(-7, -8, 4).fill(0xffd95a).circle(7, -8, 4).fill(0xffd95a);
    this.body.circle(-7, -8, 1.8).fill(0x07111f).circle(7, -8, 1.8).fill(0x07111f);
    this.body.moveTo(-7, 14).lineTo(-3, 22).lineTo(0, 14).lineTo(4, 22).lineTo(8, 14).stroke({ width: 3, color: 0xd8c7ff });
    this.bread.roundRect(-11, 19, 22, 14, 5).fill(this.definition.breadColor).stroke({ width: 3, color: 0xfff1a8 });
  }

  #drawHealth() {
    this.healthBar.clear();
    if (this.hp >= this.maxHp) return;
    this.healthBar.roundRect(-31, 0, 62, 8, 4).fill(0x07111f);
    this.healthBar.roundRect(-29, 2, 58 * Math.max(0, this.hp / this.maxHp), 4, 2).fill(0xff5f67);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.stateTime += dt;
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const player = engine.entities.findByTag('player')[0];

    if (!player || player.hp <= 0) {
      this.#setState('patrol');
      if (this.archetype === 'bat') this.#batPatrol(dt, engine);
      else this.#patrol(dt);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const playerDistance = distance(this.x, this.y, player.x, player.y);

    if (this.stunTimer > 0) {
      this.#setState('stunned');
      this.velocity.x = approach(this.velocity.x, 0, 420 * dt);
      if (this.archetype === 'bat') this.velocity.y = approach(this.velocity.y, 0, 420 * dt);
    } else if (this.archetype === 'bat') {
      this.#bat(dt, engine, { player, dx, dy, playerDistance });
    } else if (this.archetype === 'penguin') {
      this.#penguin(dt, { dx, dy, playerDistance });
    } else if (this.archetype === 'lobber') {
      this.#lobber(dt, engine, { player, dx, dy, playerDistance });
    } else if (this.state === 'windup') {
      this.velocity.x = approach(this.velocity.x, 0, 900 * dt);
      if (this.stateTime >= 0.38) {
        this.direction = signNonZero(dx, this.direction);
        const chargeSpeed = this.archetype === 'brute' ? 480 : this.rank === 'captain' ? 500 : this.archetype === 'pouncer' ? 350 : 420;
        this.velocity.x = this.direction * chargeSpeed * (1 + Math.min(0.35, (this.level - 1) * 0.035));
        this.velocity.y = this.archetype === 'pouncer' ? -510 : -90;
        this.#setState('charge');
      }
    } else if (this.state === 'charge') {
      const chargeDuration = this.archetype === 'pouncer' ? 0.72 : this.archetype === 'brute' ? 0.62 : 0.48;
      if (this.stateTime >= chargeDuration || Math.abs(dx) > 620) {
        this.attackCooldown = this.archetype === 'brute' ? 1.15 : 0.85;
        this.#setState('chase');
      }
    } else if (playerDistance < (this.archetype === 'pouncer' ? 210 : this.archetype === 'brute' ? 155 : 125) && Math.abs(dy) < 130 && this.attackCooldown <= 0) {
      this.direction = signNonZero(dx, this.direction);
      this.#setState('windup');
    } else if (playerDistance < (this.rank === 'captain' ? 720 : 520) && Math.abs(dy) < 240) {
      this.#setState('chase');
      this.direction = signNonZero(dx, this.direction);
      const baseSpeed = this.archetype === 'brute' ? 118 : this.archetype === 'pouncer' ? 180 : this.rank === 'captain' ? 205 : 155;
      const chaseSpeed = baseSpeed * (1 + Math.min(0.35, (this.level - 1) * 0.035));
      this.velocity.x = approach(this.velocity.x, this.direction * chaseSpeed, 650 * dt);
    } else {
      this.#setState('patrol');
      this.#patrol(dt);
    }

    if (Math.abs(this.x - this.spawn.x) > this.patrol * 3 && playerDistance > 850) {
      this.direction = signNonZero(this.spawn.x - this.x, this.direction);
      this.velocity.x = approach(this.velocity.x, this.direction * 175, 700 * dt);
    }

    this.art.scale.x = Math.abs(this.art.scale.x) * this.direction;
    this.alert.scale.x = this.direction;
    this.healthBar.scale.x = this.direction;
    this.alert.visible = ['windup', 'lob-windup', 'slide-windup', 'swoop-windup', 'chase'].includes(this.state);
    const runRate = Math.min(1, Math.abs(this.velocity.x) / 260);
    this.body.y = Math.sin(engine.loop.time.elapsed * 14) * 2 * runRate;
    this.tail.rotation = this.archetype === 'bat'
      ? Math.sin(engine.loop.time.elapsed * 19 + this.x * 0.01) * 0.34
      : Math.sin(engine.loop.time.elapsed * 7 + this.x * 0.01) * 0.18;
  }

  #bat(dt, engine, { dx, dy, playerDistance }) {
    this.direction = signNonZero(dx, this.direction);
    if (this.state === 'swoop-windup') {
      this.velocity.x = approach(this.velocity.x, 0, 920 * dt);
      this.velocity.y = approach(this.velocity.y, -70, 760 * dt);
      if (this.stateTime >= 0.3) {
        this.velocity.x = this.direction * (520 + Math.min(170, this.level * 9));
        this.velocity.y = Math.max(160, Math.min(520, dy * 2.4));
        this.#setState('swoop');
      }
      return;
    }
    if (this.state === 'swoop') {
      if (this.stateTime >= 0.68) {
        this.attackCooldown = Math.max(this.attackCooldown, 1.8);
        this.#setState('retreat');
      }
      return;
    }
    if (this.state === 'retreat') {
      const retreatY = this.spawn.y - 45;
      this.velocity.x = approach(this.velocity.x, -this.direction * 260, 700 * dt);
      this.velocity.y = approach(this.velocity.y, (retreatY - this.y) * 2.2, 880 * dt);
      if (this.stateTime >= 0.9) this.#setState('patrol');
      return;
    }
    if (playerDistance < 760) {
      this.#setState('chase');
      const targetY = this.y + dy - 145;
      this.velocity.x = approach(this.velocity.x, Math.max(-330, Math.min(330, dx * 1.35)), 680 * dt);
      this.velocity.y = approach(this.velocity.y, Math.max(-260, Math.min(260, (targetY - this.y) * 1.7)), 650 * dt);
      if (this.attackCooldown <= 0 && Math.abs(dx) < 300 && dy > 25 && dy < 310) this.#setState('swoop-windup');
      return;
    }
    this.#batPatrol(dt, engine);
  }

  #batPatrol(dt, engine) {
    const targetY = this.spawn.y + Math.sin((engine.loop?.time?.elapsed ?? 0) * 1.7 + this.originX * 0.01) * 55;
    if (Math.abs(this.x - this.originX) >= this.patrol) this.direction *= -1;
    this.velocity.x = approach(this.velocity.x, this.direction * 125, 420 * dt);
    this.velocity.y = approach(this.velocity.y, (targetY - this.y) * 2.4, 520 * dt);
  }

  #penguin(dt, { dx, dy, playerDistance }) {
    this.direction = signNonZero(dx, this.direction);
    if (this.state === 'slide-windup') {
      this.velocity.x = approach(this.velocity.x, 0, 1000 * dt);
      if (this.stateTime >= 0.44) {
        this.velocity.x = this.direction * (610 + Math.min(170, this.level * 8));
        this.#setState('ice-slide');
      }
      return;
    }
    if (this.state === 'ice-slide') {
      if (this.stateTime >= 0.75 || Math.abs(dx) > 720) {
        this.attackCooldown = 1.35;
        this.#setState('chase');
      }
      return;
    }
    if (playerDistance < 430 && Math.abs(dy) < 115 && this.attackCooldown <= 0) {
      this.#setState('slide-windup');
      return;
    }
    if (playerDistance < 620 && Math.abs(dy) < 180) {
      this.#setState('chase');
      this.velocity.x = approach(this.velocity.x, this.direction * 135, 520 * dt);
      return;
    }
    this.#setState('patrol');
    this.#patrol(dt);
  }

  #lobber(dt, engine, { player, dx, dy, playerDistance }) {
    this.direction = signNonZero(dx, this.direction);
    if (this.state === 'lob-windup') {
      this.velocity.x = approach(this.velocity.x, 0, 850 * dt);
      if (this.stateTime >= 0.52) {
        engine.entities.add(new LobbedCrumb({ x: this.x + this.direction * 28, y: this.y - 45, direction: this.direction, level: this.level }), this.display.parent);
        this.attackCooldown = Math.max(1.25, 2.05 - this.level * 0.045);
        this.#setState('chase');
      }
      return;
    }
    if (playerDistance >= 235 && playerDistance <= 660 && Math.abs(dy) < 260 && this.attackCooldown <= 0) {
      this.#setState('lob-windup');
      return;
    }
    if (playerDistance < 215) {
      this.#setState('chase');
      this.velocity.x = approach(this.velocity.x, -this.direction * 175, 720 * dt);
    } else if (playerDistance < 760 && Math.abs(dy) < 280) {
      this.#setState('chase');
      const desired = playerDistance > 430 ? this.direction * 118 : 0;
      this.velocity.x = approach(this.velocity.x, desired, 540 * dt);
    } else {
      this.#setState('patrol');
      this.#patrol(dt);
    }
  }

  #patrol(dt) {
    const left = this.originX - this.patrol;
    const right = this.originX + this.patrol;
    if (this.direction > 0 && this.x >= right) this.direction = -1;
    else if (this.direction < 0 && this.x <= left) this.direction = 1;
    this.velocity.x = approach(this.velocity.x, this.direction * 92, 420 * dt);
  }

  #setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }

  land(y, platform = null) {
    if (this.hasTag('flying-enemy')) return;
    this.y = y;
    if (platform?.bounce) {
      this.velocity.y = -platform.bounce * 0.72;
      this.grounded = false;
      this.groundPlatform = null;
      return;
    }
    this.velocity.y = 0;
    this.grounded = true;
    this.groundPlatform = platform;
  }

  crumbDropCount() {
    if (this.archetype === 'bat') return 2;
    if (this.archetype === 'penguin') return this.rank === 'captain' ? 4 : 3;
    return foxCrumbDropCount(this.rank);
  }

  onPlayerHit(player, engine) {
    if (!this.definition.stealsCrumbs || !player) return 0;
    this.attackCooldown = Math.max(this.attackCooldown, 2.2);
    this.#setState('retreat');
    this.velocity.x = -this.direction * 330;
    this.velocity.y = -310;
    return player.dropRecoverableCrumbs?.(engine, { source: this, maximum: 3 }) ?? 0;
  }

  markPlayerImpact(engine) {
    this.lastPlayerImpactAt = Number(engine?.loop?.time?.elapsed) || 0;
  }

  wasRecentlyPlayerPushed(engine, windowSeconds = 3) {
    const now = Number(engine?.loop?.time?.elapsed) || 0;
    return Number.isFinite(this.lastPlayerImpactAt) && now - this.lastPlayerImpactAt <= windowSeconds;
  }

  resetToSpawn() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.previousPosition.x = this.x;
    this.previousPosition.y = this.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.grounded = false;
    this.groundPlatform = null;
    this.lastPlayerImpactAt = Number.NEGATIVE_INFINITY;
    this.#setState('patrol');
  }

  #dropCrumbs(engine, count = this.crumbDropCount(), { cause = 'combat', source = null } = {}) {
    const total = Math.max(0, Math.min(6, Math.floor(Number(count) || 0)));
    const parent = this.display.parent;
    if (!parent) return;
    const defeatKey = `${this.enemyId}-${Math.floor(engine.loop?.time?.elapsed * 1000 || Date.now())}`;
    const dropX = cause === 'fall' ? this.spawn.x : this.x;
    const dropY = cause === 'fall'
      ? this.spawn.y - 58
      : cause === 'water'
        ? Math.min(this.y - 52, Number(source?.collider?.top) - 42 || this.y - 52)
        : this.y - 52;
    for (let index = 0; index < total; index += 1) {
      const offset = (index - (total - 1) / 2) * 34;
      const crumb = new Collectible({
        id: `fox-drop-${defeatKey}-${index}`,
        type: 'crumb',
        x: dropX + offset,
        y: dropY - (index % 2) * 20,
        value: 1,
      });
      crumb.addTag('fox-drop');
      engine.entities.addImmediate(crumb, parent);
      engine.physics.addBody(crumb, { static: true });
      engine.physics.addCollider(crumb.collider);
    }
  }

  defeat(engine, { cause = 'combat', source = null, reward = true, dropCrumbs = true, crumbCount = this.crumbDropCount() } = {}) {
    if (this.destroyed || this.defeated) return false;
    if (this.hasTag('goose-lab-spawn')) {
      reward = false;
      dropCrumbs = false;
    }
    this.defeated = true;
    this.hp = 0;
    this.collider.enabled = false;
    this.velocity.x = 0;
    this.velocity.y = 0;
    if (dropCrumbs) this.#dropCrumbs(engine, crumbCount, { cause, source });
    const noun = this.definition.species === 'bat' ? 'BAT' : this.definition.species === 'penguin' ? 'PENGUIN' : 'FOX';
    const label = cause === 'stomp' ? 'STOMP!' : cause === 'water' ? 'SPLASH!' : cause === 'fall' ? `${noun} FELL!` : `${noun} DOWN!`;
    const color = cause === 'water' ? 0x55d6ff : cause === 'stomp' ? 0xffd95a : 0xffa65a;
    engine.entities.add(new WingBurst({ x: this.x, y: this.y - 24, color, count: 12, label }), this.display.parent);
    if (reward) {
      engine.events.emit('enemy:defeated', { enemy: this, cause, source, crumbCount: Math.max(0, Number(crumbCount) || 0) });
      engine.events.emit('achievement:unlock', { id: this.rank === 'captain' ? 'fox-captain' : 'fox-felled' });
    }
    engine.entities.remove(this);
    return true;
  }

  takeDamage(amount, engine, options = {}) {
    if (this.destroyed || this.defeated || this.hp <= 0) return false;
    this.markPlayerImpact(engine);
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    this.stunTimer = this.rank === 'captain' ? 0.2 : 0.32;
    this.#setState('stunned');
    this.#drawHealth();
    if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(5, 0.1);
    if (this.hp <= 0) this.defeat(engine, options);
    return true;
  }
}
