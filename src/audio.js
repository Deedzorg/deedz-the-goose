export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.step = 0;
    this.timer = 0;
  }

  ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  beep(freq = 440, duration = 0.08, type = 'square', gain = 0.04) {
    if (!this.enabled) return;
    this.ensure();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.stop(this.ctx.currentTime + duration);
  }

  update(dt, danger, boss) {
    if (!this.enabled) return;
    this.timer -= dt;
    const tempo = boss ? 0.16 : danger ? 0.21 : 0.31;
    if (this.timer > 0) return;
    this.timer = tempo;
    const calm = [196, 247, 294, 330, 294, 247, 220, 247];
    const dangerNotes = [147, 196, 220, 196, 165, 220, 247, 220];
    const bossNotes = [98, 147, 196, 147, 110, 165, 220, 165];
    const bank = boss ? bossNotes : danger ? dangerNotes : calm;
    this.beep(bank[this.step++ % bank.length], 0.07, boss || danger ? 'sawtooth' : 'triangle', boss ? 0.045 : 0.03);
  }
}
