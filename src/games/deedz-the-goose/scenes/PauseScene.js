import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { ControlsSettingsPanel } from '../ui/ControlsSettingsPanel.js';
import { createMenuRepeatState, menuBackPressed, menuRepeatDirection, menuSelectPressed, menuStartPressed, menuTabDirection } from '../data/menuNavigation.js';

export const PAUSE_TABS = Object.freeze([
  { id: 'mission', label: 'Mission' },
  { id: 'controls', label: 'Controls' },
  { id: 'settings', label: 'Settings' },
  { id: 'records', label: 'Records' },
]);

function isVisible(element) {
  return Boolean(element && !element.disabled && !element.hidden && element.getClientRects?.().length);
}

export class PauseScene extends Scene {
  constructor() {
    super('pause', { blocksWorld: true, transparent: true });
    this.activeTab = 'mission';
    this.leaving = false;
    this.menuRepeat = createMenuRepeatState();
  }

  async enter(data) {
    await super.enter(data);
    this.screen = new Screen({ id: 'pause-ui', modal: true, label: 'Paused game mission control' });
    const panel = document.createElement('section');
    panel.className = 'deedz-panel deedz-panel--mission';
    panel.innerHTML = `
      <div class="deedz-kicker">MISSION CONTROL</div>
      <h1 class="deedz-title deedz-title--compact">PAUSED</h1>
      <p class="deedz-menu-hint">Controller: ↑/↓ moves · ←/→ adjusts or crosses a row · LB/RB changes pages · A selects · B/Menu resumes</p>
      <div class="deedz-tabs" role="tablist" aria-label="Pause menu sections" data-tabs></div>
      <div class="deedz-tab-panels">
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="mission">
          <p class="deedz-subtitle">Check the next objective, continue the run, restart, or safely return to the title screen.</p>
          <div class="deedz-pause-summary">
            <strong>Adventure progress is saved locally.</strong>
            <span>Up/down walks the current page in a fixed order. Left/right changes a setting or moves across a remap row.</span>
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
    this.resume = new Button({ label: 'Resume', variant: 'primary', onClick: () => this.#resumePause() });
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
    this._onEscape = (event) => {
      if (event.code !== 'Escape' || event.repeat || this.controls?.capture) return;
      event.preventDefault();
      event.stopPropagation();
      this.#resumePause();
    };
    window.addEventListener('keydown', this._onEscape, { capture: true });
    this.resume.focus({ preventScroll: true });
    this.screen.element.scrollTop = 0;
  }

  #resumePause() {
    if (this.leaving || this.engine.scenes.transitioning) return;
    this.leaving = true;
    this.engine.scenes.pop().catch((error) => {
      this.leaving = false;
      this.engine.ui.toast(`Could not resume: ${error?.message ?? 'unknown error'}`, { type: 'danger' });
    });
  }

  async #leavePause(sceneId, data = {}) {
    if (this.leaving || this.engine.scenes.transitioning) return;
    this.leaving = true;
    this.resume?.setDisabled(true);
    this.restart?.setDisabled(true);
    this.menu?.setDisabled(true);
    this.engine.input.setEnabled(false);
    try {
      // Replace the entire pause+world stack in one SceneManager transition.
      // Never expose/resume the old world between Pause and the destination.
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
    this.menuRepeat.direction = null;
    this.menuRepeat.nextAt = 0;
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
    if (active?.tagName === 'INPUT' && active.type === 'checkbox') {
      const next = direction > 0;
      if (active.checked !== next) {
        active.checked = next;
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    return false;
  }

  #moveLinear(step) {
    const items = this.#focusables();
    if (!items.length) return this.#focus(this.tabButtons.get(this.activeTab));
    const active = document.activeElement;
    const index = items.indexOf(active);
    const start = index >= 0 ? index : (step > 0 ? -1 : 0);
    return this.#focus(items[(start + step + items.length) % items.length]);
  }

  #moveAcrossRow(direction) {
    const active = document.activeElement;
    const row = active?.closest?.('.deedz-control-row');
    if (!row) return false;
    const items = [...row.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(isVisible);
    const index = items.indexOf(active);
    if (index < 0 || items.length < 2) return false;
    const next = Math.max(0, Math.min(items.length - 1, index + direction));
    return next !== index ? this.#focus(items[next]) : true;
  }

  #moveMenu(direction) {
    const active = document.activeElement;
    const isTab = [...this.tabButtons.values()].includes(active);
    if (isTab) {
      if (direction === 'left') this.#changeTab(-1, 'tab');
      else if (direction === 'right') this.#changeTab(1, 'tab');
      else if (direction === 'down') this.#focus(this.#focusables()[0]);
      return true;
    }

    if (direction === 'up') return this.#moveLinear(-1);
    if (direction === 'down') return this.#moveLinear(1);
    if (direction === 'left' || direction === 'right') {
      const step = direction === 'left' ? -1 : 1;
      if (this.#adjustFocused(step)) return true;
      if (this.#moveAcrossRow(step)) return true;
      return false;
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
    if (this.controls?.capture || this.leaving) return;

    const input = this.engine.input;
    if (menuStartPressed(input) || menuBackPressed(input)) {
      this.#resumePause();
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
    const direction = menuRepeatDirection(input, this.menuRepeat);
    if (direction) this.#moveMenu(direction);
  }

  async exit() {
    window.removeEventListener('keydown', this._onEscape, { capture: true });
    this.controls?.destroy();
    if (!this.leaving) this.engine.input.setEnabled(true);
    this.engine.ui.remove(this.screen?.id);
    await super.exit();
  }
}
