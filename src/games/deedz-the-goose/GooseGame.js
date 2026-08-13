import { GameApp } from '../../engine/GameApp.js';
import { AssetManifest } from '../../engine/assets/AssetManifest.js';
import { GooseConfig } from './GooseConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { cloneDefaultInputBindings } from '../../engine/input/InputMap.js';

export class GooseGame extends GameApp {
  createConfig() { return GooseConfig; }
  assetManifest() { return new AssetManifest().addBundle('goose-core', []); }
  defaultSaveData() {
    return {
      profile: { name: 'Deedz', character: 'deedz', cosmetics: ['cap', 'chain'] },
      settings: { master: 0.75, music: true, musicVolume: 0.55, adaptiveMusic: true, touchControls: 'auto', sfx: true, sfxVolume: 0.8, voice: false, screenShake: true, controls: cloneDefaultInputBindings() },
      progress: { chapter: 1, crumbs: 0, crumbAmmo: 12, enemies: 0, collectibles: 0, bestTime: null, checkpoint: null, evolution: { level: 1, xp: 0, cycle: 0, seed: 1337, bossWins: 0 } },
      achievements: [],
    };
  }
  networkProfile(engine) {
    const profile = engine.save.get('profile', {});
    return { name: String(profile.name || 'Anonymous Goose').slice(0, 24), character: profile.character || 'deedz' };
  }
  async registerScenes(engine) {
    engine.scenes.register('boot', () => new BootScene());
    engine.scenes.register('main-menu', () => new MainMenuScene());
    engine.scenes.register('world', () => new WorldScene());
    engine.scenes.register('pause', () => new PauseScene());
    engine.scenes.register('results', () => new ResultsScene());
  }
  async initialize(engine) {
    engine.events.on('network:open', () => engine.ui.toast('Connected to Goose Lobby.', { type: 'success' }));
    engine.events.on('network:close', () => engine.ui.toast('Offline mode active.', { type: 'warning' }));
    engine.events.on('save:error', () => engine.ui.toast('Local storage is unavailable. Progress will last for this session only.', { type: 'warning', duration: 5000 }));
    engine.events.on('engine:error', ({ error, fatal }) => {
      if (!fatal) engine.ui?.toast(`Engine warning: ${error?.message ?? 'Unknown error'}`, { type: 'danger' });
    });
    const settings = engine.save.get('settings', {});
    engine.input.setBindings(settings.controls ?? cloneDefaultInputBindings());
    engine.audio.setVolumes({ master: settings.master ?? 0.75, music: settings.music === false ? 0 : (settings.musicVolume ?? 0.55), sfx: settings.sfx === false ? 0 : (settings.sfxVolume ?? 0.8) });
  }
}
