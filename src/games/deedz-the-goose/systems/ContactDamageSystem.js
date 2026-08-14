import { isStompLanding } from '../data/combat.js';

export class ContactDamageSystem {
  constructor(engine) {
    this.engine = engine;
    this.unsubscribers = [
      engine.events.on('collision:enter', (contact) => this.#handleEnter(contact)),
      engine.events.on('collision:stay', (contact) => this.#handleStay(contact)),
    ];
  }

  #entities({ a, b }) {
    const playerCollider = a.entity.hasTag('player') ? a : b.entity.hasTag('player') ? b : null;
    const enemyCollider = a.entity.hasTag('enemy') ? a : b.entity.hasTag('enemy') ? b : null;
    const hazard = a.entity.hasTag('hazard') ? a.entity : b.entity.hasTag('hazard') ? b.entity : null;
    return { playerCollider, enemyCollider, hazard };
  }

  #isStomp(playerCollider, enemyCollider) {
    if (!playerCollider || !enemyCollider || enemyCollider.entity.hasTag?.('boss')) return false;
    const player = playerCollider.entity;
    return isStompLanding({
      verticalVelocity: player.velocity?.y,
      previousBottom: Number(player.previousPosition?.y ?? player.y) + playerCollider.offset.y + playerCollider.height / 2,
      currentBottom: playerCollider.bottom,
      enemyTop: enemyCollider.top,
      playerCenterY: playerCollider.centerY,
      enemyCenterY: enemyCollider.centerY,
    });
  }

  defeatEnemy(enemy, cause = 'combat', source = null) {
    if (!enemy || enemy.hasTag?.('boss')) return false;
    const crumbCount = enemy.crumbDropCount?.() ?? 2;
    const defeated = enemy.defeat?.(this.engine, { cause, source, crumbCount });
    if (defeated) this.engine.network.sendWorldEvent('enemy-defeated', { enemyId: enemy.enemyId, cause, crumbCount });
    return Boolean(defeated);
  }

  #stomp(playerCollider, enemyCollider) {
    if (!this.#isStomp(playerCollider, enemyCollider)) return false;
    const player = playerCollider.entity;
    const enemy = enemyCollider.entity;
    if (!this.defeatEnemy(enemy, 'stomp', player)) return false;
    player.velocity.y = -520;
    player.grounded = false;
    player.groundPlatform = null;
    player.jumpsRemaining = Math.max(Number(player.jumpsRemaining) || 0, 1);
    this.engine.events.emit('player:stomp', { player, enemy });
    return true;
  }

  #handleEnter(contact) {
    const { playerCollider, enemyCollider, hazard } = this.#entities(contact);
    if (this.#stomp(playerCollider, enemyCollider)) return;
    if (hazard && enemyCollider && !enemyCollider.entity.hasTag?.('boss')) {
      const enemy = enemyCollider.entity;
      if (enemy.wasRecentlyPlayerPushed?.(this.engine)) {
        this.defeatEnemy(enemy, hazard.type === 'water' ? 'water' : 'fall', hazard);
      } else {
        enemy.resetToSpawn?.();
      }
    }
  }

  #handleStay(contact) {
    const { playerCollider, enemyCollider } = this.#entities(contact);
    if (!playerCollider || !enemyCollider || enemyCollider.entity.defeated) return;
    if (this.#stomp(playerCollider, enemyCollider)) return;
    playerCollider.entity.takeDamage?.(1, enemyCollider.entity, this.engine);
  }

  destroy() { this.unsubscribers.forEach((off) => off()); }
}
