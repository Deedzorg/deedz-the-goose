import { Graphics } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { clamp } from '../../../shared/math.js';

export class CrumbProjectile extends Entity {
  constructor({
    x = 0,
    y = 0,
    facing = 1,
    ownerId = null,
    damage = 1,
    remote = false,
    color = 0xf7ca76,
    strength = 790,
    lift = 155,
    duration = 2.2,
    charge = 0.5,
    style = 'crumb',
  } = {}) {
    super({ name: style === 'ember-bolt' ? 'FireFeatherProjectile' : 'CrumbProjectile', tags: ['projectile', 'crumb-projectile', ...(style === 'ember-bolt' ? ['ember-bolt'] : [])] });
    this.x = x + facing * 44;
    this.y = y - 18;
    this.facing = facing === -1 ? -1 : 1;
    this.ownerId = ownerId;
    this.damage = Math.max(1, Number(damage) || 1);
    this.remote = Boolean(remote);
    this.style = style === 'ember-bolt' ? 'ember-bolt' : 'crumb';
    this.charge = clamp(Number(charge) || 0, 0, 1);
    this.life = 0;
    this.duration = clamp(Number(duration) || 2.2, 0.65, 3.2);
    this.hit = false;
    const maxStrength = this.style === 'ember-bolt' ? 1380 : 1120;
    this.velocity.x = this.facing * clamp(Number(strength) || 790, 320, maxStrength);
    this.velocity.y = -clamp(Number(lift) || (this.style === 'ember-bolt' ? 20 : 155), this.style === 'ember-bolt' ? 0 : 55, this.style === 'ember-bolt' ? 80 : 340);
    const size = 0.86 + this.charge * 0.34;
    this.collider = new Collider(this, { width: this.style === 'ember-bolt' ? 38 : 28 * size, height: this.style === 'ember-bolt' ? 16 : 22 * size, trigger: true, layer: 128, mask: 4 });
    if (this.remote) this.collider.enabled = false;
    this.art = new Graphics();
    if (this.style === 'ember-bolt') {
      this.art.moveTo(-26, 0).lineTo(-10, -9).lineTo(20, -4).lineTo(32, 0).lineTo(20, 4).lineTo(-10, 9).closePath().fill(0xff4b36).stroke({ width: 3, color: 0xffd05a });
      this.art.moveTo(-34, 0).lineTo(-18, -5).lineTo(-20, 0).lineTo(-18, 5).closePath().fill({ color: 0xffa24c, alpha: 0.9 });
      this.art.circle(16, 0, 5 + this.charge * 3).fill({ color, alpha: 0.72 });
      this.art.scale.x = this.facing;
    } else {
      this.art.roundRect(-13 * size, -9 * size, 26 * size, 18 * size, 6).fill(0xd69b4f).stroke({ width: 3 + this.charge * 2, color });
      this.art.moveTo(-7 * size, -5 * size).lineTo(-3 * size, 4 * size).moveTo(4 * size, -5 * size).lineTo(8 * size, 4 * size).stroke({ width: 2, color: 0x8d552d });
      if (this.charge > 0.72) this.art.circle(0, 0, 18 * size).stroke({ width: 2, color: 0xfff0a6, alpha: 0.55 });
    }
    this.display.addChild(this.art);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.life += dt;
    if (this.style === 'ember-bolt') {
      const pulse = 1 + Math.sin(this.life * 36) * 0.08;
      this.art.scale.y = pulse;
    } else {
      this.display.rotation += dt * (8 + this.charge * 8) * this.facing;
    }
    if (this.life >= this.duration || this.y > 1360 || this.x < -300 || this.x > 10200) engine.entities.remove(this);
  }
}
