# Deedz Engine v1.6

> **v1.6.1 hotfix:** Restart Mission and Main Menu re-entry now guarantee a grounded spawn after final Echo geometry loads. Flock Sense only highlights currently actionable targets.


A reusable, plugin-friendly JavaScript browser-game engine built for **Deedz The Goose** and future Deedz Corp games. It uses PixiJS 8, Vite, Express, WebSockets, and the Web Audio API.

The canonical names for player actions, progression systems, enemy archetypes, and evolving-world features live in [docs/GAMEPLAY_MECHANICS.md](docs/GAMEPLAY_MECHANICS.md).

Version 1.6 is the **Mobile Symphony** update. It repairs pause-menu mission restarts, upgrades the evolving soundtrack into a layered generative score, improves fast-tap throwing responsiveness, adds automatic on-screen mobile controls, gives LT a new Flock Sense ability, and cleans the gameplay HUD without removing multiplayer interaction.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- A current desktop browser with WebGL support

## Install and run

```bash
npm ci --no-audit --no-fund
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/ws` to the development server on port `8080`.

For a production build:

```bash
npm run validate
npm start
```

Open `http://localhost:8080`.

### Windows dependency repair

The lockfile is pinned to the public npm registry. If an interrupted installation leaves locked files behind, close other Node processes and run:

```powershell
.\repair-install.ps1
```

## Mobile Symphony highlights

### Restart-safe mission reset

**Restart Mission** now performs an explicit fresh-mission transition instead of rebuilding from ambiguous pause/checkpoint state. The saved checkpoint is cleared for the restart, Echo-generated geometry is applied, and the spawn is validated against the final platform layout before physics resumes. If evolving geometry overlaps the requested spawn, the goose is lifted to a safe surface automatically.

### Generative Echo orchestra

Adaptive music now uses a look-ahead Web Audio scheduler and a layered arrangement rather than a single pad plus repeating lead note. Echo Layers deterministically evolve:

- Chord progressions and harmonic modes
- Bass movement and melodic motifs
- Kick, snare, and high-hat density
- Pads, lead timbre, shimmer, delay, and swing
- Instrument tiers that unlock as layers rise
- Baron Breadstorm stabs, heavier bass, and denser percussion during crisis phases
- Smooth score crossfades when the world or boss intensity changes

### Responsive crumb throwing

Fast keyboard and touch taps are now preserved even when press and release both occur between rendered frames. Quick-toss speed was raised, charge time was tightened, projectile creation is immediate, and throw recovery is shorter while retaining the full near-to-far charge range.

### Mobile and controller expansion

Touch-capable devices receive on-screen controls automatically when no controller is connected. The Settings tab offers **Auto**, **Always on**, and **Off** modes. Auto mode hides the overlay as soon as a gamepad is detected, allowing mobile players to switch cleanly to a controller.

The compact phone layout keeps the six core actions visible: **Flap, Wing Whap, Peck, Crumb, Honk, and Dash**. Flock Sense and Wing-Bump remain available on keyboard/controller. Starting from a touch device requests browser fullscreen, and the installable web-app manifest provides a browser-free landscape view when the game is added to a Home Screen.

The default controller layout uses **RB for Flap**, **RT for Dash**, **A for Wing Whap**, and **Y for Peck**, while **LT remains Flock Sense**. Hold Flock Sense to reveal nearby collectibles, Echo Crystals, Resonators, Bread Foxes, checkpoints, bosses, and connected geese.

### Cleaner interface

The HUD now prioritizes health, flaps, throwable crumbs, and Echo progress. Adventure totals are combined into one compact status chip, network/flock information is simplified, and low-priority chips collapse on smaller displays. Attempting a wing-bump without a nearby player no longer creates an interruption notification; the interaction remains available whenever another goose enters range.

## Goose Flow highlights

### Tabbed Mission Control

Pause with `Escape` or the controller Menu button. The pause screen now opens to a compact **Mission** tab instead of immediately filling the screen with every binding and toggle.

Three accessible tabs keep the interface focused:

- **Mission** — Resume, restart, or return to the main menu
- **Controls** — Complete keyboard/controller reference and live remapping
- **Settings** — Music, adaptive music, sound effects, screen shake, and volume sliders

Arrow keys can move between tabs. Controls and settings remain hidden until selected.

### Automatic map recovery

A dedicated `WorldSafetySystem` monitors the player for:

- Falling beneath the playable world
- Escaping beyond either horizontal map boundary
- Launching far above the supported camera space
- Becoming embedded beneath thick ground geometry

