function cleanProfile(profile = {}) {
  return {
    name: String(profile.name || 'Anonymous Goose').trim().slice(0, 24) || 'Anonymous Goose',
    character: String(profile.character || 'deedz').slice(0, 24),
  };
}

function cleanState(state = {}) {
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    x: Math.max(-100000, Math.min(100000, number(state.x))),
    y: Math.max(-100000, Math.min(100000, number(state.y))),
    facing: state.facing === -1 ? -1 : 1,
    character: String(state.character || 'deedz').slice(0, 24),
    velocityX: Math.max(-2000, Math.min(2000, number(state.velocityX))),
    velocityY: Math.max(-2000, Math.min(2000, number(state.velocityY))),
    grounded: Boolean(state.grounded),
    crouching: Boolean(state.crouching),
    evolutionLevel: Math.max(1, Math.min(999, Math.floor(number(state.evolutionLevel, 1)))),
    updatedAt: Date.now(),
  };
}

function cleanId(value, maxLength = 48) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLength);
}

function cleanWorldEvent(payload = {}) {
  const event = String(payload.event || '').slice(0, 32);
  const allowed = new Set(['enemy-hit', 'enemy-defeated', 'crystal-activated', 'flock-energy', 'boss-hit']);
  if (!allowed.has(event)) throw new Error('Unsupported world event');
  if (event === 'crystal-activated') return { event, crystalId: cleanId(payload.crystalId) };
  if (event === 'flock-energy') {
    return {
      event,
      amount: Math.max(1, Math.min(30, Math.floor(Number(payload.amount) || 1))),
      reason: String(payload.reason || 'Adventure').slice(0, 48),
    };
  }
  if (event === 'boss-hit') {
    const hitType = ['attack', 'honk', 'dash', 'crumb'].includes(payload.hitType) ? payload.hitType : 'attack';
    return {
      event,
      bossId: cleanId(payload.bossId || 'baron-breadstorm'),
      damage: Math.max(1, Math.min(8, Number(payload.damage) || 1)),
      hitType,
    };
  }
  return {
    event,
    enemyId: cleanId(payload.enemyId),
    damage: Math.max(0, Math.min(20, Number(payload.damage) || 0)),
    knockbackX: Math.max(-1200, Math.min(1200, Number(payload.knockbackX) || 0)),
    knockbackY: Math.max(-1200, Math.min(1200, Number(payload.knockbackY) || 0)),
  };
}

function createWorldState() {
  return {
    activatedCrystals: new Set(),
    defeatedEnemies: new Set(),
    flockEnergy: 0,
    flockGoal: 180,
    bossWins: 0,
    boss: null,
  };
}

function cloneBoss(boss) { return boss ? { ...boss } : null; }

export class RoomManager {
  constructor({ maxRoomSize = 64 } = {}) {
    this.maxRoomSize = maxRoomSize;
    this.rooms = new Map();
    this.clientRoom = new Map();
    this.worldStates = new Map();
  }

  join(client, roomId = 'goose-lobby', profile = {}) {
    this.leave(client);
    const normalizedRoomId = String(roomId || 'goose-lobby').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || 'goose-lobby';
    const room = this.rooms.get(normalizedRoomId) ?? new Map();
    if (room.size >= this.maxRoomSize) throw new Error('Room is full');
    const member = { id: client.id, socket: client.socket, profile: cleanProfile(profile), joinedAt: Date.now(), state: null };
    room.set(client.id, member);
    this.rooms.set(normalizedRoomId, room);
    this.clientRoom.set(client.id, normalizedRoomId);
    if (!this.worldStates.has(normalizedRoomId)) this.worldStates.set(normalizedRoomId, createWorldState());
    return {
      roomId: normalizedRoomId,
      member,
      peers: [...room.values()].filter((peer) => peer.id !== client.id).map((peer) => this.publicMember(peer)),
      worldState: this.getWorldState(normalizedRoomId),
    };
  }

  leave(client) {
    const roomId = this.clientRoom.get(client.id);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    room?.delete(client.id);
    this.clientRoom.delete(client.id);
    if (room?.size === 0) {
      this.rooms.delete(roomId);
      this.worldStates.delete(roomId);
    }
    return roomId;
  }

  updateState(client, state) {
    const member = this.getMember(client.id);
    if (member) member.state = cleanState(state);
    return member?.state ?? null;
  }

