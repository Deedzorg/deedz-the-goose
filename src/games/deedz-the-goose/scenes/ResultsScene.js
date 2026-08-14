import { Graphics, Text } from 'pixi.js';
import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { NetEvents } from '../../../engine/networking/NetEvents.js';

function formatTime(milliseconds) {
  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2).padStart(5, '0');
  return `${minutes}:${seconds}`;
}

export class ResultsScene extends Scene {
  constructor() { super('results'); }
  async enter(data = {}) {
    await super.enter(data);
    const background = new Graphics().rect(-2000, -1200, 4000, 2400).fill(0x08182a);
    const title = new Text({ text: 'MISSION COMPLETE', style: { fill: 0xffd95a, fontSize: 70, fontWeight: '900' } });
    title.anchor.set(0.5);
    this.root.addChild(background, title);
    this.engine.renderer.camera.setBounds(null).setPosition(0, 0, true);

    const score = Math.max(0, Math.round(100000 - (data.elapsedMs ?? 0) * 2 + (data.crumbs ?? 0) * 250 + (data.enemies ?? 0) * 700));
    this.engine.network.send(NetEvents.LEADERBOARD_SUBMIT, {
      name: this.engine.save.get('profile.name', 'Deedz'),
      character: this.engine.save.get('profile.character', 'deedz'),
      score,
    });

    this.screen = new Screen({ id: 'results-ui', label: 'Mission results' });
    const panel = document.createElement('section');
    panel.className = 'deedz-panel';
    panel.innerHTML = `
      <div class="deedz-kicker">GOOSE GREEN SECURED</div>
      <h1 class="deedz-title">MISSION<br>COMPLETE</h1>
      <div class="deedz-results">
        <div><span>Time</span><strong>${formatTime(data.elapsedMs ?? 0)}${data.isBest ? ' · NEW BEST' : ''}</strong></div>
        <div><span>Total crumbs</span><strong>${data.crumbs ?? 0}</strong></div>
        <div><span>Enemies defeated</span><strong>${data.enemies ?? 0}</strong></div>
        <div><span>Mission score</span><strong>${score.toLocaleString()}</strong></div>
      </div>
      <div class="deedz-actions"></div>`;
    const actions = panel.querySelector('.deedz-actions');
    const replay = new Button({ label: 'Replay Mission', variant: 'primary', onClick: () => this.engine.scenes.change('world') });
    const menu = new Button({ label: 'Main Menu', onClick: () => this.engine.scenes.change('main-menu') });
    actions.append(replay.element, menu.element);
    this.screen.element.appendChild(panel);
    this.engine.ui.register(this.screen);
    this.engine.ui.show(this.screen.id);
    replay.focus();
  }
  async exit() { this.engine.ui.remove(this.screen?.id); await super.exit(); }
}
