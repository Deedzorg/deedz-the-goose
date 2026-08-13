import { collectibleDefinition } from '../data/collectibles.js';

export class CollectibleSystem {
  constructor(engine) {
    this.engine = engine;
    this.off = engine.events.on('collision:enter', ({ a, b }) => {
      const playerCollider = a.entity.hasTag('player') ? a : b.entity.hasTag('player') ? b : null;
      const collectibleCollider = a.entity.hasTag('collectible') ? a : b.entity.hasTag('collectible') ? b : null;
      if (!playerCollider || !collectibleCollider) return;
      const item = collectibleCollider.entity;
      if (!item.available || item.destroyed || !item.collect(engine)) return;

      const player = playerCollider.entity;
      const definition = collectibleDefinition(item.type);
      if (definition.ammo > 0) {
        const current = Math.max(0, Number(engine.save.get('progress.crumbAmmo', 0)) || 0);
        const next = Math.min(99, current + definition.ammo * item.value);
        engine.save.set('progress.crumbAmmo', next);
        engine.events.emit('player:ammo', { ammo: next, gained: next - current, item });
      }
      if (definition.heal > 0) player.heal?.(definition.heal * item.value, engine);
      if (item.type === 'golden-feather') {
        player.jumpsRemaining = player.maxJumps;
        player.flightTime = Math.max(player.flightTime, 0.7);
        engine.events.emit('player:jump-refill', { player, item });
      }

      engine.events.emit('collectible:collected', { item, player, definition });
      if (engine.save.get('settings.sfx', true)) {
        const frequency = item.type === 'echo-cache' ? 380 : item.type === 'flock-star' ? 760 : 620;
        engine.audio.sfx.tone({ frequency, slide: item.type === 'heart' ? -90 : 160, duration: item.type === 'echo-cache' ? 0.18 : 0.08, type: 'sine', volume: 0.06 });
      }
    });
  }
  destroy() { this.off?.(); }
}
