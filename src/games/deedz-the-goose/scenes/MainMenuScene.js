import { Graphics, Text } from 'pixi.js';
import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { gooseClasses, gooseColors, networkCharacterId, setActiveGooseColor } from '../data/characters.js';
import { createMenuRepeatState, menuRepeatDirection, menuSelectPressed, menuStartPressed } from '../data/menuNavigation.js';

function pips(value = 3) {
  const count = Math.max(1, Math.min(5, Number(value) || 1));
  return `${'●'.repeat(count)}${'○'.repeat(5 - count)}`;
}

function isVisible(element) {
  return Boolean(element && !element.disabled && !element.hidden && element.getClientRects?.().length);
}

export class MainMenuScene extends Scene {
  constructor() {
    super('main-menu');
    this.unsubscribers = [];
    this.menuRepeat = createMenuRepeatState();
  }

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
    panel.className = 'deedz-panel deedz-panel--wide deedz-launch-panel';
    panel.innerHTML = `
      <div class="deedz-launch-heading">
        <div>
          <div class="deedz-kicker">DEEDZ ENGINE ${this.engine.config.engine.version}</div>
          <h1 class="deedz-title">DEEDZ<br>THE GOOSE</h1>
        </div>
        <div class="deedz-controller-pill" data-controller-status>Keyboard ready · connect a controller anytime</div>
      </div>
      <p class="deedz-subtitle">Pick a play style, choose your goose color, and enter the living shared world.</p>
      <p class="deedz-menu-hint">Controller: ↑/↓ moves through sections · ←/→ moves within a choice row · A selects · Menu starts</p>

      <label class="deedz-field deedz-name-field">Goose name<input data-name maxlength="24" autocomplete="nickname"></label>

      <div class="deedz-section-title">1 · Play Style</div>
      <div class="deedz-loadout-grid">
        <div class="deedz-class-list" data-classes></div>
        <aside class="deedz-class-detail" data-class-detail aria-live="polite"></aside>
      </div>

      <div class="deedz-section-title">2 · Goose Color <span class="deedz-section-note">Cosmetic only — no stat changes</span></div>
      <div class="deedz-color-grid" data-colors></div>

      <div class="deedz-selection-summary" data-selection-summary></div>
      <div class="deedz-settings deedz-launch-settings" data-settings></div>
      <div class="deedz-progress-line" data-progress></div>
      <div class="deedz-actions deedz-launch-actions" data-actions></div>`;

    const savedClass = this.engine.save.get('profile.character', 'classic');
    if (!gooseClasses.some((item) => item.id === savedClass)) this.engine.save.set('profile.character', 'classic');
    const savedColor = this.engine.save.get('profile.color', 'snow');
    if (!gooseColors.some((item) => item.id === savedColor)) this.engine.save.set('profile.color', 'snow');
    setActiveGooseColor(this.engine.save.get('profile.color', 'snow'));

    const nameInput = panel.querySelector('[data-name]');
    nameInput.value = this.engine.save.get('profile.name', 'Deedz');
    nameInput.addEventListener('change', () => this.#saveProfile(nameInput.value));

    const classList = panel.querySelector('[data-classes]');
    this.characterButtons = [];
    for (const character of gooseClasses) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deedz-class-card';
      button.dataset.character = character.id;
      button.innerHTML = `
        <span class="deedz-class-card__mark" style="--class-color:#${character.themeColor.toString(16).padStart(6, '0')}"></span>
        <span><strong>${character.name}</strong><small>${character.ability}</small></span>`;
      button.addEventListener('click', () => {
        this.engine.save.set('profile.character', character.id);
        this.#refreshSelection();
        this.#saveProfile(nameInput.value);
      });
      classList.appendChild(button);
      this.characterButtons.push(button);
    }

