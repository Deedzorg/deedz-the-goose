export function makeLevel(seed = 1) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const platforms = [{ x: 0, y: 620, w: 900, h: 100, type: 'grass' }];
  const springs = [];
  const moving = [];
  const coins = [];
  const enemies = [];
  const props = [];
  const powerups = [];

  let x = 720;
  let y = 560;
  for (let i = 0; i < 46; i++) {
    const gap = 120 + rand() * 210;
    const w = 230 + rand() * 360;
    y = Math.max(300, Math.min(620, y + (rand() - 0.5) * 190));
    x += gap;

    if (rand() < 0.18) {
      moving.push({ x, y, w: 180, h: 26, baseX: x, amp: 80 + rand() * 90, speed: 0.7 + rand() * 0.8, t: rand() * 10 });
    } else {
      platforms.push({ x, y, w, h: 100, type: rand() < 0.25 ? 'stone' : 'grass' });
    }

    if (rand() < 0.55) springs.push({ x: x + 50 + rand() * (w - 100), y: y - 18, w: 44, h: 18 });
    if (rand() < 0.35) enemies.push({ x: x + 90 + rand() * Math.max(80, w - 180), y: y - 38, vx: rand() < 0.5 ? -1 : 1, type: rand() < 0.35 ? 'crow' : rand() < 0.55 ? 'raccoon' : 'fox', hp: 2 });
    if (rand() < 0.2) powerups.push({ x: x + w / 2, y: y - 105, type: rand() < 0.35 ? 'feather' : 'soda', taken: false });

    for (let c = 0; c < 5; c++) coins.push({ x: x + 60 + c * 44, y: y - 76 - Math.sin(c / 4 * Math.PI) * 32, taken: false });

    const propTypes = ['sign', 'mushroom', 'dish', 'crate', 'flag'];
    for (let p = 0; p < 2; p++) {
      if (rand() < 0.45) props.push({ x: x + 40 + rand() * (w - 80), y, type: propTypes[Math.floor(rand() * propTypes.length)] });
    }

    x += w;
  }

  const boss = { x: x + 700, y: 560, hp: 35, maxHp: 35, active: false, dead: false, t: 0 };
  platforms.push({ x: x + 300, y: 620, w: 1500, h: 100, type: 'boss' });

  return { platforms, springs, moving, coins, enemies, props, powerups, boss, endX: x + 1500 };
}
