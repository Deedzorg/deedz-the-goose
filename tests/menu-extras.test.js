import test from 'node:test';
import assert from 'node:assert/strict';
import { randomGooseName, topGoose } from '../src/games/deedz-the-goose/data/menuExtras.js';

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test('random goose names are playful, repeatable for tests, and profile-safe', () => {
  assert.equal(randomGooseName(sequenceRandom([0, 0])), 'Silly Waddles');
  const last = randomGooseName(sequenceRandom([0.999, 0.999]));
  assert.equal(last, 'Zippy Honk');
  assert.ok(last.length <= 24);
  assert.match(last, /^[A-Za-z]+ [A-Za-z]+$/);
});

test('Top Goose compares persistent local glory with live room scores', () => {
  const local = topGoose({
    localName: 'Captain Crumb',
    progress: { crumbs: 100, evolution: { level: 1, xp: 0 }, records: { bestScore: 450 } },
    peers: [{ profile: { name: 'Webby' }, state: { score: 400, evolutionLevel: 3 } }],
  });
  assert.equal(local.name, 'Captain Crumb');
  assert.equal(local.local, true);

  const visitor = topGoose({
    localName: 'Captain Crumb',
    progress: { records: { bestScore: 450 }, evolution: { level: 1 } },
    peers: [{ profile: { name: 'Queen Honk' }, state: { score: 900, evolutionLevel: 4 } }],
  });
  assert.equal(visitor.name, 'Queen Honk');
  assert.equal(visitor.score, 900);
});
