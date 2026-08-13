import { clamp } from '../../shared/math.js';

const ROOTS = Object.freeze([82.41, 92.5, 98, 110, 123.47, 130.81]);
const MODES = Object.freeze([
  { id: 'major-pentatonic', semitones: [0, 2, 4, 7, 9, 12], ratios: [1, 1.125, 1.25, 1.5, 1.667, 2] },
  { id: 'dorian', semitones: [0, 2, 3, 5, 7, 9, 10, 12], ratios: [1, 1.122, 1.189, 1.335, 1.498, 1.682, 1.782, 2] },
  { id: 'lydian', semitones: [0, 2, 4, 6, 7, 9, 11, 12], ratios: [1, 1.122, 1.26, 1.414, 1.498, 1.682, 1.888, 2] },
  { id: 'minor-pentatonic', semitones: [0, 3, 5, 7, 10, 12], ratios: [1, 1.189, 1.335, 1.498, 1.782, 2] },
  { id: 'mixolydian', semitones: [0, 2, 4, 5, 7, 9, 10, 12], ratios: [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.782, 2] },
]);
const CHORD_PROGRESSIONS = Object.freeze([
  [0, 3, 4, 3],
  [0, 4, 2, 3],
  [0, 2, 5, 4],
  [0, 5, 3, 4],
  [0, 3, 1, 4],
]);
const MELODY_PATTERNS = Object.freeze([
  [0, null, 2, null, 4, 3, null, 1, 0, null, 3, 4, 5, null, 4, 2],
  [0, 2, null, 3, 4, null, 2, null, 5, 4, 3, null, 2, 1, null, 0],
  [0, null, 4, 3, null, 5, 4, 2, null, 1, 2, null, 4, 5, 3, null],
  [0, 1, 3, null, 4, 3, null, 5, 4, null, 2, 3, 1, null, 0, null],
]);

function seededIndex(level, offset, length) {
  const value = Math.imul((level + 17) >>> 0, 2654435761) + Math.imul(offset + 31, 1597334677);
  return Math.abs(value >>> 0) % length;
}

function frequencyFromScale(root, scale, degree, octave = 0) {
  const count = Math.max(1, scale.length - 1);
  const wrapped = ((degree % count) + count) % count;
  const octaveFromDegree = Math.floor(degree / count);
  return root * scale[wrapped] * 2 ** (octave + octaveFromDegree);
}

export function adaptiveMusicProfile({ level = 1, stage = {}, intensity = 0 } = {}) {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
  const normalizedIntensity = clamp(Number(intensity) || 0, 0, 1);
  const rootIndex = (normalizedLevel - 1) % ROOTS.length;
  const cycle = Math.floor((normalizedLevel - 1) / ROOTS.length);
  const root = Number(stage.musicRoot) || ROOTS[rootIndex] * (cycle % 2 === 0 ? 1 : 1.05946);
  const tempo = clamp((Number(stage.musicTempo) || 80 + (normalizedLevel - 1) * 3.4) + normalizedIntensity * 24, 76, 154);
  const modePreset = MODES[seededIndex(normalizedLevel, 3, MODES.length)];
  const stageMode = Array.isArray(stage.musicMode) && stage.musicMode.length >= 4 ? stage.musicMode.map(Number) : null;
  const scale = stageMode ?? modePreset.ratios;
  const progression = CHORD_PROGRESSIONS[seededIndex(normalizedLevel, 11, CHORD_PROGRESSIONS.length)];
  const melody = MELODY_PATTERNS[seededIndex(normalizedLevel, 29, MELODY_PATTERNS.length)];
  const instrumentTiers = Math.min(5, 1 + Math.floor((normalizedLevel - 1) / 2));
  return {
    level: normalizedLevel,
    stageId: stage.id ?? `echo-${normalizedLevel}`,
    root,
    tempo,
    intensity: normalizedIntensity,
    mode: [...scale],
    modeName: stage.musicModeName ?? modePreset.id,
    chordProgression: [...progression],
    melodyPattern: [...melody],
    padType: normalizedLevel % 4 === 0 ? 'sawtooth' : normalizedLevel % 3 === 0 ? 'triangle' : 'sine',
    leadType: normalizedIntensity > 0.72 ? 'square' : normalizedLevel % 3 === 0 ? 'triangle' : 'sine',
    bassType: normalizedIntensity > 0.55 ? 'sawtooth' : 'triangle',
    volume: 0.026 + Math.min(0.012, normalizedLevel * 0.0012) + normalizedIntensity * 0.008,
    beatDivision: normalizedLevel >= 5 ? 2 : 1,
    instrumentTiers,
    percussionDensity: clamp(0.24 + normalizedLevel * 0.035 + normalizedIntensity * 0.42, 0.28, 1),
    shimmer: clamp((normalizedLevel - 1) * 0.08 + normalizedIntensity * 0.25, 0, 1),
    swing: normalizedLevel % 2 === 0 ? 0.055 : 0.025,
    bossMode: normalizedIntensity >= 0.3,
  };
}

