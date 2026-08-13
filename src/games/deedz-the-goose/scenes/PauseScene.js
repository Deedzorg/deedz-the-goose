import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { ControlsSettingsPanel } from '../ui/ControlsSettingsPanel.js';
import { menuBackPressed, menuDirection, menuSelectPressed, menuStartPressed } from '../data/menuNavigation.js';

export const PAUSE_TABS = Object.freeze([
  { id: 'mission', label: 'Mission' },
  { id: 'controls', label: 'Controls' },
  { id: 'settings', label: 'Settings' },
]);

function isVisible(element) {
  return Boolean(element && !element.disabled && !element.hidden && element.getClientRects?.().length);
}

export class PauseScene extends Scene {
  constructor() {
    super('pause', { blocksWorld: true, transparent: true });
    this.activeTab = 'mission';
  }

  async enter(data) {
    await super.enter(data);
    this.screen = new Screen({ id: 'pause-ui', modal: true, label: 'Paused game mission control' });
    const panel = document.createElement('section');
    panel.className = 'deedz-panel deedz-panel--mission';
    panel.innerHTML = `
      <div class="deedz-kicker">MISSION CONTROL</div>
      <h1 class="deedz-title deedz-title--compact">PAUSED</h1>
      <p class="deedz-menu-hint">Controller: D-pad / left stick moves · A selects · B goes back · Menu resumes</p>
      <div class="deedz-tabs" role="tablist" aria-label="Pause menu sections" data-tabs></div>
      <div class="dedz-tab-panels">
        <section class="dedz-tab-panel" role="tabpanel" data-tab-panel="mission">
          <p class="dedz-subtitle">Rest your wings, restart from the beginning, or return to the main menu.</p>
          <div class="dedz-pause-summary">
            <strong>Adventure continues when you resume.</strong>
            <span>Left / right changes tabs. Up / down moves through controls. A selects.</span>
          </div>
          <div class="deedz-actions deedz-actions--horizontal" data-actions></div>
        </section>
        <section class="dedz-tab-panel" role="tabpanel" data-tab-panel="controls" hidden></section>
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="settings" hidden></section>
      </div>`;

    const actions = panel.querySelector('[data-actions]');
    this.resume = new Button({ label: 'Resume', variant: 'primary', onClick: () => this.engine.scenes.pop() });
    this.restart = new Button({ label: 'Restart Mission', onClick: () => this.#leavePause('world', { restartMission: true }) });
    this.menu = new Button({ label: 'Main Menu', onClick: () => this.#leavePause('main-menu', { fromPause: true }) });
    actions.append(this.resume.element, this.restart.element, this.menu.element);

    this.controls = new ControlsSettingsPanel(this.engine);
    panel.querySelector('[data-tab-panel="controls"]').appendChild(this.controls.controlsElement);
    panel.querySelector('[data-tab-panel="settings"]').appendChild(this.controls.settingsElement);

    this.tabButtons = new Map();
    const tabList = panel.querySelector('[data-tabs]');
    for (const tab of PAUSE_TABS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deedz-tab';
      button.textContent = tab.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab.id === this.activeTab));
      button.tabIndex = tab.id === this.activeTab ? 0 : -1;
      button.addEventListener('click', () => this.#selectTab(tab.id, panel));
      button.addEventListener('keydown', (event) => this.#navigateTabs(event, tab.id, panel));
      tabList.appendChild(button);
      this.tabButtons.set(tab.id, button);
    }

    this.panel = panel;
    this.screen.element.appendChild(panel);
    this.engine.ui.register(this.screen);
    this.engine.ui.show(this.screen.id);
    this.resume.focus();
  }

  async #leavePause(sceneId, data = {}) {
    if (this.leaving || this.engine.scenes.transitioning) return;
    this.leaving = true;
    this.resume?.setDisabled(true);
    this.restart?.setDisabled(true);
    this.menu?.setDisabled(true);
    this.engine.input.setEnabled(false);
    try {
      await this.engine.scenes.change(sceneId, data);
    } catch (error) {
      this.leaving = false;
      this.engine.input.setEnabled(true);
      this.engine.ui.toast(`Scene transition failed: ${error?.message ?? 'unknown error'}`, { type: 'danger' });
    }
  }

  #selectTab(id, panel = this.panel) {
    if (!PAUSE_TABS.some((tab) => tab.id === id)) return;
    this.activeTab = id;
    for (const [tabId, button] of this.tabButtons) {
      const selected = tabId === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const content of panel.querySelectorAll('[data-tab-panel]')) content.hidden = content.dataset.tabPanel !== id;
    const focusTarget = id === 'mission' ? this.resume.element : this.#focusables(id)[0] ?? this.tabButtons.get(id);
    focusTarget?.focus();
  }

  #navigateTabs(event, currentId, panel) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) return;
    event.preventDefault();
    const index = PAUSE_TABS.findIndex((tab) => tab.id === currentId);
    const nextIndex = event.code === 'Home' ? 0 : event.code === 'End' ? PAUSE_TABS.length - 1 : (index + (event.code === 'ArrowRight' ? 1 : -1) + PAUSE_TABS.length) % PAUSE_TABS.length;
    const next = PAUSE_TABS[nextIndex];
    this.#selectTab(next.id, panel);
    this.tabButtons.get(next.id)?.focus();
  }

  #focusables(tabId = this.activeTab) {
    const panel = this.panel?.querySelector(`[data-tab-panel="${tabId}"]`);
    if (!panel || panel.hidden) return [];
    return [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(isVisible);
  }

  #moveFocus(direction) {
    const items = this.#focusables();
    if (!items.length) return;
    const current = document.activeElement;
    const index = Math.max(0, items.indexOf(current));
    const next = items[(index + direction + items.length) % items.length];
    next?.focus();
  }

