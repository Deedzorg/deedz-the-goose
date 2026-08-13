import { cloneDefaultInputBindings } from '../../engine/input/InputMap.js';

export const GooseConfig = Object.freeze({
  engine: { debug: import.meta.env.DEV },
  game: { id: 'deedz-the-goose', title: 'Deedz The Goose', version: '1.6.1' },
  renderer: { background: '#0a1e36' },
  physics: { gravityY: 1900, cellSize: 160 },
  save: {
    namespace: 'deedz-the-goose-v1',
    version: 6,
    migrations: {
      2: (data) => ({
        ...data,
        settings: { master: 0.75, music: true, sfx: true, voice: false, screenShake: true, ...(data.settings ?? {}) },
        progress: { chapter: 1, crumbs: 0, enemies: 0, bestTime: null, checkpoint: null, ...(data.progress ?? {}) },
      }),
      3: (data) => ({
        ...data,
        progress: {
          chapter: 1,
          crumbs: 0,
          enemies: 0,
          bestTime: null,
          checkpoint: null,
          ...(data.progress ?? {}),
          evolution: { level: 1, xp: 0, cycle: 0, seed: 1337, bossWins: 0, ...(data.progress?.evolution ?? {}) },
        },
      }),
      4: (data) => ({
        ...data,
        settings: {
          master: 0.75,
          music: true,
          sfx: true,
          voice: false,
          screenShake: true,
          ...(data.settings ?? {}),
          controls: { ...cloneDefaultInputBindings(), ...(data.settings?.controls ?? {}) },
        },
        progress: {
          chapter: 1,
          crumbs: 0,
          crumbAmmo: 12,
          enemies: 0,
          collectibles: 0,
          bestTime: null,
          checkpoint: null,
          ...(data.progress ?? {}),
        },
      }),

      5: (data) => ({
        ...data,
        settings: {
          master: 0.75,
          music: true,
          musicVolume: 0.55,
          adaptiveMusic: true,
          sfx: true,
          sfxVolume: 0.8,
          voice: false,
          screenShake: true,
          ...(data.settings ?? {}),
          controls: { ...cloneDefaultInputBindings(), ...(data.settings?.controls ?? {}) },
        },
      }),

      6: (data) => ({
        ...data,
        settings: {
          master: 0.75,
          music: true,
          musicVolume: 0.55,
          adaptiveMusic: true,
          touchControls: 'auto',
          sfx: true,
          sfxVolume: 0.8,
          voice: false,
          screenShake: true,
          ...(data.settings ?? {}),
          controls: { ...cloneDefaultInputBindings(), ...(data.settings?.controls ?? {}) },
        },
      }),
    },
  },
  network: { room: 'goose-lobby', stateIntervalMs: 50, pingIntervalMs: 3000 },
  debug: { enabled: import.meta.env.DEV, visible: false, drawColliders: true },
});
