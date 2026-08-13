export class EnginePlugin {
  constructor({ id, version = '1.0.0', dependencies = [] } = {}) {
    if (!id) throw new Error('EnginePlugin requires an id');
    this.id = id;
    this.version = version;
    this.dependencies = [...dependencies];
    this.enabled = true;
    this.installed = false;
    this.started = false;
  }
  async install(_engine) { this.installed = true; }
  async start(_engine) { this.started = true; }
  fixedUpdate(_dt, _engine) {}
  update(_dt, _engine) {}
  async stop(_engine) { this.started = false; }
  async uninstall(_engine) { this.installed = false; }
}
