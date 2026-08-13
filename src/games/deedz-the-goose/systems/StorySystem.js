export class StorySystem {
  constructor(engine, beats = []) { this.engine = engine; this.beats = beats.map((beat) => ({ ...beat, shown: false })); }
  update(player) {
    for (const beat of this.beats) {
      if (!beat.shown && player.x >= beat.x) { beat.shown = true; this.engine.ui.toast(beat.text, { duration: 4200 }); this.engine.events.emit('story:beat', beat); }
    }
  }
}
