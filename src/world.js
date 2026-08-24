import { AIR, GRASS, DIRT, STONE, LEAVES, LOG, SAND, WATER, BEDROCK, isSolid } from './blocks.js';
import { fbm2, hash2 } from './noise.js';

export const CS = 16;
export const W = Infinity;
export const H = 64;
const SEA = 18;
const SEED = 1337;
const KEY = 'voxelcraft-edits.v1';

export function ck(cx, cz) {
  return cx + ',' + cz;
}

export class World {
  constructor() {
    this.chunks = new Map();
    this.edits = new Map();
    this.loadEdits();
    this.generationDone = false;
  }

  loadEdits() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        for (const [k, v] of arr) this.edits.set(k, v);
      }
    } catch {
      /* ignore corrupt save */
    }
  }

  saveEdits() {
    try {
      const arr = [...this.edits];
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch {
      /* storage full or blocked: keep playing */
    }
  }

  resetEdits() {
    this.edits.clear();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  }

  key(x, y, z) {
    return x + ',' + y + ',' + z;
  }

  get(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= H) return AIR;
    const e = this.edits.get(this.key(x, y, z));
    if (e !== undefined) return e;
    return this.terrain(x, y, z);
  }

  set(x, y, z, id) {
    if (y < 0 || y >= H) return;
    if (this.terrain(x, y, z) !== id) {
      this.edits.set(this.key(x, y, z), id);
      this.saveEdits();
    } else {
      this.edits.delete(this.key(x, y, z));
      this.saveEdits();
    }
  }

  heightAt(x, z) {
    for (let y = H - 1; y >= 0; y--) {
      if (isSolid(this.get(x, y, z))) return y;
    }
    return 0;
  }

  isTreeTrunk(x, y, z) {
    if (this.get(x, y, z) !== LOG) return false;
    return this.get(x, y + 1, z) === LOG && this.get(x, y - 1, z) !== LOG;
  }

  isLeafInTree(x, y, z) {
    if (this.get(x, y, z) !== LEAVES) return false;
    for (let dy = 0; dy <= 5; dy++) {
      if (this.isTreeTrunk(x, y - dy, z)) return true;
    }
    return false;
  }

  // Deterministic pseudo-random for a coordinate (independent of edits).
  static h(x, z, salt) {
    return hash2(x, z, SEED + salt);
  }

  static terrainHeights(x, z) {
    const n0 = fbm2(x * 0.0045, z * 0.0045, 1, 4);
    const n1 = fbm2(x * 0.02, z * 0.02, 2, 3);
    const n2 = fbm2(x * 0.09, z * 0.09, 3, 2);
    // 0..1 -> height
    let h = (n0 - 0.5) * 2; // centered
    h = h * h * Math.sign(h); // steeper extremes
    let hh = Math.floor(SEA + 6 + h * 26 + n1 * 5 + n2 * 2);
    if (hh < 1) hh = 1;
    if (hh >= H - 8) hh = H - 8;
    return hh;
  }

  treeAt(x, z) {
    // A tree occupies (x,z) if this is its trunk position.
    if (World.h(x, z, 77) > 0.0035) return null;
    const hh = World.terrainHeights(x, z);
    if (hh <= SEA) return null; // no trees in sea
    if (hh < 6 || hh > H - 10) return null;
    const hgt = 4 + Math.floor(World.h(x, z, 78) * 3);
    return { x, z, base: hh, height: hgt };
  }

  terrain(x, y, z) {
    const hh = World.terrainHeights(x, z);
    const t = this.treeAt(x, z);
    if (t) {
      const ty = t.base + 1;
      const relY = y - ty;
      const r = Math.max(Math.abs(x - t.x), Math.abs(z - t.z));
      if (relY >= 0 && r === 0 && relY < t.height) return LOG;
      const canopy = t.height - 2;
      if (relY >= canopy - 1 && relY <= t.height + 1) {
        const rc = Math.abs(x - t.x) + Math.abs(z - t.z);
        const maxR = relY >= t.height ? 1 : 2;
        if (rc <= maxR && !(relY === t.height + 1 && rc > 0)) {
          if (World.h(x * 13, z * 17 + y, 99) > 0.12) return LEAVES;
        }
      }
    }
    if (y === 0) return BEDROCK;
    if (y > hh) {
      if (y <= SEA) return WATER;
      return AIR;
    }
    if (y === hh) {
      if (hh <= SEA + 1) return SAND;
      return GRASS;
    }
    if (y >= hh - 3) return DIRT;
    if (World.h(x, z, 5) < 0.22 && y < hh - 9) return STONE; // stone pockets are just stone anyway
    return STONE;
  }
}
