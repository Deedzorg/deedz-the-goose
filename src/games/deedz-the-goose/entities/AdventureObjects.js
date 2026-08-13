import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';

export class Checkpoint extends Entity {
  constructor({ id, x = 0, y = 0, label = 'Goose Post' } = {}) {
    super({ id: id ? `checkpoint-${id}` : undefined, name: 'Checkpoint', tags: ['checkpoint'] });
    this.checkpointId = id ?? `checkpoint-${x}`;
    this.x = x;
    this.y = y;
    this.activeCheckpoint = false;
    this.collider = new Collider(this, { width: 88, height: 150, trigger: true, layer: 32, mask: 1 });

    this.flag = new Container();
    const pole = new Graphics().rect(-5, -78, 10, 156).fill(0xe8edf2);
    this.cloth = new Graphics().moveTo(4, -70).lineTo(70, -50).lineTo(4, -28).closePath().fill(0x55d6ff).stroke({ width: 4, color: 0xffd95a });
    const base = new Graphics().ellipse(0, 76, 32, 10).fill(0x274d50);
    const text = new Text({ text: label, style: { fill: 0xffffff, fontSize: 13, fontWeight: '800', stroke: { color: 0x07111f, width: 4 } } });
    text.anchor.set(0.5);
    text.y = 101;
    this.flag.addChild(pole, this.cloth, base, text);
    this.display.addChild(this.flag);
  }

  activate() {
    if (this.activeCheckpoint) return false;
    this.activeCheckpoint = true;
    this.cloth.tint = 0x8cff98;
    return true;
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.cloth.skew.y = Math.sin(engine.loop.time.elapsed * 4 + this.x * 0.01) * 0.08;
  }
}

export class Hazard extends Entity {
  constructor({ x = 0, y = 0, width = 200, height = 80, type = 'water' } = {}) {
    super({ name: `Hazard:${type}`, tags: ['hazard', type] });
    this.x = x + width / 2;
    this.y = y + height / 2;
    this.type = type;
    this.collider = new Collider(this, { width, height, trigger: true, layer: 64, mask: 1 });
    this.surface = new Graphics();
    const color = type === 'thorns' ? 0xb94cff : 0x2377a5;
    this.surface.rect(-width / 2, -height / 2, width, height).fill({ color, alpha: 0.72 });
    for (let px = -width / 2; px < width / 2; px += 28) {
      if (type === 'thorns') this.surface.moveTo(px, height / 2).lineTo(px + 14, -height / 2).lineTo(px + 28, height / 2).fill(0xf0a5ff);
      else this.surface.circle(px + 14, -height / 2 + 4, 11).fill({ color: 0x55d6ff, alpha: 0.8 });
    }
    this.display.addChild(this.surface);
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.surface.y = Math.sin(engine.loop.time.elapsed * 2.8 + this.x * 0.01) * 4;
  }
}

export class HonkCrystal extends Entity {
  constructor({ id, x = 0, y = 0, radius = 230, label = 'Echo Crystal' } = {}) {
    super({ id: id ? `crystal-${id}` : undefined, name: 'HonkCrystal', tags: ['honk-reactive', 'crystal'] });
    this.crystalId = id ?? `crystal-${x}`;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.activated = false;
    this.age = Math.random() * 5;

    this.glow = new Graphics().circle(0, 0, 52).fill({ color: 0x55d6ff, alpha: 0.08 });
    this.crystal = new Graphics();
    this.crystal.moveTo(0, -58).lineTo(34, -12).lineTo(20, 48).lineTo(-20, 48).lineTo(-34, -12).closePath().fill(0x2876ad).stroke({ width: 5, color: 0x8de7ff });
    this.crystal.moveTo(0, -58).lineTo(0, 48).stroke({ width: 3, color: 0xcdf8ff, alpha: 0.7 });
    const plaque = new Text({ text: label, style: { fill: 0xcdf8ff, fontSize: 13, fontWeight: '800', stroke: { color: 0x07111f, width: 4 } } });
    plaque.anchor.set(0.5);
    plaque.y = 78;
    this.display.addChild(this.glow, this.crystal, plaque);
  }

