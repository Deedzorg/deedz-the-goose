export class GameApp {
  createConfig() { return {}; }
  assetManifest() { return undefined; }
  defaultSaveData() { return {}; }
  networkProfile(engine) { return engine.save.get('profile', {}); }
  async registerPlugins(_engine) {}
  async registerScenes(_engine) {}
  async initialize(_engine) {}
  async start(engine) { await engine.scenes.change('boot'); }
  async shutdown(_engine) {}
}
