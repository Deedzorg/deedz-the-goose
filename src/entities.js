export const keys = new Set();
addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));

export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Player {
  constructor() { this.reset(); }
  reset() {
    this.x = 120; this.y = 500; this.vx = 0; this.vy = 0; this.w = 42; this.h = 88;
    this.facing = 1; this.grounded = false; this.jumps = 0; this.maxJumps = 2; this.hp = 6; this.score = 0;
    this.dash = 0; this.dashCd = 0; this.honkCd = 0; this.stickCd = 0; this.crumbCd = 0; this.inv = 0;
    this.triple = false; this.ammo = 40; this.state = 'idle';
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  stickRect() { return { x: this.x + (this.facing > 0 ? 12 : -96), y: this.y - 78, w: 84, h: 44 }; }
  update(dt, solids, audio) {
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    if (move) this.facing = Math.sign(move);
    this.dashCd = Math.max(0, this.dashCd - dt); this.honkCd = Math.max(0, this.honkCd - dt);
    this.stickCd = Math.max(0, this.stickCd - dt); this.crumbCd = Math.max(0, this.crumbCd - dt); this.inv = Math.max(0, this.inv - dt);

    if (this.dash > 0) { this.dash -= dt; this.vx = this.facing * 760; }
    else this.vx += (move * 360 - this.vx) * (this.grounded ? 0.18 : 0.09);
    this.vy += 1850 * dt;
    this.vy = Math.min(this.vy, 980);

    this.x += this.vx * dt;
    let r = this.rect();
    for (const s of solids) if (rectsOverlap(r, s)) {
      if (this.vx > 0) this.x = s.x - this.w / 2;
      if (this.vx < 0) this.x = s.x + s.w + this.w / 2;
      this.vx = 0; r = this.rect();
    }

    this.y += this.vy * dt;
    this.grounded = false;
    r = this.rect();
    for (const s of solids) if (rectsOverlap(r, s)) {
      if (this.vy > 0) { this.y = s.y; this.vy = 0; this.grounded = true; this.jumps = 0; }
      else if (this.vy < 0) { this.y = s.y + s.h + this.h; this.vy = 0; }
      r = this.rect();
    }
    this.state = !this.grounded ? 'jump' : Math.abs(this.vx) > 30 ? 'run' : 'idle';
  }
  jump(audio) { if (this.grounded || this.jumps < this.maxJumps) { this.vy = this.jumps === 0 ? -760 : -650; this.grounded = false; this.jumps++; audio.beep(520 + this.jumps * 120, 0.08, 'triangle', 0.055); } }
  doDash(audio) { if (!this.dashCd) { this.dash = 0.15; this.dashCd = 0.55; audio.beep(120, 0.08, 'sawtooth', 0.07); } }
  hurt(audio) { if (this.inv) return; this.hp--; this.inv = 1.1; this.vy = -420; this.vx = -this.facing * 260; audio.beep(130, 0.16, 'sawtooth', 0.08); }
}

export class Cat {
  constructor() { this.x = 40; this.y = 520; this.t = 0; }
  update(dt, player, coins) {
    this.t += dt;
    this.x += ((player.x - player.facing * 90) - this.x) * 0.08;
    this.y += (player.y - this.y) * 0.08;
    for (const c of coins) if (!c.taken && Math.hypot(c.x - this.x, c.y - this.y) < 58) { c.taken = true; player.score += 10; player.ammo++; }
  }
}
