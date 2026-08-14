function positiveInteger(value, fallback = 1) {
  return Math.max(1, Math.floor(Number(value) || fallback));
}

export const BREADSTORM_SHIELD_LEVEL = 5;
export const BREADSTORM_PHASE_SHIELD_LEVEL = 7;

export function breadstormShieldUnlocked(evolutionLevel = 2) {
  return positiveInteger(evolutionLevel, 2) >= BREADSTORM_SHIELD_LEVEL;
}

export function breadstormPhaseShieldUnlocked(evolutionLevel = 2) {
  return positiveInteger(evolutionLevel, 2) >= BREADSTORM_PHASE_SHIELD_LEVEL;
}

export function breadstormStats({ cycle = 1, players = 1, evolutionLevel = Number(cycle) + 1 } = {}) {
  const fight = positiveInteger(cycle);
  const shieldUnlocked = breadstormShieldUnlocked(evolutionLevel);
  return {
    maxHp: fight,
    maxShield: shieldUnlocked
      ? 1 + Math.floor(Math.max(0, fight - 4) / 2)
      : 0,
  };
}

export function breadstormPhaseShield({ cycle = 1, evolutionLevel = Number(cycle) + 1, phaseShieldsEnabled = breadstormPhaseShieldUnlocked(evolutionLevel) } = {}) {
  if (!phaseShieldsEnabled) return 0;
  return 1 + Math.floor(Math.max(0, positiveInteger(cycle) - 6) / 3);
}

export function breadstormShieldDamage(damage = 1) {
  return Math.max(1, Math.ceil(Math.max(1, Number(damage) || 1) * 1.5));
}

export function breadstormHeartDamage() { return 1; }
