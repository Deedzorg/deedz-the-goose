export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, value) => a === b ? 0 : (value - a) / (b - a);
export const remap = (inMin, inMax, outMin, outMax, value) => lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
export const approach = (current, target, amount) => current < target ? Math.min(current + amount, target) : Math.max(current - amount, target);
export const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const randomRange = (min, max) => min + Math.random() * (max - min);
export const signNonZero = (value, fallback = 1) => value === 0 ? fallback : Math.sign(value);
