import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { ControlsSettingsPanel } from '../ui/ControlsSettingsPanel.js';
import { menuBackPressed, menuDirection, menuSelectPressed, menuStartPressed, menuTabDirection } from '../data/menuNavigation.js';

export const PAUSE_TABS = Object.freeze([
  { id: 'mission', label: 'Mission' },
  { id: 'controls', label: 'Controls' },
  { id: 'settings', label: 'Settings' },
  { id: 'records', label: 'Records' },
]);

function isVisible(element) {
  return Boolean(element && !element.disabled && !element.hidden && element.getClientRects?.().length);
}

function centerOf(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export class PauseScene extends Scene {
  constructor() {
    super('pause', { blocksWorld: true, transparent: true });
    this.activeTab = 'mission';
    this.leaving = false;
  }

  async enter(data) {
    await super.enter(data);
    this.screen = new Screen({ id: 'pause-ui', modal: true, label: 'Paused game mission control' });
    const panel = document.createElement('section');
    panel.className = 'deedz-panel deedz-panel--mission';
    panel.innerHTML = `
      <div class="deedz-kicker">MISSION CONTROL</div>
      <h1 class="deedz-title deedz-title--compact">PAUSED</h1>
      <p class="deedz-menu-hint">Controller: D-pad moves inside each page · LB/RB changes pages · A selects · B/Menu resumes</p>
      <div class="deedz-tabs" role="tablist" aria-label="Pause menu sections" data-tabs></div>
      <div class="deedz-tab-panels">
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="mission">
          <p class="deedz-subtitle">Check the next objective, continue the run, restart, or safely return to the title screen.</p>
          <div class="deedz-pause-summary">
            <strong>Adventure progress is saved locally.</strong>
            <span>Up/down moves through items. Left/right moves across rows and settings. LB/RB jumps between pages.</span>
          </div>
          <div class="deedz-actions deedz-actions--horizontal" data-actions></div>
        </section>
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="controls" hidden></section>
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="settings" hidden></section>
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="records" hidden>
          <p class="deedz-help">Flock records are loading…</p>
        </section>
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
      button.addEventListener('click', () => this.#selectTab(tab.id, { focus: 'content' }));
      button.addEventListener('keydown', (event) => this.#navigateTabs(event, tab.id));
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
      await this.engine.scenes.pop({ destination: sceneId });
      await this.engine.scenes.change(sceneId, data);
      this.engine.input.setEnabled(true);
    } catch (error) {
      this.leaving = false;
      this.engine.input.setEnabled(true);
      this.engine.ui.toast(`Scene transition failed: ${error?.message ?? 'unknown error'}`, { type: 'danger' });
    }
  }

  #selectTab(id, { focus = 'content' } = {}) {
    if (!PAUSE_TABS.some((tab) => tab.id === id)) return;
    this.activeTab = id;
    for (const [tabId, button] of this.tabButtons) {
      const selected = tabId === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const content of this.panel.querySelectorAll('[data-tab-panel]')) content.hidden = content.dataset.tabPanel !== id;
    const target = focus === 'tab' ? this.tabButtons.get(id) : (this.#focusables(id)[0] ?? this.tabButtons.get(id));
    this.#focus(target);
  }

  #navigateTabs(event, currentId) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'ArrowDown'].includes(event.code)) return;
    event.preventDefault();
    if (event.code === 'ArrowDown') {
      this.#focus(this.#focusables(currentId)[0]);
      return;
    }
    const index = PAUSE_TABS.findIndex((tab) => tab.id === currentId);
    const nextIndex = event.code === 'Home' ? 0 : event.code === 'End' ? PAUSE_TABS.length - 1 : (index + (event.code === 'ArrowRight' ? 1 : -1) + PAUSE_TABS.length) % PAUSE_TABS.length;
    this.#selectTab(PAUSE_TABS[nextIndex].id, { focus: 'tab' });
  }

  #focusables(tabId = this.activeTab) {
    const section = this.panel?.querySelector(`[data-tab-panel="${tabId}"]`);
    if (!section || section.hidden) return [];
    return [...section.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(isVisible);
  }

  #focus(element) {
    if (!element) return false;
    element.focus();
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  #changeTab(direction, focus = 'content') {
    const index = PAUSE_TABS.findIndex((tab) => tab.id === this.activeTab);
    const next = PAUSE_TABS[(index + direction + PAUSE_TABS.length) % PAUSE_TABS.length];
    this.#selectTab(next.id, { focus });
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

  #moveSpatial(direction) {
    const active = document.activeElement;
    const activeTabButton = this.tabButtons.get(this.activeTab);
    const isTab = [...this.tabButtons.values()].includes(active);
    if (isTab) {
      if (direction === 'left') this.#changeTab(-1, 'tab');
      else if (direction === 'right') this.#changeTab(1, 'tab');
      else if (direction === 'down') this.#focus(this.#focusables()[0]);
      return true;
    }

    if ((direction === 'left' || direction === 'right') && this.#adjustFocused(direction === 'left' ? -1 : 1)) return true;

    const items = this.#focusables();
    if (!items.length) return this.#focus(activeTabButton);
    if (!items.includes(active)) return this.#focus(items[0]);

    const origin = centerOf(active);
    const candidates = items.filter((item) => item !== active).map((item) => {
      const point = centerOf(item);
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      const valid = direction === 'left' ? dx < -4 : direction === 'right' ? dx > 4 : direction === 'up' ? dy < -4 : dy > 4;
      if (!valid) return null;
      const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
      const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      return { item, score: primary * 4 + secondary };
    }).filter(Boolean).sort((a, b) => a.score - b.score);

    if (candidates[0]) return this.#focus(candidates[0].item);
    if (direction === 'up') return this.#focus(activeTabButton);
    if (direction === 'left') { this.#changeTab(-1); return true; }
    if (direction === 'right') { this.#changeTab(1); return true; }
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
    if (this.controls?.capture || this.leaving) return;

    const input = this.engine.input;
    if (menuStartPressed(input) || menuBackPressed(input)) {
      this.engine.scenes.pop();
      return;
    }
    const tabDirection = menuTabDirection(input);
    if (tabDirection) {
      this.#changeTab(tabDirection);
      return;
    }
    if (menuSelectPressed(input)) {
      this.#activateFocused();
      return;
    }
    const direction = menuDirection(input);
    if (direction) this.#moveSpatial(direction);
  }

  async exit() {
    this.controls?.destroy();
    if (!this.leaving) this.engine.input.setEnabled(true);
    this.engine.ui.remove(this.screen?.id);
    await super.exit();
  }
}
