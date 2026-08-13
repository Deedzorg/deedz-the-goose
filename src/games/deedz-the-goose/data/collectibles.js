export const COLLECTIBLE_TYPES = Object.freeze({
  crumb: {
    label: 'Crumb', xp: 7, flockEnergy: 3, ammo: 1, heal: 0, color: 0xd69b4f, accent: 0xf7ca76,
  },
  'echo-crumb': {
    label: 'Echo Crumb', xp: 24, flockEnergy: 8, ammo: 2, heal: 0, color: 0x55d6ff, accent: 0xcdf8ff,
  },
  'golden-feather': {
    label: 'Golden Feather', xp: 20, flockEnergy: 5, ammo: 0, heal: 0, color: 0xffd95a, accent: 0xffffff,
  },
  'moon-token': {
    label: 'Moon Token', xp: 32, flockEnergy: 10, ammo: 0, heal: 0, color: 0xb6c8ff, accent: 0xffffff,
  },
  'flock-star': {
    label: 'Flock Star', xp: 18, flockEnergy: 16, ammo: 0, heal: 0, color: 0xff8ad8, accent: 0xffffff,
  },
  heart: {
    label: 'Gooseberry Heart', xp: 12, flockEnergy: 2, ammo: 0, heal: 2, color: 0xff5f67, accent: 0xffc7cf,
  },
  'prism-seed': {
    label: 'Prism Seed', xp: 42, flockEnergy: 12, ammo: 0, heal: 0, color: 0xb94cff, accent: 0x8de7ff,
  },
  'echo-cache': {
    label: 'Echo Cache', xp: 55, flockEnergy: 18, ammo: 5, heal: 1, color: 0xffa24c, accent: 0xfff3ba,
  },
});

export function collectibleDefinition(type = 'crumb') {
  return COLLECTIBLE_TYPES[type] ?? COLLECTIBLE_TYPES.crumb;
}

export function collectibleXpValue(type = 'crumb', value = 1) {
  const definition = collectibleDefinition(type);
  return Math.max(1, Math.floor(definition.xp * Math.max(1, Number(value) || 1)));
}
