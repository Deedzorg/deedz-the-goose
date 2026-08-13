import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';

export class HonkPulse extends Entity {
  constructor({ x = 0, y = 0, facing = 1, color = 0xffe36e, label = 'HONK!', radius = 220 } = {}) {
    super({ name: 'HonkPulse', tags: ['effect', 'honk-effect'] });
    this.x = x + facing * 26;
    this.y = y - 18;
    this.facing = facing;
    this.radius = radius;
    this.life = 0;
    this.duration = 0.52;

    this.rings = new Container();
    for (let index = 0; index < 3; index += 1) {
      const ring = new Graphics().circle(0, 0, 26 + index * 12).stroke({ width: 6 - index, color, alpha: 0.9 - index * 0.18 });
      ring.scale.x = 1.45;
      this.rings.addChild(ring);
    }
    this.rings.scale.x *= facing;

    this.label = new Text({
      text: label,
      style: {
        fill: color,
        fontSize: 26,
        fontWeight: '900',
        fontStyle: 'italic',
        stroke: { color: 0x07111f, width: 6 },
      },
    });
    this.label.anchor.set(0.5);
    this.label.y = -54;
    this.display.addChild(this.rings, this.label);
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.life += dt;
    const progress = Math.min(1, this.life / this.duration);
    const eased = 1 - (1 - progress) ** 3;
    const scale = 0.55 + eased * (this.radius / 52);
    this.rings.scale.set(scale * this.facing, scale * 0.72);
    this.rings.alpha = 1 - progress;
    this.label.y = -54 - progress * 40;
    this.label.alpha = Math.max(0, 1 - progress * 1.2);
    this.label.scale.set(1 + Math.sin(progress * Math.PI) * 0.18);
    if (progress >= 1) engine.entities.remove(this);
  }
}

export class WingBurst extends Entity {
  constructor({ x = 0, y = 0, color = 0xffffff, count = 9, label = null } = {}) {
    super({ name: 'WingBurst', tags: ['effect', 'feather-effect'] });
    this.x = x;
    this.y = y;
    this.life = 0;
    this.duration = 0.7;
    this.particles = [];

    for (let index = 0; index < count; index += 1) {
      const angle = (-Math.PI * 0.9) + (Math.PI * 1.8 * index) / Math.max(1, count - 1);
      const speed = 90 + (index % 4) * 26;
      const particle = new Graphics().ellipse(0, 0, 8, 3).fill({ color, alpha: 0.9 });
      particle.rotation = angle;
      this.display.addChild(particle);
      this.particles.push({
        display: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        spin: (index % 2 ? 1 : -1) * (3 + index * 0.17),
      });
    }

    if (label) {
      this.label = new Text({
        text: label,
        style: { fill: color, fontSize: 19, fontWeight: '900', stroke: { color: 0x07111f, width: 5 } },
      });
      this.label.anchor.set(0.5);
      this.label.y = -54;
      this.display.addChild(this.label);
    }
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.life += dt;
    const progress = Math.min(1, this.life / this.duration);
    for (const particle of this.particles) {
      particle.vy += 300 * dt;
      particle.display.x += particle.vx * dt;
      particle.display.y += particle.vy * dt;
      particle.display.rotation += particle.spin * dt;
      particle.display.alpha = 1 - progress;
    }
    if (this.label) {
      this.label.y -= 30 * dt;
      this.label.alpha = 1 - progress;
    }
    if (progress >= 1) engine.entities.remove(this);
  }
}
