import { AudioSystem } from './audio.js';
import { makeLevel } from './levels.js';
import { Player, Cat, rectsOverlap } from './entities.js';
import { drawWorld } from './render.js';
import { gooseOnline } from './online.js';
import { controls, bindTouchControls } from './controls.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const startBtn = document.querySelector('#startBtn');
const muteBtn = document.querySelector('#muteBtn');
const missionBtn = document.querySelector('#missionBtn');
const playBtn = document.querySelector('#playBtn');
const resumeBtn = document.querySelector('#resumeBtn');
const restartMenuBtn = document.querySelector('#restartMenuBtn');
const mainMenuBtn = document.querySelector('#mainMenuBtn');
const gameMenu = document.querySelector('#gameMenu');
const launchPanel = document.querySelector('#launchPanel');
const pausePanel = document.querySelector('#pausePanel');
const statusEl = document.querySelector('#status');
const controllerState = document.querySelector('#controllerState');

const audio = new AudioSystem();
const game = {
  mode: 'start', time: 0, cam: 0,
  level: makeLevel(Date.now() & 99999),
  player: new Player(), cat: new Cat(), crumbs: [], honks: [], particles: [],
  remotes: [], profile: gooseOnline.profile,
  onlineSubmitted: true
};
game.player.profile = game.profile;

bindTouchControls();
wireMenus();
wirePointerControls();
showMenu('launch');

function wireMenus() {
  startBtn?.addEventListener('click', restart);
  playBtn?.addEventListener('click', restart);
  resumeBtn?.addEventListener('click', resumeGame);
  restartMenuBtn?.addEventListener('click', restart);
  mainMenuBtn?.addEventListener('click', returnToLaunchBay);
  missionBtn?.addEventListener('click', togglePause);
  muteBtn?.addEventListener('click', () => {
    muteBtn.textContent = `Music: ${audio.toggle() ? 'On' : 'Off'}`;
  });

  for (const button of document.querySelectorAll('[data-goose-color]')) {
    const choose = () => {
      game.profile = gooseOnline.setProfile({
        color: button.dataset.gooseColor,
        accent: button.dataset.gooseAccent || '#facc15'
      });
      game.player.profile = game.profile;
      for (const option of document.querySelectorAll('[data-goose-color]')) option.classList.remove('selected');
      button.classList.add('selected');
    };
    button.addEventListener('click', choose);
    if (button.dataset.gooseColor === game.profile.color) button.classList.add('selected');
  }
}

function wirePointerControls() {
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (game.mode !== 'play') return;
    const rect = canvas.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width + game.cam;
    game.player.facing = pointerX < game.player.x ? -1 : 1;
    controls.trigger(event.button === 2 ? 'honk' : 'crumb');
    event.preventDefault();
  });
}

function restart() {
  if (game.mode === 'play' && !game.onlineSubmitted) submitRun(false);
  game.mode = 'play'; game.time = 0; game.cam = 0;
  game.level = makeLevel(Date.now() & 99999);
  game.player = new Player();
  game.player.profile = game.profile;
  game.cat = new Cat(); game.crumbs = []; game.honks = [];
  game.onlineSubmitted = false;
  audio.ensure();
  gooseOnline.startRun();
  showMenu('hidden');
  statusEl.textContent = 'Goose deployed. Flock link active.';
}

function submitRun(completed) {
  if (game.onlineSubmitted) return;
  game.onlineSubmitted = true;
  gooseOnline.finishRun(game.player.score, completed);
}

function togglePause() {
  if (game.mode === 'play') pauseGame();
  else if (game.mode === 'paused') resumeGame();
}

function pauseGame() {
  if (game.mode !== 'play') return;
  game.mode = 'paused';
  showMenu('pause');
  statusEl.textContent = 'Mission Control open.';
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  game.mode = 'play';
  showMenu('hidden');
  statusEl.textContent = 'Back to the flock.';
}

function returnToLaunchBay() {
  if (!game.onlineSubmitted) submitRun(false);
  game.mode = 'start';
  showMenu('launch');
  statusEl.textContent = 'Launch Bay ready.';
}

function showMenu(which) {
  if (!gameMenu) return;
  const hidden = which === 'hidden';
  gameMenu.classList.toggle('is-hidden', hidden);
  launchPanel?.classList.toggle('is-hidden', which !== 'launch');
  pausePanel?.classList.toggle('is-hidden', which !== 'pause');
}

