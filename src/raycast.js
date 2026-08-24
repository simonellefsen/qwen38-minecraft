import { H } from './world.js';

// Voxel traversal (Amanatides & Woo). Returns the cell hit plus the previous
// cell (the neighbor the ray came from, useful for block placement).
export function raycast(world, origin, dir, maxDist = 6) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX = dir.x < 0 ? (x - origin.x) * tDeltaX : (x + 1 - origin.x) * tDeltaX;
  let tMaxY = dir.y < 0 ? (y - origin.y) * tDeltaY : (y + 1 - origin.y) * tDeltaY;
  let tMaxZ = dir.z < 0 ? (z - origin.z) * tDeltaZ : (z + 1 - origin.z) * tDeltaZ;

  let px = x, py = y, pz = z;
  let t = 0;

  for (let i = 0; i < 512; i++) {
    const id = world.get(x, y, z);
    if (id !== 0) {
      return { x, y, z, px, py, pz, id, t };
    }
    px = x;
    py = y;
    pz = z;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
    }
    if (t > maxDist || y < 0 || y >= H) break;
  }
  return null;
}