  applyWorldEvent(client, payload) {
    const roomId = this.clientRoom.get(client.id);
    if (!roomId) throw new Error('Join a room first');
    const room = this.rooms.get(roomId);
    const event = cleanWorldEvent(payload);
    const state = this.worldStates.get(roomId) ?? createWorldState();

    if (event.event === 'crystal-activated' && event.crystalId) state.activatedCrystals.add(event.crystalId);
    if (event.event === 'enemy-defeated' && event.enemyId) state.defeatedEnemies.add(event.enemyId);

    if (event.event === 'flock-energy') {
      if (!state.boss?.active) state.flockEnergy = Math.min(state.flockGoal, state.flockEnergy + event.amount);
      if (state.flockEnergy >= state.flockGoal && !state.boss?.active) {
        const cycle = state.bossWins + 1;
        const players = Math.max(1, room?.size ?? 1);
        const maxHp = 34 + cycle * 10 + players * 6;
        const maxShield = 4 + cycle + players * 2;
        state.boss = {
          id: `baron-breadstorm-${cycle}`,
          active: true,
          defeated: false,
          hp: maxHp,
          maxHp,
          shield: maxShield,
          maxShield,
          phase: 1,
          cycle,
          spawnedAt: Date.now(),
        };
      }
      this.worldStates.set(roomId, state);
      return {
        ...event,
        flockEnergy: state.flockEnergy,
        flockGoal: state.flockGoal,
        bossWins: state.bossWins,
        boss: cloneBoss(state.boss),
      };
    }

    if (event.event === 'boss-hit') {
      let damageApplied = 0;
      let shieldDamage = 0;
      const boss = state.boss;
      if (boss?.active && !boss.defeated) {
        if (boss.shield > 0) {
          if (event.hitType === 'honk') {
            shieldDamage = Math.min(boss.shield, Math.ceil(event.damage * 2));
            boss.shield = Math.max(0, boss.shield - shieldDamage);
          }
        } else {
          damageApplied = Math.min(boss.hp, event.damage);
          boss.hp = Math.max(0, boss.hp - damageApplied);
          const ratio = boss.hp / Math.max(1, boss.maxHp);
          const nextPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
          if (nextPhase > boss.phase && boss.hp > 0) {
            boss.phase = nextPhase;
            boss.maxShield = 3 + boss.phase * 2 + Math.max(1, room?.size ?? 1);
            boss.shield = boss.maxShield;
          }
          if (boss.hp <= 0) {
            boss.active = false;
            boss.defeated = true;
            boss.defeatedAt = Date.now();
            state.bossWins += 1;
            state.flockEnergy = 0;
            state.flockGoal = Math.min(900, 180 + state.bossWins * 45);
          }
        }
      }
      this.worldStates.set(roomId, state);
      return {
        ...event,
        attackerId: client.id,
        damageApplied,
        shieldDamage,
        flockEnergy: state.flockEnergy,
        flockGoal: state.flockGoal,
        bossWins: state.bossWins,
        boss: cloneBoss(state.boss),
      };
    }

    this.worldStates.set(roomId, state);
    return event;
  }

  getWorldState(roomId) {
    const state = this.worldStates.get(roomId) ?? createWorldState();
    return {
      activatedCrystals: [...state.activatedCrystals],
      defeatedEnemies: [...state.defeatedEnemies],
      flockEnergy: state.flockEnergy,
      flockGoal: state.flockGoal,
      bossWins: state.bossWins,
      boss: cloneBoss(state.boss),
    };
  }

  getMember(clientId) {
    const roomId = this.clientRoom.get(clientId);
    return roomId ? this.rooms.get(roomId)?.get(clientId) : null;
  }

  broadcastFrom(client, message, { includeSender = false } = {}) {
    const roomId = this.clientRoom.get(client.id);
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    const payload = JSON.stringify({ ...message, sentAt: Date.now() });
    let sent = 0;
    for (const member of room.values()) {
      if ((includeSender || member.id !== client.id) && member.socket.readyState === 1) {
        member.socket.send(payload);
        sent += 1;
      }
    }
    return sent;
  }

  publicMember(member) { return { id: member.id, profile: member.profile, state: member.state, joinedAt: member.joinedAt }; }
  stats() { return { rooms: this.rooms.size, clients: this.clientRoom.size, occupancy: [...this.rooms].map(([id, room]) => ({ id, clients: room.size })) }; }
}
