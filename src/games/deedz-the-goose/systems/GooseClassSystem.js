const BASE = Object.freeze({ speed: 380, acceleration: 2500, airAcceleration: 1550, jumpSpeed: 720, hp: 6 });

function selectedClass(engine) {
  const id = engine.save.get('profile.character', 'classic');
  return engine.game?.constructor?.name ? id : id;
}

function statsFor(engine, player = null) {
  const stats = player?.character?.stats;
  if (stats) return stats;
  return engine.gooseClassStats?.() ?? {};
}

export class GooseClassSystem {
  constructor(engine) {
    this.engine = engine;
    this.unsubscribers = [
      engine.events.on('entity:added', ({ entity }) => this.#applyPlayer(entity), { priority: 100 }),
      engine.events.on('goose:honk', (payload) => this.#modifyHonk(payload), { priority: 100 }),
      engine.events.on('goose:throw', (payload) => this.#modifyThrow(payload), { priority: 100 }),
      engine.events.on('player:dash', ({ player }) => this.#modifyDash(player), { priority: 100 }),
      engine.events.on('player:jump', (payload) => this.#modifyFlight(payload), { priority: 100 }),
    ];
  }

  #applyPlayer(player) {
    if (!player?.hasTag?.('player')) return;
    const stats = statsFor(this.engine, player);
    player.speed = BASE.speed * (stats.speed ?? 1);
    player.acceleration = BASE.acceleration * (stats.acceleration ?? 1);
    player.airAcceleration = BASE.airAcceleration * (stats.acceleration ?? 1);
    player.jumpSpeed = BASE.jumpSpeed * (stats.jumpSpeed ?? 1);
    player.maxHp = Math.max(4, Math.round(stats.health ?? BASE.hp));
    player.hp = Math.min(player.maxHp, Math.max(player.hp ?? BASE.hp, player.maxHp));
    player.gooseClassId = player.character?.classId ?? player.character?.id ?? selectedClass(this.engine);
  }

  #modifyHonk(payload = {}) {
    const stats = statsFor(this.engine, payload.player);
    payload.range = Math.round((Number(payload.range) || 230) * (stats.honkRange ?? 1));
    payload.strength = Math.round((Number(payload.strength) || 620) * (stats.honkStrength ?? 1));
    if (payload.player?.honkCooldown > 0) payload.player.honkCooldown *= stats.honkCooldown ?? 1;
  }

  #modifyThrow(payload = {}) {
    const stats = statsFor(this.engine, payload.player);
    payload.strength = Math.round((Number(payload.strength) || 0) * (stats.throwStrength ?? 1));
    payload.lift = Math.round((Number(payload.lift) || 0) * (stats.throwLift ?? 1));
    payload.duration = (Number(payload.duration) || 0) * (stats.throwDuration ?? 1);
  }

  #modifyDash(player) {
    if (!player) return;
    const stats = statsFor(this.engine, player);
    player.velocity.x *= stats.dashSpeed ?? 1;
    if (player.dashCooldown > 0) player.dashCooldown *= stats.dashCooldown ?? 1;
  }

  #modifyFlight({ player, flying } = {}) {
    if (!player || !flying) return;
    const stats = statsFor(this.engine, player);
    player.flightTime = Math.max(player.flightTime, 0.48 * (stats.flightDuration ?? 1));
  }

  destroy() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }
}
