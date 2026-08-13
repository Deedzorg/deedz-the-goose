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
  assert.equal(gooseClasses.length, 8);
  assert.deepEqual(gooseClasses[0].ratings, { health: 3, speed: 3, honk: 3, throw: 3, flight: 3 });
  assert.equal(Object.values(gooseClasses[0].ratings).reduce((sum, value) => sum + value, 0), 15);
  for (const gooseClass of gooseClasses.slice(1)) {
    const directions = Object.entries(gooseClass.stats).map(([key, value]) => direction(key, value));
    assert.equal(Object.values(gooseClass.ratings).reduce((sum, value) => sum + value, 0), 15, `${gooseClass.name} must use the same visible power budget`);
    assert.ok(directions.includes(1), `${gooseClass.name} needs a buff`);
    assert.ok(directions.includes(-1), `${gooseClass.name} needs a debuff`);
    assert.ok(gooseClass.stats.health >= 5 && gooseClass.stats.health <= 8);
    assert.ok(gooseClass.stats.speed >= 0.88 && gooseClass.stats.speed <= 1.15);
    assert.ok(gooseClass.stats.honkRange >= 0.88 && gooseClass.stats.honkRange <= 1.25);
    assert.ok(gooseClass.stats.throwStrength >= 0.9 && gooseClass.stats.throwStrength <= 1.2);
    assert.ok(gooseClass.stats.flightDuration >= 0.85 && gooseClass.stats.flightDuration <= 1.55);
  }
});

test('class and goose color are independent and network-safe', () => {
  assert.equal(gooseColors.length, 8);
  setActiveGooseColor('violet');
  assert.equal(gooseClasses[0].color, gooseColors.find((color) => color.id === 'violet').color);
  const id = networkCharacterId('guardian', 'rose');
  assert.equal(id, 'guardian--rose');
  const remote = resolveCharacter('guardian', 'rose');
  assert.equal(remote.stats.health, 8);
  assert.equal(remote.plumageId, 'rose');
});

test('class systems apply advertised modifiers including Ember Fire Feather', async () => {
  const { EventBus } = await import('../src/engine/events/EventBus.js');
  const { GooseClassSystem } = await import('../src/games/deedz-the-goose/systems/GooseClassSystem.js');
  const events = new EventBus();
  const engine = { events, save: { get: (_path, fallback) => fallback } };
  const system = new GooseClassSystem(engine);

  const echo = gooseClasses.find((item) => item.id === 'echo');
  const player = {
    character: echo, hp: 6, maxHp: 6, speed: 380, acceleration: 2500, airAcceleration: 1550, jumpSpeed: 720,
    honkCooldown: 0.82, dashCooldown: 0.62, flightTime: 0.48, velocity: { x: 840 },
    hasTag(tag) { return tag === 'player'; },
  };
  events.emit('entity:added', { entity: player });
  assert.equal(player.maxHp, 5);
  const honk = { player, range: 230, strength: 620 };
  events.emit('goose:honk', honk);
  assert.equal(honk.range, Math.round(230 * 1.25));
  assert.equal(honk.strength, Math.round(620 * 1.08));
  assert.ok(player.honkCooldown < 0.82);

  const ranger = gooseClasses.find((item) => item.id === 'ranger');
  const throwPayload = { player: { character: ranger }, strength: 1000, lift: 200, duration: 2 };
  events.emit('goose:throw', throwPayload);
  assert.equal(throwPayload.strength, 1200);
  assert.equal(throwPayload.lift, 220);
  assert.equal(throwPayload.duration, 2.3);

  const ember = gooseClasses.find((item) => item.id === 'firebrand');
  assert.equal(ember.name, 'Ember Goose');
  assert.equal(ember.projectileStyle, 'ember-bolt');
  const fire = { player: { character: ember }, strength: 700, lift: 180, duration: 1.6, charge: 0.5 };
  events.emit('goose:throw', fire);
  assert.equal(fire.projectileStyle, 'ember-bolt');
  assert.ok(fire.strength >= 900);
  assert.ok(fire.lift <= 30, 'Fire Feather should fly nearly straight');
  assert.ok(fire.duration <= 1.4, 'Fire Feather trades lob duration for direct speed');

  const skywing = gooseClasses.find((item) => item.id === 'skywing');
  const flying = { character: skywing, flightTime: 0.48 };
  events.emit('player:jump', { player: flying, flying: true });
  assert.equal(flying.flightTime, 0.48 * 1.55);
  system.destroy();
});
