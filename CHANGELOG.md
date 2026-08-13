# Changelog

## 1.6.1 — Safe Return Hotfix

### Fixed

- Restart Mission now seats the player directly on a verified final platform after Echo geometry is generated.
- Returning to Main Menu and re-entering the world uses the same grounded spawn guarantee.
- Scene simulation pauses during asynchronous scene transitions, preventing stale physics updates during teardown and rebuild.
- Pause-menu destination buttons are transition-locked to prevent duplicate scene changes.
- Map burial detection reacts earlier if the player enters thick terrain.

### Flock Sense

- Collected or temporarily unavailable pickups no longer appear.
- Activated Echo Crystals no longer appear.
- Cooling Echo Resonators remain hidden until they can be activated again.
- Activated Goose Posts and defeated enemies are filtered out.
- Active foxes, Baron Breadstorm, and connected geese remain detectable.

### Validation

- Added grounded restart-spawn regression coverage.
- Added evolved-geometry overlap coverage.
- Added availability filtering coverage for every Flock Sense target category.

## 1.6.0 — Mobile Symphony

### Restart safety

- Changed pause-menu mission restart into an explicit fresh-world transition.
- Cleared the active Goose Post only for deliberate mission restarts.
- Added final-layout spawn validation after Echo-generated platforms are created.
- Added safe-surface fallback when a requested spawn overlaps or lacks supporting geometry.
- Reset previous position, velocity, grounded state, and camera position before simulation resumes.

### Generative soundtrack

- Replaced the basic adaptive loop with a look-ahead Web Audio score scheduler.
- Added deterministic chord progressions, modes, bass movement, melodic motifs, pads, percussion, shimmer, delay, swing, and layer-based instrument tiers.
- Added boss-specific rhythmic density, harmonic stabs, and orchestral intensity.
- Added smooth crossfades between Echo Layer and boss-state arrangements.

### Responsive throwing and input

- Buffered hardware press/release edges so very fast taps between frames are not lost.
- Added virtual action input for touch controls using the same remappable action layer.
- Increased quick-toss velocity, shortened full-charge time, shortened recovery, and created projectiles immediately.

### Mobile controls and controller expansion

- Added automatic touch-capability detection and optional on-screen controls.
- Added Auto, Always on, and Off mobile-control settings.
- Hid automatic touch controls when a controller is connected and restored them after disconnect.
- Added mobile movement, jump, attack, throw, honk, dash, interaction, Flock Sense, and pause controls.
- Preserved RB as Dash and assigned LT to the new Flock Sense action.
- Added Flock Sense visualization for nearby treasure, crystals, foxes, bosses, checkpoints, and geese.

### Interface cleanup

- Consolidated adventure counters into one compact HUD chip.
- Prioritized health, flaps, ammunition, and Echo Layer progress.
- Added responsive HUD reduction for small and touch displays.
- Removed the no-nearby-player interaction toast while preserving wing-bump behavior.
- Added save schema version 6 for mobile-control preferences and the new default binding.

### Validation

- Expanded the suite to 27 passing tests and 102 validated JavaScript modules.
- Added regression coverage for restart spawn safety, touch-control policy, LT/RB bindings, advanced music orchestration, and faster quick throws.
- Compiled 741 modules in the production client.

## 1.5.0 — Goose Flow

### Tabbed Mission Control

- Split the pause screen into compact Mission, Controls, and Settings tabs.
- Kept control bindings and settings hidden until their tab is selected.
- Added accessible tab roles, selected state, arrow-key navigation, Home/End navigation, and focus transfer.
- Added master, music, and effects volume sliders.
- Added a separate adaptive-layer-music setting while preserving persistent remapping and default reset.

### World safety recovery

- Added `WorldSafetySystem` with horizontal, ceiling, floor, and embedded-ground escape detection.
- Added delayed recovery to prevent false positives during normal movement.
- Added automatic return to the latest Goose Post with restored health, jumps, and velocity.
- Added a dedicated player-facing recovery message and `world:safety-recovery` event.

### Charged crumb throwing

- Replaced instant fixed-speed throws with press, hold, and release charging.
- Added short quick tosses, medium throws, and full-power long throws.
- Scaled projectile speed, lift, lifetime, size, spin, knockback, visual effects, and damage by charge.
- Added a visible charge ring and full-charge Power Crumb feedback.
- Synchronized charge, lift, duration, strength, and damage through the multiplayer action protocol.
- Added server sanitation for every charged-projectile field.

