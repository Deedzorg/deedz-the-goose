export const PECK_PROFILE = Object.freeze({
  range: 132,
  damage: 3,
  knockback: 560,
  knockbackY: -230,
  cooldown: 0.3,
  groundLunge: 690,
  airLunge: 510,
  dashTime: 0.13,
});

export function recoverableCrumbLoss(ammo = 0, maximum = 3) {
  const available = Math.max(0, Math.floor(Number(ammo) || 0));
  if (available <= 1) return 0;
  const requested = Math.max(1, Math.ceil(available * 0.25));
  return Math.min(Math.max(1, Math.floor(Number(maximum) || 1)), requested, available - 1);
}

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
