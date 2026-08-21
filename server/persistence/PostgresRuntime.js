import postgres from 'postgres';

const CHANNEL = 'deedz_global_events';

export class PostgresRuntime {
  constructor(connectionString = '', { instanceId = crypto.randomUUID() } = {}) {
    this.connectionString = String(connectionString || '').trim();
    this.instanceId = instanceId;
    this.enabled = Boolean(this.connectionString);
    this.sql = this.enabled ? postgres(this.connectionString, { max: 6, idle_timeout: 20, connect_timeout: 10 }) : null;
    this.unlisten = null;
  }

  async init() {
    if (!this.enabled) return;
    await this.sql`
      create table if not exists deedz_leaderboard (
        id uuid primary key,
        name text not null,
        score bigint not null check (score >= 0),
        character text not null,
        created_at timestamptz not null default now()
      )
    `;
    await this.sql`create index if not exists deedz_leaderboard_score_idx on deedz_leaderboard (score desc, created_at asc)`;
  }

  async submitLeaderboard(entry) {
    if (!this.enabled) throw new Error('Postgres runtime is disabled');
    const [row] = await this.sql`
      insert into deedz_leaderboard (id, name, score, character, created_at)
      values (${entry.id}, ${entry.name}, ${entry.score}, ${entry.character}, ${entry.createdAt})
      returning id, name, score, character, created_at
    `;
    return this.#mapEntry(row);
  }

  async topLeaderboard(limit = 20) {
    if (!this.enabled) throw new Error('Postgres runtime is disabled');
    const rows = await this.sql`
      select id, name, score, character, created_at
      from deedz_leaderboard
      order by score desc, created_at asc
      limit ${limit}
    `;
    return rows.map((row) => this.#mapEntry(row));
  }

  async publish(event) {
    if (!this.enabled) return;
    const payload = JSON.stringify({ ...event, sourceInstanceId: this.instanceId, publishedAt: Date.now() });
    if (Buffer.byteLength(payload, 'utf8') > 7000) throw new Error('Backplane payload too large');
    await this.sql.notify(CHANNEL, payload);
  }

  async subscribe(handler) {
    if (!this.enabled || this.unlisten) return;
    this.unlisten = await this.sql.listen(CHANNEL, (payload) => {
      try {
        const event = JSON.parse(payload);
        if (event?.sourceInstanceId === this.instanceId) return;
        handler(event);
      } catch (error) {
        console.warn('[Backplane] Ignored invalid event:', error.message);
      }
    });
  }

  async close() {
    try { await this.unlisten?.(); } catch {}
    this.unlisten = null;
    if (this.sql) await this.sql.end({ timeout: 5 });
  }

  #mapEntry(row) {
    return {
      id: String(row.id),
      name: String(row.name),
      score: Number(row.score),
      character: String(row.character),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
