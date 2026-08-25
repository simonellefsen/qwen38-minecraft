import * as THREE from 'three';
import { BLOCKS, isOpaque, WATER } from './blocks.js';
import { H } from './world.js';

// Face table. Corner: [x, y, z, localU(0|1), localV(0|bottom)].
const FACES = [
  {
    d: [1, 0, 0],
    c: [
      [1, 1, 1, 1, 0],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 0, 0, 0],
    ],
  },
  {
    d: [-1, 0, 0],
    c: [
      [0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 1, 1],
    ],
  },
  {
    d: [0, 1, 0],
    c: [
      [0, 1, 0, 0, 0],
      [0, 1, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 0, 1, 0],
    ],
  },
  {
    d: [0, -1, 0],
    c: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 1, 0],
    ],
  },
  {
    d: [0, 0, 1],
    c: [
      [0, 0, 1, 0, 1],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 0, 1, 1, 1],
    ],
  },
  {
    d: [0, 0, -1],
    c: [
      [1, 0, 0, 1, 1],
      [1, 1, 0, 1, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1],
    ],
  },
];

// Minecraft-style ambient-occlusion factors per level (0..3).
const AO_FACT = [0.45, 0.66, 0.85, 1.0];

export function buildUVMap(atlasJSON, sheetW, sheetH) {
  const map = {};
  for (const [name, f] of Object.entries(atlasJSON.frames || {})) {
    const ft = f.frame;
    map[name] = {
      u0: ft.x / sheetW,
      v0: ft.y / sheetH,
      u1: (ft.x + ft.w) / sheetW,
      v1: (ft.y + ft.h) / sheetH,
    };
  }
  return map;
}

// Classic AO: two side probes + one corner probe per vertex.
function vertexAO(world, gx, y, gz, face, p) {
  const A = face.d[0] !== 0 ? 0 : face.d[1] !== 0 ? 1 : 2;
  const [a1, a2] = A === 0 ? [1, 2] : A === 1 ? [0, 2] : [0, 1];
  const s1 = [0, 0, 0];
  const s2 = [0, 0, 0];
  s1[a1] = p[a1] > 0.5 ? 1 : -1;
  s2[a2] = p[a2] > 0.5 ? 1 : -1;
  const corner = [0, 0, 0];
  corner[a1] = s1[a1];
  corner[a2] = s2[a2];
  const o1 = isOpaque(world.get(gx + s1[0], y + s1[1], gz + s1[2])) ? 1 : 0;
  const o2 = isOpaque(world.get(gx + s2[0], y + s2[1], gz + s2[2])) ? 1 : 0;
  const oc = isOpaque(world.get(gx + corner[0], y + corner[1], gz + corner[2])) ? 1 : 0;
  const level = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
  return AO_FACT[level];
}

function pushFace(out, gx, y, gz, face, world, spriteUV, yOffset) {
  const base = out.positions.length / 3;
  for (const c of face.c) {
    out.positions.push(gx + c[0], y + (c[1] === 1 ? c[1] + yOffset : c[1]), gz + c[2]);
    out.normals.push(face.d[0], face.d[1], face.d[2]);
    out.uvs.push(spriteUV.u0 + c[3] * (spriteUV.u1 - spriteUV.u0), spriteUV.v0 + c[4] * (spriteUV.v1 - spriteUV.v0));
  }
  for (const c of face.c) {
    const f = vertexAO(world, gx, y, gz, face, c);
    out.colors.push(f, f, f);
  }
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const newStream = () => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] });

export function buildChunkGeometry(world, cx, cz, uvMap) {
  const opaque = newStream();
  const trans = newStream();
  const ox = cx * 16;
  const oz = cz * 16;

  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      const gx = ox + x;
      const gz = oz + z;
      for (let y = 0; y < H; y++) {
        const id = world.get(gx, y, gz);
        if (!id) continue;
        const def = BLOCKS[id];
        const target = def.opaque ? opaque : trans;
        for (const face of FACES) {
          const n = world.get(gx + face.d[0], y + face.d[1], gz + face.d[2]);
          if (isOpaque(n) || n === id) continue;
          const sprite = face.d[1] === 1 ? def.top : face.d[1] === -1 ? def.bottom : def.side;
          const uv = uvMap[sprite];
          if (!uv) continue;
          const yOffset = id === WATER && face.d[1] === 1 ? -0.125 : 0;
          pushFace(target, gx, y, gz, face, world, uv, yOffset);
        }
      }
    }
  }

  const make = (out) => {
    if (!out.indices.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(out.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(out.colors, 3));
    g.setIndex(out.indices);
    g.computeBoundingSphere();
    return g;
  };

  return { opaque: make(opaque), trans: make(trans) };
}
