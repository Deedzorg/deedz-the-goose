import { Graphics } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { lerp } from '../../../shared/math.js';

export class CatCompanion extends Entity {
  constructor({ target, x = 0, y = 0 } = {}) {
    super({ name: 'CatCompanion', tags: ['companion'] });
    this.target = target; this.x = x; this.y = y;
    const art = new Graphics();
    art.ellipse(0, 0, 21, 14).fill(0x11151e);
    art.circle(16, -14, 12).fill(0x11151e);
    art.moveTo(8, -22).lineTo(10, -37).lineTo(19, -24).closePath().fill(0x11151e);
    art.moveTo(20, -24).lineTo(30, -36).lineTo(28, -18).closePath().fill(0x11151e);
    art.circle(13, -16, 2).fill(0x7dff8a); art.circle(21, -16, 2).fill(0x7dff8a);
    art.moveTo(-20, -3).bezierCurveTo(-45, -25, -52, 12, -31, 17).stroke({ width: 7, color: 0x11151e });
    this.display.addChild(art);
  }
  update(dt, engine) {
    super.update(dt, engine); if (!this.target) return;
    const desiredX = this.target.x - this.target.facing * 90; const desiredY = this.target.y - 6;
    const t = 1 - Math.exp(-5 * dt); this.x = lerp(this.x, desiredX, t); this.y = lerp(this.y, desiredY, t);
    this.display.scale.x = this.target.facing;
  }
}
