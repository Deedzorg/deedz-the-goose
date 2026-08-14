import { Container, Graphics } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { approach, clamp, signNonZero } from '../../../shared/math.js';
import { PECK_PROFILE, recoverableCrumbLoss, WING_WHAP_PROFILE } from '../data/combat.js';
import { chargedThrowProfile, THROW_CHARGE } from '../data/throwing.js';
import { WingBurst } from './ActionEffects.js';
import { RecoverableCrumb } from './Collectible.js';

export function movementSpeedForStance(baseSpeed, { crouching = false, grounded = false } = {}) {
  return baseSpeed * (crouching && grounded ? 0.36 : 1);
}

export class PlayerGoose extends Entity {
  constructor({ character, x = 0, y = 0 } = {}) {
    super({ name: 'PlayerGoose', tags: ['player', 'damageable', 'goose'] });
    this.character = character;
    this.x = x;
    this.y = y;
    this.speed = 380;
    this.movementMultiplier = 1;
    this.gravityMultiplier = 1;
    this.acceleration = 2500;
    this.airAcceleration = 1550;
    this.jumpSpeed = 720;
    this.maxJumps = 3;
    this.jumpsRemaining = this.maxJumps;
    this.jumpNumber = 0;
    this.grounded = false;
    this.groundPlatform = null;
    this.coyoteTime = 0;
    this.jumpBuffer = 0;
    this.flightTime = 0;
    this.facing = 1;
    this.hp = 6;
    this.maxHp = 6;
    this.invulnerable = 0;
    this.attackCooldown = 0;
    this.peckCooldown = 0;
    this.throwCooldown = 0;
    this.emptyThrowCooldown = 0;
    this.throwCharging = false;
    this.throwChargeTime = 0;
    this.honkCooldown = 0;
    this.interactCooldown = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.crouching = false;
    this.idleTime = 0;
    this.collider = new Collider(this, { width: 62, height: 48, y: -4, layer: 1, mask: 0xffffffff });
    this.#draw();
  }

  #draw() {
    const presentation = this.character.presentation ?? {};
    const bodyWidth = 34 * (presentation.bodyWidth ?? 1);
    const bodyHeight = 23 * (presentation.bodyHeight ?? 1);
    const headRadius = 15 * (presentation.headScale ?? 1);
    this.art = new Container();
    this.body = new Graphics();
    this.body.ellipse(0, 0, bodyWidth, bodyHeight).fill(this.character.color);
    this.body.circle(30, -24, headRadius).fill(this.character.color);
    this.body.moveTo(40, -25).lineTo(60, -18).lineTo(40, -13).closePath().fill(0xffa62b);
    this.body.circle(34, -29, 2.8).fill(0x07111f);

    this.details = new Graphics();
    if (presentation.detail === 'smile') {
      this.details.circle(31, -21, 3.8).fill({ color: this.character.accent, alpha: 0.72 });
      this.details.arc(33, -23, 7, 0.2, 1.35).stroke({ width: 2.5, color: 0x07111f });
    } else if (presentation.detail === 'crumb') {
      this.details.roundRect(-18, -12, 27, 23, 7).fill(this.character.accent).stroke({ width: 3, color: 0x9a6237 });
      this.details.moveTo(-11, -7).lineTo(-7, 2).moveTo(-1, -7).lineTo(3, 2).stroke({ width: 2, color: 0x9a6237 });
    } else if (presentation.detail === 'curves') {
      this.details.moveTo(-30, -9).bezierCurveTo(-13, -22, 8, -17, 20, -4).stroke({ width: 4, color: this.character.accent, alpha: 0.95 });
      this.details.moveTo(-29, 10).bezierCurveTo(-10, 23, 10, 16, 22, 4).stroke({ width: 4, color: this.character.accent, alpha: 0.95 });
      this.details.circle(-28, 0, 4).fill(this.character.accent);
    } else if (presentation.detail === 'heart') {
      this.details.moveTo(-8, 4).bezierCurveTo(-18, -3, -15, -13, -7, -8).bezierCurveTo(1, -13, 5, -3, -8, 4).fill(this.character.accent);
    } else if (presentation.detail === 'scowl') {
      this.details.moveTo(27, -36).lineTo(39, -32).stroke({ width: 4, color: 0x07111f });
    } else if (presentation.detail === 'tuft') {
      this.details.moveTo(21, -39).bezierCurveTo(19, -50, 27, -52, 29, -42).bezierCurveTo(31, -53, 40, -50, 38, -40).stroke({ width: 4, color: this.character.accent });
    } else if (presentation.detail === 'spark') {
      this.details.moveTo(-7, -5).lineTo(-2, 1).lineTo(-7, 7).lineTo(-13, 1).closePath().fill(this.character.accent);
    } else if (presentation.detail === 'ember') {
      this.details.moveTo(-34, 3).bezierCurveTo(-48, -10, -43, -22, -30, -14).bezierCurveTo(-38, -5, -31, 2, -34, 3).fill(0xff6b35);
    }

