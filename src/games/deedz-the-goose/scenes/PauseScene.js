import { Scene } from '../../../engine/scenes/Scene.js';
import { Screen } from '../../../engine/ui/Screen.js';
import { Button } from '../../../engine/ui/Button.js';
import { ControlsSettingsPanel } from '../ui/ControlsSettingsPanel.js';

export const PAUSE_TABS = Object.freeze([
  { id: 'mission', label: 'Mission' },
  { id: 'controls', label: 'Controls' },
  { id: 'settings', label: 'Settings' },
]);

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
      <div class="deedz-tabs" role="tablist" aria-label="Pause menu sections" data-tabs></div>
      <div class="deedz-tab-panels">
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="mission">
          <p class="deedz-subtitle">Rest your wings, restart from the beginning, or return to the main menu.</p>
          <div class="deedz-pause-summary">
            <strong>Adventure continues when you resume.</strong>
            <span>Controls and settings remain tucked into their own tabs until you need them.</span>
          </div>
          <div class="deedz-actions deedz-actions--horizontal" data-actions></div>
        </section>
        <section class="deedz-tab-panel" role="tabpanel" data-tab-panel="controls" hidden></section>
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
    const focusTarget = id === 'mission'
      ? this.resume.element
      : panel.querySelector(`[data-tab-panel="${id}"] button:not(:disabled), [data-tab-panel="${id}"] input:not(:disabled)`);
    focusTarget?.focus();
  }

  #navigateTabs(event, currentId, panel) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) return;
    event.preventDefault();
    const index = PAUSE_TABS.findIndex((tab) => tab.id === currentId);
    const nextIndex = event.code === 'Home' ? 0
      : event.code === 'End' ? PAUSE_TABS.length - 1
        : (index + (event.code === 'ArrowRight' ? 1 : -1) + PAUSE_TABS.length) % PAUSE_TABS.length;
    const next = PAUSE_TABS[nextIndex];
    this.#selectTab(next.id, panel);
    this.tabButtons.get(next.id)?.focus();
  }

  update() {
    this.controls?.update();
    if (!this.controls?.capture && this.engine.input.wasPressed('pause')) this.engine.scenes.pop();
  }

  async exit() {
    this.controls?.destroy();
    this.engine.input.setEnabled(true);
    this.engine.ui.remove(this.screen?.id);
    await super.exit();
  }
}
