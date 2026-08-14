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
export const ADVANCED_GOOSE_UNLOCK_LEVEL = 10;

function unlockChallenge(type, target, label) {
  return Object.freeze({ type, target, label });
}

function gooseClass(definition) {
  return Object.freeze({
    ...definition,
    get color() { return activePlumage().color; },
    get accent() { return activePlumage().accent; },
  });
}

export const gooseClasses = Object.freeze([
  gooseClass({ id: 'classic', name: 'Silly Goose', ability: 'Oddball All-Rounder', description: 'A cheerful, dependable goose with no hidden weaknesses.', tradeoff: 'Balanced baseline', themeColor: 0xf7fbff, presentation: { bodyWidth: 1.02, bodyHeight: 0.98, headScale: 1, detail: 'tuft' }, stats: stats(), ratings: { health: 3, speed: 3, honk: 3, throw: 3, flight: 3 } }),
  gooseClass({ id: 'echo', name: 'Happy Happy Goose', ability: 'Joyful Honk', description: 'Longer, stronger honks with a quicker recharge.', tradeoff: 'Less health and weaker crumb throws', themeColor: 0x55d6ff, presentation: { bodyWidth: 1.08, bodyHeight: 0.96, headScale: 1.1, detail: 'smile' }, stats: stats({ health: 5, honkRange: 1.25, honkStrength: 1.08, honkCooldown: 0.9, throwStrength: 0.92 }), ratings: { health: 2, speed: 3, honk: 5, throw: 2, flight: 3 } }),
  gooseClass({ id: 'ranger', name: 'Crumb Goose', ability: 'Long Toss', description: 'Charged crumbs travel farther, higher, and stay airborne longer.', tradeoff: 'Less health, shorter honk, slower dash recharge', themeColor: 0xffd95a, presentation: { bodyWidth: 0.98, bodyHeight: 1.04, headScale: 0.96, detail: 'crumb' }, stats: stats({ health: 5, throwStrength: 1.2, throwLift: 1.1, throwDuration: 1.15, honkRange: 0.9, dashCooldown: 1.08 }), ratings: { health: 2, speed: 3, honk: 2, throw: 5, flight: 3 } }),
  gooseClass({ id: 'guardian', name: 'Curvy Goose', ability: 'Big-Hearted Guard', description: 'A broad, curvy silhouette and eight hearts make her a sturdy frontline goose.', tradeoff: 'Slower movement, dash, and glide', unlockLevel: ADVANCED_GOOSE_UNLOCK_LEVEL, unlockChallenge: unlockChallenge('level', ADVANCED_GOOSE_UNLOCK_LEVEL, `Reach Echo ${ADVANCED_GOOSE_UNLOCK_LEVEL}`), themeColor: 0xff8fc9, presentation: { bodyWidth: 1.28, bodyHeight: 1.24, headScale: 1.08, detail: 'curves' }, stats: stats({ health: 8, speed: 0.9, acceleration: 0.92, dashSpeed: 0.9, flightDuration: 0.9 }), ratings: { health: 5, speed: 2, honk: 3, throw: 3, flight: 2 } }),
  gooseClass({ id: 'skywing', name: 'Sweet Goose', ability: 'Gentle Glide', description: 'Third-jump flight lasts dramatically longer.', tradeoff: 'Less health, slower movement and dash', unlockChallenge: unlockChallenge('crumbs', 50, 'Collect 50 crumbs'), themeColor: 0xb794ff, presentation: { bodyWidth: 1.08, bodyHeight: 1.08, headScale: 1.03, detail: 'heart' }, stats: stats({ health: 5, speed: 0.94, flightDuration: 1.55, dashSpeed: 0.92 }), ratings: { health: 2, speed: 2, honk: 3, throw: 3, flight: 5 } }),
  gooseClass({ id: 'swift', name: 'Bad Bad Goose', ability: 'Troublemaker Dash', description: 'Faster running, acceleration, and a stronger, quicker dash.', tradeoff: 'Less health and shorter honk', unlockChallenge: unlockChallenge('enemies', 20, 'Defeat 20 enemies'), themeColor: 0x27354d, presentation: { bodyWidth: 0.92, bodyHeight: 0.9, headScale: 0.96, detail: 'scowl' }, stats: stats({ health: 5, speed: 1.12, acceleration: 1.1, dashSpeed: 1.15, dashCooldown: 0.85, honkRange: 0.9 }), ratings: { health: 2, speed: 5, honk: 2, throw: 3, flight: 3 } }),
  gooseClass({ id: 'spring', name: 'Fun Size Goose', ability: 'Pocket-Sized Pop', description: 'A tiny, compact silhouette with extra-high jumps for reaching vertical routes.', tradeoff: 'Less health, slower running, shorter third-jump flight', unlockChallenge: unlockChallenge('crystals', 3, 'Awaken 3 Echo Crystals'), themeColor: 0xff8a42, presentation: { bodyWidth: 0.82, bodyHeight: 0.84, headScale: 0.82, detail: 'spark' }, stats: stats({ health: 5, speed: 0.94, jumpSpeed: 1.15, flightDuration: 0.85, dashCooldown: 1.06 }), ratings: { health: 2, speed: 2, honk: 3, throw: 3, flight: 5 } }),
  gooseClass({ id: 'firebrand', name: 'Ember Goose', ability: 'Fire Feather', description: 'Turns every thrown crumb into a fast, nearly straight flaming feather bolt.', tradeoff: 'Less health, shorter honk, and little ability to arc shots over cover', unlockChallenge: unlockChallenge('bossWins', 1, 'Defeat Breadstorm once'), themeColor: 0xff4b4b, presentation: { bodyWidth: 1.06, bodyHeight: 0.94, headScale: 1, detail: 'ember' }, projectileStyle: 'ember-bolt', stats: stats({ health: 5, honkRange: 0.9, throwStrength: 1.15, throwLift: 0.92, throwDuration: 0.92 }), ratings: { health: 2, speed: 3, honk: 2, throw: 5, flight: 3 } }),
]);

