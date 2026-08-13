import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';
import { SaveManager } from '../src/engine/save/SaveManager.js';
import { StorageAdapter } from '../src/engine/save/StorageAdapter.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

test('SaveManager migrates, persists, imports, and resets data', () => {
  const storage = new MemoryStorage();
  const adapter = new StorageAdapter(storage);
  storage.setItem('deedz-engine:test-save', JSON.stringify({ version: 1, data: { profile: { name: 'Old Goose' }, score: 4 } }));
  const save = new SaveManager({ namespace: 'test-save', version: 2, debounceMs: 1, migrations: { 2: (data) => ({ ...data, migrated: true }) } }, new EventBus(), adapter);
  save.initialize({ profile: { name: 'Deedz', character: 'deedz' }, score: 0 });
  assert.equal(save.get('profile.name'), 'Old Goose');
  assert.equal(save.get('profile.character'), 'deedz');
  assert.equal(save.get('migrated'), true);
  save.set('score', 99, { immediate: true });
  assert.equal(JSON.parse(storage.getItem('deedz-engine:test-save')).data.score, 99);
  const exported = save.export();
  save.set('score', 1, { immediate: true });
  save.import(exported);
  assert.equal(save.get('score'), 99);
  save.reset();
  assert.equal(save.get('score'), 0);
});