export class MusicSystem {
  constructor(audio) {
    this.audio = audio;
    this.current = null;
    this.nodes = [];
    this.pending = null;
    this.offUnlock = null;
    this.scheduler = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.scoreGain = null;
    this.buses = null;
    this.noiseBuffer = null;
  }

  playToneBed(options = {}) {
    return this.#queue({ kind: 'tone-bed', options: { root: 110, tempo: 92, volume: 0.035, ...options } });
  }

  playEvolutionScore(options = {}) {
    const profile = adaptiveMusicProfile(options);
    const key = `${profile.stageId}:${profile.level}:${profile.tempo.toFixed(1)}:${profile.intensity.toFixed(2)}:${profile.modeName}`;
    if (this.current?.type === 'evolution-score' && this.current.key === key) return true;
    return this.#queue({ kind: 'evolution-score', options: profile });
  }

  setIntensity(intensity = 0) {
    const source = this.current?.type === 'evolution-score' ? this.current.profile : this.pending?.kind === 'evolution-score' ? this.pending.options : null;
    if (!source) return false;
    return this.playEvolutionScore({
      level: source.level,
      stage: {
        id: source.stageId,
        musicRoot: source.root,
        musicTempo: source.tempo - source.intensity * 24,
        musicMode: source.mode,
        musicModeName: source.modeName,
      },
      intensity,
    });
  }

