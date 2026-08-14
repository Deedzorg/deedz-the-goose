import { gooseClasses, gooseUnlockProgressFromSave, isGooseClassUnlocked } from '../data/characters.js';

function unlockedIds(save) {
  const progress = gooseUnlockProgressFromSave(save);
  return new Set(gooseClasses.filter((character) => isGooseClassUnlocked(character, progress)).map((character) => character.id));
}

export class GooseUnlockSystem {
  constructor(engine) {
    this.engine = engine;
    this.unlocked = unlockedIds(engine.save);
    this.checkQueued = false;
    this.unsubscribers = [
      engine.events.on('save:changed', ({ path } = {}) => {
        if (!path || String(path).startsWith('progress.')) this.#queueCheck();
      }),
      engine.events.on('save:reset', () => { this.unlocked = unlockedIds(engine.save); }),
      engine.events.on('save:imported', () => { this.unlocked = unlockedIds(engine.save); }),
    ];
  }

  #queueCheck() {
    if (this.checkQueued) return;
    this.checkQueued = true;
    queueMicrotask(() => {
      this.checkQueued = false;
      this.#check();
    });
  }

  #check() {
    const current = unlockedIds(this.engine.save);
    const newlyUnlocked = gooseClasses.filter((character) => current.has(character.id) && !this.unlocked.has(character.id));
    this.unlocked = current;
    if (!newlyUnlocked.length) return;
    const names = newlyUnlocked.map((character) => character.name).join(' + ');
    const message = newlyUnlocked.length === 1
      ? `${names} unlocked! Choose this goose from the main menu.`
      : `${newlyUnlocked.length} geese unlocked: ${names}. Choose them from the main menu.`;
    this.engine.ui.toast(message, { type: 'success', duration: 6000 });
    for (const character of newlyUnlocked) this.engine.events.emit('goose:unlocked', { character });
  }

  destroy() {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }
}
