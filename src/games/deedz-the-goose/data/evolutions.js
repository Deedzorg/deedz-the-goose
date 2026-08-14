import { collectibleXpValue } from './collectibles.js';
import { enemyArchetypesForLevel, enemyDefinition } from './enemies.js';

const STAGE_COUNT = 6;

export const evolutionStages = Object.freeze([
  {
    id: 'moonlit-awakening',
    name: 'Moonlit Awakening',
    description: 'Gentle cloud paths, wandering scouts, and bright crumb constellations.',
    tint: 0x55d6ff,
    accent: 0xffd95a,
    skyTop: 0x0c2444,
    skyBottom: 0x17445c,
    horizon: 0x1c4e53,
    mountain: 0x16384d,
    moon: 0xfff3ba,
    platformColor: 0x315f70,
    platformEdge: 0x8de7ff,
    decor: ['wind-ribbon', 'flower', 'lantern'],
    gravity: 1,
    speed: 1,
    platformCount: 6,
    enemyCount: 2,
  },
  {
    id: 'blooming-updraft',
    name: 'Blooming Updraft',
    description: 'The wind rises. Trampolines bloom and longer aerial routes appear.',
    tint: 0x7dff8a,
    accent: 0x55d6ff,
    skyTop: 0x12364b,
    skyBottom: 0x1b655f,
    horizon: 0x27785d,
    mountain: 0x194b50,
    moon: 0xd9fff0,
    platformColor: 0x2d725d,
    platformEdge: 0x9dffb1,
    decor: ['flower', 'wind-ribbon', 'floating-island'],
    gravity: 0.94,
    speed: 1.03,
    platformCount: 8,
    enemyCount: 3,
  },
  {
    id: 'violet-rift',
    name: 'Violet Rift',
    description: 'Ruins drift into new places while tougher fox patrols cross the old roads.',
    tint: 0xb94cff,
    accent: 0xf0a5ff,
    skyTop: 0x201642,
    skyBottom: 0x3f285f,
    horizon: 0x4e3464,
    mountain: 0x2a2448,
    moon: 0xe5c8ff,
    platformColor: 0x50406b,
    platformEdge: 0xe4a3ff,
    decor: ['crystal-garden', 'ruin', 'floating-island'],
    gravity: 0.9,
    speed: 1.06,
    platformCount: 9,
    enemyCount: 4,
  },
  {
    id: 'foxfire-siege',
    name: 'Foxfire Siege',
    description: 'The fortress pushes outward and every route demands stronger flock movement.',
    tint: 0xff7b42,
    accent: 0xffd95a,
    skyTop: 0x35162a,
    skyBottom: 0x74352f,
    horizon: 0x704633,
    mountain: 0x432937,
    moon: 0xffca8d,
    platformColor: 0x644638,
    platformEdge: 0xffa85c,
    decor: ['banner', 'lantern', 'crystal-garden'],
    gravity: 0.88,
    speed: 1.08,
    platformCount: 10,
    enemyCount: 5,
  },
  {
    id: 'golden-chaos',
    name: 'Golden Chaos',
    description: 'Fast moving sky bridges and rich collectible trails reward fearless flight.',
    tint: 0xffd95a,
    accent: 0xffffff,
    skyTop: 0x3e3157,
    skyBottom: 0x9b653f,
    horizon: 0x8c7042,
    mountain: 0x5a4650,
    moon: 0xffffff,
    platformColor: 0x76603b,
    platformEdge: 0xffef9d,
    decor: ['lantern', 'floating-island', 'banner', 'flower'],
    gravity: 0.84,
    speed: 1.12,
    platformCount: 12,
    enemyCount: 6,
  },
  {
    id: 'infinite-flock',
    name: 'Infinite Flock',
    description: 'The world keeps remixing forever with escalating foxes, phasing ruins, and airborne routes.',
    tint: 0x8de7ff,
    accent: 0xff8ad8,
    skyTop: 0x14234e,
    skyBottom: 0x355d7f,
    horizon: 0x3d6f78,
    mountain: 0x253b61,
    moon: 0xffd9f1,
    platformColor: 0x3e6378,
    platformEdge: 0xffa4df,
    decor: ['crystal-garden', 'floating-island', 'wind-ribbon', 'lantern', 'banner'],
    gravity: 0.82,
    speed: 1.15,
    platformCount: 13,
    enemyCount: 7,
  },
]);

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function mixColor(a, b, amount) {
  const t = Math.max(0, Math.min(1, amount));
  const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
  const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function stageForLevel(level = 1) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  return evolutionStages[Math.min(evolutionStages.length - 1, normalized - 1)];
}

