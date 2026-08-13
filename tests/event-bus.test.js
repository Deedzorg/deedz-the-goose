import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';

test('EventBus respects priority, once, and abort signals', () => {
  const bus = new EventBus();
  const calls = [];
  const controller = new AbortController();
  bus.on('goose', () => calls.push('low'), { priority: 1 });
  bus.once('goose', () => calls.push('once'), { priority: 5 });
  bus.on('goose', () => calls.push('aborted'), { signal: controller.signal });
  controller.abort();
  assert.equal(bus.emit('goose'), 2);
  assert.deepEqual(calls, ['once', 'low']);
  bus.emit('goose');
  assert.deepEqual(calls, ['once', 'low', 'low']);
});
