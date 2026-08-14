import { evolutionGoal } from './evolutions.js';
import { BREADSTORM_ENCOUNTER, bossTargetForLevel, nextEchoPreview } from './progression.js';

export function progressionDirective({ activeCrystals = 0, requiredCrystals = 3, level = 1, xp = 0, xpGoal = evolutionGoal(level), bossWins = 0, bossTarget = bossTargetForLevel(level), flockEnergy = 0, flockGoal = 180, boss = null } = {}) {
  const next = nextEchoPreview(level);
  const bossRequired = bossWins < bossTarget;
  if (bossRequired && boss?.active && !boss.defeated) {
    const shield = Math.max(0, Number(boss.shield) || 0);
    const hp = Math.max(0, Number(boss.hp) || 0);
    const maxHp = Math.max(1, Number(boss.maxHp) || hp || 1);
    const phase = Math.max(1, Number(boss.phase) || 1);
    return shield > 0
      ? { phase: 'boss-shield', title: 'NEXT · BREAK THE ECHO SHIELD', detail: `Breadstorm P${phase} · HONK the blue shield (${shield}) · ${BREADSTORM_ENCOUNTER.zone}, center map`, next }
      : { phase: 'boss-fight', title: 'NEXT · DEFEAT BARON BREADSTORM', detail: `${boss.shieldEnabled === false ? 'Early form · no shield · ' : 'Shield down · '}hit the boss now · ${hp}/${maxHp} hearts · ${BREADSTORM_ENCOUNTER.zone}`, next };
  }
  if (activeCrystals < requiredCrystals) {
    return { phase: 'crystals', title: `NEXT · AWAKEN ECHO CRYSTALS ${activeCrystals}/${requiredCrystals}`, detail: 'Hold Flock Sense (LT / Q) to find them, then HONK nearby', next };
  }
  if (xp < xpGoal) {
    return { phase: 'xp', title: `NEXT · CHARGE ECHO LAYER ${level}`, detail: `${Math.max(0, xpGoal - xp)} XP to go · collect, defeat enemies, and activate resonators · Boss Charge ${flockEnergy}/${flockGoal}`, next };
  }
  if (bossRequired) {
    return { phase: 'summon', title: 'NEXT · SUMMON BARON BREADSTORM', detail: `Boss Charge ${flockEnergy}/${flockGoal} · he will invade ${BREADSTORM_ENCOUNTER.zone}, near the center`, next };
  }
  return { phase: 'gate', title: `NEXT · EVOLVE TO ECHO LAYER ${next.level}`, detail: `Reach the Foxfire Gate → ${next.name} · ${next.description}`, next };
}