  activate(engine, source = null) {
    if (this.activated) return false;
    this.activated = true;
    this.addTag('activated');
    this.crystal.tint = 0xffd95a;
    this.glow.clear().circle(0, 0, 72).fill({ color: 0xffd95a, alpha: 0.24 });
    engine.events.emit('crystal:activated', { crystal: this, source });
    return true;
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.age += dt;
    this.crystal.y = Math.sin(this.age * 2.4) * 7;
    this.crystal.rotation = Math.sin(this.age * 1.5) * 0.045;
    const pulse = 1 + Math.sin(this.age * 3) * (this.activated ? 0.09 : 0.04);
    this.glow.scale.set(pulse);
  }
}


export class EchoResonator extends Entity {
  constructor({ id, x = 0, y = 0, radius = 250, cooldown = 22, xp = 30, color = 0x55d6ff, accent = 0xffd95a } = {}) {
    super({ id: id ? `resonator-${id}` : undefined, name: 'EchoResonator', tags: ['honk-reactive', 'echo-resonator'] });
    this.resonatorId = id ?? `resonator-${x}`;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.cooldown = Math.max(8, Number(cooldown) || 22);
    this.cooldownRemaining = 0;
    this.xp = Math.max(1, Math.floor(Number(xp) || 30));
    this.color = color;
    this.accent = accent;
    this.activated = false;
    this.age = Math.random() * 8;

    this.glow = new Graphics().circle(0, 0, 48).fill({ color, alpha: 0.11 });
    this.rings = new Graphics().circle(0, 0, 34).stroke({ width: 4, color: accent, alpha: 0.7 }).circle(0, 0, 22).stroke({ width: 3, color, alpha: 0.9 });
    this.core = new Graphics().moveTo(0, -34).lineTo(25, 0).lineTo(0, 34).lineTo(-25, 0).closePath().fill(color).stroke({ width: 4, color: accent });
    this.display.addChild(this.glow, this.rings, this.core);
  }

  activate(engine, source = null) {
    if (this.activated || this.cooldownRemaining > 0) return false;
    this.activated = true;
    this.cooldownRemaining = this.cooldown;
    this.core.tint = 0xffffff;
    this.glow.clear().circle(0, 0, 72).fill({ color: this.accent, alpha: 0.3 });
    engine.events.emit('resonator:activated', { resonator: this, source, xp: this.xp });
    return true;
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.age += dt;
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    if (this.activated && this.cooldownRemaining <= 0) {
      this.activated = false;
      this.core.tint = 0xffffff;
      this.glow.clear().circle(0, 0, 48).fill({ color: this.color, alpha: 0.11 });
      engine.events.emit('resonator:ready', { resonator: this });
    }
    this.core.y = Math.sin(this.age * 2.3) * 6;
    this.core.rotation = Math.sin(this.age * 1.4) * 0.08;
    this.rings.rotation += dt * (this.activated ? 1.8 : 0.45);
    const pulse = 0.9 + Math.sin(this.age * 3.2) * (this.activated ? 0.22 : 0.09);
    this.glow.scale.set(pulse);
    this.display.alpha = this.activated ? 0.66 : 1;
  }
}

