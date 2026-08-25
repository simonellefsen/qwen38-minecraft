# Voxelcraft

A Minecraft-style block-building sandbox that runs entirely in your browser.
Chunked infinite terrain, trees, water, first-person physics, and break/place
blocks — with all texture art packed into a sprite atlas by CodeScene
TexturePacker.

## Run it

```sh
npm install
npm run dev          # local dev server
npm run build        # production build -> dist/
```

Open the dev URL, click **Play**, and you're in the world.

## Controls

| Input | Action |
| --- | --- |
| W A S D | move |
| Mouse | look around |
| Space | jump / swim up |
| Shift | sprint |
| Left click | break block |
| Right click | place block |
| Middle click | pick the block you're aiming at |
| 1–10 / wheel | select hotbar slot |
| Esc | release mouse (pause) |

## What's inside

- `src/world.js` — deterministic value-noise terrain (seed 1337): hills, sand
  beaches, sea, bedrock floor, and hash-placed trees; player edits are stored
  as a sparse override map in `localStorage`.
- `src/mesher.js` — per-chunk face-culled meshing (only visible faces are
  emitted) with baked directional shading and separate transparent geometry
  for water, glass, and leaves.
- `src/player.js` — AABB collision, gravity, jumping, and swimming.
- `src/raycast.js` — Amanatides–Woo voxel traversal for block targeting.
- `src/engine.js` — render loop, 9×9 chunk streaming/unloading, highlighting,
  block break/place.
- `public/textures/` — `atlas.png` + `atlas.json` produced by TexturePacker
  from the 16×16 source sprites in `public/textures/sprites/`.

## Regenerating the texture atlas

```sh
python3 tools/make_sprites.py    # draws the 14 source sprites (Pillow)
python3 tools/make_atlas.py      # packs them into atlas.png + atlas.json
```

`make_atlas.py` writes a deterministic 16px grid atlas in the TexturePacker
JSON format and verifies every cell is byte-identical to its source. (The
original atlas was produced with TexturePacker 8.2, but that run shipped two
corrupted cells — leaves/sand came out red — so the verified grid packer is
now used. If you prefer TexturePacker, the engine only needs the same JSON
`frames`/`meta.size` shape.)

The game reads `atlas.json` at runtime, so sprite names/sizes in the atlas are
data-driven — swap in your own 16×16 PNGs and it just works.

## Game features

- infinite chunked terrain (hills, beaches, sea, bedrock, trees)
- true per-vertex ambient occlusion (Minecraft-style corner shading) under a
  moving directional sun
- day/night cycle with sun, moon, stars, drifting clouds, dusk sky tint
- block break particles colored from the actual block texture
- water, glass, leaves transparency; break a tree trunk and its canopy drops
- block edits persist in `localStorage`

## Stack

Vanilla ES modules + Vite + three.js. No framework, no build-time codegen.
