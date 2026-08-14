import { Container, Graphics, Text } from 'pixi.js';
import { Entity } from '../../../engine/entities/Entity.js';
import { lerp } from '../../../shared/math.js';
import { characters } from '../data/characters.js';

export class RemoteGoose extends Entity {
  constructor({ id, profile = {}, state = null } = {}) {
    super({ id: `remote-${id}`, name: 'RemoteGoose', tags: ['remote-player', 'goose'] });
    this.peerId = id;
    this.profile = profile;
    this.target = {
      x: state?.x ?? 0,
      y: state?.y ?? 0,
      facing: state?.facing ?? 1,
      velocityX: state?.velocityX ?? 0,
      velocityY: state?.velocityY ?? 0,
      grounded: state?.grounded ?? false,
      crouching: state?.crouching ?? false,
      evolutionLevel: Math.max(1, Number(state?.evolutionLevel) || 1),
    };
    this.x = this.target.x;
    this.y = this.target.y;
    this.action = null;
    this.actionTime = 0;
    this.#draw();
  }

  #draw() {
    this.art = new Container();
    this.body = new Graphics();
    this.details = new Graphics();
    this.wing = new Graphics();
    this.art.addChild(this.body, this.details, this.wing);

    this.label = new Text({
      text: this.profile.name || 'Goose',
      style: { fill: 0xffffff, fontSize: 14, fontWeight: '700', stroke: { color: 0x07111f, width: 4 } },
    });
    this.label.anchor.set(0.5);
    this.label.y = -62;

    this.levelLabel = new Text({
      text: `Echo L${this.target.evolutionLevel}`,
      style: { fill: 0x8de7ff, fontSize: 11, fontWeight: '800', stroke: { color: 0x07111f, width: 3 } },
    });
    this.levelLabel.anchor.set(0.5);
    this.levelLabel.y = -46;