export class Scenery extends Entity {
  constructor({ x = 0, y = 0, type = 'tree', scale = 1, flip = false, label = '', color = 0x55d6ff, accent = 0xffd95a } = {}) {
    super({ name: `Scenery:${type}`, tags: ['scenery', type] });
    this.x = x;
    this.y = y;
    this.display.scale.set((flip ? -1 : 1) * scale, scale);
    const art = new Graphics();
    if (type === 'tree') {
      art.rect(-12, -100, 24, 112).fill(0x5b3b2a);
      art.circle(-28, -112, 52).fill(0x245d50);
      art.circle(30, -124, 58).fill(0x2f7258);
      art.circle(2, -164, 48).fill(0x3d845e);
    } else if (type === 'ruin') {
      art.rect(-42, -92, 84, 104).fill(0x3f5260);
      art.rect(-28, -72, 18, 44).fill(0x102e50);
      art.rect(10, -72, 18, 44).fill(0x102e50);
      art.moveTo(-48, -92).lineTo(-20, -118).lineTo(2, -96).lineTo(26, -128).lineTo(48, -92).fill(0x60707a);
    } else if (type === 'sign') {
      art.rect(-5, -52, 10, 64).fill(0x6d442a);
      art.roundRect(-68, -84, 136, 42, 8).fill(0x9a6237).stroke({ width: 4, color: 0xe1a95f });
      const text = new Text({ text: label, style: { fill: 0xffe8bd, fontSize: 12, fontWeight: '900', align: 'center' } });
      text.anchor.set(0.5);
      text.y = -63;
      text.scale.x = flip ? -1 : 1;
      this.display.addChild(text);
    } else if (type === 'mushroom') {
      art.rect(-7, -35, 14, 42).fill(0xe9e4d6);
      art.ellipse(0, -38, 34, 17).fill(color).stroke({ width: 4, color: accent });
      art.circle(-13, -43, 3).fill(0xffffff);
      art.circle(10, -37, 4).fill(0xffffff);
    } else if (type === 'lantern') {
      art.rect(-4, -78, 8, 85).fill(0x63452f);
      art.moveTo(0, -78).lineTo(28, -63).stroke({ width: 5, color: 0x63452f });
      art.roundRect(17, -72, 24, 34, 7).fill({ color: accent, alpha: 0.78 }).stroke({ width: 3, color });
      art.circle(29, -55, 24).fill({ color: accent, alpha: 0.1 });
    } else if (type === 'banner') {
      art.rect(-5, -112, 10, 120).fill(0x5d4437);
      art.moveTo(3, -104).lineTo(62, -88).lineTo(52, -40).lineTo(4, -54).closePath().fill(color).stroke({ width: 4, color: accent });
      art.circle(28, -72, 10).fill(accent);
    } else if (type === 'crystal-garden') {
      for (let index = 0; index < 5; index += 1) {
        const px = -34 + index * 17;
        const height = 34 + (index % 3) * 18;
        art.moveTo(px, 4).lineTo(px + 8, -height).lineTo(px + 17, 4).closePath().fill(index % 2 ? color : accent).stroke({ width: 2, color: 0xd9f9ff, alpha: 0.7 });
      }
      art.ellipse(0, 8, 54, 12).fill({ color, alpha: 0.16 });
    } else if (type === 'floating-island') {
      art.ellipse(0, 0, 70, 20).fill(0x365b53).stroke({ width: 4, color: accent, alpha: 0.7 });
      art.moveTo(-62, 5).lineTo(-28, 58).lineTo(0, 42).lineTo(24, 67).lineTo(62, 4).closePath().fill(0x3f4f59);
      art.circle(-24, -14, 22).circle(9, -20, 27).circle(38, -10, 18).fill({ color, alpha: 0.38 });
    } else if (type === 'wind-ribbon') {
      art.moveTo(-70, 0).bezierCurveTo(-28, -38, 8, 35, 72, -8).stroke({ width: 8, color, alpha: 0.28 });
      art.moveTo(-55, 20).bezierCurveTo(-20, -10, 24, 46, 58, 18).stroke({ width: 4, color: accent, alpha: 0.35 });
    } else if (type === 'flower') {
      art.rect(-3, -36, 6, 42).fill(0x4f8a58);
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3;
        art.ellipse(Math.cos(angle) * 13, -38 + Math.sin(angle) * 13, 10, 6).fill(color);
      }
      art.circle(0, -38, 7).fill(accent);
    }
    this.display.addChildAt(art, 0);
  }
}
