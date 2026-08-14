import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WorldScene } from '../src/games/deedz-the-goose/scenes/WorldScene.js';

test('world gate state never shadows the scene cleanup lifecycle', async () => {
  const world = new WorldScene();
  assert.equal(typeof world.exit, 'function');

  const source = await readFile(new URL('../src/games/deedz-the-goose/scenes/WorldScene.js', import.meta.url), 'utf8');
  const adventure = await readFile(new URL('../src/games/deedz-the-goose/systems/AdventureProgressionSystem.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /this\.exit\s*=/);
  assert.match(source, /this\.levelExit\s*=\s*new LevelExit/);
  assert.doesNotMatch(adventure, /world\?*\.exit/);
  assert.match(adventure, /world\.levelExit\.setLocked/);
  world.destroy();
});

test('Escape has a dedicated pause-menu resume path outside remappable input', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/scenes/PauseScene.js', import.meta.url), 'utf8');
  assert.match(source, /event\.code !== 'Escape'/);
  assert.match(source, /window\.addEventListener\('keydown', this\._onEscape/);
  assert.match(source, /window\.removeEventListener\('keydown', this\._onEscape/);
  assert.match(source, /#resumePause\(\)/);
});