After a brief confirmation delay, the goose is returned to the most recent Goose Post with health, jumps, velocity, and camera state restored. Ordinary jumps beneath small one-way platforms do not trigger the failsafe.

### Charged crumb throws

The crumb throw is now time-sensitive:

- **Tap X** for a short, quick toss
- **Hold X** to charge distance, lift, knockback, lifetime, visual size, and throw power
- A nearly full charge becomes a two-damage **Power Crumb**
- The charge ring appears beside the goose while aiming
- Charged throw data synchronizes to connected players

Keyboard `X` and controller X use the same hold-and-release behavior.

### Crouch-walking and living idle animation

Holding down now lowers the collider while still allowing slower left/right movement. Crouch-walking is useful for careful positioning and gives the goose a distinct sneaking animation.

When left alone, the goose now breathes, tucks its wing, shifts its head, and occasionally blinks. Walking, crouching, charging, attacking, flying, and idle states each have their own procedural motion.

### Adaptive Echo music

Music now genuinely evolves with the world. Each Echo Layer changes:

- Root note and harmonic mode
- Tempo and rhythmic subdivision
- Pad and lead oscillator character
- Melodic pattern and density
- Boss intensity during Baron Breadstorm phases

The soundtrack is generated through the Web Audio API, remains gesture-safe, and can be disabled independently with **Adaptive layer music** in the Settings tab. Turning adaptive music off restores the simpler ambient tone bed.

## Echo Layer progression repair

Echo advancement can no longer permanently run dry at Layer 5 or later.

Every generated layer now contains:

- A one-pass XP budget of at least 128% of that layer's evolution requirement
- Respawning collectibles rather than one-use-only advancement
- At least two repeatable honk-powered Echo Resonators
- Rare Echo Caches beginning at Layer 5
- Renewable enemy, collectible, social, crystal, and boss progression sources

The generator remains deterministic: the same player seed, layer, and cycle produce the same world. Existing v1.3 progress is preserved during migration, including players already at Layer 5.

## Expanded combat: the Echo Arsenal

### Wing Whap

The wide close-range attack remains available through `J` or controller A by default. It can hit several nearby Bread Foxes and damage Baron Breadstorm after his Echo Shield breaks.

### Peck

Press `K` or controller Y for a quick, precise beak strike. Peck now has a more forgiving reach, lunge, and hit reaction. It still has less range and knockback than Wing Whap and only hits the nearest target, but it recovers faster.

### Throwable crumbs

Press `X` on the keyboard or the controller X button to throw a crumb projectile.

Throwable crumbs:

- Consume persistent crumb ammunition
- Travel with gravity and visible spin
- Damage and knock back Bread Foxes
- Damage Baron Breadstorm after his honk-only shield is broken
- Synchronize throw reactions and cosmetic projectiles to other players
- Can be replenished by collecting crumb-family pickups

The HUD shows current throwable crumb ammunition. Running out never blocks ordinary progression; renewable crumb pickups continually return.

### Honk and social play

Honk remains a first-class combat and interaction mechanic:

- Break Baron Breadstorm's Echo Shield
- Knock back nearby foxes and players
- Awaken Echo Crystals
- Activate renewable Echo Resonators
- Synchronize visible and audible reactions across the room

Nearby players can still wing-bump through the interact action.

## More expressive world evolution

Personal Echo Layers now evolve visually and mechanically instead of mainly changing color.

Later layers can introduce:

- Auroras, drifting atmospheric motes, and changing sky gradients
- Crystal gardens, lantern groves, banners, wind ribbons, and flowers
- Floating islands and richer distant scenery
- Updraft platforms that launch the goose into flight routes
- Phase platforms that appear and disappear on a rhythm
- Crystal and lantern platforms with layer-specific glow
- Shifting mountain, horizon, moon, platform, and accent palettes
- More vertical routes, collectible trails, fox ranks, and movement mutations
- Infinite palette cycling beyond the named evolution stages

All players remain in the same base coordinate space, so social interactions remain meaningful even when personal traversal routes differ.

## Collectibles

The collectible family includes:

- **Crumb** — Echo XP and throwable ammunition
- **Echo Crumb** — stronger progression and flock energy
- **Golden Feather** — restores flight jumps and rewards XP
- **Moon Token** — rarer Echo progress
- **Flock Star** — social-flavored progression and flock energy
- **Heart** — health recovery and progression
- **Prism Seed** — colorful high-layer advancement
- **Echo Cache** — a rare Layer 5+ treasure with a large reward

Collectible totals persist and new collection achievements reward exploration.

## Mission Control and remapping

