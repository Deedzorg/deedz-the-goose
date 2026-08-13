import { distance } from '../../../shared/math.js';
import { HonkPulse, WingBurst } from '../entities/ActionEffects.js';
import { CrumbProjectile } from '../entities/CrumbProjectile.js';

export class GooseInteractionSystem {
  constructor(engine, player, networkPlayers, parent) {
    this.engine = engine;
    this.player = player;
    this.networkPlayers = networkPlayers;
    this.parent = parent;
    this.unsubscribers = [
      engine.events.on('goose:interact', ({ player: source }) => this.#interact(source)),
      engine.events.on('goose:honk', (payload) => this.#localHonk(payload)),
      engine.events.on('net:action', (payload) => this.#remoteAction(payload)),
    ];
  }

  #interact(player) {
    const remote = this.networkPlayers.nearest(player.x, player.y, 165);
    if (!remote) return;
    const midpoint = { x: (player.x + remote.x) / 2, y: (player.y + remote.y) / 2 - 10 };
    player.wingBump(remote.x, this.engine);
    remote.react('wing-bump', { facing: remote.target.facing });
    this.engine.entities.add(new WingBurst({ ...midpoint, color: 0xffd95a, count: 18, label: 'GOOSE BUMP!' }), this.parent);
    this.engine.network.sendAction('wing-bump', { targetId: remote.peerId, x: player.x, y: player.y, facing: player.facing, strength: 360 });
    this.engine.events.emit('achievement:unlock', { id: 'wing-bump' });
    this.engine.events.emit('goose:social', { type: 'wing-bump', player, remote });
  }

  #localHonk({ player, x = player?.x ?? 0, y = player?.y ?? 0, range = 230, strength = 620 } = {}) {
    for (const remote of this.networkPlayers.all()) {
      if (distance(x, y, remote.x, remote.y) > range) continue;
      const direction = Math.sign(remote.x - x || player?.facing || 1);
      remote.react('honk', { facing: remote.target.facing });
      remote.target.x += direction * Math.min(42, strength * 0.06);
      remote.target.y -= 24;
    }
  }

  #remoteAction(payload = {}) {
    const remote = this.networkPlayers.get(payload.id);
    if (!remote) return;
    remote.react(payload.action, payload);

    if (payload.action === 'honk') {
      const range = Math.max(120, Math.min(320, Number(payload.range) || 230));
      const strength = Math.max(120, Math.min(780, Number(payload.strength) || 520));
      this.engine.entities.add(new HonkPulse({ x: payload.x, y: payload.y, facing: payload.facing, radius: range, color: remote.character?.accent ?? 0xffe36e }), this.parent);
      this.engine.events.emit('world:honk', { source: remote, x: payload.x, y: payload.y, facing: payload.facing, range, strength, remote: true });
      if (distance(this.player.x, this.player.y, payload.x, payload.y) <= range) {
        this.player.applyHonkImpulse({ x: payload.x, y: payload.y, strength }, this.engine);
        this.engine.ui.toast(`${remote.profile.name || 'A goose'} honked you into action!`, { duration: 1700 });
      }
    } else if (payload.action === 'throw') {
      const charge = Math.max(0, Math.min(1, Number(payload.charge) || 0));
      const style = remote.character?.projectileStyle === 'ember-bolt' ? 'ember-bolt' : 'crumb';
      const strength = style === 'ember-bolt' ? Math.max(900, Number(payload.strength) || 790) : Number(payload.strength) || 790;
      const lift = style === 'ember-bolt' ? 16 + Math.round(charge * 10) : Number(payload.lift) || 155;
      const duration = style === 'ember-bolt' ? 1.05 + charge * 0.35 : Number(payload.duration) || 2.2;
      const projectile = new CrumbProjectile({
        x: Number(payload.x) || remote.x,
        y: Number(payload.y) || remote.y,
        facing: payload.facing,
        ownerId: payload.id,
        remote: true,
        strength,
        lift,
        duration,
        damage: Number(payload.damage) || 1,
        charge,
        style,
        color: style === 'ember-bolt' ? 0xffd05a : (remote.character?.accent ?? 0xf7ca76),
      });
      this.engine.entities.addImmediate(projectile, this.parent);
      this.engine.physics.addBody(projectile, { gravityScale: style === 'ember-bolt' ? 0.025 : 0.22 + (1 - charge) * 0.08, maxSpeedX: style === 'ember-bolt' ? 1420 : 1180, maxSpeedY: 980 });
    } else if (payload.action === 'wing-bump' && payload.targetId === this.engine.network.clientId) {
      this.player.wingBump(payload.x, this.engine);
      this.engine.entities.add(new WingBurst({ x: this.player.x, y: this.player.y - 10, color: 0xffd95a, count: 18, label: 'GOOSE BUMP!' }), this.parent);
      this.engine.events.emit('achievement:unlock', { id: 'wing-bump' });
      this.engine.ui.toast(`${remote.profile.name || 'A goose'} gave you a wing-bump!`, { type: 'success', duration: 1800 });
    }
  }

  destroy() { this.unsubscribers.forEach((off) => off()); }
}
