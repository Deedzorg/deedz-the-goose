import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lockPlayerForSpawn, screenOwnsControllerNavigation } from '../src/games/deedz-the-goose/systems/GameplayPolishSystem.js';

test('pause and main menu own controller navigation without the generic UI navigator', () => {
  assert.equal(screenOwnsControllerNavigation('pause-ui'), true);
  assert.equal(screenOwnsControllerNavigation('main-menu-ui'), true);
  assert.equal(screenOwnsControllerNavigation('results-ui'), false);
});

test('spawn lock suppresses entity gravity before the scene spawn guard runs', () => {
  let originalCalls = 0;
  const body = { gravityScale: 1 };
  const engine = { physics: { getBody: () => body } };
  const player = {
    x: 260,
    y: 899,
    velocity: { x: 90, y: 400 },
    previousPosition: { x: 0, y: 0 },
    fixedUpdate() { originalCalls += 1; },
  };

  lockPlayerForSpawn(player, engine, 2);
  player.fixedUpdate(1 / 60, engine);
  assert.deepEqual(player.velocity, { x: 0, y: 0 });
  assert.equal(body.gravityScale, 0);
  assert.deepEqual(player.previousPosition, { x: 260, y: 899 });
  assert.equal(originalCalls, 0);

  player.velocity.y = 300;
  body.gravityScale = 1;
  player.fixedUpdate(1 / 60, engine);
  assert.equal(player.velocity.y, 0);
  assert.equal(body.gravityScale, 0);
  assert.equal(originalCalls, 0);

  player.fixedUpdate(1 / 60, engine);
  assert.equal(originalCalls, 1, 'normal player simulation should resume after the lock');
});

test('desktop mouse and compact touch HUD route crumb throwing through the shared throw action', async () => {
  const polish = await readFile(new URL('../src/games/deedz-the-goose/systems/GameplayPolishSystem.js', import.meta.url), 'utf8');
  const touch = await readFile(new URL('../src/games/deedz-the-goose/ui/TouchControls.js', import.meta.url), 'utf8');
  assert.match(polish, /pointerType !== 'mouse'/);
  assert.match(polish, /setVirtualAction\('throw', 1\)/);
  assert.match(polish, /releaseVirtualAction\('throw'\)/);
  assert.match(touch, /\['throw', 'CRUMB'\]/);
  assert.doesNotMatch(touch, /\['sense', 'SENSE'\]/);
  assert.doesNotMatch(touch, /\['interact', 'BUMP'\]/);
  assert.match(touch, /data-action="pause"/);
});

test('completed Echo objectives auto-build Boss Charge instead of requiring an invisible grind', async () => {
  const source = await readFile(new URL('../src/games/deedz-the-goose/systems/GameplayPolishSystem.js', import.meta.url), 'utf8');
  assert.match(source, /Boss Charge/);
  assert.match(source, /contributeFlockEnergy\(Math\.min\(30, missing\)/);
  assert.match(source, /Echo objective complete/);
  assert.match(source, /Baron Breadstorm/);
});
