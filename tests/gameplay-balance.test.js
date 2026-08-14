import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/engine/events/EventBus.js';
import {
  breadstormHeartDamage,
  breadstormPhaseShield,
  breadstormPhaseShieldUnlocked,
  breadstormShieldDamage,
  breadstormShieldUnlocked,
  breadstormStats,
} from '../src/shared/bossBalance.js';
import { BREADSTORM_ENCOUNTER, bossTargetForLevel } from '../src/games/deedz-the-goose/data/progression.js';
import { foxCrumbDropCount, isStompLanding, PECK_PROFILE, WING_WHAP_PROFILE } from '../src/games/deedz-the-goose/data/combat.js';
import { CombatSystem } from '../src/games/deedz-the-goose/systems/CombatSystem.js';
import { ContactDamageSystem } from '../src/games/deedz-the-goose/systems/ContactDamageSystem.js';
import { RemoteGoose } from '../src/games/deedz-the-goose/entities/RemoteGoose.js';

function combatHarness(enemies) {
  const events = new EventBus();
  const worldEvents = [];
  const effects = [];
  const engine = {
    events,
    entities: {
      findByTag(tag) { return tag === 'enemy' ? enemies : []; },
      add(effect) { effects.push(effect); },
      get() { return null; },
      remove() {},
    },
    network: {
      clientId: 'local',
      sendWorldEvent(event, payload) { worldEvents.push({ event, payload }); },
    },
  };
  const combat = new CombatSystem(engine, {});
  return { engine, combat, worldEvents, effects };
}

function enemy(x, y = 0) {
  return {
    x,
    y,
    hp: 3,
    enemyId: `fox-${x}`,
    destroyed: false,
    velocity: { x: 0, y: 0 },
    hasTag() { return false; },
    takeDamage(amount) { this.hp -= amount; },
  };
}

test('Peck is fast single-target precision while Wing Whap remains the wider cleave', () => {
  const close = enemy(52);
  const second = enemy(70);
  const wideOnly = enemy(108);
  const { engine, combat } = combatHarness([close, second, wideOnly]);
  const player = { x: 0, y: 0, facing: 1 };

  engine.events.emit('goose:peck', { player });
  assert.equal(close.hp, 2);
  assert.equal(second.hp, 3);
  assert.equal(wideOnly.hp, 3);
  assert.equal(close.velocity.x, PECK_PROFILE.knockback);

  engine.events.emit('goose:attack', { player });
  assert.equal(close.hp, 1);
  assert.equal(second.hp, 2);
  assert.equal(wideOnly.hp, 2);
  assert.ok(PECK_PROFILE.range >= 96, 'Peck should comfortably reach a nearby enemy');
  assert.ok(PECK_PROFILE.range < WING_WHAP_PROFILE.range, 'Wing Whap should retain the wider reach');
  assert.ok(PECK_PROFILE.knockback < WING_WHAP_PROFILE.knockback, 'Wing Whap should retain the stronger crowd-control knockback');
  assert.ok(PECK_PROFILE.cooldown < WING_WHAP_PROFILE.cooldown, 'Peck should recover faster');
  combat.destroy();
});

test('Breadstorm starts friendly, then evolves shields without losing later challenge', () => {
  const solo = breadstormStats({ cycle: 1, players: 1, evolutionLevel: 2 });
  const duo = breadstormStats({ cycle: 1, players: 2, evolutionLevel: 2 });
  const second = breadstormStats({ cycle: 2, players: 1, evolutionLevel: 3 });
  const shielded = breadstormStats({ cycle: 4, players: 1, evolutionLevel: 5 });
  const phaseShielded = breadstormStats({ cycle: 6, players: 1, evolutionLevel: 7 });
  assert.deepEqual(solo, { maxHp: 1, maxShield: 0 });
  assert.deepEqual(duo, solo, 'co-op should help instead of inflating early boss health');
  assert.deepEqual(second, { maxHp: 2, maxShield: 0 });
  assert.deepEqual(shielded, { maxHp: 4, maxShield: 1 });
  assert.deepEqual(phaseShielded, { maxHp: 6, maxShield: 2 });
  assert.equal(breadstormShieldUnlocked(2), false);
  assert.equal(breadstormShieldUnlocked(4), false);
  assert.equal(breadstormShieldUnlocked(5), true);
  assert.equal(breadstormPhaseShieldUnlocked(6), false);
  assert.equal(breadstormPhaseShieldUnlocked(7), true);
  assert.equal(breadstormShieldDamage(2), 3);
  assert.equal(breadstormHeartDamage(8), 1);
  assert.equal(breadstormPhaseShield({ phase: 2, cycle: 4, evolutionLevel: 5 }), 0);
  assert.equal(breadstormPhaseShield({ phase: 2, cycle: 6, evolutionLevel: 7 }), 1);
  assert.equal(bossTargetForLevel(1), 0);
  assert.equal(bossTargetForLevel(2), 1);
  assert.equal(bossTargetForLevel(3), 2);
  assert.ok(BREADSTORM_ENCOUNTER.x < 7000, 'the boss encounter should be well before the far-right gate');
});