    this.wing = new Graphics();
    this.wing.ellipse(-20, 4, 20, 11).fill(this.character.accent).stroke({ width: 3, color: this.character.color });
    this.wing.pivot.set(-5, 2);

    this.legs = new Graphics();
    this.legs.moveTo(-20, 18).lineTo(-34, 34).stroke({ width: 5, color: 0xffa62b });
    this.legs.moveTo(8, 18).lineTo(2, 36).stroke({ width: 5, color: 0xffa62b });

    this.blink = new Graphics();
    this.blink.moveTo(30, -29).lineTo(38, -29).stroke({ width: 4, color: this.character.color });
    this.blink.visible = false;

    this.throwChargeArt = new Graphics();
    this.throwChargeArt.position.set(54, -38);
    this.throwChargeArt.visible = false;

    this.art.addChild(this.legs, this.body, this.details, this.wing, this.blink, this.throwChargeArt);
    this.display.addChild(this.art);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    const input = engine.input;
    const body = engine.physics.getBody(this);
    this.coyoteTime = this.grounded ? 0.11 : Math.max(0, this.coyoteTime - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.peckCooldown = Math.max(0, this.peckCooldown - dt);
    this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    this.emptyThrowCooldown = Math.max(0, this.emptyThrowCooldown - dt);
    this.honkCooldown = Math.max(0, this.honkCooldown - dt);
    this.interactCooldown = Math.max(0, this.interactCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.flightTime = Math.max(0, this.flightTime - dt);

    if (body) {
      const holdingFlight = this.flightTime > 0 && input.isDown('jump') && this.velocity.y < 260;
      body.gravityScale = (holdingFlight ? 0.28 : 1) * this.gravityMultiplier;
      if (holdingFlight) {
        this.velocity.y = Math.min(this.velocity.y, 135);
        this.velocity.x = approach(this.velocity.x, this.facing * Math.max(170, Math.abs(this.velocity.x)), 260 * dt);
      }
    }

    if (input.wasPressed('jump')) this.jumpBuffer = 0.14;
    this.crouching = this.grounded && input.isDown('down');
    this.collider.height = this.crouching ? 32 : 48;
    this.collider.offset.y = this.crouching ? 4 : -4;

    const axis = input.axis('left', 'right');
    const acceleration = (this.grounded ? this.acceleration : this.airAcceleration) * (this.crouching ? 0.72 : 1);
    const targetSpeed = movementSpeedForStance(this.speed, this) * this.movementMultiplier;
    if (this.dashTime <= 0) this.velocity.x = approach(this.velocity.x, axis * targetSpeed, acceleration * this.movementMultiplier * dt);
    if (Math.abs(axis) > 0.05) this.facing = signNonZero(axis, this.facing);

    if (this.jumpBuffer > 0 && (this.coyoteTime > 0 || this.jumpsRemaining > 0)) {
      const jumpNumber = this.maxJumps - this.jumpsRemaining + 1;
      const isThirdJump = jumpNumber >= 3;
      this.jumpNumber = jumpNumber;
      this.velocity.y = -(isThirdJump ? this.jumpSpeed * 0.9 : this.jumpSpeed);
      if (isThirdJump) {
        this.flightTime = 0.48;
        this.velocity.x += this.facing * 95;
        engine.entities.add(new WingBurst({ x: this.x, y: this.y + 8, color: this.character.accent, count: 12, label: 'FLAP!' }), this.display.parent);
        if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(3, 0.12);
      } else {
        engine.entities.add(new WingBurst({ x: this.x, y: this.y + 20, color: this.character.accent, count: 5 }), this.display.parent);
      }
      this.jumpBuffer = 0;
      this.coyoteTime = 0;
      this.jumpsRemaining = Math.max(0, this.jumpsRemaining - 1);
      this.grounded = false;
      this.groundPlatform = null;
      engine.audio.sfx.tone({ frequency: isThirdJump ? 520 : 380 + jumpNumber * 45, slide: isThirdJump ? 260 : 180, duration: isThirdJump ? 0.15 : 0.09, type: 'triangle' });
      engine.events.emit('player:jump', { player: this, jumpNumber, jumpsRemaining: this.jumpsRemaining, flying: isThirdJump });
      if (isThirdJump) engine.events.emit('achievement:unlock', { id: 'triple-flap' });
    }

    if (input.wasPressed('dash') && this.dashCooldown <= 0 && !this.crouching) {
      this.velocity.x = this.facing * 840;
      this.velocity.y *= 0.35;
      this.dashTime = 0.12;
      this.dashCooldown = 0.62;
      if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(4, 0.1);
      engine.events.emit('player:dash', { player: this });
      engine.network.sendAction('dash', { x: this.x, y: this.y, facing: this.facing });
    }

    if (input.wasPressed('attack') && this.attackCooldown <= 0 && this.peckCooldown <= 0) {
      this.attackCooldown = WING_WHAP_PROFILE.cooldown;
      engine.events.emit('goose:attack', { player: this });
      engine.network.sendAction('attack', { x: this.x, y: this.y, facing: this.facing });
      if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 180, slide: -80, duration: 0.06 });
    }

