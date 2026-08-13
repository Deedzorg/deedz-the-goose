export class Screen {
  constructor({ id, className = '', modal = false, label = null } = {}) {
    if (!id) throw new Error('Screen requires an id');
    this.id = id;
    this.modal = modal;
    this.element = document.createElement('div');
    this.element.className = `deedz-screen ${className}`.trim();
    this.element.dataset.screen = id;
    this.element.hidden = true;
    this.element.setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) this.element.setAttribute('aria-modal', 'true');
    if (label) this.element.setAttribute('aria-label', label);
    this.visible = false;
    this.lastFocused = null;
  }

  show(parent) {
    this.lastFocused = document.activeElement;
    if (!this.element.isConnected) parent.appendChild(this.element);
    this.element.hidden = false;
    this.visible = true;
    this.onShow();
  }

  hide() {
    this.element.hidden = true;
    this.visible = false;
    this.onHide();
    this.lastFocused?.focus?.();
  }

  focusables() { return [...this.element.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]; }
  focusFirst() { this.focusables()[0]?.focus(); }
  onShow() {}
  onHide() {}
  destroy() { if (this.visible) this.hide(); this.element.remove(); }
}
