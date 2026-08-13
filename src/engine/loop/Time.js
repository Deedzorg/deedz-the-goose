export class Time {
  constructor() { this.reset(); }

  reset(now = performance.now()) {
    this.startedAt = now;
    this.previous = now;
    this.now = now;
    this.delta = 0;
    this.unscaledDelta = 0;
    this.elapsed = 0;
    this.unscaledElapsed = 0;
    this.frame = 0;
    this.scale = 1;
    this.fps = 0;
    this.frameTimeMs = 0;
  }

  tick(now) {
    this.now = now;
    this.unscaledDelta = Math.max(0, (now - this.previous) / 1000);
    this.delta = this.unscaledDelta * this.scale;
    this.unscaledElapsed += this.unscaledDelta;
    this.elapsed += this.delta;
    this.previous = now;
    this.frame += 1;
    const instantFps = this.unscaledDelta > 0 ? 1 / this.unscaledDelta : 0;
    this.fps = this.fps === 0 ? instantFps : this.fps * 0.9 + instantFps * 0.1;
    this.frameTimeMs = this.unscaledDelta * 1000;
    return this.delta;
  }

  setScale(scale) { this.scale = Math.max(0, Number(scale) || 0); }
}
