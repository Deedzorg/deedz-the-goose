export class AssetManifest {
  constructor() { this.bundles = new Map(); }
  addBundle(name, assets = []) {
    if (!name) throw new Error('Asset bundle requires a name');
    this.bundles.set(name, assets.map((asset) => ({ ...asset })));
    return this;
  }
  hasBundle(name) { return this.bundles.has(name); }
  getBundle(name) { return this.bundles.get(name) ?? []; }
  entries() { return this.bundles.entries(); }
  toPixiManifest() { return { bundles: [...this.bundles.entries()].map(([name, assets]) => ({ name, assets })) }; }
}
