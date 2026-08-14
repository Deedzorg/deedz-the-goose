import { GameApp } from '../../engine/GameApp.js';
import { AssetManifest } from '../../engine/assets/AssetManifest.js';
import { GooseConfig } from './GooseConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { cloneDefaultInputBindings } from '../../engine/input/InputMap.js';
import { GooseClassSystem } from './systems/GooseClassSystem.js';
import { AdventureProgressionSystem } from './systems/AdventureProgressionSystem.js';
import { GameplayInputSystem } from './systems/GameplayInputSystem.js';
import { BossGuidanceSystem } from './systems/BossGuidanceSystem.js';
import { gooseUnlockProgressFromSave, isGooseClassUnlocked, networkCharacterId } from './data/characters.js';
import { GooseUnlockSystem } from './systems/GooseUnlockSystem.js';
import { GooseTestLab } from './ui/GooseTestLab.js';

export class GooseGame extends GameApp {
  createConfig() { return GooseConfig; }
  assetManifest() { return new AssetManifest().addBundle('goose-core', []); }
  defaultSaveData() {
    return {
      profile: { name: 'Deedz', character: 'classic', color: 'snow', cosmetics: ['cap', 'chain'] },
      settings: { master: 0.75, music: true, musicVolume: 0.55, adaptiveMusic: true, touchControls: 'auto', sfx: true, sfxVolume: 0.8, voice: false, screenShake: true, controls: cloneDefaultInputBindings() },
      progress: {
        chapter: 1,
        crumbs: 0,
        crumbAmmo: 12,
        enemies: 0,
        collectibles: 0,
        bestTime: null,
        checkpoint: null,
        activatedCrystals: [],
        debugUnlockAllGeese: false,
        records: { bestScore: 0, highestLayer: 1, mostCrumbs: 0, mostFoxes: 0 },
        evolution: { level: 1, xp: 0, cycle: 0, seed: 1337, bossWins: 0 },
      },
      achievements: [],
    };
  }
  networkProfile(engine) {
    const profile = engine.save.get('profile', {});
    const unlockProgress = gooseUnlockProgressFromSave(engine.save);
    const character = isGooseClassUnlocked(profile.character || 'classic', unlockProgress)
      ? profile.character || 'classic'
      : 'classic';
    return { name: String(profile.name || 'Anonymous Goose').slice(0, 24), character: networkCharacterId(character, profile.color || 'snow') };
  }
  async registerScenes(engine) {
    engine.scenes.register('boot', () => new BootScene());
    engine.scenes.register('main-menu', () => new MainMenuScene());
    engine.scenes.register('world', () => new WorldScene());
    engine.scenes.register('pause', () => new PauseScene());
    engine.scenes.register('results', () => new ResultsScene());
  }
  async initialize(engine) {
    this.gooseClasses = new GooseClassSystem(engine);
    this.adventureProgression = new AdventureProgressionSystem(engine);
    this.gameplayInput = new GameplayInputSystem(engine);
    this.bossGuidance = new BossGuidanceSystem(engine);
    this.gooseUnlocks = new GooseUnlockSystem(engine);
    this.testLab = new GooseTestLab(engine);
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
  async shutdown() {
    this.testLab?.destroy();
    this.gooseUnlocks?.destroy();
    this.bossGuidance?.destroy();
    this.gameplayInput?.destroy();
    this.adventureProgression?.destroy();
    this.gooseClasses?.destroy();
  }
}
