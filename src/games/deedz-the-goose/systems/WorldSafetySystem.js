import { clamp } from '../../../shared/math.js';

const DEFAULTS = Object.freeze({
  sideMargin: 280,
  ceilingMargin: 820,
  floorMargin: 70,
  embeddedDepth: 42,
  triggerDelay: 0.08,
  cooldown: 1.2,
});

function colliderMetrics(collider = {}) {
  return {
    halfWidth: Math.max(1, Number(collider.width) || 62) / 2,
    halfHeight: Math.max(1, Number(collider.height) || 48) / 2,
    offsetY: Number(collider.offset?.y ?? collider.offsetY ?? -4) || 0,
  };
}

function solidEntries(platforms = []) {
  return platforms
    .map((platform) => ({ platform, solid: platform?.collider }))
    .filter(({ solid }) => solid?.enabled && solid.width > 0 && solid.height > 0);
}

export function playerEscapeReason(player, level, platforms = [], options = {}) {
  if (!player || !level) return null;
  const config = { ...DEFAULTS, ...options };
  if (player.x < -config.sideMargin) return 'left-world';
  if (player.x > level.width + config.sideMargin) return 'right-world';
  if (player.y < -config.ceilingMargin) return 'above-world';
  if (player.y > level.height - config.floorMargin) return 'below-world';

  const collider = player.collider;
  if (!collider) return null;
  for (const platform of platforms) {
    const solid = platform?.collider;
    if (!solid?.enabled || solid.height < 110) continue;
    const insideX = collider.right > solid.left + 12 && collider.left < solid.right - 12;
    const buried = collider.top > solid.top + config.embeddedDepth && collider.bottom < solid.bottom + 35;
    if (insideX && buried) return 'inside-ground';
  }
  return null;
}

/**
 * Resolves a spawn against the final platform set and seats it directly on a
 * stable surface. Spawning already grounded avoids the one-frame void fall that
 * could occur while restarting or returning from the main menu.
 */
export function resolveSafeSpawn(preferred = {}, platforms = [], level = {}, collider = {}) {
  const { halfWidth, halfHeight, offsetY } = colliderMetrics(collider);
  let x = clamp(Number(preferred.x) || 120, halfWidth + 8, Math.max(halfWidth + 8, (Number(level.width) || 9600) - halfWidth - 8));
  let y = clamp(Number(preferred.y) || 620, -200, Math.max(200, (Number(level.height) || 1250) - 90));
  const entries = solidEntries(platforms);
  if (!entries.length) return { x, y };

  const left = x - halfWidth;
  const right = x + halfWidth;
  const top = y + offsetY - halfHeight;
  const bottom = y + offsetY + halfHeight;

  // First escape any geometry that overlaps the requested point.
  const overlaps = entries.filter(({ solid }) => right > solid.left + 4 && left < solid.right - 4 && bottom > solid.top + 2 && top < solid.bottom - 2);
  if (overlaps.length) {
    const highestSurface = Math.min(...overlaps.map(({ solid }) => solid.top));
    y = highestSurface - offsetY - halfHeight - 1;
  }

  // Prefer the nearest platform directly beneath the requested horizontal
  // position. The generous vertical range supports checkpoint and level spawns
  // that intentionally begin above the ground.
  const directFloors = entries
    .filter(({ solid }) => x >= solid.left + Math.min(20, solid.width * 0.1)
      && x <= solid.right - Math.min(20, solid.width * 0.1)
      && solid.top >= y + offsetY + halfHeight - 48)
    .sort((a, b) => a.solid.top - b.solid.top);

  let support = directFloors[0] ?? null;
  if (!support) {
    support = [...entries].sort((a, b) => {
      const ax = clamp(x, a.solid.left, a.solid.right);
      const bx = clamp(x, b.solid.left, b.solid.right);
      const horizontal = Math.abs(ax - x) - Math.abs(bx - x);
      if (Math.abs(horizontal) > 0.001) return horizontal;
      return Math.abs(a.solid.top - y) - Math.abs(b.solid.top - y);
    })[0];
    x = clamp(x, support.solid.left + halfWidth + 12, support.solid.right - halfWidth - 12);
  }

  y = support.solid.top - offsetY - halfHeight - 1;
  return { x, y };
}

export function supportingPlatformForSpawn(position = {}, platforms = [], collider = {}, tolerance = 6) {
  const { halfWidth, halfHeight, offsetY } = colliderMetrics(collider);
  const x = Number(position.x) || 0;
  const bottom = (Number(position.y) || 0) + offsetY + halfHeight;
  return solidEntries(platforms)
    .filter(({ solid }) => x + halfWidth > solid.left + 2 && x - halfWidth < solid.right - 2)
    .sort((a, b) => Math.abs(a.solid.top - bottom) - Math.abs(b.solid.top - bottom))
    .find(({ solid }) => Math.abs(solid.top - bottom) <= tolerance)?.platform ?? null;
}

export class WorldSafetySystem {
  constructor(engine, { player, level, platforms, recover, options = {} } = {}) {
    this.engine = engine;
    this.player = player;
    this.level = level;
    this.platforms = platforms;
    this.recover = recover;
    this.options = { ...DEFAULTS, ...options };
    this.escapeTime = 0;
    this.cooldown = 0;
    this.lastReason = null;
  }

  reset(cooldown = 0.45) {
    this.escapeTime = 0;
    this.lastReason = null;
    this.cooldown = Math.max(this.cooldown, Number(cooldown) || 0);
  }

  fixedUpdate(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const platforms = typeof this.platforms === 'function' ? this.platforms() : this.platforms;
    const reason = playerEscapeReason(this.player, this.level, platforms, this.options);
    if (!reason) {
      this.escapeTime = 0;
      this.lastReason = null;
      return false;
    }

    if (reason !== this.lastReason) this.escapeTime = 0;
    this.lastReason = reason;
    this.escapeTime += dt;
    if (this.cooldown > 0 || this.escapeTime < this.options.triggerDelay) return false;

    this.cooldown = this.options.cooldown;
    this.escapeTime = 0;
    this.engine.events.emit('world:safety-recovery', { reason, player: this.player });
    this.recover?.(reason);
    return true;
  }

  destroy() {
    this.player = null;
    this.platforms = [];
    this.recover = null;
  }
}
