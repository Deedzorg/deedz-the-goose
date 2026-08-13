import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';
import { SceneManager } from '../src/engine/scenes/SceneManager.js';

class FakeScene {
  constructor(id, log, { failEnter = false } = {}) {
    this.id = id;
    this.log = log;
    this.failEnter = failEnter;
    this.loaded = false;
    this.active = false;
    this.root = { removeFromParent() {} };
  }
  async load() { this.loaded = true; this.log.push(`load:${this.id}`); }
  async enter() { this.log.push(`enter:${this.id}`); if (this.failEnter) throw new Error('enter failed'); this.active = true; }
  pause() { this.log.push(`pause:${this.id}`); this.active = false; }
  resume() { this.log.push(`resume:${this.id}`); this.active = true; }
  async exit() { this.log.push(`exit:${this.id}`); this.active = false; }
  async unload() { this.log.push(`unload:${this.id}`); this.loaded = false; }
  destroy() { this.log.push(`destroy:${this.id}`); }
  fixedUpdate() {}
  update() {}
  render() {}
}

function createManager(log) {
  const layer = { addChild() {} };
  const engine = { renderer: { layers: { get: () => layer } } };
  return new SceneManager(engine, new EventBus());
}

test('SceneManager serializes rapid transitions instead of dropping them', async () => {
  const log = [];
  const manager = createManager(log);
  manager.register('a', () => new FakeScene('a', log));
  manager.register('b', () => new FakeScene('b', log));
  const first = manager.change('a');
  const second = manager.change('b');
  await Promise.all([first, second]);
  assert.equal(manager.active.id, 'b');
  assert.deepEqual(log, ['load:a', 'enter:a', 'exit:a', 'unload:a', 'destroy:a', 'load:b', 'enter:b']);
  await manager.destroy();
});

test('SceneManager restores the previous scene when a pushed scene fails', async () => {
  const log = [];
  const manager = createManager(log);
  manager.register('base', () => new FakeScene('base', log));
  manager.register('bad', () => new FakeScene('bad', log, { failEnter: true }));
  await manager.change('base');
  await assert.rejects(manager.push('bad'), /enter failed/);
  assert.equal(manager.active.id, 'base');
  assert.equal(manager.active.active, true);
  assert.ok(log.includes('resume:base'));
  assert.ok(log.includes('destroy:bad'));
  await manager.destroy();
});
