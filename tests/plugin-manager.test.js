import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';
import { EnginePlugin } from '../src/engine/plugins/EnginePlugin.js';
import { PluginManager } from '../src/engine/plugins/PluginManager.js';

class TestPlugin extends EnginePlugin {
  constructor(id, dependencies, log) { super({ id, dependencies }); this.log = log; }
  async install() { this.log.push(`install:${this.id}`); }
  async start() { this.log.push(`start:${this.id}`); }
  async stop() { this.log.push(`stop:${this.id}`); }
  async uninstall() { this.log.push(`uninstall:${this.id}`); }
}

test('PluginManager resolves dependencies and shuts down in reverse order', async () => {
  const log = [];
  const manager = new PluginManager(new EventBus());
  manager.register(new TestPlugin('gameplay', ['core'], log));
  manager.register(new TestPlugin('core', [], log));
  await manager.installAll({});
  await manager.startAll({});
  await manager.destroy({});
  assert.deepEqual(log, [
    'install:core', 'install:gameplay', 'start:core', 'start:gameplay',
    'stop:gameplay', 'uninstall:gameplay', 'stop:core', 'uninstall:core',
  ]);
});
