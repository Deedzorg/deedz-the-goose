const neutralStats = Object.freeze({
  health: 6,
  speed: 1,
  acceleration: 1,
  jumpSpeed: 1,
  flightDuration: 1,
  dashSpeed: 1,
  dashCooldown: 1,
  honkRange: 1,
  honkStrength: 1,
  honkCooldown: 1,
  throwStrength: 1,
  throwLift: 1,
  throwDuration: 1,
});

function stats(overrides = {}) {
  return Object.freeze({ ...neutralStats, ...overrides });
}

export const gooseColors = Object.freeze([
  { id: 'snow', name: 'Snow', color: 0xf7fbff, accent: 0x55d6ff },
  { id: 'rose', name: 'Rose', color: 0xff7fbe, accent: 0xffc3df },
  { id: 'sunny', name: 'Sunny', color: 0xffd95a, accent: 0xfff1a8 },
  { id: 'ocean', name: 'Ocean', color: 0x55d6ff, accent: 0x8de7ff },
  { id: 'meadow', name: 'Meadow', color: 0x7dff8a, accent: 0xb7ffc0 },
  { id: 'violet', name: 'Violet', color: 0xb794ff, accent: 0xd8c7ff },
  { id: 'ember', name: 'Ember', color: 0xff4b4b, accent: 0xffb24d },
  { id: 'midnight', name: 'Midnight', color: 0x27354d, accent: 0x9edce6 },
]);

let activeColorId = 'snow';
const activePlumage = () => gooseColors.find((item) => item.id === activeColorId) ?? gooseColors[0];

function gooseClass(definition) {
  return Object.freeze({
    ...definition,
    get color() { return activePlumage().color; },
    get accent() { return activePlumage().accent; },
  });
}

export const gooseClasses = Object.freeze([
  gooseClass({ id: 'classic', name: 'Classic Goose', ability: 'All-Rounder', description: 'No bonuses and no penalties. Reliable everywhere.', tradeoff: 'Balanced baseline', themeColor: 0xf7fbff, stats: stats(), ratings: { health: 3, speed: 3, honk: 3, throw: 3, flight: 3 } }),
  gooseClass({ id: 'echo', name: 'Echo Goose', ability: 'Big Honk', description: 'Longer, stronger honks with a quicker recharge.', tradeoff: 'Less health and weaker crumb throws', themeColor: 0x55d6ff, stats: stats({ health: 5, honkRange: 1.25, honkStrength: 1.08, honkCooldown: 0.9, throwStrength: 0.92 }), ratings: { health: 2, speed: 3, honk: 5, throw: 2, flight: 3 } }),
  gooseClass({ id: 'ranger', name: 'Crumb Ranger', ability: 'Long Toss', description: 'Charged crumbs travel farther, higher, and stay airborne longer.', tradeoff: 'Less health, shorter honk, slower dash recharge', themeColor: 0xffd95a, stats: stats({ health: 5, throwStrength: 1.2, throwLift: 1.1, throwDuration: 1.15, honkRange: 0.9, dashCooldown: 1.08 }), ratings: { health: 2, speed: 3, honk: 2, throw: 5, flight: 3 } }),
  gooseClass({ id: 'guardian', name: 'Guardian Goose', ability: 'Sturdy', description: 'Eight hearts make this goose the safest frontline choice.', tradeoff: 'Slower movement, dash, and glide', themeColor: 0x7dff8a, stats: stats({ health: 8, speed: 0.9, acceleration: 0.92, dashSpeed: 0.9, flightDuration: 0.9 }), ratings: { health: 5, speed: 2, honk: 3, throw: 3, flight: 2 } }),
  gooseClass({ id: 'skywing', name: 'Skywing Goose', ability: 'Long Glide', description: 'Third-jump flight lasts dramatically longer.', tradeoff: 'Less health, slower movement and dash', themeColor: 0xb794ff, stats: stats({ health: 5, speed: 0.94, flightDuration: 1.55, dashSpeed: 0.92 }), ratings: { health: 2, speed: 2, honk: 3, throw: 3, flight: 5 } }),
  gooseClass({ id: 'swift', name: 'Swift Goose', ability: 'Quick Dash', description: 'Faster running, acceleration, and a stronger, quicker dash.', tradeoff: 'Less health and shorter honk', themeColor: 0xff7fbe, stats: stats({ health: 5, speed: 1.12, acceleration: 1.1, dashSpeed: 1.15, dashCooldown: 0.85, honkRange: 0.9 }), ratings: { health: 2, speed: 5, honk: 2, throw: 3, flight: 3 } }),
  gooseClass({ id: 'spring', name: 'Spring Goose', ability: 'High Flap', description: 'Every jump launches higher, making vertical routes easier.', tradeoff: 'Less health, slower running, shorter third-jump flight', themeColor: 0xff8a42, stats: stats({ health: 5, speed: 0.94, jumpSpeed: 1.15, flightDuration: 0.85, dashCooldown: 1.06 }), ratings: { health: 2, speed: 2, honk: 3, throw: 3, flight: 5 } }),
  gooseClass({ id: 'firebrand', name: 'Ember Goose', ability: 'Fire Feather', description: 'Turns every thrown crumb into a fast, nearly straight flaming feather bolt.', tradeoff: 'Less health, shorter honk, and little ability to arc shots over cover', themeColor: 0xff4b4b, projectileStyle: 'ember-bolt', stats: stats({ health: 5, honkRange: 0.9, throwStrength: 1.15, throwLift: 0.92, throwDuration: 0.92 }), ratings: { health: 2, speed: 3, honk: 2, throw: 5, flight: 3 } }),
]);

export function setActiveGooseColor(colorId = 'snow') {
  activeColorId = gooseColors.some((item) => item.id === colorId) ? colorId : 'snow';
  return activePlumage();
}

export function networkCharacterId(classId = 'classic', colorId = 'snow') {
  const validClass = gooseClasses.some((item) => item.id === classId) ? classId : 'classic';
  const validColor = gooseColors.some((item) => item.id === colorId) ? colorId : 'snow';
  return `${validClass}--${validColor}`;
}

export function resolveCharacter(classId = 'classic', colorId = 'snow') {
  const base = gooseClasses.find((item) => item.id === classId) ?? gooseClasses[0];
  const plumage = gooseColors.find((item) => item.id === colorId) ?? gooseColors[0];
  return Object.freeze({ ...base, id: networkCharacterId(base.id, plumage.id), color: plumage.color, accent: plumage.accent, classId: base.id, plumageId: plumage.id });
}

const networkCharacters = gooseClasses.flatMap((base) => gooseColors.map((plumage) => resolveCharacter(base.id, plumage.id)));
export const characters = Object.freeze([...gooseClasses, ...networkCharacters]);
