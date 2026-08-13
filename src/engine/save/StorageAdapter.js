import { safeJsonParse } from '../../shared/utils.js';

export class StorageAdapter {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.available = this.#test(); }
  #test() {
    if (!this.storage) return false;
    try { const key = '__deedz_storage_test__'; this.storage.setItem(key, '1'); this.storage.removeItem(key); return true; }
    catch { return false; }
  }
  get(key, fallback = null) { if (!this.available) return fallback; try { const raw = this.storage.getItem(key); return raw === null ? fallback : safeJsonParse(raw, fallback); } catch { return fallback; } }
  set(key, value) { if (!this.available) return false; try { this.storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  remove(key) { if (!this.available) return false; try { this.storage.removeItem(key); return true; } catch { return false; } }
}
