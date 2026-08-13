import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';

export class BootScene extends Scene {
  constructor() { super('boot'); }
  async enter(data) {
    await super.enter(data);
    this.screen = new Screen({ id: 'boot-loading', label: 'Deedz Engine loading' });
    this.screen.element.innerHTML = `<section class="deedz-panel"><div class="deedz-kicker">VERSION ${this.engine.config.engine.version}</div><h1 class="deedz-title">DEEDZ<br>ENGINE</h1><p class="deedz-subtitle">Powering up Goose Systems…</p><div class="deedz-progress" aria-label="Loading"><span></span></div></section>`;
    this.engine.ui.register(this.screen);
    this.engine.ui.show(this.screen.id);
    const bar = this.screen.element.querySelector('.deedz-progress span');
    const off = this.engine.events.on('assets:progress', ({ progress }) => { bar.style.width = `${Math.round(progress * 100)}%`; });
    await this.engine.assets.loadBundle('goose-core');
    bar.style.width = '100%';
    off();
    await new Promise((resolve) => setTimeout(resolve, 250));
    queueMicrotask(() => this.engine.scenes.change('main-menu'));
  }
  async exit() { this.engine.ui.remove(this.screen?.id); await super.exit(); }
}