    const colorGrid = panel.querySelector('[data-colors]');
    this.colorButtons = [];
    for (const color of gooseColors) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deedz-color-choice';
      button.dataset.color = color.id;
      button.setAttribute('aria-label', `${color.name} goose color`);
      button.innerHTML = `<span class="deedz-color-choice__swatch" style="--goose-color:#${color.color.toString(16).padStart(6, '0')}"></span><span>${color.name}</span>`;
      button.addEventListener('click', () => {
        this.engine.save.set('profile.color', color.id);
        setActiveGooseColor(color.id);
        this.#refreshSelection();
        this.#saveProfile(nameInput.value);
      });
      colorGrid.appendChild(button);
      this.colorButtons.push(button);
    }

    const settings = panel.querySelector('[data-settings]');
    settings.append(
      this.#toggle('Music', 'settings.music', true, (enabled) => this.engine.audio.setVolumes({ music: enabled ? this.engine.save.get('settings.musicVolume', 0.55) : 0 })),
      this.#toggle('Sound effects', 'settings.sfx', true, (enabled) => this.engine.audio.setVolumes({ sfx: enabled ? this.engine.save.get('settings.sfxVolume', 0.8) : 0 })),
      this.#toggle('Screen shake', 'settings.screenShake', true),
    );

    const evolution = this.engine.save.get('progress.evolution', { level: 1, xp: 0, bossWins: 0 });
    panel.querySelector('[data-progress]').textContent =
      `Echo Layer ${evolution.level || 1} · ${evolution.xp || 0} XP · ${evolution.bossWins || 0} Breadstorm victories`;

    const actions = panel.querySelector('[data-actions]');
    this.play = new Button({
      label: 'Start Adventure',
      variant: 'primary',
      onClick: () => {
        this.#saveProfile(nameInput.value);
        if (!this.engine.scenes.transitioning) this.engine.scenes.change('world');
      },
    });
    const reset = new Button({
      label: 'Reset Local Progress',
      variant: 'danger',
      onClick: () => {
        this.engine.save.reset();
        nameInput.value = 'Deedz';
        setActiveGooseColor('snow');
        this.#refreshSelection();
        this.engine.ui.toast('Local progress reset.', { type: 'warning' });
      },
    });
    actions.append(this.play.element, reset.element);

    this.panel = panel;
    this.classDetail = panel.querySelector('[data-class-detail]');
    this.selectionSummary = panel.querySelector('[data-selection-summary]');
    this.controllerStatus = panel.querySelector('[data-controller-status]');
    this.screen.element.appendChild(panel);
    this.engine.ui.register(this.screen);
    this.engine.ui.show(this.screen.id);
    this.#refreshSelection();
    this.#refreshControllerStatus(this.engine.input.gamepad.info);
    this.play.focus();

    this.unsubscribers.push(
      this.engine.events.on('gamepad:connected', (info) => this.#refreshControllerStatus(info)),
      this.engine.events.on('gamepad:disconnected', () => this.#refreshControllerStatus(null)),
    );

    if (this.engine.save.get('settings.music', true)) this.engine.audio.music.playToneBed({ root: 82 });
  }

  #selectedClass() {
    const id = this.engine.save.get('profile.character', 'classic');
    return gooseClasses.find((item) => item.id === id) ?? gooseClasses[0];
  }

  #selectedColor() {
    const id = this.engine.save.get('profile.color', 'snow');
    return gooseColors.find((item) => item.id === id) ?? gooseColors[0];
  }

  #refreshSelection() {
    const character = this.#selectedClass();
    const color = this.#selectedColor();
    setActiveGooseColor(color.id);

    for (const button of this.characterButtons ?? []) button.setAttribute('aria-pressed', String(button.dataset.character === character.id));
    for (const button of this.colorButtons ?? []) button.setAttribute('aria-pressed', String(button.dataset.color === color.id));

    const ratings = character.ratings ?? {};
    if (this.classDetail) {
      this.classDetail.innerHTML = `
        <div class="deedz-class-detail__header">
          <span class="deedz-class-preview" style="--goose-color:#${color.color.toString(16).padStart(6, '0')};--goose-accent:#${color.accent.toString(16).padStart(6, '0')}"></span>
          <div><strong>${character.name}</strong><span>${character.ability}</span></div>
        </div>
        <p>${character.description}</p>
        <div class="deedz-tradeoff"><strong>Tradeoff:</strong> ${character.tradeoff}</div>
        <div class="deedz-stat-list">
          ${this.#stat('Health', ratings.health)}
          ${this.#stat('Speed', ratings.speed)}
          ${this.#stat('Honk', ratings.honk)}
          ${this.#stat('Throw', ratings.throw)}
          ${this.#stat('Air', ratings.flight)}
        </div>`;
    }
    if (this.selectionSummary) {
      this.selectionSummary.innerHTML = `<span>Ready:</span><strong>${character.name}</strong><span>·</span><strong>${color.name}</strong><span>color</span>`;
    }
  }

  #stat(label, value) {
    return `<div class="deedz-stat"><span>${label}</span><strong aria-label="${value} of 5">${pips(value)}</strong></div>`;
  }

  #saveProfile(name) {
    const clean = String(name || 'Deedz').trim().slice(0, 24) || 'Deedz';
    const classId = this.engine.save.get('profile.character', 'classic');
    const colorId = this.engine.save.get('profile.color', 'snow');
    this.engine.save.set('profile.name', clean);
    this.engine.network.setProfile({ name: clean, character: networkCharacterId(classId, colorId) });
  }

  #toggle(label, path, fallback, onChange = null) {
    const wrapper = document.createElement('label');
    wrapper.className = 'deedz-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.engine.save.get(path, fallback);
    const text = document.createElement('span');
    text.textContent = label;
    input.addEventListener('change', () => {
      this.engine.save.set(path, input.checked);
      onChange?.(input.checked);
    });
    wrapper.append(input, text);
    return wrapper;
  }

  #focusables() {
    return [...(this.panel?.querySelectorAll('button:not(:disabled), input:not(:disabled)') ?? [])].filter(isVisible);
  }

  #focus(element) {
    if (!element) return false;
    element.focus();
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  #moveFocus(direction) {
    const items = this.#focusables();
    if (!items.length) return;
    const current = document.activeElement;
    const index = items.indexOf(current);
    const start = index >= 0 ? index : (direction > 0 ? -1 : 0);
    this.#focus(items[(start + direction + items.length) % items.length]);
  }

  #moveWithinChoices(direction) {
    const active = document.activeElement;
    const groups = [this.characterButtons ?? [], this.colorButtons ?? []];
    for (const group of groups) {
      const index = group.indexOf(active);
      if (index < 0 || !group.length) continue;
      const next = (index + direction + group.length) % group.length;
      this.#focus(group[next]);
      return true;
    }
    if (active?.tagName === 'INPUT' && active.type === 'checkbox') {
      const next = direction > 0;
      if (active.checked !== next) {
        active.checked = next;
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    const actions = [...(this.panel?.querySelectorAll('[data-actions] button:not(:disabled)') ?? [])].filter(isVisible);
    const actionIndex = actions.indexOf(active);
    if (actionIndex >= 0 && actions.length > 1) {
      const next = (actionIndex + direction + actions.length) % actions.length;
      this.#focus(actions[next]);
      return true;
    }
    return false;
  }

  #activateFocused() {
    const active = document.activeElement;
    if (!active || !this.panel?.contains(active)) return;
    if (active.tagName === 'BUTTON') active.click();
    else if (active.tagName === 'INPUT' && ['checkbox', 'radio'].includes(active.type)) active.click();
  }

  #refreshControllerStatus(info) {
    if (!this.controllerStatus) return;
    if (!info?.id) {
      this.controllerStatus.textContent = 'Keyboard ready · connect a controller anytime';
      this.controllerStatus.classList.remove('is-connected');
      return;
    }
    const short = String(info.id).replace(/\s+\(.*?\)\s*/g, ' ').trim().slice(0, 52);
    this.controllerStatus.textContent = `Controller connected · ${short}`;
    this.controllerStatus.classList.add('is-connected');
  }

  update() {
    const input = this.engine.input;
    if (menuStartPressed(input)) {
      this.play?.element.click();
      return;
    }
    if (menuSelectPressed(input)) {
      this.#activateFocused();
      return;
    }
    const direction = menuRepeatDirection(input, this.menuRepeat);
    if (direction === 'up') {
      this.#moveFocus(-1);
      return;
    }
    if (direction === 'down') {
      this.#moveFocus(1);
      return;
    }
    if (direction === 'left') {
      this.#moveWithinChoices(-1);
      return;
    }
    if (direction === 'right') this.#moveWithinChoices(1);
  }

  async exit() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.engine.ui.remove(this.screen?.id);
    await super.exit();
  }
}
