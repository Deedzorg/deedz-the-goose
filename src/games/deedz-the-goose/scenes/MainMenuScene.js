import { Graphics, Text } from 'pixi.js';
import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { characters } from '../data/characters.js';

export class MainMenuScene extends Scene {
  constructor() { super('main-menu'); }

  async enter(data) {
    await super.enter(data);
    const sky = new Graphics().rect(-2000, -1200, 4000, 2400).fill(0x0a1e36);
    const moon = new Graphics().circle(300, -160, 120).fill(0xfff3ba);
    const title = new Text({ text: 'HONK.', style: { fill: 0xffffff, fontSize: 92, fontWeight: '900' } });
    title.anchor.set(0.5);
    title.position.set(0, -40);
    this.root.addChild(sky, moon, title);
    this.engine.renderer.camera.setBounds(null).setPosition(0, 0, true).setZoom(1, true);

    this.screen = new Screen({ id: 'main-menu-ui', label: 'Deedz The Goose main menu' });
    const panel = document.createElement('section');
    panel.className = 'deedz-panel deedz-panel--wide';
    panel.innerHTML = `
      <div class="deedz-kicker">DEEDZ ENGINE ${this.engine.config.engine.version}</div>
      <h1 class="deedz-title">DEEDZ<br>THE GOOSE</h1>
      <p class="deedz-subtitle">A living shared-world adventure powered by Deedz Engine v1.6.1. Charged crumb throws, crouch-walking, adaptive Echo music, and automatic map recovery keep every layer flowing.</p>
      <label class="deedz-field">Goose name<input data-name maxlength="24" autocomplete="nickname"></label>
      <div class="deedz-section-title">Choose your goose</div>
      <div class="deedz-character-grid" data-characters></div>
      <div class="deedz-settings" data-settings></div>
      <div class="deedz-actions" data-actions></div>
      <p class="deedz-help">Press Pause during play to open Mission Control, view every control, and remap keyboard or controller buttons.</p>`;

    const nameInput = panel.querySelector('[data-name]');
    nameInput.value = this.engine.save.get('profile.name', 'Deedz');
    nameInput.addEventListener('change', () => this.#saveProfile(nameInput.value));

    const characterGrid = panel.querySelector('[data-characters]');
    this.characterButtons = [];
    for (const character of characters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deedz-character';
      button.dataset.character = character.id;
      button.innerHTML = `<span class="deedz-character__swatch" style="--goose-color:#${character.color.toString(16).padStart(6, '0')}"></span><strong>${character.name}</strong><small>${character.description}</small>`;
      button.addEventListener('click', () => { this.engine.save.set('profile.character', character.id); this.#refreshCharacterSelection(); });
      characterGrid.appendChild(button);
      this.characterButtons.push(button);
    }
    this.#refreshCharacterSelection();

    const settings = panel.querySelector('[data-settings]');
    settings.append(
      this.#toggle('Music', 'settings.music', true, (enabled) => this.engine.audio.setVolumes({ music: enabled ? this.engine.save.get('settings.musicVolume', 0.55) : 0 })),
      this.#toggle('Sound effects', 'settings.sfx', true, (enabled) => this.engine.audio.setVolumes({ sfx: enabled ? this.engine.save.get('settings.sfxVolume', 0.8) : 0 })),
      this.#toggle('Screen shake', 'settings.screenShake', true),
    );

    const evolution = this.engine.save.get('progress.evolution', { level: 1, xp: 0, bossWins: 0 });
    const progress = document.createElement('p');
    progress.className = 'deedz-help';
    progress.textContent = `Echo Layer ${evolution.level || 1} · ${evolution.xp || 0} XP · ${evolution.bossWins || 0} Breadstorm victories`;
    panel.querySelector('[data-settings]').after(progress);

    const actions = panel.querySelector('[data-actions]');
    const play = new Button({ label: 'Enter the Living Goose World', variant: 'primary', onClick: () => { this.#saveProfile(nameInput.value); this.engine.scenes.change('world'); } });
    const reset = new Button({ label: 'Reset Local Progress', variant: 'danger', onClick: () => { this.engine.save.reset(); nameInput.value = 'Deedz'; this.#refreshCharacterSelection(); this.engine.ui.toast('Local progress reset.', { type: 'warning' }); } });
    actions.append(play.element, reset.element);
    this.screen.element.appendChild(panel);
    this.engine.ui.register(this.screen);
    this.engine.ui.show(this.screen.id);
    play.focus();
    if (this.engine.save.get('settings.music', true)) this.engine.audio.music.playToneBed({ root: 82 });
  }

  #saveProfile(name) {
    const clean = String(name || 'Deedz').trim().slice(0, 24) || 'Deedz';
    this.engine.save.set('profile.name', clean);
    this.engine.network.setProfile({ name: clean, character: this.engine.save.get('profile.character', 'deedz') });
  }

  #refreshCharacterSelection() {
    const selected = this.engine.save.get('profile.character', 'deedz');
    for (const button of this.characterButtons ?? []) button.setAttribute('aria-pressed', String(button.dataset.character === selected));
  }

  #toggle(label, path, fallback, onChange = null) {
    const wrapper = document.createElement('label');
    wrapper.className = 'deedz-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.engine.save.get(path, fallback);
    const text = document.createElement('span');
    text.textContent = label;
    input.addEventListener('change', () => { this.engine.save.set(path, input.checked); onChange?.(input.checked); });
    wrapper.append(input, text);
    return wrapper;
  }

  async exit() { this.engine.ui.remove(this.screen?.id); await super.exit(); }
}