The always-visible button explainer has been removed from the gameplay HUD. Pause with `Escape` or the Menu button to open **Mission Control**.

Mission Control shows every action, description, keyboard binding, and controller binding. Select a binding and press a replacement input to remap it immediately. Custom bindings persist in the save file.

The default controls are:

| Action | Keyboard | Controller |
|---|---|---|
| Move | `A/D`, arrows | Left stick |
| Crouch-walk / descend | `S`, down arrow | Left stick down |
| Triple jump / glide | `Space` | Right bumper |
| Wing Whap | `J` | A |
| Peck | `K` | Y |
| Charge and throw crumb | Tap/hold `X` | Tap/hold X |
| Honk | `H` | B |
| Dash | `Left Shift` | Right trigger |
| Flock Sense | `Q` | Left trigger |
| Wing-bump / interact | `E` | Left bumper |
| Pause / Mission Control | `Escape` | Menu |
| Diagnostics | `F3` | Unbound |

Mission Control separates those bindings into the **Controls** tab. The **Settings** tab includes master, music, and effects volume sliders; music, adaptive-music, sound-effects, screen-shake, and on-screen-control preferences; plus a one-click **Reset Default Controls** action.

## The living-world loop

The game has two progression tracks that work together.

### Personal Echo Layer

Each player keeps persistent:

- Echo Layer level and Echo XP
- Completed evolution cycles
- Deterministic personal world seed
- Baron Breadstorm victories
- Collectible and crumb-ammunition totals
- Custom input bindings

Echo Layer 1 is a welcoming exploration run: awaken the crystals, fill Echo XP, and reach Foxfire Gate without a boss fight. Echo Layer 2 introduces Baron Breadstorm in Moonwater Ravine as a one-heart form with no shield. Each later Echo adds one heart. His opening Echo Shield arrives at Echo Layer 5, while phase-restoring shields wait until Echo Layer 7.

Jumping squarely onto a Bread Fox instantly defeats it and bounces the goose upward. Foxes also lose when knocked into water or an open fall. Each defeated fox scatters two to four collectible bread crumbs based on its rank.

Guardian Goose and Ember Goose remain visible in the class picker but begin locked. Reaching Echo Layer 10 permanently makes both advanced choices available through the player's saved progression.

### Shared Flock Crisis

Beginning in Echo Layer 2, adventure actions contribute bounded Flock Energy to the current multiplayer room. When the room meter reaches its goal, **Baron Breadstorm** invades Moonwater Ravine near the center of the map. Geese on the same Echo Layer contribute to the same fight, and extra teammates do not increase his hearts.

Shared room state includes:

- Player presence, profile, movement, and Echo Layer level
- Honk, Wing Whap, Peck, crumb throw, dash, wing-bump, and evolution reactions
- Activated Echo Crystals and defeated shared Bread Foxes
- Flock Energy and its current goal
- Baron Breadstorm health, shield, phase, cycle, and victory count
- Late-join synchronization of the active crisis

Room state is process-local and resets when the final player leaves or the server restarts. Personal Echo progression and custom controls are stored locally and persist between sessions.

## Baron Breadstorm

The boss remains server-coordinated so every connected player sees the same health, shield, phase, and victory result.

```text
Early forms  Slow crowned charges that teach the fight safely
Mid forms    Small toast volleys and an opening Echo Shield
Deep forms   Honk waves, larger volleys, and phase-restoring shields
```

The Echo Layer 2 introductory fight has one heart and no shield, so Peck, Wing Whap, Honk, and thrown crumbs work immediately. Every ordinary successful hit removes one heart. Beginning in Echo Layer 5, Baron Breadstorm's opening Echo Shield can only be damaged by honking. Phase-restoring shields begin at Echo Layer 7, giving younger and first-time players several runs to learn the encounter before its full mechanics arrive.

Offline play remains supported. Without a WebSocket connection, Flock Energy and the boss simulation run locally.

## Multiplayer

Every client joins the default room `goose-lobby`, so players connecting to the same running server share one game instance.

During local development:

- This computer: `http://localhost:5173`
- Another computer on the same network: use the `Network` URL printed by Vite, such as `http://192.168.1.2:5173`
- A Tailscale-connected computer: use the host computer's Tailscale IP with port `5173`

For internet play, deploy the production Node server so all players connect to the same public host. The WebSocket endpoint automatically uses the page's host.

## The Great Goose Adventure

The permanent base map contains seven connected regions:

1. Windmill Meadow
2. Cloudstep Crossing
3. Whispering Ruins
4. Moonwater Ravine
5. Lantern Woods
6. Bread Fox Pass
7. Foxfire Fortress