export function normalizeGooseUnlockProgress(progress = 1) {
  const source = typeof progress === 'object' && progress !== null ? progress : { level: progress };
  const evolution = typeof source.evolution === 'object' && source.evolution !== null ? source.evolution : {};
  const crystalSource = source.activatedCrystals ?? source.crystals ?? 0;
  const crystals = Array.isArray(crystalSource)
    ? new Set(crystalSource.map((id) => String(id || '').trim()).filter(Boolean)).size
    : Math.max(0, Math.floor(Number(crystalSource) || 0));
  return {
    unlockAll: Boolean(source.unlockAll ?? source.debugUnlockAllGeese),
    level: Math.max(1, Math.floor(Number(source.level ?? evolution.level) || 1)),
    crumbs: Math.max(0, Math.floor(Number(source.crumbs) || 0)),
    enemies: Math.max(0, Math.floor(Number(source.enemies) || 0)),
    crystals,
    bossWins: Math.max(0, Math.floor(Number(source.bossWins ?? evolution.bossWins) || 0)),
  };
}

export function gooseUnlockProgressFromSave(save) {
  return normalizeGooseUnlockProgress({
    level: save?.get?.('progress.evolution.level', 1),
    unlockAll: save?.get?.('progress.debugUnlockAllGeese', false),
    crumbs: save?.get?.('progress.crumbs', 0),
    enemies: save?.get?.('progress.enemies', 0),
    activatedCrystals: save?.get?.('progress.activatedCrystals', []),
    bossWins: save?.get?.('progress.evolution.bossWins', 0),
  });
}

export function gooseUnlockStatus(characterOrId, progress = 1) {
  const character = typeof characterOrId === 'string'
    ? gooseClasses.find((item) => item.id === characterOrId)
    : characterOrId;
  if (!character) return { unlocked: false, current: 0, target: 1, label: 'Unknown goose' };
  const challenge = character.unlockChallenge;
  if (!challenge) return { unlocked: true, current: 1, target: 1, label: 'Available from the start' };
  const snapshot = normalizeGooseUnlockProgress(progress);
  if (snapshot.unlockAll) return { unlocked: true, current: challenge.target, target: challenge.target, label: 'Unlocked by Goose Lab' };
  const current = Math.min(challenge.target, Math.max(0, Number(snapshot[challenge.type]) || 0));
  return { unlocked: current >= challenge.target, current, target: challenge.target, label: challenge.label };
}

export function isGooseClassUnlocked(characterOrId, progress = 1) {
  return gooseUnlockStatus(characterOrId, progress).unlocked;
}

export function advancedGooseUnlocks() {
  return gooseClasses.filter((item) => item.unlockChallenge?.type === 'level' && Number(item.unlockChallenge.target) === ADVANCED_GOOSE_UNLOCK_LEVEL);
}

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