### Movement and animation

- Added crouch-walking at 36% normal ground speed.
- Synchronized crouching state to remote players.
- Added procedural breathing, blinking, head motion, walking bob, crouch sneak, attack, throw-charge, and airborne animation states.

### Adaptive Echo soundtrack

- Replaced the world’s fixed root-92 tone bed with a procedural layer-aware score.
- Added deterministic root, mode, tempo, waveform, melodic density, and rhythmic changes by Echo Layer.
- Added escalating music intensity during Baron Breadstorm phases.
- Retained a simple tone-bed fallback when adaptive music is disabled.
- Added save schema version 5 for music/effects volume and adaptive-music preferences.

### Validation

- Expanded the suite to 22 passing tests and 99 validated JavaScript modules.
- Added regression coverage for charged throws, crouch walking, world safety, adaptive music, pause tabs, remote crouching, and charged-projectile transport.
- Compiled 739 modules in the production client.

## 1.4.0 — Echo Arsenal

### Progression repair

- Fixed the Echo Layer 5 progression stall by replacing finite layer rewards with renewable advancement sources.
- Guaranteed each generated layer has a one-pass XP budget of at least 128% of its next evolution goal.
- Added at least two repeatable honk-activated Echo Resonators to every layer.
- Added respawn timers to generated collectibles and rare renewable Echo Caches at Layer 5 and above.
- Added regression coverage for Layers 1 through 24 and an explicit Layer 5 anti-stall test.

### Echo Arsenal combat

- Preserved Wing Whap as a dedicated close-range attack on `J` / right trigger.
- Added throwable crumb projectiles on keyboard `X` / controller X.
- Added persistent crumb ammunition, HUD feedback, pickup refills, empty-ammo messaging, projectile spin, gravity, damage, and knockback.
- Added crumb hits against ordinary Bread Foxes and Baron Breadstorm after his shield is broken.
- Added synchronized remote throw reactions and cosmetic projectiles.
- Added a two-client transport assertion for projectile owner, position, facing, and speed.

### Richer world evolution

- Expanded evolving layers with auroras, atmospheric motes, crystal gardens, lantern groves, banners, flowers, wind ribbons, and floating islands.
- Added updraft, phase, crystal, and lantern platform mutations.
- Added evolving sky, horizon, mountain, moon, platform, edge, glow, and accent palettes.
- Added infinite palette cycling and continued route, collectible, and fox escalation beyond the named stages.

### Collectibles

- Added Crumbs, Echo Crumbs, Golden Feathers, Moon Tokens, Flock Stars, Hearts, Prism Seeds, and Echo Caches.
- Added distinct art, rewards, Echo XP, flock-energy values, healing, jump restoration, ammunition, and respawn behavior.
- Added persistent collectible totals and new exploration/combat achievements.

### Mission Control and remapping

- Removed the always-visible gameplay button explainer.
- Added a full control reference to the pause menu with action descriptions and current keyboard/controller bindings.
- Added live keyboard and controller-button capture, persistent custom bindings, and one-click default reset.
- Added pause-menu music, sound-effects, and screen-shake settings.
- Added save schema version 4 with v1.3 migration for controls, crumb ammunition, and collectible totals.

### Validation

- Expanded the release gate to 17 passing test groups and 96 validated JavaScript modules.
- Compiled 737 modules in the production client.

## 1.3.0 — Living Goose World

### Endless personal progression

- Replaced the one-time mission ending with a persistent world-evolution loop.
- Added saved Echo Layer level, Echo XP, cycle count, deterministic seed, and boss victories.
- Added automatic v1.2-to-v1.3 save migration through schema version 3.
- Added deterministic personal platform, collectible, and Bread Fox generation.
- Added six named evolution atmospheres with an infinite final scaling tier.
- Added escalating platform counts, enemy counts, fox ranks, movement speed, and low-gravity flight feel.
- Converted Foxfire Gate into an evolution trigger that remixes the world without leaving the shared area.
- Added visible remote-player Echo Layer badges and evolution reactions.

### Shared Flock Crisis

- Added authoritative room Flock Energy and escalating crisis goals.
- Added bounded contributions from crumbs, Echo Crumbs, fox defeats, crystals, and player interactions.
- Added late-join synchronization for Flock Energy, boss victories, and active boss state.
- Added offline fallback progression and boss simulation.
- Added room-state sanitation for evolution level, flock-energy events, and boss-hit events.

### Baron Breadstorm

