export class SpatialHash {
  constructor(cellSize = 128) {
    this.cellSize = Math.max(16, cellSize);
    this.cells = new Map();
  }

  #key(x, y) { return `${x},${y}`; }
  #range(collider) {
    return {
      minX: Math.floor(collider.left / this.cellSize),
      maxX: Math.floor(collider.right / this.cellSize),
      minY: Math.floor(collider.top / this.cellSize),
      maxY: Math.floor(collider.bottom / this.cellSize),
    };
  }

  insert(collider) {
    const range = this.#range(collider);
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        const key = this.#key(x, y);
        const cell = this.cells.get(key) ?? [];
        cell.push(collider);
        this.cells.set(key, cell);
      }
    }
  }

  rebuild(colliders) {
    this.cells.clear();
    for (const collider of colliders) if (collider.enabled) this.insert(collider);
  }

  candidatePairs() {
    const pairKeys = new Set();
    const pairs = [];
    for (const cell of this.cells.values()) {
      for (let i = 0; i < cell.length; i += 1) {
        for (let j = i + 1; j < cell.length; j += 1) {
          const a = cell[i];
          const b = cell[j];
          if (a === b) continue;
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          if (pairKeys.has(key)) continue;
          pairKeys.add(key);
          pairs.push([a, b, key]);
        }
      }
    }
    return pairs;
  }

  clear() { this.cells.clear(); }
}