let last = performance.now();
let lastControllerLabel = '';
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  controls.update();
  handleGlobalInput();
  if (game.mode === 'play') handleActionInput();
  update(dt);
  game.remotes = gooseOnline.tickRemotes(dt);
  gooseOnline.publishPlayer(game.player, game.mode);
  updateControllerLabel();
  drawWorld(ctx, game);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function handleGlobalInput() {
  if (controls.consume('pause')) togglePause();
  if (game.mode === 'start' && controls.consume('confirm')) restart();
}

function handleActionInput() {
  const player = game.player;
  if (controls.consume('jump')) {
    player.jump(audio);
    gooseOnline.action('jump', player);
  }
  if (controls.consume('dash')) {
    player.doDash(audio);
    gooseOnline.action('dash', player);
  }
  if (controls.consume('honk')) doHonk();
  if (controls.consume('crumb')) throwCrumb();
  if (controls.consume('stick')) gooseOnline.action('stick', player);
}

function doHonk() {
  const player = game.player;
  if (player.honkCd) return;
  player.honkCd = 1.2;
  game.honks.push({ x: player.x, y: player.y, dir: player.facing, life: .32 });
  gooseOnline.honk();
  gooseOnline.action('honk', player);
  audio.beep(230, .22, 'sawtooth', .07);
}

function throwCrumb() {
  const player = game.player;
  if (player.crumbCd || player.ammo <= 0) return;
  player.crumbCd = .18;
  player.ammo--;
  game.crumbs.push({ x: player.x + player.facing * 46, y: player.y - 70, vx: player.facing * 620, vy: -120, life: 1.1 });
  gooseOnline.action('crumb', player);
  audio.beep(820, .05, 'square', .045);
}

function updateControllerLabel() {
  if (!controllerState) return;
  const label = controls.controllerName ? 'Xbox / gamepad connected' : 'Keyboard · mouse · touch ready';
  if (label !== lastControllerLabel) {
    lastControllerLabel = label;
    controllerState.textContent = label;
  }
}

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
    if (controls.down('stick') && !player.stickCd && rectsOverlap(player.stickRect(), er)) {
      player.stickCd = .25; e.hp -= 2; player.score += 25; audio.beep(260,.08,'square',.065);
    }
    for (const h of game.honks) if (rectsOverlap({x:h.x + h.dir*20, y:h.y-115, w:220, h:125}, er)) { e.vx = h.dir * 4; e.hp -= 0.02; }
    if (e.hp <= 0) { e.dead = true; player.score += 100; }
  }

  if (player.x > level.endX - 1200) level.boss.active = true;
  const b = level.boss;
  if (b.active && !b.dead) {
    b.t += dt; b.x += Math.sin(b.t * 1.5) * 70 * dt; b.y = 560 + Math.sin(b.t * 2) * 18;
    const br = { x:b.x-80, y:b.y-145, w:160, h:115 };
    if (rectsOverlap(player.rect(), br)) player.hurt(audio);
    if (controls.down('stick') && !player.stickCd && rectsOverlap(player.stickRect(), br)) {
      player.stickCd = .28; b.hp -= 2; player.score += 40; audio.beep(180,.08,'sawtooth',.07);
    }
    for (const c of game.crumbs) if (!c.dead && rectsOverlap({x:c.x-10,y:c.y-7,w:20,h:14}, br)) { c.dead = true; b.hp--; player.score += 20; }
    for (const h of game.honks) if (rectsOverlap({x:h.x + h.dir*20, y:h.y-115, w:220,h:125}, br)) b.hp -= 0.03;
    if (b.hp <= 0) {
      b.dead = true;
      player.score += 1500;
      statusEl.textContent = 'Boss defeated. Cat approved. Score saved to the Goose Board!';
      submitRun(true);
    }
  }

  for (const c of game.crumbs) { c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 900 * dt; if (c.life <= 0) c.dead = true; }
  game.crumbs = game.crumbs.filter(c => !c.dead);
  for (const h of game.honks) h.life -= dt;
  game.honks = game.honks.filter(h => h.life > 0);

  audio.update(dt, player.hp <= 2, b.active && !b.dead);
  if (player.y > 980 || player.hp <= 0) {
    submitRun(false);
    game.mode = 'start';
    showMenu('launch');
    statusEl.textContent = 'Deedz got bonked. Score saved. Choose your goose and launch again.';
  }
}
