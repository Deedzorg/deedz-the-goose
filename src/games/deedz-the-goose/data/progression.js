import { evolutionGoal, stageForLevel } from './evolutions.js';

export function flockScore({ level = 1, xp = 0, bossWins = 0, crumbs = 0, enemies = 0, collectibles = 0 } = {}) {
  return Math.max(0, (Number(level) - 1) * 1500 + Number(bossWins) * 700 + Number(xp) * 2 + Number(crumbs) * 2 + Number(enemies) * 50 + Number(collectibles) * 25);
}

export function nextEchoPreview(level = 1) {
  const nextLevel = Math.max(1, Math.floor(Number(level) || 1)) + 1;
  const stage = stageForLevel(nextLevel);
  return { level: nextLevel, name: stage.name, description: stage.description, xpGoal: evolutionGoal(nextLevel) };
}
