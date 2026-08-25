import * as THREE from 'three';
import { World, CS } from './world.js';
import { Player } from './player.js';
import { BLOCKS, HOTBAR, WATER, isSolid } from './blocks.js';
import { buildChunkGeometry, buildUVMap } from './mesher.js';
import { raycast } from './raycast.js';
import { Sky } from './sky.js';
import { Particles } from './particles.js';

const RENDER_RADIUS = 4;

export class Engine {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this.selected = 0;
    this.locked = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1500);

    this.world = new World();
    this.player = new Player(this.camera, this.world);

    this.meshes = new Map();

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }

  async initTextures() {
    const jsonText = await fetch('./textures/atlas.json').then((r) => r.text());
    const atlas = JSON.parse(jsonText);
    const size = atlas.meta.size;
    this.uvMap = buildUVMap(atlas, size.w, size.h);

    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = './textures/atlas.png';
    });
    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.texture = texture;

    // average color per sprite (for break particles)
    this.blockColors = {};
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    for (const [name, f] of Object.entries(atlas.frames)) {
      if (!f || !f.frame) continue;
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(img, f.frame.x, f.frame.y, 16, 16, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      this.blockColors[name] = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
    }

    this.opaqueMat = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
    this.transMat = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.sky = new Sky(this.scene, this.camera);
    this.particles = new Particles(this.scene);
  }

  chunkMeshKey(cx, cz) {
    return cx + ',' + cz;
  }

  remeshChunk(cx, cz) {
    const key = this.chunkMeshKey(cx, cz);
    const existing = this.meshes.get(key);
    if (existing) {
      for (const m of [existing.opaque, existing.trans]) {
        if (m) {
          m.geometry.dispose();
          this.scene.remove(m);
        }
      }
    }
    if (!this.texture) return;
    const { opaque, trans } = buildChunkGeometry(this.world, cx, cz, this.uvMap);
    const entry = {};
    if (opaque) {
      entry.opaque = new THREE.Mesh(opaque, this.opaqueMat);
      this.scene.add(entry.opaque);
    }
    if (trans) {
      entry.trans = new THREE.Mesh(trans, this.transMat);
      entry.trans.renderOrder = 1;
      this.scene.add(entry.trans);
    }
    this.meshes.set(key, entry);
  }

  needsChunks() {
    const pcx = Math.floor(this.player.pos.x / CS);
    const pcz = Math.floor(this.player.pos.z / CS);
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        if (!this.meshes.has(this.chunkMeshKey(pcx + dx, pcz + dz))) return true;
      }
    }
    return false;
  }

  ensureChunks() {
    const pcx = Math.floor(this.player.pos.x / CS);
    const pcz = Math.floor(this.player.pos.z / CS);
    const needed = [];
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.meshes.has(this.chunkMeshKey(cx, cz))) needed.push([cx, cz]);
      }
    }
    needed.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
    const budget = 1;
    for (let i = 0; i < Math.min(needed.length, budget); i++) this.remeshChunk(needed[i][0], needed[i][1]);

    for (const [key, entry] of this.meshes) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= RENDER_RADIUS + 1) continue;
      for (const m of [entry.opaque, entry.trans]) {
        if (m) {
          m.geometry.dispose();
          this.scene.remove(m);
        }
      }
      this.meshes.delete(key);
    }
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      this.onLock && this.onLock(was, this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.player.look(e.movementX, e.movementY);
    });
    window.addEventListener('keydown', (e) => {
      this.player.keys[e.code] = true;
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= HOTBAR.length) {
          this.selected = n - 1;
          this.onSelect && this.onSelect(this.selected);
        } else if (n === 0) {
          this.selected = HOTBAR.length - 1;
          this.onSelect && this.onSelect(this.selected);
        }
      }
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.player.keys[e.code] = false;
    });
    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      const d = e.deltaY > 0 ? 1 : -1;
      this.selected = (this.selected + d + HOTBAR.length) % HOTBAR.length;
      this.onSelect && this.onSelect(this.selected);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const hit = this.raycastEye();
      if (!hit) return;
      if (e.button === 0) {
        this.breakBlock(hit.x, hit.y, hit.z);
      } else if (e.button === 2) {
        this.placeBlock(hit.px, hit.py, hit.pz);
      } else if (e.button === 1) {
        e.preventDefault();
        const id = this.world.get(hit.x, hit.y, hit.z);
        const idx = HOTBAR.indexOf(id);
        if (idx >= 0) {
          this.selected = idx;
          this.onSelect && this.onSelect(this.selected);
        }
      }
    });
  }

  raycastEye() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return raycast(this.world, this.camera.position, dir, 6);
  }

  breakBlock(x, y, z) {
    if (y === 0) return; // bedrock floor
    const id = this.world.get(x, y, z);
    // breaking a logged trunk also drops its canopy (no floating leaves)
    if (id === 6) {
      for (let dy = -1; dy <= 6; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            if (this.world.get(nx, ny, nz) === 7) this.world.set(nx, ny, nz, 0);
          }
        }
      }
    }
    const def = BLOCKS[id];
    if (def && this.blockColors && this.particles) {
      const name = def.side;
      const col = this.blockColors[name] || this.blockColors[def.icon];
      this.particles.burst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), col || new THREE.Color(0xbbbbbb));
    }
    this.world.set(x, y, z, 0);
    this.affectedChunkUpdates(x, y, z);
  }

  placeBlock(x, y, z) {
    if (y <= 0 || y >= 64) return;
    const cur = this.world.get(x, y, z);
    if (cur !== 0 && cur !== WATER) return;
    if (this.intersectsPlayer(x, y, z)) return;
    this.world.set(x, y, z, HOTBAR[this.selected]);
    this.affectedChunkUpdates(x, y, z);
  }

  intersectsPlayer(x, y, z) {
    const p = this.player.pos;
    const hw = 0.3;
    return x + 1 > p.x - hw && x < p.x + hw && z + 1 > p.z - hw && z < p.z + hw && y + 1 > p.y && y < p.y + 1.8;
  }

  affectedChunkUpdates(x, y, z) {
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    const updates = new Set([cx + ',' + cz]);
    if (x % CS === 0) updates.add(cx - 1 + ',' + cz);
    if (x % CS === CS - 1) updates.add(cx + 1 + ',' + cz);
    if (z % CS === 0) updates.add(cx + ',' + (cz - 1));
    if (z % CS === CS - 1) updates.add(cx + ',' + (cz + 1));
    for (const key of updates) {
      const [cxi, czi] = key.split(',').map(Number);
      this.remeshChunk(cxi, czi);
    }
  }

  updateHighlight() {
    const hit = this.locked ? this.raycastEye() : null;
    if (hit) {
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  resetWorld() {
    this.world.resetEdits();
    for (const key of [...this.meshes.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      this.remeshChunk(cx, cz);
    }
  }

  frame(dt) {
    const eyeInWater = this.player.eyesSubmerged;
    if (this.sky && this.particles) {
      this.sky.update(dt, eyeInWater ? 1 : 0);
      this.particles.update(dt);
    }
    if (this.locked) {
      this.player.move(dt);
      this.player.updateCamera();
      this.ensureChunks();
      this.updateHighlight();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