The stable base map keeps remote players spatially meaningful. Each personal Echo Layer adds deterministic routes, visual mutations, collectibles, resonators, and encounters over that shared foundation.

## Save migration

Version 1.6 uses save schema version 7. Existing v1.4 saves migrate automatically and add:

```js
settings.musicVolume = 0.55;
settings.sfxVolume = 0.8;
settings.adaptiveMusic = true;
```

Existing player identity, custom controls, Echo Layer, XP, cycle, seed, boss victories, crumbs, ammunition, collectible totals, achievements, checkpoints, and prior audio toggles are preserved.

## Architectural rule

> The engine never knows what a goose is.

Reusable capabilities live in `src/engine`. Goose-specific entities, scenes, systems, data, art, interactions, progression, personal world generation, combat, collectibles, and boss behavior live in `src/games/deedz-the-goose`.

```text
src/
├─ engine/                              Reusable runtime
│  ├─ audio/                            Gesture-safe audio and effects
│  ├─ debug/                            Diagnostics and collider drawing
│  ├─ entities/                         Entity/component lifecycle
│  ├─ events/                           Prioritized event bus
│  ├─ input/                            Remappable keyboard/gamepad actions
│  ├─ loop/                             Fixed-step simulation
│  ├─ networking/                       WebSocket client and room protocol
│  ├─ physics/                          Bodies, colliders, spatial hash
│  ├─ plugins/                          Dependency-aware plugins
│  ├─ rendering/                        Pixi application, layers, camera
│  ├─ save/                             Versioned saves and migrations
│  ├─ scenes/                           Queued scene stack
│  └─ ui/                               Accessible DOM screens
├─ games/deedz-the-goose/
│  ├─ data/collectibles.js              Collectible definitions and rewards
│  ├─ data/controls.js                  Control descriptions and labels
│  ├─ data/evolutions.js                Deterministic evolving layers
│  ├─ data/throwing.js                  Charged-throw power profiles
│  ├─ entities/CrumbProjectile.js       Variable-range crumb combat
│  ├─ entities/BreadstormBoss.js        Multi-phase boss
│  ├─ systems/WorldEvolutionSystem.js   Renewable progression and visuals
│  ├─ systems/WorldSafetySystem.js      Escape and under-map recovery
│  └─ ui/ControlsSettingsPanel.js       Tabbed settings and remapping
└─ shared/                              General constants and utilities
```

## Stable public surface

```js
import {
  DeedzEngine,
  GameApp,
  Scene,
  Entity,
  Collider,
  EnginePlugin,
} from './src/engine/index.js';
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run Vite and the Node server together |
| `npm run dev:client` | Run only Vite on port 5173 |
| `npm run dev:server` | Run only API/WebSocket server on port 8080 |
| `npm run build` | Create the production client in `dist/` |
| `npm run preview` | Preview the built client on port 4173 |
| `npm start` | Serve `dist/`, API routes, and WebSockets on port 8080 |
| `npm run check` | Validate local JavaScript imports |
| `npm test` | Run the Node test suite |
| `npm run validate` | Run imports, tests, and production build |

## Networking security boundary

The server authoritatively owns room Flock Energy and Baron Breadstorm's shared health, shields, phases, and victory state. Movement, ordinary enemy simulation, local collisions, collectible spawning, personal Echo Layers, and player ammunition remain client-side.

Competitive or economy-sensitive play would still require authentication, durable server persistence, authoritative movement/collision simulation, reward validation, and anti-cheat controls.

## Testing

The automated suite covers:

- Event priority, one-shot listeners, and abort cleanup
- Save migration, persistence, import, and reset
- Spatial-hash collision enter/stay/exit behavior
- Plugin dependency ordering and reverse shutdown
- Room sanitation, capacity, state, and broadcasts
- Serialized scene transitions and failed-push rollback
- HTTP health and WebSocket room joining
- Two-client wing-bump and charged crumb-throw relay
- Shared world-event broadcasts and late-join synchronization
- Deterministic personal Echo Layer generation
- Renewable progression budgets across Layers 1–24
- Explicit Layer 5 anti-stall guarantees
- Default and remapped control bindings
- Pause-tab structure, crouch-walk speed, charged-throw scaling, map recovery, and adaptive music profiles
- Flock Energy, honk-only shields, boss phases, and victory resets

Run the complete release gate:

```bash
npm run validate
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PLUGIN_GUIDE.md`](docs/PLUGIN_GUIDE.md)
- [`docs/NETWORKING.md`](docs/NETWORKING.md)
- [`CHANGELOG.md`](CHANGELOG.md)
