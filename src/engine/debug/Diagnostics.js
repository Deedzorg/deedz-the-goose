import { Graphics } from 'pixi.js';

export class Diagnostics {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = config;
    this.visible = Boolean(config.visible);
    this.lastRefresh = 0;
    this.element = null;
    this.graphics = null;
  }

  initialize() {
    if (!this.config.enabled) return;
    this.element = document.createElement('pre');
    this.element.className = 'deedz-diagnostics';
    this.element.hidden = !this.visible;
    this.element.setAttribute('aria-live', 'off');
    document.querySelector('#ui-root')?.appendChild(this.element);
    this.graphics = new Graphics({ label: 'debug:colliders' });
    this.engine.renderer.layers.add('debug', this.graphics, 9999);
    this.engine.events.emit('debug:initialized', { diagnostics: this });
  }

  toggle(force = null) {
    if (!this.config.enabled) return false;
    this.visible = force === null ? !this.visible : Boolean(force);
    if (this.element) this.element.hidden = !this.visible;
    if (this.graphics) this.graphics.visible = this.visible && this.config.drawColliders;
    this.engine.events.emit('debug:visibility', { visible: this.visible });
    return this.visible;
  }

  update() {
    if (!this.config.enabled) return;
    if (this.engine.input.wasPressed(this.config.toggleAction)) this.toggle();
    if (!this.visible || !this.element) return;
    const now = performance.now();
    if (now - this.lastRefresh < this.config.refreshMs) return;
    this.lastRefresh = now;
    const loop = this.engine.loop;
    const physics = this.engine.physics.collisions.stats;
    const player = this.engine.entities.findByTag('player')[0];
    const position = player ? `${player.x.toFixed(1)}, ${player.y.toFixed(1)}` : '—';
    const evolution = this.engine.scenes?.active?.evolution?.snapshot?.();
    const boss = evolution?.shared?.boss;
    this.element.textContent = [
      `DEEDZ ENGINE ${this.engine.config.engine.version}`,
      `State        ${this.engine.state}`,
      `Scene        ${this.engine.scenes?.active?.id ?? '—'} (${this.engine.scenes?.depth ?? 0})`,
      `FPS          ${loop.time.fps.toFixed(1)} (${loop.time.frameTimeMs.toFixed(2)} ms)`,
      `Fixed steps  ${loop.stats.lastSubSteps} / dropped ${loop.stats.droppedFrames}`,
      `Entities     ${this.engine.entities.entities.size}`,
      `Physics      ${physics.colliders} colliders · ${physics.contacts} contacts`,
      `Player       ${position}`,
      `Network      ${this.engine.network.status}${this.engine.network.latency === null ? '' : ` · ${this.engine.network.latency} ms`}`,
      `Peers        ${this.engine.network.peers.size}`,
      ...(evolution ? [
        `Echo layer   ${evolution.level} · ${evolution.xp}/${evolution.goal}${evolution.ready ? ' READY' : ''}`,
        `Flock energy ${evolution.shared.flockEnergy}/${evolution.shared.flockGoal}`,
        `Boss         ${boss?.active ? `P${boss.phase} ${boss.hp}/${boss.maxHp} shield ${boss.shield}` : `dormant · wins ${evolution.shared.bossWins}`}`,
      ] : []),
      `Renderer     ${this.engine.renderer.width} × ${this.engine.renderer.height}`, 
      '',
      'F3 toggles diagnostics',
    ].join('\n');
  }

  render() {
    if (!this.graphics) return;
    this.graphics.clear();
    this.graphics.visible = this.visible && this.config.drawColliders;
    if (!this.graphics.visible) return;
    for (const collider of this.engine.physics.allColliders()) {
      const color = collider.trigger ? 0xffd95a : collider.entity.hasTag?.('player') ? 0x55d6ff : collider.entity.hasTag?.('enemy') ? 0xff6b7a : 0x7dff8a;
      this.graphics.rect(collider.left, collider.top, collider.width, collider.height).stroke({ width: 2, color, alpha: 0.9 });
    }
  }

  destroy() {
    this.element?.remove();
    this.graphics?.removeFromParent();
    this.graphics?.destroy();
    this.element = null;
    this.graphics = null;
  }
}