test('fox stomps are deliberate and defeated foxes drop useful crumb bundles', () => {
  assert.equal(foxCrumbDropCount('scout'), 2);
  assert.equal(foxCrumbDropCount('guard'), 3);
  assert.equal(foxCrumbDropCount('captain'), 4);
  assert.equal(isStompLanding({ verticalVelocity: 280, previousBottom: 90, currentBottom: 112, enemyTop: 100, playerCenterY: 84, enemyCenterY: 125 }), true);
  assert.equal(isStompLanding({ verticalVelocity: -120, previousBottom: 90, currentBottom: 112, enemyTop: 100, playerCenterY: 84, enemyCenterY: 125 }), false);
  assert.equal(isStompLanding({ verticalVelocity: 280, previousBottom: 120, currentBottom: 128, enemyTop: 100, playerCenterY: 110, enemyCenterY: 125 }), false);
});

test('contact combat routes stomps and water falls through shared fox defeat events', () => {
  const events = new EventBus();
  const worldEvents = [];
  const engine = { events, network: { sendWorldEvent(event, payload) { worldEvents.push({ event, payload }); } } };
  const tags = (wanted) => ({ hasTag(tag) { return wanted.includes(tag); } });
  const player = {
    ...tags(['player']), velocity: { y: 280 }, previousPosition: { y: 70 }, y: 88,
    grounded: false, groundPlatform: null, jumpsRemaining: 0,
  };
  const fox = {
    ...tags(['enemy']), enemyId: 'stomp-fox', defeated: false,
    crumbDropCount() { return 2; },
    defeat(_engine, options) { this.defeated = true; this.options = options; return true; },
  };
  const playerCollider = { entity: player, offset: { y: -4 }, height: 48, bottom: 108, centerY: 84 };
  const foxCollider = { entity: fox, top: 100, centerY: 125 };
  const system = new ContactDamageSystem(engine);
  events.emit('collision:enter', { a: playerCollider, b: foxCollider });
  assert.equal(fox.defeated, true);
  assert.equal(fox.options.cause, 'stomp');
  assert.equal(player.velocity.y, -520);
  assert.equal(player.jumpsRemaining, 1);
  assert.deepEqual(worldEvents[0], { event: 'enemy-defeated', payload: { enemyId: 'stomp-fox', cause: 'stomp', crumbCount: 2 } });

  const waterFox = {
    ...tags(['enemy']), enemyId: 'water-fox', defeated: false,
    crumbDropCount() { return 3; },
    wasRecentlyPlayerPushed() { return true; },
    defeat(_engine, options) { this.defeated = true; this.options = options; return true; },
  };
  const water = { ...tags(['hazard']), type: 'water' };
  events.emit('collision:enter', { a: { entity: waterFox }, b: { entity: water } });
  assert.equal(waterFox.options.cause, 'water');
  assert.equal(worldEvents[1].payload.crumbCount, 3);

  const wanderingFox = {
    ...tags(['enemy']), enemyId: 'wandering-fox', defeated: false, reset: false,
    wasRecentlyPlayerPushed() { return false; },
    resetToSpawn() { this.reset = true; },
    defeat() { this.defeated = true; return true; },
  };
  events.emit('collision:enter', { a: { entity: wanderingFox }, b: { entity: water } });
  assert.equal(wanderingFox.defeated, false, 'a fox should not award a free victory for wandering into danger');
  assert.equal(wanderingFox.reset, true);
  system.destroy();
});

test('remote geese refresh their name and plumage when a profile changes', () => {
  const remote = new RemoteGoose({ id: 'friend', profile: { name: 'First Goose', character: 'classic--snow' } });
  remote.applyProfile({ name: 'Fresh Goose', character: 'swift--rose' });
  assert.equal(remote.profile.name, 'Fresh Goose');
  assert.equal(remote.label.text, 'Fresh Goose');
  assert.equal(remote.character.id, 'swift--rose');
  remote.display.destroy({ children: true });
});