export function visualForLevel(level = 1) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  const stage = stageForLevel(normalized);
  if (normalized <= evolutionStages.length) return { ...stage };
  const cycleColors = [0x55d6ff, 0x7dff8a, 0xb94cff, 0xff7b42, 0xffd95a, 0xff8ad8];
  const cycleColor = cycleColors[(normalized - 1) % cycleColors.length];
  const blend = 0.2 + ((normalized % 4) * 0.07);
  return {
    ...stage,
    name: `${stage.name} ${normalized - evolutionStages.length + 1}`,
    tint: mixColor(stage.tint, cycleColor, blend),
    accent: mixColor(stage.accent, cycleColors[normalized % cycleColors.length], 0.28),
    skyTop: mixColor(stage.skyTop, cycleColor, 0.13),
    skyBottom: mixColor(stage.skyBottom, cycleColor, 0.17),
    horizon: mixColor(stage.horizon, cycleColor, 0.12),
    platformColor: mixColor(stage.platformColor, cycleColor, 0.18),
    platformEdge: mixColor(stage.platformEdge, cycleColor, 0.35),
  };
}

export function evolutionGoal(level = 1) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  return 120 + (normalized - 1) * 55;
}

export function createEvolutionSeed(profileName = 'Deedz', seed = Date.now()) {
  return hashString(`${profileName}:${seed}`);
}

function enemyXp(rank) {
  return rank === 'captain' ? 38 : rank === 'guard' ? 24 : 16;
}

export function evolutionLayoutXpBudget(layout = {}) {
  const collectibleXp = (layout.collectibles ?? []).reduce((sum, item) => sum + collectibleXpValue(item.type, item.value), 0);
  const enemyExperience = (layout.enemies ?? []).reduce((sum, enemy) => sum + enemyXp(enemy.rank), 0);
  const resonatorExperience = (layout.resonators ?? []).reduce((sum, resonator) => sum + (Number(resonator.xp) || 30), 0);
  return collectibleXp + enemyExperience + resonatorExperience;
}