    if (input.wasPressed('peck') && this.peckCooldown <= 0 && this.attackCooldown <= 0 && !this.crouching) {
      this.peckCooldown = PECK_PROFILE.cooldown;
      const lunge = this.grounded ? PECK_PROFILE.groundLunge : PECK_PROFILE.airLunge;
      this.velocity.x = this.facing * Math.max(lunge, Math.abs(this.velocity.x));
      this.velocity.y *= 0.35;
      this.dashTime = Math.max(this.dashTime, PECK_PROFILE.dashTime);
      engine.events.emit('goose:peck', { player: this });
      engine.network.sendAction('peck', { x: this.x, y: this.y, facing: this.facing });
      if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 410, slide: -130, duration: 0.045, type: 'square', volume: 0.055 });
    }

    if (input.wasPressed('throw') && this.throwCooldown <= 0 && !this.throwCharging) this.#beginThrowCharge(engine);
    if (this.throwCharging) {
      this.throwChargeTime = Math.min(THROW_CHARGE.maxSeconds, this.throwChargeTime + dt);
      this.#drawThrowCharge(chargedThrowProfile(this.throwChargeTime));
      const released = input.wasReleased('throw') || !input.isDown('throw') || this.throwChargeTime >= THROW_CHARGE.maxSeconds;
      if (released) this.#releaseThrow(engine);
    }

    if (input.wasPressed('honk') && this.honkCooldown <= 0) {
      this.honkCooldown = 0.82;
      engine.events.emit('goose:honk', { player: this, x: this.x, y: this.y, facing: this.facing, range: 230, strength: 620 });
      engine.events.emit('achievement:unlock', { id: 'honk-first' });
      engine.network.sendAction('honk', { x: this.x, y: this.y, facing: this.facing, strength: 620, range: 230 });
      if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 210, slide: 110, duration: 0.28, type: 'sawtooth', volume: 0.12 });
    }

    if (input.wasPressed('interact') && this.interactCooldown <= 0) {
      this.interactCooldown = 0.45;
      engine.events.emit('goose:interact', { player: this });
    }

    this.velocity.x = clamp(this.velocity.x, -880, 880);
    this.display.alpha = this.invulnerable > 0 && Math.floor(this.invulnerable * 18) % 2 === 0 ? 0.38 : 1;
    this.#animate(engine, axis, dt);
  }


  cancelThrowCharge(engine = null) {
    if (!this.throwCharging) return false;
    this.throwCharging = false;
    this.throwChargeTime = 0;
    this.throwChargeArt.clear();
    this.throwChargeArt.visible = false;
    engine?.events.emit('goose:throw-charging', { player: this, charging: false, cancelled: true });
    return true;
  }

  #beginThrowCharge(engine) {
    const ammo = Math.max(0, Math.floor(Number(engine.save.get('progress.crumbAmmo', 0)) || 0));
    if (ammo <= 0) {
      if (this.emptyThrowCooldown <= 0) {
        this.emptyThrowCooldown = 1.2;
        engine.ui.toast('Out of throwable crumbs. Collect more crumbs!', { type: 'warning', duration: 1800 });
        if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 150, slide: -40, duration: 0.08, type: 'square', volume: 0.04 });
      }
      return false;
    }
    this.throwCharging = true;
    this.throwChargeTime = 0;
    this.throwChargeArt.visible = true;
    engine.events.emit('goose:throw-charging', { player: this, charging: true });
    return true;
  }

  #releaseThrow(engine) {
    if (!this.throwCharging) return false;
    const profile = chargedThrowProfile(this.throwChargeTime);
    this.throwCharging = false;
    this.throwChargeTime = 0;
    this.throwChargeArt.clear();
    this.throwChargeArt.visible = false;

    const ammo = Math.max(0, Math.floor(Number(engine.save.get('progress.crumbAmmo', 0)) || 0));
    if (ammo <= 0) return false;
    const nextAmmo = ammo - 1;
    this.throwCooldown = 0.12 + profile.charge * 0.09;
    engine.save.set('progress.crumbAmmo', nextAmmo);
    engine.events.emit('player:ammo', { ammo: nextAmmo, spent: 1 });
    const payload = {
      player: this,
      x: this.x,
      y: this.y,
      facing: this.facing,
      damage: profile.damage,
      strength: profile.strength,
      lift: profile.lift,
      duration: profile.duration,
      charge: profile.charge,
    };
    engine.events.emit('goose:throw', payload);
    engine.network.sendAction('throw', {
      x: this.x,
      y: this.y,
      facing: this.facing,
      strength: profile.strength,
      lift: profile.lift,
      duration: profile.duration,
      charge: profile.charge,
      damage: profile.damage,
    });
    engine.entities.add(new WingBurst({ x: this.x + this.facing * 38, y: this.y - 22, color: this.character.accent, count: 4 + Math.round(profile.charge * 8), label: profile.charge >= 0.9 ? profile.label : '' }), this.display.parent);
    if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 270 + profile.charge * 210, slide: -80 - profile.charge * 130, duration: 0.07 + profile.charge * 0.08, type: 'triangle', volume: 0.06 + profile.charge * 0.04 });
    engine.events.emit('goose:throw-charging', { player: this, charging: false, profile });
    return true;
  }

  #drawThrowCharge(profile) {
    this.throwChargeArt.clear();
    const color = profile.charge >= 0.9 ? 0xffd95a : this.character.accent;
    this.throwChargeArt.circle(0, 0, 7 + profile.charge * 5).fill({ color, alpha: 0.18 + profile.charge * 0.35 });
    this.throwChargeArt.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.03, profile.charge)).stroke({ width: 4, color, alpha: 0.95 });
  }

  #animate(engine, axis, dt) {
    const elapsed = engine.loop.time.elapsed;
    const moving = Math.abs(axis) > 0.08 && this.grounded;
    const idle = this.grounded && !moving && !this.crouching && this.dashTime <= 0 && !this.throwCharging;
    this.idleTime = idle ? this.idleTime + dt : 0;

    this.art.scale.x = this.facing;
    this.art.scale.y = this.crouching ? 0.78 : 1;
    this.art.y = this.crouching ? 11 : 0;
    this.body.y = 0;
    this.body.rotation = 0;
    this.legs.rotation = 0;
    this.legs.x = 0;
    this.wing.rotation = 0;
    this.blink.visible = false;

    if (this.flightTime > 0) {
      this.wing.rotation = Math.sin(elapsed * 28) * 0.8;
      this.body.rotation = -this.facing * 0.035;
    } else if (!this.grounded) {
      this.wing.rotation = Math.sin(elapsed * 20) * 0.34;
    } else if (this.throwCharging) {
      const profile = chargedThrowProfile(this.throwChargeTime);
      this.wing.rotation = -0.25 - profile.charge * 0.62;
      this.body.rotation = -this.facing * profile.charge * 0.055;
      this.art.y += Math.sin(elapsed * 18) * profile.charge * 1.5;
    } else if (this.crouching) {
      this.art.y += Math.sin(elapsed * (moving ? 14 : 6)) * (moving ? 2.2 : 0.7);
      this.wing.rotation = -0.18 + Math.sin(elapsed * 8) * 0.06;
      this.legs.rotation = moving ? Math.sin(elapsed * 18) * 0.16 : 0;
    } else if (moving) {
      const pace = 12 + Math.abs(this.velocity.x) * 0.018;
      this.art.y = Math.abs(Math.sin(elapsed * pace)) * -3;
      this.body.rotation = Math.sin(elapsed * pace) * 0.025;
      this.wing.rotation = Math.sin(elapsed * pace) * 0.16;
      this.legs.rotation = Math.sin(elapsed * pace) * 0.18;
    } else if (idle) {
      const breath = Math.sin(elapsed * 2.4);
      this.body.y = breath * 1.5;
      this.wing.rotation = -0.08 + breath * 0.055;
      this.art.y = breath * -0.7;
      if (this.idleTime > 2.5) this.body.rotation = Math.sin((this.idleTime - 2.5) * 0.72) * 0.035;
      const blinkCycle = this.idleTime % 4.6;
      this.blink.visible = blinkCycle > 4.32 || (this.idleTime > 7 && blinkCycle > 2.1 && blinkCycle < 2.22);
    }

    if (this.attackCooldown > 0.17) this.wing.rotation -= 0.58;
    if (this.peckCooldown > PECK_PROFILE.cooldown * 0.5) {
      this.art.x = this.facing * 14 * Math.sin((this.peckCooldown / PECK_PROFILE.cooldown) * Math.PI);
      this.body.rotation = this.facing * 0.08;
    } else if (this.dashTime <= 0) {
      this.art.x = 0;
    }
    this.legs.visible = this.grounded || this.velocity.y > 100;
  }

  land(y, platform = null) {
    this.y = y;
    if (platform?.bounce) {
      this.velocity.y = -platform.bounce;
      this.grounded = false;
      this.groundPlatform = null;
      this.jumpsRemaining = this.maxJumps - 1;
      this.jumpNumber = 1;
      this.flightTime = 0;
      return;
    }
    this.velocity.y = 0;
    this.grounded = true;
    this.groundPlatform = platform;
    this.jumpsRemaining = this.maxJumps;
    this.jumpNumber = 0;
    this.flightTime = 0;
  }

  applyHonkImpulse({ x = this.x - this.facing, y = this.y, strength = 520 } = {}, engine) {
    if (this.invulnerable > 0.2) return false;
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    this.velocity.x += (dx / distance) * strength;
    this.velocity.y = Math.min(this.velocity.y, -180 - Math.abs(dy / distance) * 110);
    this.grounded = false;
    this.groundPlatform = null;
    this.flightTime = Math.max(this.flightTime, 0.12);
    if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(5, 0.12);
    return true;
  }

  wingBump(sourceX, engine) {
    const direction = signNonZero(this.x - sourceX, this.facing);
    this.velocity.x = direction * 360;
    this.velocity.y = -470;
    this.grounded = false;
    this.groundPlatform = null;
    this.jumpsRemaining = Math.max(this.jumpsRemaining, 1);
    engine.entities.add(new WingBurst({ x: this.x, y: this.y - 6, color: 0xffd95a, count: 14, label: 'WING BUMP!' }), this.display.parent);
    if (engine.save.get('settings.sfx', true)) engine.audio.sfx.tone({ frequency: 640, slide: -180, duration: 0.12, type: 'triangle' });
    return true;
  }

  takeDamage(amount, source, engine) {
    if (this.invulnerable > 0 || this.hp <= 0) return false;
    this.invulnerable = 0.9;
    this.hp = Math.max(0, this.hp - amount);
    this.velocity.x = Math.sign(this.x - (source?.x ?? this.x - this.facing) || 1) * 340;
    this.velocity.y = -280;
    engine.events.emit('player:health', { hp: this.hp, maxHp: this.maxHp, source });
    if (engine.save.get('settings.screenShake', true)) engine.renderer.camera.shake(10, 0.18);
    if (this.hp <= 0) engine.events.emit('player:defeated', { player: this });
    return true;
  }

  dropRecoverableCrumbs(engine, { source = null, maximum = 3 } = {}) {
    const ammo = Math.max(0, Math.floor(Number(engine.save.get('progress.crumbAmmo', 0)) || 0));
    const lost = recoverableCrumbLoss(ammo, maximum);
    if (!lost) return 0;
    const nextAmmo = ammo - lost;
    engine.save.set('progress.crumbAmmo', nextAmmo);
    engine.events.emit('player:ammo', { ammo: nextAmmo, lost, source });

    const world = engine.scenes?.get?.('world');
    const platforms = world?.platforms ?? [];
    const parent = this.display.parent;
    const timestamp = Math.floor((engine.loop?.time?.elapsed ?? Date.now()) * 1000);
    for (let index = 0; index < lost; index += 1) {
      const direction = index % 2 === 0 ? -1 : 1;
      const spread = 52 + index * 28;
      const dropX = this.x + direction * (18 + index * 10);
      const support = platforms
        .map((platform) => platform.collider)
        .filter((collider) => collider?.enabled !== false && dropX >= collider.left - 20 && dropX <= collider.right + 20 && collider.top >= this.y - 10)
        .sort((a, b) => a.top - b.top)[0];
      const landingY = support ? support.top - 18 : Math.min((world?.level?.height ?? 1080) - 36, this.y + 220);
      const crumb = new RecoverableCrumb({
        id: `lost-${timestamp}-${index}`,
        x: dropX,
        y: this.y - 30,
        landingY,
        velocityX: direction * spread,
        velocityY: -360 - index * 35,
      });
      if (parent) engine.entities.addImmediate(crumb, parent);
      else engine.entities.addImmediate(crumb);
      engine.physics.addCollider(crumb.collider);
    }
    engine.entities.add(new WingBurst({ x: this.x, y: this.y - 28, color: 0xf7ca76, count: 8 + lost * 2, label: `-${lost} CRUMBS!` }), parent);
    engine.ui.toast(`A Crumb-Snatch Bat knocked loose ${lost} crumb${lost === 1 ? '' : 's'}—grab them back!`, { type: 'warning', duration: 2600 });
    return lost;
  }

  heal(amount, engine) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount));
    if (this.hp !== before) engine.events.emit('player:health', { hp: this.hp, maxHp: this.maxHp });
  }
}
