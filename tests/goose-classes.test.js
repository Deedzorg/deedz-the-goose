import test from 'node:test';
import assert from 'node:assert/strict';
import { gooseClasses, gooseColors, networkCharacterId, resolveCharacter, setActiveGooseColor } from '../src/games/deedz-the-goose/data/characters.js';

const lowerIsBuff = new Set(['dashCooldown', 'honkCooldown']);

function direction(key, value) {
  const baseline = key === 'health' ? 6 : 1;
  if (value === baseline) return 0;
  if (key === 'health') return value > baseline ? 1 : -1;
  if (lowerIsBuff.has(key)) return value < baseline ? 1 : -1;
  return value > baseline ? 1 : -1;
}

test('specialist goose classes have both a buff and a debuff', () => {
  assert.equal(gooseClasses.length, 7);
  assert.deepEqual(gooseClasses[0].ratings, { health: 3, speed: 3, honk: 3, throw: 3, flight: 3 });
  for (const gooseClass of gooseClasses.slice(1)) {
    const directions = Object.entries(gooseClass.stats).map(([key, value]) => direction(key, value));
    assert.ok(directions.includes(1), `${gooseClass.name} needs a buff`);
    assert.ok(directions.includes(-1), `${gooseClass.name} needs a debuff`);
    assert.ok(gooseClass.stats.health >= 5 && gooseClass.stats.health <= 8);
    assert.ok(gooseClass.stats.speed >= 0.88 && gooseClass.stats.speed <= 1.15);
    assert.ok(gooseClass.stats.honkRange >= 0.88 && gooseClass.stats.honkRange <= 1.3);
    assert.ok(gooseClass.stats.throwStrength >= 0.9 && gooseClass.stats.throwStrength <= 1.25);
    assert.ok(gooseClass.stats.flightDuration >= 0.85 && gooseClass.stats.flightDuration <= 1.7);
  }
});

test('class and plumage are independent and network-safe', () => {
  assert.equal(gooseColors.length, 8);
  setActiveGooseColor('violet');
  assert.equal(gooseClasses[0].color, gooseColors.find((color) => color.id === 'violet').color);
  const id = networkCharacterId('guardian', 'rose');
  assert.equal(id, 'guardian--rose');
  const remote = resolveCharacter('guardian', 'rose');
  assert.equal(remote.stats.health, 8);
  assert.equal(remote.plumageId, 'rose');
});
