export class UIManager {
  constructor(events, rootSelector = '#ui-root') {
    this.events = events;
    this.root = document.querySelector(rootSelector);
    if (!this.root) throw new Error(`UI root not found: ${rootSelector}`);
    this.screens = new Map();
    this.toastTimers = new Set();
    this.toastStack = document.createElement('div');
    this.toastStack.className = 'deedz-toast-stack';
    this.toastStack.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.toastStack);
  }

  register(screen) {
    if (this.screens.has(screen.id)) this.remove(screen.id);
    this.screens.set(screen.id, screen);
    return screen;
  }

  show(id) {
    const screen = this.screens.get(id);
    if (!screen) throw new Error(`Unknown UI screen: ${id}`);
    screen.show(this.root);
    this.events.emit('ui:screenShown', { id, screen });
    return screen;
  }

  hide(id) {
    const screen = this.screens.get(id);
    screen?.hide();
    if (screen) this.events.emit('ui:screenHidden', { id, screen });
  }

  remove(id) {
    const screen = this.screens.get(id);
    screen?.destroy();
    this.screens.delete(id);
  }

  get activeScreen() { return [...this.screens.values()].reverse().find((screen) => screen.visible) ?? null; }

  update(input) {
    const screen = this.activeScreen;
    if (!screen) return;
    const focusables = screen.focusables();
    if (!focusables.length) return;
    const activeIndex = Math.max(0, focusables.indexOf(document.activeElement));
    if (input.wasPressed('down') || input.wasPressed('right')) focusables[(activeIndex + 1) % focusables.length].focus();
    else if (input.wasPressed('up') || input.wasPressed('left')) focusables[(activeIndex - 1 + focusables.length) % focusables.length].focus();
    else if (input.wasPressed('jump') || input.wasPressed('interact')) document.activeElement?.click?.();
  }

  toast(message, { duration = 2600, type = 'info' } = {}) {
    const toast = document.createElement('div');
    toast.className = `deedz-toast deedz-toast--${type}`;
    toast.textContent = message;
    this.toastStack.appendChild(toast);
    const timer = setTimeout(() => { toast.remove(); this.toastTimers.delete(timer); }, duration);
    this.toastTimers.add(timer);
    return toast;
  }

  clear() {
    for (const screen of this.screens.values()) screen.destroy();
    this.screens.clear();
    for (const timer of this.toastTimers) clearTimeout(timer);
    this.toastTimers.clear();
    this.toastStack.replaceChildren();
  }

  destroy() { this.clear(); this.toastStack.remove(); }
}
