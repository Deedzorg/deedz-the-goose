# Networking Protocol

All WebSocket messages use:

```json
{
  "type": "state",
  "payload": {},
  "sentAt": 1782864000000
}
```

## Client to server

- `join`: `{ room, profile }`
- `state`: `{ x, y, facing, character, velocityX, velocityY, grounded, evolutionLevel }`
- `action`: `{ action, x, y, facing, targetId?, strength?, range? }`
- `world:event`: `{ event, ...eventData }`
- `leaderboard:request`: `{ limit }`
- `leaderboard:submit`: `{ name, character, score }`
- `ping`: `{ clientTime }`

## Server to client

- `welcome`: client identifier
- `joined`: room identifier, current peers, and shared world state
- `peer-join`: peer identity and profile
- `peer-leave`: peer identifier
- `state`: sanitized peer snapshot
- `action`: sanitized peer action
- `world:event`: sanitized shared-world event or authoritative boss result
- `leaderboard:update`: ranked entries
- `pong`: echoed client time and server time
- `error`: safe protocol error

## Actions

The reference game currently uses:

- `attack`
- `honk`
- `dash`
- `wing-bump`
- `evolution`

`wing-bump` uses `targetId` so only the intended player applies the local impulse. Honk actions include bounded `strength` and `range` values. Evolution is a presentation action that lets remote players react when another goose advances to a new personal Echo Layer.

## Shared world events

Allowed room events are:

- `enemy-hit`: transient ordinary-enemy damage and knockback relay
- `enemy-defeated`: persisted in the room until the room closes
- `crystal-activated`: persisted in the room until the room closes
- `flock-energy`: bounded contribution to the room crisis meter
- `boss-hit`: authoritative Baron Breadstorm damage request

### Flock Energy

Clients send:

```json
{
  "event": "flock-energy",
  "amount": 8,
  "reason": "Echo crumb"
}
```

The server caps each contribution, updates the room meter, and returns the authoritative total. When the goal is reached, the same event includes the newly created boss state.

### Boss hits

Clients send:

```json
{
  "event": "boss-hit",
  "bossId": "baron-breadstorm",
  "damage": 2,
  "hitType": "honk"
}
```

The server decides whether the hit damages the shield or health, updates phase transitions, restores phase shields, resolves victory, and broadcasts the resulting boss snapshot to every player including the sender.

Melee and dash damage are rejected while an Echo Shield is active. Honk hits damage shields. Once a shield reaches zero, normal damage can reduce health until the next phase restores a new shield.

## Joined world snapshot

The `joined` payload contains:

```json
{
  "worldState": {
    "activatedCrystals": ["meadow"],
    "defeatedEnemies": ["bread-captain"],
    "flockEnergy": 92,
    "flockGoal": 180,
    "bossWins": 0,
    "boss": {
      "id": "baron-breadstorm-1",
      "active": true,
      "defeated": false,
      "hp": 44,
      "maxHp": 56,
      "shield": 5,
      "maxShield": 9,
      "phase": 2,
      "cycle": 1
    }
  }
}
```

This lets late joiners enter the current cooperative crisis rather than a fresh local copy.

## Personal versus shared state

Personal Echo Layer generation is intentionally not synchronized. Each browser saves its own layer, XP, cycle, and seed. Remote geese send `evolutionLevel` with movement state so other players can see their progression badge while remaining in the same base-world coordinate system.

Shared room state covers only the cooperative foundation and crisis:

- Players and actions
- Echo Crystals
- Shared ordinary-enemy defeats
- Flock Energy
- Baron Breadstorm

## Reliability behavior

The browser client queues a bounded number of outbound messages while disconnected and reconnects with exponential backoff plus jitter. The manager rejoins the configured room after reconnecting, receives the current world snapshot, and measures round-trip latency.

The server limits message size and rate, sanitizes room/profile/state/action/world-event fields, enforces room capacity, and terminates dead connections using heartbeat pings.

## Current authority boundary

The server is authoritative for room presence, Flock Energy, and Baron Breadstorm's health, shield, phases, cycle, and victory result. Movement, ordinary enemies, local collisions, collectibles, and personal Echo Layer generation remain client-side.

A competitive or economy-sensitive release should additionally move movement, ordinary enemy simulation, collision validation, collectibles, personal rewards, and checkpoint ownership to authenticated durable server infrastructure.
