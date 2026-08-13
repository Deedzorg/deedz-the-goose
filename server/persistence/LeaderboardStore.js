import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class LeaderboardStore {
  constructor(filePath, { limit = 100 } = {}) {
    this.filePath = filePath;
    this.limit = limit;
    this.entries = [];
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.entries = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[Leaderboard] Could not read store:', error.message);
      this.entries = [];
    }
    this.loaded = true;
  }

  async submit({ name = 'Anonymous Goose', score = 0, character = 'deedz' } = {}) {
    await this.load();
    const cleanName = String(name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 32) || 'Anonymous Goose';
    const cleanCharacter = String(character).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'deedz';
    const cleanScore = Math.max(0, Math.min(1000000000, Math.floor(Number(score) || 0)));
    const entry = { id: crypto.randomUUID(), name: cleanName, score: cleanScore, character: cleanCharacter, createdAt: new Date().toISOString() };
    this.entries.push(entry);
    this.entries.sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
    this.entries = this.entries.slice(0, this.limit);
    await this.#persist();
    return entry;
  }

  async top(limit = 20) {
    await this.load();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    return this.entries.slice(0, safeLimit).map((entry) => ({ ...entry }));
  }

  async #persist() {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const temp = `${this.filePath}.tmp`;
      await writeFile(temp, JSON.stringify(this.entries, null, 2), 'utf8');
      await rename(temp, this.filePath);
    });
    return this.writeQueue;
  }
}
