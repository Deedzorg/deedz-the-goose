export class PluginManager {
  constructor(events) { this.events = events; this.plugins = new Map(); this.order = []; this.engine = null; }

  register(plugin) {
    if (!plugin?.id) throw new Error('Invalid plugin');
    if (this.plugins.has(plugin.id)) throw new Error(`Plugin already registered: ${plugin.id}`);
    this.plugins.set(plugin.id, plugin);
    this.events.emit('plugin:registered', { plugin });
    return plugin;
  }

  get(id) { return this.plugins.get(id); }
  has(id) { return this.plugins.has(id); }

  #resolveOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];
    const visit = (plugin) => {
      if (visited.has(plugin.id)) return;
      if (visiting.has(plugin.id)) throw new Error(`Circular plugin dependency involving ${plugin.id}`);
      visiting.add(plugin.id);
      for (const id of plugin.dependencies) {
        const dependency = this.plugins.get(id);
        if (!dependency) throw new Error(`Plugin ${plugin.id} requires ${id}`);
        visit(dependency);
      }
      visiting.delete(plugin.id);
      visited.add(plugin.id);
      order.push(plugin);
    };
    for (const plugin of this.plugins.values()) visit(plugin);
    this.order = order;
  }

  async installAll(engine) {
    this.engine = engine;
    this.#resolveOrder();
    const installed = [];
    try {
      for (const plugin of this.order) {
        await plugin.install(engine);
        plugin.installed = true;
        installed.push(plugin);
        this.events.emit('plugin:installed', { plugin });
      }
    } catch (error) {
      for (const plugin of installed.reverse()) await plugin.uninstall(engine).catch(() => {});
      throw error;
    }
  }

  async startAll(engine) {
    const started = [];
    try {
      for (const plugin of this.order) {
        if (!plugin.enabled) continue;
        await plugin.start(engine);
        plugin.started = true;
        started.push(plugin);
        this.events.emit('plugin:started', { plugin });
      }
    } catch (error) {
      for (const plugin of started.reverse()) await plugin.stop(engine).catch(() => {});
      throw error;
    }
  }

  async setEnabled(id, enabled) {
    const plugin = this.get(id);
    if (!plugin) throw new Error(`Unknown plugin: ${id}`);
    const next = Boolean(enabled);
    if (plugin.enabled === next) return plugin;
    plugin.enabled = next;
    if (next && plugin.installed && !plugin.started) { await plugin.start(this.engine); plugin.started = true; }
    if (!next && plugin.started) { await plugin.stop(this.engine); plugin.started = false; }
    this.events.emit('plugin:enabledChanged', { plugin, enabled: next });
    return plugin;
  }

  fixedUpdate(dt, engine) { for (const plugin of this.order) if (plugin.enabled && plugin.started) plugin.fixedUpdate(dt, engine); }
  update(dt, engine) { for (const plugin of this.order) if (plugin.enabled && plugin.started) plugin.update(dt, engine); }

  async destroy(engine) {
    for (const plugin of [...this.order].reverse()) {
      if (plugin.started) await plugin.stop(engine).catch((error) => this.events.emit('plugin:error', { plugin, phase: 'stop', error }));
      plugin.started = false;
      if (plugin.installed) await plugin.uninstall(engine).catch((error) => this.events.emit('plugin:error', { plugin, phase: 'uninstall', error }));
      plugin.installed = false;
    }
    this.plugins.clear();
    this.order = [];
    this.engine = null;
  }
}
