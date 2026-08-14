export class ObjectiveSystem {
  constructor(engine) {
    this.engine = engine;
    this.state = {
      crumbs: engine.save.get('progress.crumbs', 0),
      enemies: engine.save.get('progress.enemies', 0),
      collectibles: engine.save.get('progress.collectibles', 0),
    };
    this.unsubscribers = [
      engine.events.on('collectible:collected', ({ item, recovered = false }) => {
        if (recovered) return;
        this.state.collectibles += 1;
        engine.save.set('progress.collectibles', this.state.collectibles);
        if (item.type === 'crumb' || item.type === 'echo-crumb') {
          this.state.crumbs += item.value;
          engine.save.set('progress.crumbs', this.state.crumbs);
          if (this.state.crumbs >= 1) engine.events.emit('achievement:unlock', { id: 'first-crumb' });
          if (this.state.crumbs >= 10) engine.events.emit('achievement:unlock', { id: 'crumb-hunter' });
        }
        if (this.state.collectibles >= 25) engine.events.emit('achievement:unlock', { id: 'echo-collector' });
        if (item.type === 'echo-cache') engine.events.emit('achievement:unlock', { id: 'cache-cracker' });
        engine.events.emit('objective:changed', structuredClone(this.state));
      }),
      engine.events.on('enemy:defeated', () => {
        this.state.enemies += 1;
        engine.save.set('progress.enemies', this.state.enemies);
        engine.events.emit('objective:changed', structuredClone(this.state));
      }),
    ];
  }
  destroy() { this.unsubscribers.forEach((off) => off()); }
}