- Added a new large-scale Foxfire Fortress boss with custom art, crown, toast armor, phase display, health bar, and shield bar.
- Added three escalating combat phases.
- Added charge attacks, airborne movement, explosive toast volleys, and Breadstorm honk waves.
- Added server-authoritative health, shield, phase, cycle, and victory calculations.
- Added honk-only Echo Shields that renew at phase transitions.
- Added room-population and victory-cycle difficulty scaling.
- Added shared victory rewards, Echo XP, achievements, effects, and next-crisis escalation.

### Interface and diagnostics

- Added Echo Layer, Echo XP, Flock Energy, boss health, shield, and victory status to the gameplay HUD.
- Added Echo Layer, Flock Energy, and boss information to F3 diagnostics.
- Updated the menu with persistent evolution and boss-victory status.
- Updated story guidance so Foxfire Gate clearly continues rather than ends the adventure.

### Validation

- Added deterministic evolution generation tests.
- Added complete room-level Breadstorm simulation tests covering shields, phases, victory, and late joiners.
- Expanded the release gate to 13 passing test groups and 90 validated JavaScript modules.

## 1.2.0 — The Great Goose Adventure

### Movement and goose feel

- Replaced double jump with a three-stage jump system.
- Added a stronger third wing flap with feather effects and a brief low-gravity glide while jump is held.
- Added airborne wing animation, jump-stage audio, jump HUD state, and the `Almost Flying` achievement.
- Restored honk as a first-class combat, puzzle, visual, audio, and multiplayer action.
- Added expanding HONK pulse effects and remote-player honk reactions.
- Added nearby-player wing-bumps through `E` or gamepad Y.

### Bread Fox repair

- Rebuilt Bread Fox behavior as patrol, chase, wind-up, charge, stunned, and recovery states.
- Fixed direction thrashing after knockback and patrol-boundary crossings.
- Added stable landing behavior, fall recovery, chase ranges, charge attacks, health bars, animation, ranks, and visual polish.
- Added scouts, guards, and the Captain Crust encounter.
- Added synchronized enemy-hit and enemy-defeat world events.

### Adventure world

- Expanded the mission from 4,800 to 9,600 world pixels.
- Added seven named regions with varied elevation and traversal rhythm.
- Added grass, bridge, cloud, moving, ruin, fortress, and trampoline platform presentation.
- Added water and thorn hazards.
- Added three persistent Goose Post checkpoints.
- Added three honk-activated Echo Crystals and a locked final gate.
- Added richer mountain, hill, moon, star, cloud, ruin, tree, mushroom, and sign scenery.
- Expanded story beats, collectibles, enemy encounters, and vertical routes.

### Shared multiplayer world

- Added remote velocity, grounded state, and flight animation data.
- Added room-wide player count and flock join/leave messaging.
- Added targeted action payloads for wing-bumps.
- Added player-to-player honk impulse and reaction behavior.
- Added room world-state storage for activated crystals and defeated enemies.
- Added late-join world-state synchronization.
- Added sanitized `world:event` transport for cooperative progression.
- Added an automated three-client test for action relay and late-join state.

### Engine polish

- Deferred music creation until the browser has received a valid user gesture.
- Added public `exportSave()` and `importSave()` methods while retaining computed compatibility aliases.
- Removed the Vite false-positive warning caused by a method named `import()`.
- Added a proper SVG favicon and updated production metadata.
- Updated server health metadata to v1.2.0.

## 1.1.0

### Engine hardening

- Added explicit engine lifecycle states and fatal frame-loop handling.
- Serialized scene transitions so requests are never silently discarded.
- Added complete scene load/enter/pause/resume/exit/unload/destroy semantics.
- Added abort-scoped scene event listeners.
- Added buffered, consumable input actions and runtime binding export/import.
- Added controller-driven DOM focus navigation.
- Added time scaling, visibility handling, fixed-step statistics, and dropped-frame tracking.
- Added spatial-hash broad phase and complete collision exit contacts.
- Added automatic physics cleanup when entities are removed.
- Added versioned save migrations, storage recovery, snapshots, JSON export/import, and reset.
- Added plugin dependency rollback, runtime enable/disable, and lifecycle status.
- Added bounded network queues, reconnect cleanup, room rejoin, peer state tracking, and latency measurement.
- Added F3 diagnostics with FPS, frame timing, scene depth, entity count, collision count, network status, and collider drawing.
- Added a public `src/engine/index.js` export surface.
