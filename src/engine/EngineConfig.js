import { deepMerge } from '../shared/utils.js';
import { DEFAULT_FIXED_STEP, ENGINE_VERSION } from '../shared/constants.js';

const defaults = Object.freeze({
  engine: { name: 'Deedz Engine', version: ENGINE_VERSION, debug: false },
  game: { id: 'deedz-game', title: 'Deedz Game', version: '0.1.0' },
  renderer: {
    root: '#game-root',
    background: '#07111f',
    antialias: true,
    autoDensity: true,
    maxResolution: 2,
    preference: 'webgl',
    roundPixels: false,
    allowCanvasFallback: true,
  },
  loop: {
    fixedStep: DEFAULT_FIXED_STEP,
    maxDelta: 0.1,
    maxSubSteps: 6,
    pauseWhenHidden: true,
  },
  physics: { gravityX: 0, gravityY: 1800, cellSize: 128 },
  input: {
    preventDefault: ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'],
    pressBufferMs: 140,
    gamepadDeadZone: 0.18,
  },
  audio: { master: 0.75, music: 0.55, sfx: 0.8, muted: false },
  save: { namespace: 'deedz-game', version: 1, debounceMs: 150, migrations: [] },
  network: {
    enabled: true,
    url: null,
    reconnect: true,
    room: 'goose-lobby',
    pingIntervalMs: 3000,
    stateIntervalMs: 50,
    queueLimit: 128,
  },
  debug: {
    enabled: false,
    visible: false,
    toggleAction: 'debug',
    refreshMs: 200,
    drawColliders: true,
  },
});

export class EngineConfig {
  constructor(overrides = {}) {
    const merged = deepMerge(defaults, overrides);
    if (merged.engine.debug && overrides.debug?.enabled === undefined) merged.debug.enabled = true;
    Object.assign(this, merged);
  }

  static create(overrides = {}) { return new EngineConfig(overrides); }
}
