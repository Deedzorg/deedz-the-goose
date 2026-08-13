# Deedz Engine Architecture

## Ownership

`DeedzEngine` is the composition root. It creates every engine service and owns their shutdown order. Services communicate through stable public methods and the event bus rather than reaching into one another's private state.

The game is supplied as a `GameApp`. It provides configuration, assets, default save data, network identity, plugins, scenes, initialization, startup, and shutdown hooks.

## Frame order

Each animation frame follows this order:

1. Poll keyboard and gamepad state.
2. Run zero or more fixed updates at the configured fixed step.
3. Update plugins.
4. Update entities and components when the active scene does not block the world.
5. Integrate physics bodies and generate collision events.
6. Run the active scene fixed update.
7. Update diagnostics and controller-driven DOM navigation.
8. Update networking, plugins, entities, the active scene, and the camera.
9. Render scene interpolation hooks, debug geometry, and the Pixi stage.
10. Clear one-frame device state.

Input presses are buffered and consumed so a press is not lost when a rendered frame contains no fixed step, and is not repeated across several fixed substeps.

## Scene contract

Scene transitions are serialized through a promise queue. Calls made while another transition is running are not discarded.

Lifecycle:

```text
factory → load → enter → pause/resume → exit → unload → destroy
```

A pushed scene can set `blocksWorld` to suspend entity and physics updates beneath it. Scenes receive an `AbortSignal`; listeners registered through `scene.on()` are removed automatically on destruction.

## Entity and physics contract

Entities own display objects and components. The entity manager owns entity lifetime. Physics listens for `entity:removing`, so bodies and colliders cannot remain after an entity is destroyed.

Physics integrates velocity using a fixed timestep. A spatial hash reduces broad-phase collision candidates. The collision system emits complete `collision:enter`, `collision:stay`, and `collision:exit` contacts containing both colliders.

Collision response is deliberately game-policy driven. Deedz The Goose demonstrates one-way platform landing, moving-platform carry, and trampoline response without embedding platformer assumptions into the reusable engine.

## Error boundaries

Startup, plugins, scene transitions, the frame loop, assets, saves, audio, networking, browser errors, and unhandled promises report through `engine:error` or subsystem events. Fatal frame errors stop the loop and move the engine into `failed` state instead of continuing corrupted simulation.

## Extensibility rules

- Prefer public service methods over nested implementation access.
- Prefer events for cross-domain reactions.
- Keep game vocabulary outside `src/engine`.
- Put optional reusable behavior in plugins.
- Keep simulation in fixed updates and presentation smoothing in variable updates.
- Treat client network state as untrusted on production servers.
