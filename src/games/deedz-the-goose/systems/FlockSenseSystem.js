import { Graphics } from 'pixi.js';
import { distance } from '../../../shared/math.js';

const COLORS = Object.freeze({
  collectible: 0xffd95a,
  crystal: 0x7ee8ff,
  resonator: 0xc895ff,
  enemy: 0xff7f72,
  boss: 0xff3f63,
  goose: 0x7dff8a,
  checkpoint: 0xffffff,
});

function targetColor(entity) {
  if (entity.hasTag?.('boss')) return COLORS.boss;
  if (entity.hasTag?.('enemy')) return COLORS.enemy;
  if (entity.hasTag?.('crystal')) return COLORS.crystal;
  if (entity.hasTag?.('honk-reactive')) return COLORS.resonator;
  if (entity.hasTag?.('collectible')) return COLORS.collectible;
  if (entity.hasTag?.('remote-player')) return COLORS.goose;
  if (entity.hasTag?.('checkpoint')) return COLORS.checkpoint;
  return null;
}


export function isFlockSenseTargetAvailable(entity) {
  if (!entity || entity.destroyed || entity.active === false || entity.visible === false || entity.display?.visible === false) return false;
  if (entity.hasTag?.('collectible')) return entity.available !== false && entity.collider?.enabled !== false;
  if (entity.hasTag?.('crystal')) return entity.activated !== true;
  if (entity.hasTag?.('echo-resonator')) return entity.activated !== true && (Number(entity.cooldownRemaining) || 0) <= 0;
  if (entity.hasTag?.('checkpoint')) return entity.activeCheckpoint !== true;
  if (entity.hasTag?.('boss')) return entity.activeFight !== false && (Number(entity.hp) || 0) > 0;
  if (entity.hasTag?.('enemy')) return (Number(entity.hp) || 0) > 0;
  if (entity.hasTag?.('remote-player')) return true;
  return false;
}

export class FlockSenseSystem {
  constructor(engine, player, parent) {
    this.engine = engine;
    this.player = player;
    this.range = 980;
    this.elapsed = 0;
    this.wasActive = false;
    this.art = new Graphics();
    this.art.eventMode = 'none';
    parent.addChild(this.art);
  }

  update(dt) {
    this.elapsed += dt;
    const active = this.engine.input.isDown('sense');
    if (!active) {
      if (this.wasActive) this.art.clear();
      this.wasActive = false;
      return;
    }
    this.wasActive = true;
    this.art.clear();
    const pulse = 0.65 + Math.sin(this.elapsed * 6) * 0.2;
    this.art.circle(this.player.x, this.player.y - 10, 92 + Math.sin(this.elapsed * 5) * 12)
      .stroke({ width: 4, color: 0x7ee8ff, alpha: 0.32 });

    for (const entity of this.engine.entities.all()) {
      if (entity === this.player || !isFlockSenseTargetAvailable(entity)) continue;
      const color = targetColor(entity);
      if (color === null) continue;
      const d = distance(this.player.x, this.player.y, entity.x, entity.y);
      if (d > this.range) continue;
      const radius = entity.hasTag?.('boss') ? 66 : entity.hasTag?.('enemy') ? 42 : 30;
      const alpha = Math.max(0.18, (1 - d / this.range) * pulse);
      this.art.circle(entity.x, entity.y - 10, radius + Math.sin(this.elapsed * 7 + d * 0.01) * 4)
        .stroke({ width: entity.hasTag?.('boss') ? 6 : 3, color, alpha });
      if (d > 280) {
        const ratio = Math.min(1, 210 / d);
        const x = this.player.x + (entity.x - this.player.x) * ratio;
        const y = this.player.y + (entity.y - this.player.y) * ratio;
        this.art.moveTo(this.player.x, this.player.y - 12).lineTo(x, y - 12)
          .stroke({ width: 2, color, alpha: alpha * 0.45 });
      }
    }
  }

  destroy() { this.art.destroy(); }
}