  #queue(request) {
    this.#fadeOutCurrent(0.22);
    this.pending = request;
    if (!this.audio.unlocked) {
      this.offUnlock?.();
      this.offUnlock = this.audio.events.once('audio:unlocked', ({ unlocked }) => {
        this.offUnlock = null;
        const pending = this.pending;
        if (unlocked && pending) this.#start(pending);
      });
      return false;
    }
    this.#start(request);
    return true;
  }

  #start(request) {
    if (request.kind === 'evolution-score') return this.#startEvolutionScore(request.options);
    return this.#startToneBed(request.options);
  }

  #startToneBed({ root, tempo, volume }) {
    const context = this.audio.context;
    if (!context || !this.audio.musicGain) return false;
    this.pending = null;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), context.currentTime + 0.35);
    gain.connect(this.audio.musicGain);
    const frequencies = [root, root * 1.5, root * 2];
    for (const [index, frequency] of frequencies.entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 4;
      oscillator.connect(gain);
      oscillator.start();
      this.nodes.push(oscillator);
    }
    this.nodes.push(gain);
    this.scoreGain = gain;
    this.current = { type: 'tone-bed', root, tempo };
    return true;
  }

  #startEvolutionScore(profile) {
    const context = this.audio.context;
    if (!context || !this.audio.musicGain) return false;
    this.pending = null;
    this.step = 0;
    this.nextNoteTime = context.currentTime + 0.06;
    this.noiseBuffer = this.#createNoiseBuffer(context);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.2;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, profile.volume), context.currentTime + 0.5);
    gain.connect(compressor);
    compressor.connect(this.audio.musicGain);
    this.scoreGain = gain;
    this.nodes.push(gain, compressor);

    const createBus = (amount) => {
      const bus = context.createGain();
      bus.gain.value = amount;
      bus.connect(gain);
      this.nodes.push(bus);
      return bus;
    };
    this.buses = {
      pad: createBus(0.58),
      bass: createBus(0.48 + profile.intensity * 0.12),
      lead: createBus(0.34 + profile.intensity * 0.1),
      percussion: createBus(0.36 + profile.intensity * 0.2),
      shimmer: createBus(0.2 + profile.shimmer * 0.18),
    };

    const delay = context.createDelay(0.8);
    const feedback = context.createGain();
    const wet = context.createGain();
    delay.delayTime.value = Math.min(0.42, (60 / profile.tempo) * 0.75);
    feedback.gain.value = 0.2 + profile.shimmer * 0.12;
    wet.gain.value = 0.18 + profile.shimmer * 0.15;
    this.buses.lead.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(gain);
    this.nodes.push(delay, feedback, wet);

    this.current = {
      type: 'evolution-score',
      key: `${profile.stageId}:${profile.level}:${profile.tempo.toFixed(1)}:${profile.intensity.toFixed(2)}:${profile.modeName}`,
      profile,
    };

    this.#schedulerTick(profile);
    this.scheduler = globalThis.setInterval(() => this.#schedulerTick(profile), 25);
    return true;
  }

  #schedulerTick(profile) {
    const context = this.audio.context;
    if (!context || context.state === 'closed' || !this.scoreGain || !this.buses) return;
    const lookAhead = 0.16;
    const stepDuration = 60 / profile.tempo / 4;
    while (this.nextNoteTime < context.currentTime + lookAhead) {
      const swingOffset = this.step % 2 === 1 ? stepDuration * profile.swing : 0;
      this.#scheduleStep(profile, this.step, this.nextNoteTime + swingOffset, stepDuration);
      this.nextNoteTime += stepDuration;
      this.step += 1;
    }
  }

  #scheduleStep(profile, step, time, stepDuration) {
    const barStep = step % 16;
    const bar = Math.floor(step / 16);
    const chordDegree = profile.chordProgression[bar % profile.chordProgression.length];

    if (barStep === 0) this.#schedulePad(profile, chordDegree, time, stepDuration * 15.5);
    if (barStep % 4 === 0) this.#scheduleBass(profile, chordDegree, time, stepDuration * 3.2, barStep === 12 ? 1 : 0);

    const melodyDegree = profile.melodyPattern[barStep];
    const melodyGate = profile.instrumentTiers >= 2 || profile.intensity > 0.2;
    if (melodyGate && melodyDegree !== null && (barStep % 2 === 0 || profile.instrumentTiers >= 4)) {
      this.#scheduleLead(profile, melodyDegree + chordDegree, time, stepDuration * (profile.bossMode ? 1.4 : 1.9));
    }

    this.#schedulePercussion(profile, barStep, time, stepDuration);
    if (profile.instrumentTiers >= 3 && profile.shimmer > 0.18 && [3, 7, 11, 15].includes(barStep)) {
      this.#scheduleShimmer(profile, chordDegree + 4 + (bar % 2), time, stepDuration * 3.4);
    }
    if (profile.bossMode && [2, 6, 10, 14].includes(barStep)) {
      this.#scheduleBossStab(profile, chordDegree, time, stepDuration * 0.8);
    }
  }

  #schedulePad(profile, degree, time, duration) {
    const context = this.audio.context;
    const chord = [degree, degree + 2, degree + 4];
    for (const [index, noteDegree] of chord.entries()) {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      oscillator.type = index === 0 ? profile.padType : 'sine';
      oscillator.frequency.setValueAtTime(frequencyFromScale(profile.root, profile.mode, noteDegree, index === 2 ? 1 : 0), time);
      oscillator.detune.value = (index - 1) * 4;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900 + profile.level * 55 + profile.intensity * 850, time);
      filter.Q.value = 0.8;
      const peak = index === 0 ? 0.14 : 0.075;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + 0.32);
      gain.gain.setValueAtTime(peak, time + Math.max(0.34, duration - 0.5));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.buses.pad);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.05);
      this.#cleanupScheduled(oscillator, filter, gain);
    }
  }

  #scheduleBass(profile, degree, time, duration, variation = 0) {
    const context = this.audio.context;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = profile.bassType;
    const frequency = frequencyFromScale(profile.root, profile.mode, degree + variation, -1);
    oscillator.frequency.setValueAtTime(frequency, time);
    if (profile.bossMode) oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, time + duration);
    filter.type = 'lowpass';
    filter.frequency.value = 320 + profile.intensity * 260;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.16 + profile.intensity * 0.05, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.buses.bass);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    this.#cleanupScheduled(oscillator, filter, gain);
  }

  #scheduleLead(profile, degree, time, duration) {
    const context = this.audio.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.leadType;
    const octave = profile.level % 3 === 0 ? 2 : 1;
    const frequency = frequencyFromScale(profile.root, profile.mode, degree, octave);
    oscillator.frequency.setValueAtTime(frequency, time);
    if (profile.intensity > 0.62) oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.012, time + Math.min(0.09, duration * 0.45));
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.09 + profile.intensity * 0.035, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.buses.lead);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    this.#cleanupScheduled(oscillator, gain);
  }

  #schedulePercussion(profile, barStep, time, stepDuration) {
    const density = profile.percussionDensity;
    if (barStep === 0 || barStep === 8 || (profile.bossMode && (barStep === 6 || barStep === 14))) this.#scheduleKick(profile, time);
    if (barStep === 4 || barStep === 12) this.#scheduleSnare(profile, time);
    const hatEvery = density > 0.72 ? 1 : density > 0.45 ? 2 : 4;
    if (barStep % hatEvery === 0) this.#scheduleHat(profile, time, barStep % 4 === 2 ? 0.65 : 0.42, stepDuration);
  }

  #scheduleKick(profile, time) {
    const context = this.audio.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120 + profile.intensity * 22, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);
    gain.gain.setValueAtTime(0.22 + profile.intensity * 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    oscillator.connect(gain);
    gain.connect(this.buses.percussion);
    oscillator.start(time);
    oscillator.stop(time + 0.21);
    this.#cleanupScheduled(oscillator, gain);
  }

  #scheduleSnare(profile, time) {
    const context = this.audio.context;
    if (!this.noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1500 + profile.level * 55;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.12 + profile.intensity * 0.055, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.buses.percussion);
    source.start(time);
    source.stop(time + 0.15);
    this.#cleanupScheduled(source, filter, gain);
  }

  #scheduleHat(profile, time, strength, stepDuration) {
    const context = this.audio.context;
    if (!this.noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 5200 + profile.shimmer * 2200;
    gain.gain.setValueAtTime(0.035 * strength, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.07, stepDuration * 0.75));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.buses.percussion);
    source.start(time);
    source.stop(time + 0.08);
    this.#cleanupScheduled(source, filter, gain);
  }

  #scheduleShimmer(profile, degree, time, duration) {
    const context = this.audio.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencyFromScale(profile.root, profile.mode, degree, 2), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.055 * profile.shimmer, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.buses.shimmer);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    this.#cleanupScheduled(oscillator, gain);
  }

  #scheduleBossStab(profile, degree, time, duration) {
    const context = this.audio.context;
    for (const detune of [-9, 9]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequencyFromScale(profile.root, profile.mode, degree, 0), time);
      oscillator.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.045 * profile.intensity, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain);
      gain.connect(this.buses.lead);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
      this.#cleanupScheduled(oscillator, gain);
    }
  }

  #createNoiseBuffer(context) {
    const length = Math.max(1, Math.floor(context.sampleRate * 0.35));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.35 + white * 0.65;
      data[index] = last;
    }
    return buffer;
  }

  #cleanupScheduled(...nodes) {
    const source = nodes[0];
    source.addEventListener?.('ended', () => {
      for (const node of nodes) {
        try { node.disconnect?.(); } catch {}
      }
    }, { once: true });
  }

  #fadeOutCurrent(duration = 0.2) {
    this.offUnlock?.();
    this.offUnlock = null;
    this.pending = null;
    if (this.scheduler !== null) globalThis.clearInterval(this.scheduler);
    this.scheduler = null;
    const context = this.audio.context;
    const oldNodes = this.nodes;
    const oldGain = this.scoreGain;
    this.nodes = [];
    this.scoreGain = null;
    this.buses = null;
    this.current = null;
    this.noiseBuffer = null;
    if (!oldNodes.length) return;
    if (context && oldGain?.gain) {
      const now = context.currentTime;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value || 0.0001), now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    }
    globalThis.setTimeout(() => {
      for (const node of oldNodes) {
        try { node.stop?.(); } catch {}
        try { node.disconnect?.(); } catch {}
      }
    }, Math.ceil(duration * 1000) + 40);
  }

  stop() {
    this.offUnlock?.();
    this.offUnlock = null;
    this.pending = null;
    if (this.scheduler !== null) globalThis.clearInterval(this.scheduler);
    this.scheduler = null;
    for (const node of this.nodes) {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    }
    this.nodes = [];
    this.scoreGain = null;
    this.buses = null;
    this.current = null;
    this.noiseBuffer = null;
  }

  destroy() { this.stop(); }
}
