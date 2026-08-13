import { Graphics } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';

export class Platform extends Entity {
  constructor({ x, y, width, height, type = 'solid', moveX = 0, moveY = 0, speed = 1, phaseOffset = 0, color = null, edge = null, glow = null } = {}) {
    super({ name: `Platform:${type}`, tags: ['platform', type] });
    this.x = x + width / 2;
    this.y = y + height / 2;
    this.origin = { x: this.x, y: this.y };
    this.width = width;
    this.height = height;
    this.type = type;
    this.moveX = moveX;
    this.moveY = moveY;
    this.speed = speed;
    this.phaseOffset = phaseOffset;
    this.age = 0;
    this.delta = { x: 0, y: 0 };
    this.bounce = type === 'trampoline' ? 980 : type === 'updraft' ? 790 : 0;
    this.collider = new Collider(this, { width, height, layer: 8, mask: 1 });
    const colors = { trampoline: 0xb94cff, moving: 0x3f7d8a, cloud: 0xd8f4ff, bridge: 0x8f623f, ruin: 0x495b68, fortress: 0x3a4654, grass: 0x274d50, updraft: 0x2e7894, phase: 0x5b4f88, crystal: 0x375d7d, lantern: 0x77543b, solid: 0x274d50 };
    const edges = { trampoline: 0xf0a5ff, cloud: 0xffffff, bridge: 0xd69b4f, ruin: 0x708391, fortress: 0x9a6237, updraft: 0x8de7ff, phase: 0xf0a5ff, crystal: 0x8de7ff, lantern: 0xffd95a };
    const fillColor = color ?? colors[type] ?? colors.solid;
    const edgeColor = edge ?? edges[type] ?? 0x5b8d71;
    this.art = new Graphics().roundRect(-width / 2, -height / 2, width, height, Math.min(18, height / 2)).fill(fillColor).stroke({ width: 4, color: edgeColor });
    if (glow) this.art.roundRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, Math.min(22, height / 2 + 5)).stroke({ width: 3, color: glow, alpha: 0.18 });
    if (type === 'trampoline' || type === 'updraft') {
      this.art.rect(-width * 0.32, -height / 2 - 7, width * 0.64, 8).fill(type === 'updraft' ? 0x8de7ff : 0xffd95a);
      if (type === 'updraft') {
        for (let px = -width * 0.28; px <= width * 0.28; px += 24) this.art.moveTo(px, 8).lineTo(px + 8, -8).lineTo(px + 16, 8).stroke({ width: 3, color: 0xcdf8ff, alpha: 0.8 });
      }
    }
    if (type === 'bridge') for (let px = -width / 2 + 18; px < width / 2; px += 36) this.art.moveTo(px, -height / 2).lineTo(px, height / 2).stroke({ width: 3, color: 0x5d3b2a, alpha: 0.7 });
    if (type === 'cloud') {
      this.art.circle(-width * 0.28, -height / 2, height * 0.7).fill(0xeafaff);
      this.art.circle(0, -height / 2 - 5, height * 0.85).fill(0xf5fdff);
      this.art.circle(width * 0.28, -height / 2, height * 0.65).fill(0xeafaff);
    }
    if (type === 'phase') for (let px = -width / 2 + 12; px < width / 2; px += 28) this.art.circle(px, 0, 5).fill({ color: edgeColor, alpha: 0.8 });
    if (type === 'crystal') for (let px = -width / 2 + 20; px < width / 2 - 8; px += 38) this.art.moveTo(px, -height / 2).lineTo(px + 10, -height / 2 - 22).lineTo(px + 20, -height / 2).closePath().fill(edgeColor);
    if (type === 'lantern') for (let px = -width / 2 + 24; px < width / 2; px += 48) this.art.circle(px, 0, 7).fill({ color: 0xffd95a, alpha: 0.82 });
    this.display.addChild(this.art);
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.previousPosition.x = this.x;
    this.previousPosition.y = this.y;
    this.age += dt;
    if (this.type === 'moving') {
      this.x = this.origin.x + Math.sin(this.age * this.speed) * this.moveX;
      this.y = this.origin.y + Math.sin(this.age * this.speed) * this.moveY;
    }
    if (this.type === 'phase') {
      const wave = Math.sin(this.age * Math.max(0.55, this.speed * 0.65) + this.phaseOffset);
      const enabled = wave > -0.28;
      this.collider.enabled = enabled;
      this.display.alpha = enabled ? 0.9 : 0.18;
      this.art.tint = enabled ? 0xffffff : 0x8b7aae;
    }
    if (this.type === 'updraft') this.art.alpha = 0.82 + Math.sin(this.age * 5) * 0.14;
    this.delta.x = this.x - this.previousPosition.x;
    this.delta.y = this.y - this.previousPosition.y;
  }
}

export class LevelExit extends Entity {
  constructor({ x, y, width = 90, height = 140 } = {}) {
    super({ name: 'LevelExit', tags: ['level-exit'] });
    this.x = x;
    this.y = y;
    this.collider = new Collider(this, { width, height, trigger: true, layer: 16, mask: 1 });
    this.art = new Graphics();
    this.art.roundRect(-width / 2, -height / 2, width, height, 20).fill({ color: 0x55d6ff, alpha: 0.18 }).stroke({ width: 5, color: 0xffd95a });
    this.art.moveTo(-18, -22).lineTo(18, 0).lineTo(-18, 22).closePath().fill(0xffd95a);
    this.display.addChild(this.art);
    this.locked = false;
  }

  setLocked(locked) {
    this.locked = Boolean(locked);
    this.art.tint = this.locked ? 0x5f6470 : 0xffffff;
    this.display.alpha = this.locked ? 0.72 : 1;
  }

  update(dt, engine) {
    super.update(dt, engine);
    this.display.rotation = Math.sin(engine.loop.time.elapsed * 2) * 0.025;
    const pulse = 1 + Math.sin(engine.loop.time.elapsed * 4) * (this.locked ? 0.018 : 0.05);
    this.display.scale.set(pulse);
  }
}