    this.bubble = new Text({
      text: '',
      style: { fill: 0xffd95a, fontSize: 20, fontWeight: '900', fontStyle: 'italic', stroke: { color: 0x07111f, width: 5 } },
    });
    this.bubble.anchor.set(0.5);
    this.bubble.y = -92;
    this.bubble.visible = false;
    this.display.addChild(this.art, this.label, this.levelLabel, this.bubble);
    this.applyProfile(this.profile);
  }

  applyProfile(profile = {}) {
    const nextProfile = { ...this.profile, ...profile };
    if (this.character && nextProfile.name === this.profile.name && nextProfile.character === this.profile.character) return this;
    this.profile = nextProfile;
    this.character = characters.find((item) => item.id === this.profile.character) ?? characters[0];
    const presentation = this.character.presentation ?? {};
    const bodyWidth = 32 * (presentation.bodyWidth ?? 1);
    const bodyHeight = 21 * (presentation.bodyHeight ?? 1);
    const headRadius = 14 * (presentation.headScale ?? 1);
    this.body.clear()
      .ellipse(0, 0, bodyWidth, bodyHeight).fill({ color: this.character.color, alpha: 0.88 })
      .circle(28, -22, headRadius).fill({ color: this.character.color, alpha: 0.88 })
      .moveTo(38, -23).lineTo(57, -17).lineTo(38, -12).closePath().fill(0xffa62b)
      .circle(32, -27, 2.5).fill(0x07111f);
    this.details.clear();
    if (presentation.detail === 'smile') this.details.circle(30, -20, 3.6).fill({ color: this.character.accent, alpha: 0.72 }).arc(32, -22, 7, 0.2, 1.35).stroke({ width: 2.5, color: 0x07111f });
    else if (presentation.detail === 'crumb') this.details.roundRect(-18, -12, 27, 23, 7).fill(this.character.accent).stroke({ width: 3, color: 0x9a6237 }).moveTo(-11, -7).lineTo(-7, 2).moveTo(-1, -7).lineTo(3, 2).stroke({ width: 2, color: 0x9a6237 });
    else if (presentation.detail === 'curves') this.details.moveTo(-30, -9).bezierCurveTo(-13, -22, 8, -17, 20, -4).moveTo(-29, 10).bezierCurveTo(-10, 23, 10, 16, 22, 4).stroke({ width: 4, color: this.character.accent, alpha: 0.95 }).circle(-28, 0, 4).fill(this.character.accent);
    else if (presentation.detail === 'heart') this.details.moveTo(-8, 4).bezierCurveTo(-18, -3, -15, -13, -7, -8).bezierCurveTo(1, -13, 5, -3, -8, 4).fill(this.character.accent);
    else if (presentation.detail === 'scowl') this.details.moveTo(26, -34).lineTo(38, -30).stroke({ width: 4, color: 0x07111f });
    else if (presentation.detail === 'tuft') this.details.moveTo(20, -37).bezierCurveTo(18, -48, 26, -50, 28, -40).bezierCurveTo(30, -51, 39, -48, 37, -38).stroke({ width: 4, color: this.character.accent });
    else if (presentation.detail === 'spark') this.details.moveTo(-7, -5).lineTo(-2, 1).lineTo(-7, 7).lineTo(-13, 1).closePath().fill(this.character.accent);
    else if (presentation.detail === 'ember') this.details.moveTo(-32, 3).bezierCurveTo(-46, -10, -41, -22, -28, -14).bezierCurveTo(-36, -5, -29, 2, -32, 3).fill(0xff6b35);
    this.wing.clear().ellipse(-18, 3, 18, 9).fill({ color: this.character.accent, alpha: 0.9 });
    if (this.label) this.label.text = this.profile.name || 'Goose';
    return this;
  }

  applyState(state) {
    this.target.x = Number(state.x) || 0;
    this.target.y = Number(state.y) || 0;
    this.target.facing = state.facing === -1 ? -1 : 1;
    this.target.velocityX = Number(state.velocityX) || 0;
    this.target.velocityY = Number(state.velocityY) || 0;
    this.target.grounded = Boolean(state.grounded);
    this.target.crouching = Boolean(state.crouching);
    this.target.evolutionLevel = Math.max(1, Number(state.evolutionLevel) || this.target.evolutionLevel || 1);
    this.levelLabel.text = `Echo L${this.target.evolutionLevel}`;
  }

  react(action, payload = {}) {
    this.action = action;
    this.actionTime = action === 'honk' ? 0.55 : action === 'wing-bump' ? 0.48 : action === 'evolution' ? 0.9 : action === 'throw' ? 0.42 : action === 'peck' ? 0.24 : 0.3;
    this.bubble.text = action === 'honk' ? 'HONK!' : action === 'wing-bump' ? 'BUMP!' : action === 'attack' ? 'WHAP!' : action === 'peck' ? 'PECK!' : action === 'throw' ? 'YEET!' : action === 'evolution' ? 'EVOLVED!' : '';
    this.bubble.visible = Boolean(this.bubble.text);
    if (action === 'wing-bump') {
      this.y -= 12;
      this.target.y -= 12;
    }
    if (payload.facing) this.target.facing = payload.facing === -1 ? -1 : 1;
  }

  update(dt, engine) {
    super.update(dt, engine);
    const t = 1 - Math.exp(-15 * dt);
    this.x = lerp(this.x, this.target.x, t);
    this.y = lerp(this.y, this.target.y, t);
    this.art.scale.x = this.target.facing;
    this.art.scale.y = this.target.crouching ? 0.8 : 1;
    this.art.y = this.target.crouching ? 10 : 0;
    this.actionTime = Math.max(0, this.actionTime - dt);

    const speed = Math.min(1, Math.abs(this.target.velocityX) / 360);
    this.body.y = Math.sin(engine.loop.time.elapsed * 13) * speed * 2;
    this.wing.rotation = !this.target.grounded && this.target.velocityY < 180
      ? Math.sin(engine.loop.time.elapsed * 24) * 0.65
      : Math.sin(engine.loop.time.elapsed * 7) * 0.08;

    if (this.actionTime > 0) {
      const actionProgress = this.actionTime / 0.55;
      if (this.action === 'honk') this.art.scale.y = 0.92 + Math.sin(actionProgress * Math.PI * 4) * 0.12;
      else if (this.action === 'attack') this.art.x = this.target.facing * 12 * Math.sin(actionProgress * Math.PI);
      else if (this.action === 'throw') this.art.x = this.target.facing * 10 * Math.sin(actionProgress * Math.PI);
      else if (this.action === 'peck') this.art.x = this.target.facing * 13 * Math.sin(actionProgress * Math.PI);
      else if (this.action === 'wing-bump') this.art.rotation = Math.sin(actionProgress * Math.PI * 3) * 0.14;
      this.bubble.alpha = Math.min(1, this.actionTime * 4);
      this.bubble.y = -92 - (1 - actionProgress) * 16;
    } else {
      this.action = null;
      this.art.x = 0;
      this.art.rotation = 0;
      this.art.scale.y = 1;
      this.bubble.visible = false;
    }
  }
}
