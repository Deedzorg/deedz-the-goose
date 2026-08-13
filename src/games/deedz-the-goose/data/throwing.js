import { clamp, lerp } from '../../../shared/math.js';

export const THROW_CHARGE = Object.freeze({
  maxSeconds: 0.9,
  minimumStrength: 560,
  maximumStrength: 1100,
  minimumLift: 80,
  maximumLift: 285,
  minimumDamage: 1,
  maximumDamage: 2,
});

export function chargedThrowProfile(seconds = 0, options = THROW_CHARGE) {
  const duration = Math.max(0.001, Number(options.maxSeconds) || THROW_CHARGE.maxSeconds);
  const normalized = clamp((Number(seconds) || 0) / duration, 0, 1);
  // Ease outward so quick taps stay useful while deliberate holds gain dramatic range.
  const power = 1 - Math.pow(1 - normalized, 1.65);
  return {
    charge: normalized,
    power,
    strength: Math.round(lerp(options.minimumStrength, options.maximumStrength, power)),
    lift: Math.round(lerp(options.minimumLift, options.maximumLift, power)),
    damage: normalized >= 0.92 ? options.maximumDamage : options.minimumDamage,
    duration: lerp(1.05, 2.35, power),
    label: normalized >= 0.92 ? 'POWER CRUMB!' : normalized >= 0.48 ? 'LONG THROW!' : 'QUICK TOSS!',
  };
}
