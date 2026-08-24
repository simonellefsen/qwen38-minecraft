import * as THREE from 'three';
import { BLOCKS, isOpaque, WATER } from './blocks.js';
import { H } from './world.js';

// Face table. Each corner: [x, y, z, localU(0|1), localV(top=0|bottom=1)].
// localV=0 is the sprite's TOP row (texture flipY=false).
const FACES = [
  {
    // +x
    d: [1, 0, 0],
    shade: 0.78,
    c: [
      [1, 1, 1, 1, 0],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 0, 0, 0],
    ],
  },
  {
    // -x
    d: [-1, 0, 0],
    shade: 0.78,
    c: [
      [0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 1, 1],
    ],
  },
  {
    // +y (top)
    d: [0, 1, 0],
    shade: 1.0,
    c: [
      [0, 1, 0, 0, 0],
      [0, 1, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 0, 1, 0],
    ],
  },
  {
    // -y (bottom)
    d: [0, -1, 0],
    shade: 0.55,
    c: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 1, 0],
    ],
  },
  {
    // +z
    d: [0, 0, 1],
    shade: 0.66,
    c: [
      [0, 0, 1, 0, 1],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 0, 1, 1, 1],
    ],
  },
  {
    // -z
    d: [0, 0, -1],
    shade: 0.66,
    c: [
      [1, 0, 0, 1, 1],
      [1, 1, 0, 1, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1],
    ],
  },
];

// UV layout computed from the TexturePacker JSON ("frames": name -> frame)
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

function pushFace(out, gx, y, gz, face, spriteUV, shade, yOffset) {
  const base = out.positions.length / 3;
  for (const c of face.c) {
    out.positions.push(gx + c[0], y + (c[1] === 1 ? c[1] + yOffset : c[1]), gz + c[2]);
    out.normals.push(face.d[0], face.d[1], face.d[2]);
    out.uvs.push(
      spriteUV.u0 + c[3] * (spriteUV.u1 - spriteUV.u0),
      spriteUV.v0 + c[4] * (spriteUV.v1 - spriteUV.v0)
    );
    out.colors.push(shade, shade, shade);
  }
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const empty = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

export function buildChunkGeometry(world, cx, cz, uvMap) {
  const opaque = { ...empty, positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const trans = { ...empty, positions: [], normals: [], uvs: [], colors: [], indices: [] };
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
          const sprite =
            face.d[1] === 1 ? def.top : face.d[1] === -1 ? def.bottom : def.side;
          const uv = uvMap[sprite];
          if (!uv) continue;
          const yOffset = id === WATER && face.d[1] === 1 ? -0.125 : 0;
          pushFace(target, gx, y, gz, face, uv, face.shade, yOffset);
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
