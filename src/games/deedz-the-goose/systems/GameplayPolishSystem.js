const CUSTOM_NAVIGATION_SCREENS = new Set(['pause-ui', 'main-menu-ui']);

export function screenOwnsControllerNavigation(screenId = '') {
  return CUSTOM_NAVIGATION_SCREENS.has(String(screenId));
}

export function lockPlayerForSpawn(player, engine, frames = 8) {
  if (!player?.fixedUpdate || !engine?.physics?.getBody) return () => {};
  player.__deedzSpawnLockRestore?.();

  const original = player.fixedUpdate;
  let remaining = Math.max(1, Math.floor(Number(frames) || 8));
  const wrapper = function spawnLockedFixedUpdate(dt, runtimeEngine = engine) {
    if (remaining > 0) {
      remaining -= 1;
      const body = runtimeEngine.physics?.getBody?.(player) ?? engine.physics.getBody(player);
      if (body) body.gravityScale = 0;
      if (player.velocity) {
        player.velocity.x = 0;
        player.velocity.y = 0;
      }
      if (player.previousPosition) {
        player.previousPosition.x = player.x;
        player.previousPosition.y = player.y;
      }
      return;
    }

    if (player.fixedUpdate === wrapper) player.fixedUpdate = original;
    player.__deedzSpawnLockRestore = null;
    return original.call(player, dt, runtimeEngine);
  };

  const restore = () => {
    if (player.fixedUpdate === wrapper) player.fixedUpdate = original;
    player.__deedzSpawnLockRestore = null;
  };
  player.fixedUpdate = wrapper;
  player.__deedzSpawnLockRestore = restore;
  return restore;
}

