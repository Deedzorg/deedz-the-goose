import { distance } from '../../../shared/math.js';
import { HonkPulse, WingBurst } from '../entities/ActionEffects.js';
import { CrumbProjectile } from '../entities/CrumbProjectile.js';

export class CombatSystem {
  constructor(engine, parent) {
    this.engine = engine;
    this.parent = parent;
    this.unsubscribers = [
      engine.events.on('goose:attack', ({ player }) => this.#attack(player, 116, 1, 440, true)),
      engine.events.on('goose:throw', (payload) => this.#throwCrumb(payload)),
      engine.events.on('goose:honk', (payload) => this.#honk(payload, true, true)),
      engine.events.on('collision:enter', (contact) => this.#projectileCollision(contact)),
      engine.events.on('net:world-event', (event) => this.#applyWorldEvent(event)),
    ];
  }

  #attack(player, range, damage, knockback, broadcast) {
    let hits = 0;
    for (const enemy of this.engine.entities.findByTag('enemy')) {
      const inFacingDirection = Math.sign(enemy.x - player.x || player.facing) === player.facing;
      if (distance(player.x, player.y, enemy.x, enemy.y) > range || !inFacingDirection) continue;
      const knockbackX = Math.sign(enemy.x - player.x || 1) * knockback;
      const knockbackY = -260;
      if (this.#damageEnemy(enemy, damage, knockbackX, knockbackY, { kind: 'attack', source: player, broadcast })) hits += 1;
    }
    if (hits) this.engine.events.emit('combat:hit', { player, hits, range, damage });
  }

  #throwCrumb({ player, x = player?.x ?? 0, y = player?.y ?? 0, facing = player?.facing ?? 1, damage = 1, strength = 790, lift = 155, duration = 2.2, charge = 0.5 } = {}) {
    const projectile = new CrumbProjectile({
      x,
      y,
      facing,
      ownerId: this.engine.network.clientId ?? 'local',
      damage,
      strength,
      lift,
      duration,
      charge,
      color: player?.character?.accent ?? 0xf7ca76,
    });
    this.engine.entities.addImmediate(projectile, this.parent);
    this.engine.physics.addBody(projectile, { gravityScale: 0.22 + (1 - charge) * 0.08, maxSpeedX: 1180, maxSpeedY: 980 });
    this.engine.physics.addCollider(projectile.collider);
    this.engine.events.emit('achievement:unlock', { id: 'crumb-slinger' });
  }

  #projectileCollision({ a, b }) {
    const projectileCollider = a.entity.hasTag('crumb-projectile') ? a : b.entity.hasTag('crumb-projectile') ? b : null;
    const enemyCollider = a.entity.hasTag('enemy') ? a : b.entity.hasTag('enemy') ? b : null;
    if (!projectileCollider || !enemyCollider) return;
    const projectile = projectileCollider.entity;
    const enemy = enemyCollider.entity;
    if (projectile.hit || projectile.remote || projectile.destroyed || enemy.destroyed) return;
    projectile.hit = true;
    projectile.collider.enabled = false;
    const knockbackX = projectile.facing * (430 + projectile.charge * 330);
    const knockbackY = -190 - projectile.charge * 170;
    this.#damageEnemy(enemy, projectile.damage, knockbackX, knockbackY, {
      kind: 'crumb',
      source: projectile,
      broadcast: true,
    });
    this.engine.entities.add(new WingBurst({ x: projectile.x, y: projectile.y, color: 0xf7ca76, count: 7, label: 'CRUMB!' }), this.parent);
    this.engine.entities.remove(projectile);
  }

  #damageEnemy(enemy, damage, knockbackX, knockbackY, { kind = 'attack', source = null, broadcast = true } = {}) {
    if (!enemy || enemy.destroyed) return false;
    if (enemy.hasTag?.('boss')) {
      enemy.requestHit?.(damage, this.engine, { kind, source });
      return true;
    }
    enemy.takeDamage?.(damage, this.engine);
    enemy.velocity.x = knockbackX;
    enemy.velocity.y = knockbackY;
    if (broadcast) {
      this.engine.network.sendWorldEvent('enemy-hit', { enemyId: enemy.enemyId, damage, knockbackX, knockbackY });
      if (enemy.hp <= 0) this.engine.network.sendWorldEvent('enemy-defeated', { enemyId: enemy.enemyId });
    }
    return true;
  }

  #honk({ player = null, source = player, x = player?.x ?? 0, y = player?.y ?? 0, facing = player?.facing ?? 1, range = 230, strength = 620 } = {}, showEffect, broadcast) {
    if (showEffect) this.engine.entities.add(new HonkPulse({ x, y, facing, radius: range, color: player?.character?.accent ?? 0xffe36e }), this.parent);

    let hits = 0;
    for (const enemy of this.engine.entities.findByTag('enemy')) {
      if (distance(x, y, enemy.x, enemy.y) > range) continue;
      const direction = Math.sign(enemy.x - x || facing || 1);
      const knockbackX = direction * strength;
      const knockbackY = -300;
      if (this.#damageEnemy(enemy, enemy.hasTag?.('boss') ? 2 : 1, knockbackX, knockbackY, { kind: 'honk', source, broadcast })) hits += 1;
    }

    for (const reactive of this.engine.entities.findByTag('honk-reactive')) {
      if (reactive.activated || distance(x, y, reactive.x, reactive.y) > (reactive.radius ?? range)) continue;
      if (reactive.activate?.(this.engine, source) && broadcast && reactive.hasTag?.('crystal')) {
        this.engine.network.sendWorldEvent('crystal-activated', { crystalId: reactive.crystalId });
      }
    }

    if (hits) this.engine.events.emit('combat:hit', { player: source, hits, range, damage: 1, honk: true });
  }

  #applyWorldEvent(event = {}) {
    if (event.event === 'enemy-hit') {
      const enemy = this.engine.entities.get(`enemy-${event.enemyId}`);
      if (!enemy || enemy.destroyed) return;
      enemy.takeDamage?.(Number(event.damage) || 1, this.engine);
      enemy.velocity.x = Number(event.knockbackX) || 0;
      enemy.velocity.y = Number(event.knockbackY) || -220;
    } else if (event.event === 'enemy-defeated') {
      const enemy = this.engine.entities.get(`enemy-${event.enemyId}`);
      if (enemy && !enemy.destroyed) this.engine.entities.remove(enemy);
    } else if (event.event === 'crystal-activated') {
      const crystal = this.engine.entities.get(`crystal-${event.crystalId}`);
      crystal?.activate?.(this.engine, { remote: true });
    }
  }

  destroy() { this.unsubscribers.forEach((off) => off()); }
}
