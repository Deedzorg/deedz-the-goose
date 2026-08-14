export const enemyArchetypes = Object.freeze({
  charger: Object.freeze({ id: 'charger', name: 'Bread Charger', species: 'fox', unlockLevel: 1, bodyColor: 0xe87532, breadColor: 0xd69b4f, hpBonus: 0, scale: 1 }),
  pouncer: Object.freeze({ id: 'pouncer', name: 'Pounce Fox', species: 'fox', unlockLevel: 1, bodyColor: 0xf05d6f, breadColor: 0xffcf70, hpBonus: 0, scale: 0.94 }),
  lobber: Object.freeze({ id: 'lobber', name: 'Crumb Lobber', species: 'fox', unlockLevel: 2, bodyColor: 0x9b62d0, breadColor: 0xd9a8ff, hpBonus: 0, scale: 0.96 }),
  brute: Object.freeze({ id: 'brute', name: 'Toast Guard', species: 'fox', unlockLevel: 3, bodyColor: 0x4d6f96, breadColor: 0xf0b963, hpBonus: 2, scale: 1.12 }),
  penguin: Object.freeze({ id: 'penguin', name: 'Ice-Slide Penguin', species: 'penguin', unlockLevel: 10, bodyColor: 0x26364b, breadColor: 0x8de7ff, hpBonus: 1, scale: 1.02 }),
  bat: Object.freeze({ id: 'bat', name: 'Crumb-Snatch Bat', species: 'bat', unlockLevel: 10, bodyColor: 0x573a78, breadColor: 0xf7ca76, hpBonus: -1, scale: 0.9, flying: true, stealsCrumbs: true }),
});

export function enemyDefinition(archetype = 'charger') {
  return enemyArchetypes[archetype] ?? enemyArchetypes.charger;
}

export function enemyArchetypesForLevel(level = 1) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  return Object.values(enemyArchetypes).filter((definition) => definition.unlockLevel <= normalized).map((definition) => definition.id);
}