export class GameplayPolishSystem {
  constructor(engine) {
    this.engine = engine;
    this.mousePointerId = null;
    this.spawnRestore = null;
    this.autoBossTimer = null;
    this.autoBossLevel = null;
    this.lastEvolution = null;

    this.originalUiUpdate = engine.ui.update;
    this.uiUpdateWrapper = (input) => {
      if (screenOwnsControllerNavigation(engine.ui.activeScreen?.id)) return;
      return this.originalUiUpdate.call(engine.ui, input);
    };
    engine.ui.update = this.uiUpdateWrapper;

    this.originalToast = engine.ui.toast;
    this.toastWrapper = (message, options) => {
      let text = String(message ?? '');
      text = text.replaceAll('Flock Energy', 'Boss Charge');
      if (text.includes('fill Boss Charge and defeat Baron Breadstorm')) {
        text = 'Echo charged. Baron Breadstorm is being called to Foxfire Fortress. Win the boss challenge to unlock the gate.';
      }
      return this.originalToast.call(engine.ui, text, options);
    };
    engine.ui.toast = this.toastWrapper;

    this.canvas = engine.renderer.canvas;
    this._pointerDown = (event) => this.#pointerDown(event);
    this._pointerUp = (event) => this.#pointerUp(event);
    this._blur = () => this.#releaseMouseThrow();
    this.canvas?.addEventListener('pointerdown', this._pointerDown, { passive: false });
    this.canvas?.addEventListener('pointerup', this._pointerUp, { passive: false });
    this.canvas?.addEventListener('pointercancel', this._pointerUp, { passive: false });
    this.canvas?.addEventListener('lostpointercapture', this._pointerUp, { passive: false });
    window.addEventListener('blur', this._blur);

    this.unsubscribers = [
      engine.events.on('mission:started', () => this.#missionStarted(), { priority: 250 }),
      engine.events.on('evolution:changed', (state) => this.#evolutionChanged(state), { priority: -1000 }),
      engine.events.on('scene:pushed', () => this.#syncSceneState()),
      engine.events.on('scene:popped', () => this.#syncSceneState()),
      engine.events.on('scene:changed', () => this.#syncSceneState()),
    ];
  }

  #world() { return this.engine.scenes?.get?.('world') ?? null; }

  #missionStarted() {
    const world = this.#world();
    if (!world?.player) return;
    this.spawnRestore?.();
    // Entity physics runs before WorldScene.fixedUpdate. Locking the player at
    // the entity level makes the existing scene spawn guard actually safe.
    this.spawnRestore = lockPlayerForSpawn(world.player, this.engine, 8);
    this.engine.ui.toast('Controls: controller, keyboard, touch, or hold left mouse to charge a crumb throw.', { duration: 3600 });
  }

  #bossTarget(state = this.lastEvolution ?? {}) {
    const saved = Math.max(0, Number(this.engine.save.get('progress.bossGateTarget', 0)) || 0);
    if (saved > 0) return saved;
    const wins = Math.max(0, Number(state.bossWins) || 0);
    return wins > 0 ? wins : 1;
  }

  #evolutionChanged(state = {}) {
    this.lastEvolution = state;
    queueMicrotask(() => queueMicrotask(() => this.#refreshProgressLabels(state)));

    const world = this.#world();
    const required = Math.max(1, Number(world?.level?.requiredCrystals) || 3);
    const activeCrystals = this.engine.entities.findByTag('crystal').filter((crystal) => crystal.activated).length;
    const bossActive = Boolean(state.shared?.boss?.active && !state.shared?.boss?.defeated);
    const bossComplete = Math.max(0, Number(state.bossWins) || 0) >= this.#bossTarget(state);
    const ready = Boolean(state.ready || Number(state.xp) >= Number(state.goal));

    if (world?.evolution && ready && activeCrystals >= required && !bossComplete && !bossActive) {
      this.#startAutoBossCharge(state.level);
    } else if (bossActive || bossComplete || !world) {
      this.#stopAutoBossCharge();
    }
  }

  #startAutoBossCharge(level) {
    if (this.autoBossTimer && this.autoBossLevel === level) return;
    this.#stopAutoBossCharge();
    this.autoBossLevel = level;
    this.engine.ui.toast('Echo objective complete — calling Baron Breadstorm to Foxfire Fortress now.', { type: 'warning', duration: 4200 });

    const tick = () => {
      const world = this.#world();
      const state = world?.evolution?.snapshot?.();
      if (!world?.evolution || !state) {
        this.#stopAutoBossCharge();
        return;
      }
      const bossActive = Boolean(state.shared?.boss?.active && !state.shared?.boss?.defeated);
      const bossComplete = Math.max(0, Number(state.bossWins) || 0) >= this.#bossTarget(state);
      if (bossActive || bossComplete) {
        this.#stopAutoBossCharge();
        return;
      }
      const energy = Math.max(0, Number(state.shared?.flockEnergy) || 0);
      const goal = Math.max(1, Number(state.shared?.flockGoal) || 180);
      const missing = Math.max(0, goal - energy);
      if (missing > 0) world.evolution.contributeFlockEnergy(Math.min(30, missing), 'Echo challenge ready');
    };

    this.autoBossTimer = setInterval(tick, 120);
    tick();
  }

  #stopAutoBossCharge() {
    if (this.autoBossTimer) clearInterval(this.autoBossTimer);
    this.autoBossTimer = null;
    this.autoBossLevel = null;
  }

  #refreshProgressLabels(state = this.lastEvolution ?? {}) {
    if (!this.#world()) return;
    const energy = Math.max(0, Number(state.shared?.flockEnergy) || 0);
    const goal = Math.max(1, Number(state.shared?.flockGoal) || 180);
    const flock = document.querySelector?.('[data-flock]');
    if (flock) flock.textContent = `Boss Charge ${energy}/${goal}`;

    const adventure = document.querySelector?.('[data-adventure]');
    if (adventure) {
      adventure.textContent = adventure.textContent.replaceAll('Flock Energy', 'Boss Charge').replace(/· Flock (\d+\/\d+)/g, '· Boss Charge $1');
      const bossComplete = Math.max(0, Number(state.bossWins) || 0) >= this.#bossTarget(state);
      const bossActive = Boolean(state.shared?.boss?.active && !state.shared?.boss?.defeated);
      if (!bossComplete && !bossActive && (state.ready || Number(state.xp) >= Number(state.goal))) {
        adventure.textContent = `NEXT · BARON BREADSTORM INBOUND — Boss Charge ${energy}/${goal} auto-filling · head to Foxfire Fortress, far right`;
      }
    }
  }

  #pointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.engine.scenes?.active?.id !== 'world') return;
    event.preventDefault();
    this.mousePointerId = event.pointerId;
    this.canvas?.setPointerCapture?.(event.pointerId);
    this.engine.input.setVirtualAction('throw', 1);
  }

  #pointerUp(event) {
    if (event.pointerType !== 'mouse' || (this.mousePointerId !== null && event.pointerId !== this.mousePointerId)) return;
    event.preventDefault();
    this.#releaseMouseThrow();
  }

  #releaseMouseThrow() {
    if (this.mousePointerId === null && !this.engine.input.isDown?.('throw')) return;
    this.mousePointerId = null;
    this.engine.input.releaseVirtualAction('throw');
  }

  #syncSceneState() {
    if (this.engine.scenes?.active?.id !== 'world') this.#releaseMouseThrow();
    if (!this.#world()) this.#stopAutoBossCharge();
  }

  destroy() {
    this.spawnRestore?.();
    this.spawnRestore = null;
    this.#stopAutoBossCharge();
    this.#releaseMouseThrow();
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.canvas?.removeEventListener('pointerdown', this._pointerDown);
    this.canvas?.removeEventListener('pointerup', this._pointerUp);
    this.canvas?.removeEventListener('pointercancel', this._pointerUp);
    this.canvas?.removeEventListener('lostpointercapture', this._pointerUp);
    window.removeEventListener('blur', this._blur);
    if (this.engine.ui.update === this.uiUpdateWrapper) this.engine.ui.update = this.originalUiUpdate;
    if (this.engine.ui.toast === this.toastWrapper) this.engine.ui.toast = this.originalToast;
  }
}
