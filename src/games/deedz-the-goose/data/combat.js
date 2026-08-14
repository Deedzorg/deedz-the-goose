export const PECK_PROFILE = Object.freeze({
  range: 96,
  damage: 1,
  knockback: 285,
  knockbackY: -150,
  cooldown: 0.2,
  groundLunge: 118,
  airLunge: 60,
});

export const WING_WHAP_PROFILE = Object.freeze({
  range: 116,
  damage: 1,
  knockback: 440,
  knockbackY: -260,
  cooldown: 0.28,
});

export function foxCrumbDropCount(rank = 'scout') {
  if (rank === 'captain') return 4;
  if (rank === 'guard') return 3;
  return 2;
}

export function isStompLanding({
  verticalVelocity = 0,
  previousBottom = 0,
  currentBottom = 0,
  enemyTop = 0,
  playerCenterY = 0,
  enemyCenterY = 0,
} = {}) {
  return Number(verticalVelocity) >= 80
    && Number(previousBottom) <= Number(enemyTop) + 18
    && Number(currentBottom) <= Number(enemyCenterY) + 12
    && Number(playerCenterY) < Number(enemyCenterY);
}
