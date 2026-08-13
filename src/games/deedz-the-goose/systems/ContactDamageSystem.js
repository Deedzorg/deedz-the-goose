export class ContactDamageSystem {
  constructor(engine) {
    this.engine = engine;
    this.off = engine.events.on('collision:stay', ({ a, b }) => {
      const player = a.entity.hasTag('player') ? a.entity : b.entity.hasTag('player') ? b.entity : null;
      const enemy = a.entity.hasTag('enemy') ? a.entity : b.entity.hasTag('enemy') ? b.entity : null;
      if (player && enemy) player.takeDamage?.(1, enemy, engine);
    });
  }
  destroy() { this.off?.(); }
}
