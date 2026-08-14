import { Container, Graphics } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { Collider } from '../../../engine/physics/Collider.js';
import { collectibleDefinition } from '../data/collectibles.js';

export class Collectible extends Entity {
  constructor({ id = null, type = 'crumb', x = 0, y = 0, value = 1, respawnSeconds = 0 } = {}) {
    super({ id: id ? `collectible-${id}` : undefined, name: `Collectible:${type}`, tags: ['collectible', type] });
    this.collectibleId = id ?? this.id;
    this.type = type;
    this.value = Math.max(1, Number(value) || 1);
    this.respawnSeconds = Math.max(0, Number(respawnSeconds) || 0);
    this.respawnTimer = 0;
    this.available = true;
    this.x = x;
    this.y = y;
    this.time = Math.random() * 10;
    this.definition = collectibleDefinition(type);
    this.collider = new Collider(this, { width: type === 'echo-cache' ? 46 : 34, height: type === 'echo-cache' ? 42 : 34, trigger: true, layer: 2, mask: 1 });
    this.art = new Container();
    this.glow = new Graphics().circle(0, 0, type === 'echo-cache' ? 33 : 24).fill({ color: this.definition.color, alpha: 0.12 });
    this.graphic = new Graphics();
    this.#drawType();
    this.art.addChild(this.glow, this.graphic);
    this.display.addChild(this.art);
  }

  #drawType() {
    const { color, accent } = this.definition;
    if (this.type === 'crumb') {
      this.graphic.roundRect(-13, -9, 26, 18, 6).fill(color).stroke({ width: 3, color: accent });
      this.graphic.moveTo(-6, -5).lineTo(-2, 4).moveTo(4, -5).lineTo(8, 4).stroke({ width: 2, color: 0x9a6237 });
    } else if (this.type === 'echo-crumb') {
      this.graphic.roundRect(-14, -10, 28, 20, 7).fill(color).stroke({ width: 4, color: accent });
      this.graphic.circle(0, 0, 5).fill(0xffffff);
    } else if (this.type === 'golden-feather') {
      this.graphic.moveTo(-18, 15).bezierCurveTo(-7, -23, 25, -24, 18, 5).bezierCurveTo(8, 22, -8, 20, -18, 15).fill(color).stroke({ width: 3, color: accent });
      this.graphic.moveTo(-14, 14).lineTo(15, -12).stroke({ width: 3, color: 0x9a6b20 });
    } else if (this.type === 'moon-token') {
      this.graphic.circle(0, 0, 16).fill(color).stroke({ width: 4, color: accent });
      this.graphic.circle(6, -4, 11).fill(0x53659a);
      this.graphic.circle(10, -7, 11).fill(color);
    } else if (this.type === 'flock-star') {
      const points = [];
      for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 === 0 ? 18 : 8;
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      this.graphic.moveTo(...points[0]);
      for (const point of points.slice(1)) this.graphic.lineTo(...point);
      this.graphic.closePath().fill(color).stroke({ width: 3, color: accent });
    } else if (this.type === 'heart') {
      this.graphic.moveTo(0, 17).bezierCurveTo(-27, -2, -18, -24, 0, -10).bezierCurveTo(18, -24, 27, -2, 0, 17).fill(color).stroke({ width: 3, color: accent });
    } else if (this.type === 'prism-seed') {
      this.graphic.moveTo(0, -20).lineTo(17, -4).lineTo(10, 19).lineTo(-10, 19).lineTo(-17, -4).closePath().fill(color).stroke({ width: 4, color: accent });
      this.graphic.moveTo(0, -20).lineTo(0, 19).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    } else if (this.type === 'echo-cache') {
      this.graphic.roundRect(-23, -17, 46, 34, 9).fill(0x7a4d2d).stroke({ width: 4, color: accent });
      this.graphic.rect(-23, -5, 46, 9).fill(color);
      this.graphic.circle(0, 1, 6).fill(0xffd95a).stroke({ width: 2, color: 0x7a4d2d });
    } else {
      this.graphic.circle(0, 0, 14).fill(color).stroke({ width: 3, color: accent });
    }
  }

  collect(engine) {
    if (!this.available || this.destroyed) return false;
    this.available = false;
    this.collider.enabled = false;
    this.visible = false;
    if (this.respawnSeconds > 0) this.respawnTimer = this.respawnSeconds;
    else engine.entities.remove(this);
    return true;
  }

  update(dt, engine) {
    super.update(dt, engine);
    if (!this.available) {
      if (this.respawnSeconds <= 0) return;
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer <= 0) {
        this.available = true;
        this.collider.enabled = true;
        this.visible = true;
        this.time = 0;
        engine.events.emit('collectible:respawned', { item: this });
      }
      return;
    }
    this.time += dt;
    this.art.y = Math.sin(this.time * 3) * 5;
    this.art.rotation = Math.sin(this.time * 2) * 0.08;
    const pulse = 0.9 + Math.sin(this.time * 4.2) * 0.12;
    this.glow.scale.set(pulse);
    this.glow.alpha = 0.65 + Math.sin(this.time * 3.3) * 0.2;
    if (['moon-token', 'flock-star', 'prism-seed'].includes(this.type)) this.graphic.rotation += dt * 0.8;
  }
}

export class RecoverableCrumb extends Collectible {
  constructor({ id, x = 0, y = 0, landingY = y + 120, velocityX = 0, velocityY = -360 } = {}) {
    super({ id, type: 'crumb', x, y, value: 1 });
    this.addTag('recoverable-crumb');
    this.landingY = Math.max(y + 24, Number(landingY) || y + 120);
    this.velocity.x = Number(velocityX) || 0;
    this.velocity.y = Number(velocityY) || -360;
    this.dropGravity = 1120;
    this.pickupDelay = 0.32;
    this.landed = false;
    this.collider.enabled = false;
  }

  fixedUpdate(dt, engine) {
    super.fixedUpdate(dt, engine);
    this.pickupDelay = Math.max(0, this.pickupDelay - dt);
    if (this.pickupDelay <= 0 && this.available) this.collider.enabled = true;
    if (this.landed) return;
    this.velocity.y += this.dropGravity * dt;
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
    this.display.rotation += dt * 6;
    if (this.y < this.landingY) return;
    this.y = this.landingY;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.display.rotation = 0;
    this.landed = true;
  }
}
