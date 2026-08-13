# Plugin Guide

Plugins are reusable capabilities with dependency ordering and lifecycle rollback.

```js
import { EnginePlugin } from '../src/engine/index.js';

export class AchievementsPlugin extends EnginePlugin {
  constructor() {
    super({
      id: 'achievements',
      version: '1.0.0',
      dependencies: ['profile'],
    });
  }

  async install(engine) {
    await super.install(engine);
    this.off = engine.events.on('objective:completed', ({ id }) => {
      engine.save.set(`achievements.${id}`, true);
    });
  }

  async start(engine) {
    await super.start(engine);
  }

  fixedUpdate(dt, engine) {
    // Deterministic simulation work.
  }

  update(dt, engine) {
    // Presentation or non-deterministic work.
  }

  async stop(engine) {
    await super.stop(engine);
  }

  async uninstall(engine) {
    this.off?.();
    await super.uninstall(engine);
  }
}
```

Register plugins in the game:

```js
async registerPlugins(engine) {
  engine.plugins.register(new ProfilePlugin());
  engine.plugins.register(new AchievementsPlugin());
}
```

Dependencies are topologically sorted. Missing dependencies and cycles fail startup. If installation or startup fails, already processed plugins are rolled back in reverse order.

Runtime control:

```js
await engine.plugins.setEnabled('achievements', false);
await engine.plugins.setEnabled('achievements', true);
```
