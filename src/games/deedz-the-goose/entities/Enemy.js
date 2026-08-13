import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { approach, distance, signNonZero } from '../../../shared/math.js';

export class Enemy extends Entity {
  constructor({ id = null, x = 0, y = 0, patrol = 170, rank = 'scout', name = 'Bread Fox', level = 1 } = {}) {
    super({ id: id ? `enemy-${id}` : undefined, name: 'BreadFox', tags: ['enemy', 'damageable', 'fox'] });
    this.enemyId = id ?? this.id;
    this.x = x;
    this.y = y;
    this.spawn = { x, y };
    this.originX = x;
    this.patrol = Math.max(80, patrol);
    this.rank = rank;
    this.displayName = name;
    this.level = Math.max(1, Math.floor(Number(level) || 1));
    this.direction = 1;
    this.hp = (rank === 'captain' ? 7 : rank === 'guard' ? 4 : 3) + Math.floor((this.level - 1) / 2);
    this.maxHp = this.hp;
    this.state = 'patrol';
    this.stateTime = 0;
    this.stunTimer = 0;
    this.attackCooldown = Math.random() * 0.5;
    this.grounded = false;
    this.groundPlatform = null;
    this.collider = new Collider(this, { width: rank === 'captain' ? 86 : 72, height: rank === 'captain' ? 60 : 50, layer: 4, mask: 129 });
    this.#draw();
  }

  #draw() {
    this.art = new Container();
    const scale = this.rank === 'captain' ? 1.18 : 1;
    this.art.scale.set(scale);

    this.tail = new Graphics();
    this.tail.moveTo(-30, -2).bezierCurveTo(-70, -38, -86, 4, -48, 18).stroke({ width: 13, color: 0xf08b42 });
    this.tail.moveTo(-52, 11).bezierCurveTo(-66, 8, -74, 5, -80, -4).stroke({ width: 7, color: 0xffe8cc });

    this.body = new Graphics();
    this.body.ellipse(0, 0, 37, 24).fill(0xe87532);
    this.body.circle(29, -21, 19).fill(0xf08b42);
    this.body.moveTo(18, -34).lineTo(15, -55).lineTo(32, -39).closePath().fill(0xd75f28);
    this.body.moveTo(38, -35).lineTo(50, -53).lineTo(51, -29).closePath().fill(0xd75f28);
    this.body.moveTo(39, -17).lineTo(58, -10).lineTo(40, -5).closePath().fill(0xffd9b3);
    this.body.circle(35, -26, 3).fill(0x07111f);
    this.body.moveTo(-18, 18).lineTo(-24, 35).stroke({ width: 6, color: 0x472b24 });
    this.body.moveTo(18, 18).lineTo(23, 35).stroke({ width: 6, color: 0x472b24 });

    this.bread = new Graphics();
    this.bread.roundRect(-12, -23, 27, 24, 8).fill(0xd69b4f).stroke({ width: 3, color: 0xf7ca76 });
    this.bread.moveTo(-6, -18).lineTo(-2, -7).moveTo(3, -18).lineTo(7, -7).stroke({ width: 2, color: 0x9a6237 });

    if (this.rank === 'captain') {
      this.crown = new Graphics().moveTo(12, -51).lineTo(20, -70).lineTo(29, -55).lineTo(40, -72).lineTo(46, -49).closePath().fill(0xffd95a).stroke({ width: 3, color: 0x9a6237 });
      this.art.addChild(this.crown);
    }

    this.alert = new Text({ text: '!', style: { fill: 0xffd95a, fontSize: 34, fontWeight: '900', stroke: { color: 0x07111f, width: 6 } } });
    this.alert.anchor.set(0.5);
    this.alert.y = -82;
    this.alert.visible = false;

    this.healthBar = new Graphics();
    this.healthBar.y = -70;
    this.art.addChild(this.tail, this.body, this.bread, this.healthBar, this.alert);
    this.display.addChild(this.art);
    this.#drawHealth();
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
      this.#patrol(dt);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const playerDistance = distance(this.x, this.y, player.x, player.y);

    if (this.stunTimer > 0) {
      this.#setState('stunned');
      this.velocity.x = approach(this.velocity.x, 0, 420 * dt);
    } else if (this.state === 'windup') {
      this.velocity.x = approach(this.velocity.x, 0, 900 * dt);
      if (this.stateTime >= 0.38) {
        this.direction = signNonZero(dx, this.direction);
        this.velocity.x = this.direction * (this.rank === 'captain' ? 500 : 420) * (1 + Math.min(0.35, (this.level - 1) * 0.035));
        this.velocity.y = -90;
        this.#setState('charge');
      }
    } else if (this.state === 'charge') {
      if (this.stateTime >= 0.48 || Math.abs(dx) > 620) {
        this.attackCooldown = 0.85;
        this.#setState('chase');
      }
    } else if (playerDistance < 125 && Math.abs(dy) < 100 && this.attackCooldown <= 0) {
      this.direction = signNonZero(dx, this.direction);
      this.#setState('windup');
    } else if (playerDistance < (this.rank === 'captain' ? 720 : 520) && Math.abs(dy) < 240) {
      this.#setState('chase');
      this.direction = signNonZero(dx, this.direction);
      const chaseSpeed = (this.rank === 'captain' ? 205 : 155) * (1 + Math.min(0.35, (this.level - 1) * 0.035));
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
    this.alert.visible = ['windup', 'chase'].includes(this.state);
    const runRate = Math.min(1, Math.abs(this.velocity.x) / 260);
    this.body.y = Math.sin(engine.loop.time.elapsed * 14) * 2 * runRate;
    this.tail.rotation = Math.sin(engine.loop.time.elapsed * 7 + this.x * 0.01) * 0.18;
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

  takeDamage(amount, engine) {
    if (this.destroyed || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    this.stunTimer = this.rank === 'captain' ? 0.2 : 0.32;
    this.#setState('stunned');
    this.#drawHealth();
    if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(5, 0.1);
    if (this.hp <= 0) {
      engine.events.emit('enemy:defeated', { enemy: this });
      engine.events.emit('achievement:unlock', { id: this.rank === 'captain' ? 'fox-captain' : 'fox-felled' });
      engine.entities.remove(this);
    }
    return true;
  }
}
