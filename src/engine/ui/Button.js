export class Button {
  constructor({ label, onClick, variant = 'default', disabled = false, ariaLabel = null } = {}) {
    this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = `deedz-button${variant === 'primary' ? ' deedz-button--primary' : ''}${variant === 'danger' ? ' deedz-button--danger' : ''}`;
    this.element.textContent = label ?? 'Button';
    this.element.disabled = disabled;
    if (ariaLabel) this.element.setAttribute('aria-label', ariaLabel);
    this._onClick = onClick ?? null;
    if (this._onClick) this.element.addEventListener('click', this._onClick);
  }
  setDisabled(disabled) { this.element.disabled = Boolean(disabled); }
  setLabel(label) { this.element.textContent = label; }
  focus() { this.element.focus(); }
  destroy() { if (this._onClick) this.element.removeEventListener('click', this._onClick); this.element.remove(); }
}