export function generateEvolutionLayout({
  level = 1,
  cycle = 0,
  seed = 1,
  width = 9600,
  groundY = 920,
} = {}) {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
  const stage = visualForLevel(normalizedLevel);
  const random = mulberry32(hashString(`${seed}:${normalizedLevel}:${cycle}`));
  const platformTypes = normalizedLevel >= 6
    ? ['moving', 'trampoline', 'cloud', 'ruin', 'updraft', 'phase', 'crystal', 'lantern']
    : normalizedLevel >= 4
      ? ['moving', 'trampoline', 'cloud', 'ruin', 'updraft', 'phase']
      : normalizedLevel >= 2
        ? ['cloud', 'moving', 'trampoline', 'bridge', 'updraft']
        : ['cloud', 'bridge', 'moving'];
  const collectibleTypes = normalizedLevel >= 6
    ? ['crumb', 'echo-crumb', 'golden-feather', 'moon-token', 'flock-star', 'heart', 'prism-seed', 'echo-cache']
    : normalizedLevel >= 4
      ? ['crumb', 'echo-crumb', 'golden-feather', 'moon-token', 'flock-star', 'heart', 'prism-seed']
      : normalizedLevel >= 2
        ? ['crumb', 'echo-crumb', 'golden-feather', 'moon-token', 'heart']
        : ['crumb', 'echo-crumb', 'golden-feather'];
  const platforms = [];
  const enemies = [];
  const collectibles = [];
  const resonators = [];
  const decorations = [];
  const atmosphere = [];
  const margin = 720;
  const usableWidth = Math.max(1200, width - margin * 2);
  const platformCount = stage.platformCount + Math.min(14, Math.floor((normalizedLevel - 1) / 2));
  const enemyCount = stage.enemyCount + Math.min(10, Math.floor((normalizedLevel - 1) / 3));
  const archetypePool = enemyArchetypesForLevel(normalizedLevel);

  for (let index = 0; index < platformCount; index += 1) {
    const band = (index + 0.5) / platformCount;
    const x = margin + band * usableWidth + (random() - 0.5) * 360;
    const y = Math.max(280, groundY - 170 - random() * (390 + Math.min(300, normalizedLevel * 38)));
    let platformType = platformTypes[Math.floor(random() * platformTypes.length) % platformTypes.length];
    if (normalizedLevel >= 4 && index === 0) platformType = 'updraft';
    if (normalizedLevel >= 5 && index === 1) platformType = 'phase';
    if (normalizedLevel >= 6 && index === 2) platformType = 'crystal';
    const platformWidth = 125 + Math.floor(random() * 165);
    const platform = {
      id: `echo-platform-${normalizedLevel}-${cycle}-${index}`,
      x: Math.round(x),
      y: Math.round(y),
      width: platformWidth,
      height: platformType === 'cloud' ? 25 : 28,
      type: platformType,
      moveX: platformType === 'moving' ? 55 + random() * 125 : 0,
      moveY: platformType === 'moving' ? 25 + random() * 85 : 0,
      speed: 0.85 + random() * 0.95 + normalizedLevel * 0.025,
      phaseOffset: random() * Math.PI * 2,
      color: stage.platformColor,
      edge: stage.platformEdge,
      glow: stage.tint,
    };
    platforms.push(platform);

    const typeRoll = random();
    const typeIndex = Math.min(collectibleTypes.length - 1, Math.floor(typeRoll * collectibleTypes.length));
    const type = index % 5 === 4 ? 'echo-crumb' : collectibleTypes[typeIndex];
    collectibles.push({
      id: `echo-pickup-${normalizedLevel}-${cycle}-${index}`,
      x: platform.x + platform.width * 0.5,
      y: platform.y - 70 - random() * 38,
      type,
      value: 1,
      respawnSeconds: 18 + Math.floor(random() * 18),
    });
  }

  for (let index = 0; index < enemyCount; index += 1) {
    const x = margin + ((index + 0.5) / enemyCount) * usableWidth + (random() - 0.5) * 440;
    const rankRoll = random();
    const rank = normalizedLevel >= 5 && rankRoll > 0.68 ? 'captain' : normalizedLevel >= 2 && rankRoll > 0.44 ? 'guard' : 'scout';
    const archetype = index < archetypePool.length
      ? archetypePool[index]
      : archetypePool[Math.floor(random() * archetypePool.length) % archetypePool.length];
    const definition = enemyDefinition(archetype);
    enemies.push({
      id: `echo-fox-${normalizedLevel}-${cycle}-${index}`,
      x: Math.round(x),
      y: groundY - 85,
      patrol: 140 + Math.floor(random() * 200),
      rank,
      archetype,
      level: normalizedLevel,
      name: rank === 'captain' ? `Echo Captain · ${definition.name}` : definition.name,
    });
  }

  const resonatorCount = 2 + Math.min(4, Math.floor(normalizedLevel / 2));
  for (let index = 0; index < resonatorCount; index += 1) {
    const x = margin + ((index + 0.5) / resonatorCount) * usableWidth + (random() - 0.5) * 340;
    resonators.push({
      id: `resonator-${normalizedLevel}-${cycle}-${index}`,
      x: Math.round(x),
      y: Math.round(groundY - 115 - random() * 170),
      radius: 245 + Math.min(90, normalizedLevel * 5),
      cooldown: Math.max(12, 25 - normalizedLevel * 0.45) + random() * 7,
      xp: 28 + Math.min(22, normalizedLevel * 2),
      color: stage.tint,
      accent: stage.accent,
    });
  }

  if (normalizedLevel >= 5 && !collectibles.some((item) => item.type === 'echo-cache')) {
    collectibles.push({
      id: `echo-cache-${normalizedLevel}-${cycle}`,
      x: Math.round(width * 0.52),
      y: Math.round(groundY - 260),
      type: 'echo-cache',
      value: 1,
      respawnSeconds: 28,
    });
  }

  const targetBudget = Math.ceil(evolutionGoal(normalizedLevel) * 1.28);
  let safety = 0;
  while (evolutionLayoutXpBudget({ collectibles, enemies, resonators }) < targetBudget && safety < 32) {
    const index = collectibles.length;
    const rareEvery = Math.max(3, 7 - Math.min(4, Math.floor(normalizedLevel / 2)));
    const type = index % rareEvery === 0
      ? (normalizedLevel >= 5 ? 'echo-cache' : 'echo-crumb')
      : collectibleTypes[Math.floor(random() * collectibleTypes.length) % collectibleTypes.length];
    collectibles.push({
      id: `echo-bonus-${normalizedLevel}-${cycle}-${index}`,
      x: Math.round(margin + random() * usableWidth),
      y: Math.round(groundY - 70 - random() * (300 + Math.min(260, normalizedLevel * 28))),
      type,
      value: 1,
      respawnSeconds: 16 + Math.floor(random() * 20),
    });
    safety += 1;
  }

  const decorationCount = 14 + Math.min(28, normalizedLevel * 3);
  for (let index = 0; index < decorationCount; index += 1) {
    const type = stage.decor[Math.floor(random() * stage.decor.length) % stage.decor.length];
    decorations.push({
      id: `echo-decor-${normalizedLevel}-${cycle}-${index}`,
      type,
      x: Math.round(240 + random() * (width - 480)),
      y: type === 'floating-island' || type === 'wind-ribbon'
        ? Math.round(250 + random() * 430)
        : Math.round(groundY - 8),
      scale: 0.65 + random() * 0.9,
      flip: random() > 0.5,
      color: stage.tint,
      accent: stage.accent,
    });
  }

  for (let index = 0; index < 34 + Math.min(50, normalizedLevel * 4); index += 1) {
    atmosphere.push({
      x: Math.round(random() * width),
      y: Math.round(70 + random() * 680),
      radius: 1 + random() * (2.5 + normalizedLevel * 0.08),
      alpha: 0.12 + random() * 0.45,
      color: index % 4 === 0 ? stage.accent : stage.tint,
    });
  }

  const mutations = [
    normalizedLevel >= 2 ? 'Updraft routes' : null,
    normalizedLevel >= 2 ? 'Crumb Lobbers' : 'Pounce Foxes',
    normalizedLevel >= 3 ? 'Armored Toast Guards' : null,
    normalizedLevel >= 4 ? 'Phasing platforms' : null,
    normalizedLevel >= 5 ? 'Rare Echo Caches' : null,
    normalizedLevel >= 6 ? 'Infinite palette shift' : null,
  ].filter(Boolean);

  return {
    level: normalizedLevel,
    cycle: Math.max(0, Math.floor(Number(cycle) || 0)),
    seed: Number(seed) || 1,
    stage,
    visual: stage,
    platforms,
    enemies,
    collectibles,
    resonators,
    decorations,
    atmosphere,
    mutations,
    xpBudget: evolutionLayoutXpBudget({ collectibles, enemies, resonators }),
  };
}

export const evolutionStageCount = STAGE_COUNT;
