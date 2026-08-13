import { debounce, deepMerge, deletePath, getPath, setPath } from '../../shared/utils.js';
import { STORAGE_PREFIX } from '../../shared/constants.js';
import { StorageAdapter } from './StorageAdapter.js';

export class SaveManager {
  constructor(config, events, adapter = new StorageAdapter()) {
    this.config = config;
    this.events = events;
    this.adapter = adapter;
    this.key = `${STORAGE_PREFIX}:${config.namespace}`;
    this.defaults = {};
    this.data = {};
    this.persistDebounced = debounce(() => this.persist(), config.debounceMs);
  }

  initialize(defaults = {}) {
    this.defaults = structuredClone(defaults);
    const stored = this.adapter.get(this.key, null);
    let data = stored?.data ?? {};
    const fromVersion = Number(stored?.version ?? data.__version ?? 0);
    try { data = this.#migrate(data, fromVersion); }
    catch (error) { this.events.emit('save:migrationError', { error, fromVersion }); data = {}; }
    this.data = deepMerge(this.defaults, data);
    this.data.__version = this.config.version;
    this.events.emit('save:loaded', { data: this.snapshot(), storageAvailable: this.adapter.available, fromVersion });
    return this.data;
  }

  #migrate(data, fromVersion) {
    let current = structuredClone(data);
    const migrations = this.config.migrations ?? [];
    for (let version = fromVersion + 1; version <= this.config.version; version += 1) {
      const migration = Array.isArray(migrations) ? migrations[version - 1] : migrations[version];
      if (typeof migration === 'function') current = migration(current) ?? current;
    }
    return current;
  }

  snapshot() { return structuredClone(this.data); }
  get(path, fallback = undefined) { return getPath(this.data, path, fallback); }

  set(path, value, { immediate = false } = {}) {
    setPath(this.data, path, value);
    this.events.emit('save:changed', { path, value, data: this.data });
    immediate ? this.persist() : this.persistDebounced();
    return value;
  }

  delete(path, { immediate = false } = {}) {
    const removed = deletePath(this.data, path);
    if (removed) {
      this.events.emit('save:changed', { path, deleted: true, data: this.data });
      immediate ? this.persist() : this.persistDebounced();
    }
    return removed;
  }

  patch(values, { immediate = false } = {}) {
    this.data = deepMerge(this.data, values);
    this.events.emit('save:changed', { patch: values, data: this.data });
    immediate ? this.persist() : this.persistDebounced();
    return this.data;
  }

  update(mutator, { immediate = false } = {}) {
    const draft = this.snapshot();
    const result = mutator(draft) ?? draft;
    this.data = result;
    this.data.__version = this.config.version;
    this.events.emit('save:changed', { data: this.data });
    immediate ? this.persist() : this.persistDebounced();
    return this.data;
  }

  persist() {
    this.persistDebounced.cancel();
    const record = { version: this.config.version, savedAt: Date.now(), data: this.data };
    const ok = this.adapter.set(this.key, record);
    this.events.emit(ok ? 'save:persisted' : 'save:error', ok ? { record } : { reason: 'storage-unavailable' });
    return ok;
  }

  exportSave() { return JSON.stringify({ version: this.config.version, exportedAt: new Date().toISOString(), data: this.data }, null, 2); }
  ['export']() { return this.exportSave(); }

  importSave(serialized, { immediate = true } = {}) {
    const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    if (!parsed || typeof parsed.data !== 'object') throw new Error('Invalid save payload');
    this.data = deepMerge(this.defaults, this.#migrate(parsed.data, Number(parsed.version) || 0));
    this.data.__version = this.config.version;
    this.events.emit('save:imported', { data: this.snapshot() });
    if (immediate) this.persist();
    return this.data;
  }

  ['import'](serialized, options = {}) { return this.importSave(serialized, options); }

  reset() { this.data = structuredClone(this.defaults); this.data.__version = this.config.version; this.persist(); this.events.emit('save:reset', { data: this.snapshot() }); }
  destroy() {
    if (this.persistDebounced.pending()) this.persistDebounced.flush();
    else this.persist();
  }
}
