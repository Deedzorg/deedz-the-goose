export function bossGuidanceLabel(state = {}) {
  const shared = state.shared ?? {};
  const boss = shared.boss;
  const energy = Math.max(0, Number(shared.flockEnergy) || 0);
  const goal = Math.max(1, Number(shared.flockGoal) || 180);
  if (!boss?.active || boss.defeated) return `Baron dormant · Flock ${energy}/${goal}`;
  const hp = Math.max(0, Number(boss.hp) || 0);
  const maxHp = Math.max(1, Number(boss.maxHp) || hp || 1);
  const shield = Math.max(0, Number(boss.shield) || 0);
  const phase = Math.max(1, Number(boss.phase) || 1);
  return shield > 0
    ? `Breadstorm P${phase} · Shield ${shield} · HP ${hp}/${maxHp} · HONK!`
    : `Breadstorm P${phase} · HP ${hp}/${maxHp} · ATTACK!`;
}

export class BossGuidanceSystem {
  constructor(engine) {
    this.engine = engine;
    this.lastBoss = null;
    this.energyHintCycle = null;
    this.activeBossId = null;
    this.lastBlockedAt = 0;
    this.unsubscribers = [
      engine.events.on('evolution:changed', (state) => this.#onEvolution(state), { priority: -100 }),
      engine.events.on('net:world-event', (event) => this.#onNetworkBossEvent(event), { priority: -100 }),
      engine.events.on('boss:hit-request', (payload) => this.#onOfflineHitRequest(payload), { priority: -100 }),
    ];
  }

  #onEvolution(state = {}) {
    const shared = state.shared ?? {};
    const boss = shared.boss;
    const energy = Math.max(0, Number(shared.flockEnergy) || 0);
    const goal = Math.max(1, Number(shared.flockGoal) || 180);
    const cycle = Math.max(1, Number(boss?.cycle) || Number(shared.bossWins) + 1 || 1);

    const bossChip = document.querySelector?.('[data-boss]');
    if (bossChip) bossChip.textContent = bossGuidanceLabel(state);

    if (!boss?.active || boss.defeated) {
      this.activeBossId = null;
      this.lastBoss = boss ? { ...boss } : null;
      if (energy >= Math.ceil(goal * 0.72) && energy < goal && this.energyHintCycle !== cycle) {
        this.energyHintCycle = cycle;
        this.engine.ui.toast(
          `Flock Energy ${energy}/${goal}. Baron Breadstorm is stirring — fill the meter and head to Foxfire Fortress on the far right.`,
          { type: 'warning', duration: 5200 },
        );
      }
      return;
    }

    if (this.activeBossId !== boss.id) {
      this.activeBossId = boss.id;
      this.engine.ui.toast(
        'BARON BREADSTORM ACTIVE — Foxfire Fortress, far right. HONK the blue shield down first; attack when the shield breaks.',
        { type: 'danger', duration: 6200 },
      );
    }

    const previous = this.lastBoss;
    if (previous?.id === boss.id) {
      const shieldDrop = Math.max(0, Number(previous.shield) - Number(boss.shield));
      const hpDrop = Math.max(0, Number(previous.hp) - Number(boss.hp));
      if (shieldDrop > 0) {
        this.engine.ui.toast(
          Number(boss.shield) <= 0
            ? `Echo Shield -${shieldDrop}. SHIELD BROKEN — attack now!`
            : `Echo Shield -${shieldDrop} · ${boss.shield} remaining`,
          { type: Number(boss.shield) <= 0 ? 'success' : 'warning', duration: 1800 },
        );
      }
      if (hpDrop > 0) {
        this.engine.ui.toast(`Breadstorm -${hpDrop} HP · ${boss.hp}/${boss.maxHp}`, { type: 'success', duration: 1500 });
      }
      if (Number(boss.phase) > Number(previous.phase) && Number(boss.shield) > 0) {
        this.engine.ui.toast(`Phase ${boss.phase}! The Echo Shield is back — HONK it down again.`, { type: 'warning', duration: 3200 });
      }
    }
    this.lastBoss = { ...boss };
  }

  #onNetworkBossEvent(event = {}) {
    if (event.event !== 'boss-hit') return;
    if (Number(event.damageApplied) > 0 || Number(event.shieldDamage) > 0) return;
    if (Number(event.boss?.shield) > 0) this.#blockedHint();
  }

  #onOfflineHitRequest(payload = {}) {
    if (payload.hitType === 'honk') return;
    if (Number(this.lastBoss?.shield) > 0) this.#blockedHint();
  }

  #blockedHint() {
    const now = performance.now();
    if (now - this.lastBlockedAt < 1300) return;
    this.lastBlockedAt = now;
    this.engine.ui.toast('The blue Echo Shield blocked that hit — HONK it first.', { type: 'warning', duration: 1800 });
  }

  destroy() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }
}
