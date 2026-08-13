import { Time } from './Time.js';

export class GameLoop {
  constructor({ fixedStep = 1 / 60, maxDelta = 0.1, maxSubSteps = 6, pauseWhenHidden = true } = {}) {
    this.fixedStep = fixedStep;
    this.maxDelta = maxDelta;
    this.maxSubSteps = maxSubSteps;
    this.pauseWhenHidden = pauseWhenHidden;
    this.time = new Time();
    this.running = false;
    this.paused = false;
    this.hidden = false;
    this.accumulator = 0;
    this.rafId = 0;
    this.stats = { fixedSteps: 0, droppedFrames: 0, lastSubSteps: 0 };
    this.callbacks = { beforeFrame: null, fixedUpdate: null, update: null, render: null, afterFrame: null, onError: null };
    this._boundFrame = this.#frame.bind(this);
    this._boundVisibility = this.#onVisibility.bind(this);
  }

  configure(callbacks) { Object.assign(this.callbacks, callbacks); return this; }

  start() {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.time.reset();
    document.addEventListener('visibilitychange', this._boundVisibility);
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this._boundVisibility);
    this.rafId = 0;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.accumulator = 0;
    this.time.previous = performance.now();
  }

  setTimeScale(scale) { this.time.setScale(scale); }

  #onVisibility() {
    this.hidden = document.hidden;
    this.accumulator = 0;
    this.time.previous = performance.now();
  }

  #frame(now) {
    if (!this.running) return;
    try {
      const rawDelta = Math.min(this.time.tick(now), this.maxDelta);
      this.callbacks.beforeFrame?.(rawDelta, this.time);
      const simulationPaused = this.paused || (this.pauseWhenHidden && this.hidden);
      let subSteps = 0;

      if (!simulationPaused) {
        this.accumulator += rawDelta;
        while (this.accumulator >= this.fixedStep && subSteps < this.maxSubSteps) {
          this.callbacks.fixedUpdate?.(this.fixedStep, this.time);
          this.accumulator -= this.fixedStep;
          subSteps += 1;
          this.stats.fixedSteps += 1;
        }
        if (subSteps === this.maxSubSteps && this.accumulator >= this.fixedStep) {
          this.accumulator %= this.fixedStep;
          this.stats.droppedFrames += 1;
        }
        this.callbacks.update?.(rawDelta, this.time);
      }

      this.stats.lastSubSteps = subSteps;
      const alpha = this.fixedStep > 0 ? this.accumulator / this.fixedStep : 1;
      this.callbacks.render?.(alpha, this.time);
      this.callbacks.afterFrame?.(rawDelta, this.time);
    } catch (error) {
      this.callbacks.onError?.(error);
      if (!this.callbacks.onError) throw error;
    }
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  destroy() { this.stop(); }
}
