import { AudioSystem } from './audio.js';
import { makeLevel } from './levels.js';
import { Player, Cat, keys, rectsOverlap } from './entities.js';
import { drawWorld } from './render.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const startBtn = document.querySelector('#startBtn');
const muteBtn = document.querySelector('#muteBtn');
const statusEl = document.querySelector('#status');

const audio = new AudioSystem();
const game = {
  mode: 'start', time: 0, cam: 0,
  level: makeLevel(Date.now() & 99999),
  player: new Player(), cat: new Cat(), crumbs: [], honks: [], particles: []
};

function restart() {
  game.mode = 'play'; game.time = 0; game.cam = 0;
  game.level = makeLevel(Date.now() & 99999);
  game.player = new Player(); game.cat = new Cat(); game.crumbs = []; game.honks = [];
  audio.ensure();
  statusEl.textContent = 'Goose deployed. Commander Keen mode engaged.';
}

startBtn.onclick = restart;
muteBtn.onclick = () => { muteBtn.textContent = `Music: ${audio.toggle() ? 'On' : 'Off'}`; };

addEventListener('keydown', e => {
  if (e.code === 'Enter' && game.mode !== 'play') restart();
  if (game.mode !== 'play') return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') game.player.jump(audio);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') game.player.doDash(audio);
  if (e.code === 'KeyH' && !game.player.honkCd) { game.player.honkCd = 1.2; game.honks.push({ x: game.player.x, y: game.player.y, dir: game.player.facing, life: .32 }); audio.beep(230, .22, 'sawtooth', .07); }
  if (e.code === 'KeyK' && !game.player.crumbCd && game.player.ammo > 0) { game.player.crumbCd = .18; game.player.ammo--; game.crumbs.push({ x: game.player.x + game.player.facing * 46, y: game.player.y - 70, vx: game.player.facing * 620, vy: -120, life: 1.1 }); audio.beep(820, .05, 'square', .045); }
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  update(dt); drawWorld(ctx, game); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function solids() {
  return [...game.level.platforms, ...game.level.moving].map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
}

function update(dt) {
  game.time += dt;
  if (game.mode !== 'play') return;
  const level = game.level, player = game.player;
  for (const m of level.moving) { m.t += dt * m.speed; m.x = m.baseX + Math.sin(m.t) * m.amp; }
  player.update(dt, solids(), audio);
  game.cat.update(dt, player, level.coins);
  game.cam += (player.x - 430 - game.cam) * 0.08; game.cam = Math.max(0, game.cam);

  for (const s of level.springs) {
    if (rectsOverlap(player.rect(), s) && player.vy >= 0) { player.y = s.y; player.vy = -1040; player.jumps = 0; audio.beep(720, .11, 'triangle', .075); }
  }

  for (const c of level.coins) if (!c.taken && rectsOverlap(player.rect(), { x:c.x-13, y:c.y-13, w:26, h:26 })) { c.taken = true; player.score += 10; player.ammo++; audio.beep(1120, .05, 'triangle', .04); }
  for (const p of level.powerups) if (!p.taken && rectsOverlap(player.rect(), { x:p.x-18, y:p.y-28, w:36, h:56 })) {
    p.taken = true; player.score += 80;
    if (p.type === 'feather') { player.triple = true; player.maxJumps = 3; statusEl.textContent = 'Triple jump unlocked!'; }
    else { player.hp = Math.min(6, player.hp + 1); player.ammo += 15; statusEl.textContent = 'Sundrop power-up collected!'; }
    audio.beep(980, .2, 'triangle', .08);
  }

  for (const e of level.enemies) if (!e.dead) {
    e.x += e.vx * (e.type === 'crow' ? 95 : 58) * dt;
    e.y += e.type === 'crow' ? Math.sin(game.time * 4 + e.x) * 0.6 : 0;
    if (Math.random() < 0.01) e.vx *= -1;
    const er = { x:e.x-34, y:e.y-64, w:68, h:58 };
    if (rectsOverlap(player.rect(), er)) {
      if (player.vy > 200 && player.y - player.h / 2 < e.y - 20) { e.hp -= 2; player.vy = -560; audio.beep(340,.07,'square',.06); }
      else player.hurt(audio);
    }
    if (keys.has('KeyJ') && !player.stickCd && rectsOverlap(player.stickRect(), er)) { player.stickCd = .25; e.hp -= 2; player.score += 25; audio.beep(260,.08,'square',.065); }
    for (const h of game.honks) if (rectsOverlap({x:h.x + h.dir*20, y:h.y-115, w:220, h:125}, er)) { e.vx = h.dir * 4; e.hp -= 0.02; }
    if (e.hp <= 0) { e.dead = true; player.score += 100; }
  }

  if (player.x > level.endX - 1200) level.boss.active = true;
  const b = level.boss;
  if (b.active && !b.dead) {
    b.t += dt; b.x += Math.sin(b.t * 1.5) * 70 * dt; b.y = 560 + Math.sin(b.t * 2) * 18;
    const br = { x:b.x-80, y:b.y-145, w:160, h:115 };
    if (rectsOverlap(player.rect(), br)) player.hurt(audio);
    if (keys.has('KeyJ') && !player.stickCd && rectsOverlap(player.stickRect(), br)) { player.stickCd = .28; b.hp -= 2; player.score += 40; audio.beep(180,.08,'sawtooth',.07); }
    for (const c of game.crumbs) if (!c.dead && rectsOverlap({x:c.x-10,y:c.y-7,w:20,h:14}, br)) { c.dead = true; b.hp--; player.score += 20; }
    for (const h of game.honks) if (rectsOverlap({x:h.x + h.dir*20, y:h.y-115, w:220, h:125}, br)) b.hp -= 0.03;
    if (b.hp <= 0) { b.dead = true; player.score += 1500; statusEl.textContent = 'Boss defeated. Cat approved.'; }
  }

  for (const c of game.crumbs) { c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 900 * dt; if (c.life <= 0) c.dead = true; }
  game.crumbs = game.crumbs.filter(c => !c.dead);
  for (const h of game.honks) h.life -= dt;
  game.honks = game.honks.filter(h => h.life > 0);

  audio.update(dt, player.hp <= 2, b.active && !b.dead);
  if (player.y > 980 || player.hp <= 0) { game.mode = 'start'; statusEl.textContent = 'Deedz got bonked. Press Start to try again.'; }
}