  #changeTab(direction) {
    const index = PAUSE_TABS.findIndex((tab) => tab.id === this.activeTab);
    const next = PAUSE_TABS[(index + direction + PAUSE_TABS.length) % PAUSE_TABS.length];
    this.#selectTab(next.id);
  }

  #adjustFocused(direction) {
    const active = document.activeElement;
    if (active?.tagName === 'INPUT' && active.type === 'range') {
      const step = Number(active.step) || 0.05;
      const min = Number(active.min) || 0;
      const max = Number(active.max) || 1;
      active.value = String(Math.max(min, Math.min(max, Number(active.value) + step * direction)));
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (active?.tagName === 'SELECT') {
      const next = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + direction));
      if (next !== active.selectedIndex) {
        active.selectedIndex = next;
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    return false;
  }

  #activateFocused() {
    const active = document.activeElement;
    if (!active || !this.panel?.contains(active)) return;
    if (active.tagName === 'BUTTON') active.click();
    else if (active.tagName === 'INPUT' && ['checkbox', 'radio'].includes(active.type)) active.click();
    else if (active.tagName === 'SELECT') this.#adjustFocused(1);
  }

  update() {
    this.controls?.update();
    if (this.controls?.capture) return;

    const input = this.engine.input;
    if (menuStartPressed(input) || menuBackPressed(input)) {
      this.engine.scenes.pop();
      return;
    }
    if (menuSelectPressed(input)) {
      this.#activateFocused();
      return;
    }

    const direction = menuDirection(input);
    if (direction === 'left') {
      if (!this.#adjustFocused(-1)) this.#changeTab(-1);
      return;
    }
    if (direction === 'right') {
      if (!this.#adjustFocused(1)) this.#changeTab(1);
      return;
    }
    if (direction === 'up') {
      this.#moveFocus(-1);
      return;
    }
    if (direction === 'down') this.#moveFocus(1);
  }

  async exit() {
    this.controls?.destroy();
    this.engine.input.setEnabled(true);
    this.engine.ui.remove(this.screen?.id);
    await super.exit();
  }
}
