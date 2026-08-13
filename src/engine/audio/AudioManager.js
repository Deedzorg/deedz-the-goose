import { clamp } from '../../shared/math.js';
import { MusicSystem } from './MusicSystem.js';
import { SoundEffects } from './SoundEffects.js';

export class AudioManager {
  constructor(config, events) {
    this.config = { ...config };
    this.events = events;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.music = new MusicSystem(this);
    this.sfx = new SoundEffects(this);
    this.unlocked = false;
    this.muted = Boolean(config.muted);
    this._unlockHandler = () => this.unlock().catch((error) => this.events.emit('audio:error', { error }));
  }

  initialize() {
    window.addEventListener('pointerdown', this._unlockHandler, { once: true });
    window.addEventListener('keydown', this._unlockHandler, { once: true });
  }

  async unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.events.emit('audio:unsupported');
        return false;
      }
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      this.setVolumes(this.config);
      this.setMuted(this.muted);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.unlocked = this.context.state === 'running';
    this.events.emit('audio:unlocked', { unlocked: this.unlocked });
    return this.unlocked;
  }

  setVolumes({ master = this.config.master, music = this.config.music, sfx = this.config.sfx } = {}) {
    this.config.master = clamp(Number(master) || 0, 0, 1);
    this.config.music = clamp(Number(music) || 0, 0, 1);
    this.config.sfx = clamp(Number(sfx) || 0, 0, 1);
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.config.master;
    if (this.musicGain) this.musicGain.gain.value = this.config.music;
    if (this.sfxGain) this.sfxGain.gain.value = this.config.sfx;
    this.events.emit('audio:volumeChanged', { ...this.config, muted: this.muted });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.config.master;
    this.events.emit('audio:muted', { muted: this.muted });
  }

  async suspend() { if (this.context?.state === 'running') await this.context.suspend(); }
  async resume() { if (this.context?.state === 'suspended') await this.context.resume(); }

  async destroy() {
    window.removeEventListener('pointerdown', this._unlockHandler);
    window.removeEventListener('keydown', this._unlockHandler);
    this.music.destroy();
    this.sfx.destroy();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.unlocked = false;
  }
}
