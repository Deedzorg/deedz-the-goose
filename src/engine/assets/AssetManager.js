import { Assets } from 'pixi.js';
import { AssetManifest } from './AssetManifest.js';

export class AssetManager {
  constructor(events) {
    this.events = events;
    this.manifest = new AssetManifest();
    this.loadedBundles = new Set();
    this.loadingBundles = new Map();
  }

  async initialize(manifest = this.manifest) {
    this.manifest = manifest;
    const pixiManifest = manifest.toPixiManifest();
    if (pixiManifest.bundles.length) await Assets.init({ manifest: pixiManifest });
    this.events.emit('assets:initialized', { bundles: [...manifest.entries()].map(([name]) => name) });
  }

  async loadBundle(name) {
    if (this.loadedBundles.has(name)) return Assets.getBundle?.(name);
    if (this.loadingBundles.has(name)) return this.loadingBundles.get(name);
    if (!this.manifest.hasBundle(name)) throw new Error(`Unknown asset bundle: ${name}`);

    const assets = this.manifest.getBundle(name);
    const promise = (async () => {
      try {
        if (!assets.length) {
          this.loadedBundles.add(name);
          this.events.emit('assets:bundleLoaded', { name, empty: true });
          return {};
        }
        const result = await Assets.loadBundle(name, (progress) => this.events.emit('assets:progress', { name, progress }));
        this.loadedBundles.add(name);
        this.events.emit('assets:bundleLoaded', { name, result });
        return result;
      } catch (error) {
        this.events.emit('assets:error', { name, error });
        throw error;
      } finally {
        this.loadingBundles.delete(name);
      }
    })();
    this.loadingBundles.set(name, promise);
    return promise;
  }

  has(alias) { return Assets.cache?.has?.(alias) ?? Assets.get(alias) !== undefined; }
  get(alias) { return Assets.get(alias); }

  async unloadBundle(name) {
    await this.loadingBundles.get(name)?.catch(() => {});
    if (this.loadedBundles.delete(name)) {
      await Assets.unloadBundle(name);
      this.events.emit('assets:bundleUnloaded', { name });
    }
  }

  async destroy() {
    await Promise.allSettled([...this.loadingBundles.values()]);
    for (const name of [...this.loadedBundles]) await this.unloadBundle(name);
    this.loadingBundles.clear();
  }
}
