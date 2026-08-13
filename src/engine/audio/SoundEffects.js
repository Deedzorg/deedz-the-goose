export class SoundEffects {
  constructor(audio) { this.audio = audio; this.active = new Set(); }

  async tone({ frequency = 440, duration = 0.08, type = 'square', volume = 0.08, slide = 0 } = {}) {
    await this.audio.unlock();
    const context = this.audio.context;
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.audio.sfxGain);
    const entry = { oscillator, gain };
    this.active.add(entry);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
      this.active.delete(entry);
    }, { once: true });
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  destroy() {
    for (const { oscillator, gain } of this.active) {
      try { oscillator.stop(); } catch {}
      try { oscillator.disconnect(); gain.disconnect(); } catch {}
    }
    this.active.clear();
  }
}
