export function drawWorld(ctx, game) {
  const { cam, level, player, cat, crumbs, honks, remotes = [], profile } = game;
  ctx.clearRect(0, 0, 1280, 720);

  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(0.55, '#bae6fd'); sky.addColorStop(1, '#fef3c7');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1280, 720);

  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.18 + i * 0.015})`;
    ctx.beginPath(); ctx.arc((i * 230 - cam * 0.15) % 1600 - 100, 80 + (i % 3) * 52, 32 + (i % 2) * 18, 0, Math.PI * 2); ctx.fill();
  }

  for (const p of level.props) drawProp(ctx, p, cam);
  for (const p of [...level.platforms, ...level.moving]) drawPlatform(ctx, p, cam);
  for (const s of level.springs) drawSpring(ctx, s, cam);
  for (const c of level.coins) if (!c.taken) drawCoin(ctx, c, cam, game.time);
  for (const p of level.powerups) if (!p.taken) drawPower(ctx, p, cam, game.time);
  for (const e of level.enemies) if (!e.dead) drawEnemy(ctx, e, cam, game.time);
  if (level.boss.active && !level.boss.dead) drawBoss(ctx, level.boss, cam, game.time);
  for (const c of crumbs) drawCrumb(ctx, c, cam);
  for (const h of honks) drawHonk(ctx, h, cam);
  drawCat(ctx, cat, cam, game.time);

  for (const remote of remotes) {
    if (remote.mode === 'start') continue;
    drawRemoteAction(ctx, remote, cam);
    drawGoose(ctx, remote, cam, game.time, remote.profile, true);
  }

  drawGoose(ctx, player, cam, game.time, profile || player.profile, false);
  drawHud(ctx, game);
}

function drawPlatform(ctx, p, cam) {
  const x = p.x - cam;
  ctx.fillStyle = p.type === 'stone' ? '#78716c' : p.type === 'boss' ? '#7c2d12' : '#166534';
  roundRect(ctx, x, p.y, p.w, p.h, 12, true);
  ctx.fillStyle = p.type === 'stone' ? '#a8a29e' : '#22c55e';
  roundRect(ctx, x, p.y, p.w, 22, 12, true);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  for (let i = 20; i < p.w; i += 64) ctx.fillRect(x + i, p.y + 34 + (i % 3) * 12, 28, 8);
}
function drawSpring(ctx, s, cam) { const x = s.x - cam; ctx.fillStyle = '#ef4444'; roundRect(ctx, x, s.y, s.w, s.h, 6, true); ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x+6,s.y+15); for(let i=0;i<5;i++) ctx.lineTo(x+10+i*7,s.y+3+(i%2)*12); ctx.stroke(); }
function drawCoin(ctx, c, cam, t) { const x = c.x - cam; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(x, c.y, 12 + Math.sin(t*7+c.x)*5, 17, 0, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#92400e'; ctx.stroke(); }
function drawPower(ctx, p, cam, t) { const x = p.x - cam, y = p.y + Math.sin(t*5)*5; ctx.fillStyle = p.type === 'feather' ? '#cffafe' : '#22c55e'; roundRect(ctx, x-14, y-26, 28, 52, 8, true); ctx.fillStyle = '#fde047'; ctx.fillRect(x-10, y-8, 20, 15); }
function drawProp(ctx, p, cam) { const x = p.x - cam; if (p.type === 'sign') { ctx.fillStyle='#78350f'; ctx.fillRect(x,p.y-58,8,58); ctx.fillStyle='#fbbf24'; roundRect(ctx,x-34,p.y-82,76,30,6,true); ctx.fillStyle='#111827'; ctx.fillText('HONK',x-23,p.y-62);} else if (p.type === 'mushroom') { ctx.fillStyle='#f87171'; ctx.beginPath(); ctx.arc(x,p.y-18,24,Math.PI,0); ctx.fill(); ctx.fillStyle='#fef3c7'; ctx.fillRect(x-9,p.y-18,18,18);} else if (p.type === 'crate') {ctx.fillStyle='#92400e'; roundRect(ctx,x-18,p.y-38,36,36,4,true); ctx.strokeStyle='#fbbf24'; ctx.strokeRect(x-14,p.y-34,28,28);} else if (p.type === 'dish') {ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(x,p.y-30,28,.2,2.8); ctx.stroke();} else {ctx.fillStyle='#111827'; ctx.fillRect(x,p.y-78,7,78); ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.moveTo(x+7,p.y-78); ctx.lineTo(x+58,p.y-62); ctx.lineTo(x+7,p.y-48); ctx.fill();} }
function drawEnemy(ctx, e, cam) { const x=e.x-cam; ctx.fillStyle=e.type==='crow'?'#111827':e.type==='raccoon'?'#78716c':'#ea580c'; ctx.beginPath(); ctx.ellipse(x,e.y-22,34,24,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+22,e.y-38,20,0,Math.PI*2); ctx.fill(); ctx.fillStyle='white'; ctx.fillRect(x+18,e.y-43,6,6); ctx.fillStyle='black'; ctx.fillRect(x+21,e.y-41,3,3); }
function drawBoss(ctx, b, cam) { const x=b.x-cam; ctx.fillStyle='#9a3412'; ctx.beginPath(); ctx.ellipse(x,b.y-76,90,62,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#7f1d1d'; roundRect(ctx,x-48,b.y-104,96,40,14,true); ctx.fillStyle='white'; ctx.fillRect(x-36,b.y-126,13,13); ctx.fillRect(x-5,b.y-126,13,13); ctx.fillStyle='black'; ctx.fillRect(x-32,b.y-122,5,5); ctx.fillRect(x-1,b.y-122,5,5); ctx.fillStyle='#111827'; ctx.fillRect(380,28,520,18); ctx.fillStyle='#ef4444'; ctx.fillRect(380,28,520*(b.hp/b.maxHp),18); }
function drawCrumb(ctx,c,cam){ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.ellipse(c.x-cam,c.y,10,7,0,0,Math.PI*2);ctx.fill();}
function drawHonk(ctx,h,cam){ctx.strokeStyle='rgba(250,204,21,.72)';ctx.lineWidth=5;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(h.x-cam+h.dir*(50+i*30),h.y-62,34+i*20,-.7,.7);ctx.stroke();}}
function drawCat(ctx, cat, cam) { const x=cat.x-cam,y=cat.y; ctx.fillStyle='#020617'; ctx.beginPath(); ctx.ellipse(x,y-22,30,17,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+24,y-31,16,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#86efac'; ctx.fillRect(x+19,y-34,5,5); ctx.fillRect(x+31,y-34,5,5); }

function drawGoose(ctx, p, cam, t, profile = {}, remote = false) {
  const x=p.x-cam, y=p.y;
  if(!remote && p.inv && Math.floor(t*20)%2===0)return;
  const bodyColor = profile?.color || '#dc2626';
  const accent = profile?.accent || '#facc15';
  ctx.save();
  if (remote) ctx.globalAlpha = 0.88;
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x,y+4,42,10,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f8fafc'; ctx.beginPath(); ctx.ellipse(x,y-52,38,48,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=bodyColor; roundRect(ctx,x-33,y-82,66,56,16,true);
  ctx.fillStyle='#f8fafc'; ctx.beginPath(); ctx.arc(x+18*p.facing,y-108,32,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.moveTo(x+40*p.facing,y-108); ctx.lineTo(x+82*p.facing,y-98); ctx.lineTo(x+40*p.facing,y-86); ctx.fill();
  ctx.fillStyle='black'; ctx.beginPath(); ctx.arc(x+26*p.facing,y-116,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=accent; ctx.fillRect(x-20,y-72,40,8);
  ctx.fillStyle='#111827'; ctx.fillRect(x-27,y-18,22,10); ctx.fillRect(x+8,y-18,22,10);
  if (remote) {
    ctx.globalAlpha = 1;
    ctx.font='bold 16px system-ui';
    ctx.textAlign='center';
    ctx.fillStyle='rgba(15,23,42,.78)';
    roundRect(ctx,x-58,y-162,116,28,10,true);
    ctx.fillStyle='#fff';
    ctx.fillText(profile?.name || 'Goose', x, y-143);
    ctx.textAlign='start';
  }
  ctx.restore();
}

function drawRemoteAction(ctx, remote, cam) {
  if (!remote.action) return;
  if (remote.action === 'honk') {
    drawHonk(ctx, { x: remote.x, y: remote.y, dir: remote.facing }, cam);
    return;
  }
  const x = remote.x - cam, y = remote.y;
  if (remote.action === 'stick') {
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + remote.facing * 20, y - 60); ctx.lineTo(x + remote.facing * 92, y - 45); ctx.stroke();
  } else if (remote.action === 'crumb') {
    ctx.fillStyle='#fbbf24'; ctx.beginPath(); ctx.ellipse(x + remote.facing * 75, y - 70, 10, 7, 0, 0, Math.PI*2); ctx.fill();
  } else if (remote.action === 'dash') {
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=4;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-remote.facing*(40+i*18),y-65+i*16);ctx.lineTo(x-remote.facing*(95+i*22),y-65+i*16);ctx.stroke();}
  }
}

function drawHud(ctx, g) {
  ctx.fillStyle='rgba(15,23,42,.72)'; roundRect(ctx,18,18,340,104,14,true);
  ctx.fillStyle='white'; ctx.font='22px system-ui';
  ctx.fillText(`HP: ${g.player.hp}   Score: ${g.player.score}`,34,54);
  ctx.fillText(`Ammo: ${g.player.ammo}   Jumps: ${g.player.maxJumps}`,34,86);
  ctx.fillStyle='#86efac'; ctx.font='14px system-ui';
  ctx.fillText(`Flock: ${(g.remotes?.length || 0) + 1} visible`,34,108);
}
function roundRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r); if(fill)ctx.fill(); else ctx.stroke();}
