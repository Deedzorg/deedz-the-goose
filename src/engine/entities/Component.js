export class Component {
  constructor() { this.entity = null; this.enabled = true; this.started = false; }
  onAttach(entity) { this.entity = entity; }
  start(_engine) { this.started = true; }
  onDetach() { this.entity = null; this.started = false; }
  fixedUpdate(_dt, _engine) {}
  update(_dt, _engine) {}
  destroy() { this.onDetach(); }
}
