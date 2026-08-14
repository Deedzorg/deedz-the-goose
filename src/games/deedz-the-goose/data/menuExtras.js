const GOOSE_NAME_FIRST = Object.freeze([
  'Silly', 'Wobbly', 'Turbo', 'Noodle', 'Sunny', 'Fizzy', 'Sneaky', 'Captain',
  'Bouncy', 'Pickle', 'Fluffy', 'Zippy',
]);

const GOOSE_NAME_LAST = Object.freeze([
  'Waddles', 'Crumb', 'Honkers', 'Beak', 'Puddles', 'Feathers', 'Flapper', 'Biscuit',
  'Webfeet', 'Nibbles', 'Goosington', 'Honk',
]);

function pick(items, random) {
  const roll = Number(random?.()) || 0;
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(Math.abs(roll % 1) * items.length)));
  return items[index];
}

export function randomGooseName(random = Math.random) {
  return `${pick(GOOSE_NAME_FIRST, random)} ${pick(GOOSE_NAME_LAST, random)}`.slice(0, 24);
}

function cleanName(value, fallback) {
  return String(value || fallback).trim().slice(0, 24) || fallback;
}

function localAdventureScore(progress = {}) {
  const evolution = progress.evolution ?? {};
  const current = Math.max(0,
    (Math.max(1, Number(evolution.level) || 1) - 1) * 1500
    + Math.max(0, Number(evolution.xp) || 0) * 2
    + Math.max(0, Number(progress.crumbs) || 0) * 4
    + Math.max(0, Number(progress.enemies) || 0) * 75
    + Math.max(0, Number(progress.collectibles) || 0) * 35,
  );
  return Math.max(current, Math.max(0, Number(progress.records?.bestScore) || 0));
}

export function topGoose({ localName = 'Deedz', progress = {}, peers = [] } = {}) {
  const evolution = progress.evolution ?? {};
  const candidates = [{
    name: cleanName(localName, 'Deedz'),
    score: localAdventureScore(progress),
    level: Math.max(1, Number(evolution.level) || 1),
    local: true,
  }];

  for (const peer of peers ?? []) {
    const state = peer?.state ?? {};
    const score = Number(state.score);
    candidates.push({
      name: cleanName(peer?.profile?.name ?? peer?.name, 'Visiting Goose'),
      score: Number.isFinite(score) ? Math.max(0, score) : 0,
      level: Math.max(1, Number(state.evolutionLevel) || 1),
      local: false,
    });
  }

  candidates.sort((a, b) => b.score - a.score || b.level - a.level || Number(b.local) - Number(a.local) || a.name.localeCompare(b.name));
  return candidates[0];
}
