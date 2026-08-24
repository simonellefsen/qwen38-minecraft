import * as THREE from 'three';
import { World, CS } from './world.js';
import { Player } from './player.js';
import { BLOCKS, HOTBAR, WATER } from './blocks.js';
import { buildChunkGeometry, buildUVMap } from './mesher.js';
import { raycast } from './raycast.js';

const RENDER_RADIUS = 4;
const FAR = 1500;

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
    this.scene.background = new THREE.Color(0x9cd0f0);
    this.scene.fog = new THREE.Fog(0x9cd0f0, 40, 110);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, FAR);

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
    const [jsonText, img] = await Promise.all([
      fetch('./textures/atlas.json').then((r) => r.text()),
      new THREE.TextureLoader().load('./textures/atlas.png'),
    ]);
    const atlas = JSON.parse(jsonText);
    const size = atlas.meta.size;
    this.uvMap = buildUVMap(atlas, size.w, size.h);
    img.magFilter = THREE.NearestFilter;
    img.minFilter = THREE.NearestFilter;
    img.generateMipmaps = false;
    img.colorSpace = THREE.SRGBColorSpace;
    this.texture = img;

    this.opaqueMat = new THREE.MeshLambertMaterial({ map: img, vertexColors: true });
    this.transMat = new THREE.MeshLambertMaterial({
      map: img,
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  chunkMeshKey(cx, cz) {
    return cx + ',' + cz;
  }

  remeshChunk(cx, cz) {
    const key = this.chunkMeshKey(cx, cz);
    const existing = this.meshes.get(key);
    if (existing) {
      if (existing.opaque) {
        existing.opaque.geometry.dispose();
        this.scene.remove(existing.opaque);
      }
      if (existing.trans) {
        existing.trans.geometry.dispose();
        this.scene.remove(existing.trans);
      }
    }
    if (!this.texture) return;
    const { opaque, trans } = buildChunkGeometry(this.world, cx, cz, this.uvMap);
    const entry = {};
    if (opaque) {
      entry.opaque = new THREE.Mesh(opaque, this.opaqueMat);
      entry.opaque.matrixAutoUpdate = false;
      this.scene.add(entry.opaque);
    }
    if (trans) {
      entry.trans = new THREE.Mesh(trans, this.transMat);
      entry.trans.matrixAutoUpdate = false;
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
    needed.sort(
      (a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1])
    );
    const budget = 1;
    for (let i = 0; i < Math.min(needed.length, budget); i++) {
      this.remeshChunk(needed[i][0], needed[i][1]);
    }
    const keep = new Set();
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        keep.add(this.chunkMeshKey(pcx + dx, pcz + dz));
      }
    }
    for (const [key, entry] of this.meshes) {
      if (keep.has(key)) continue;
      const [cx, cz] = key.split(',').map(Number);
      const distC = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
      if (distC <= RENDER_RADIUS + 1) continue;
      if (entry.opaque) {
        entry.opaque.geometry.dispose();
        this.scene.remove(entry.opaque);
      }
      if (entry.trans) {
        entry.trans.geometry.dispose();
        this.scene.remove(entry.trans);
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
      this.locked = document.pointerLockElement === canvas;
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
    if (y === 0) return; // keep the bedrock floor
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
    return (
      x + 1 > p.x - hw &&
      x < p.x + hw &&
      z + 1 > p.z - hw &&
      z < p.z + hw &&
      y + 1 > p.y &&
      y < p.y + 1.8
    );
  }

  affectedChunkUpdates(x, y, z) {
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    const updates = new Set([cx + ',' + cz]);
    if (x % CS === 0) updates.add(cx - 1 + ',' + cz);
    if (x % CS === CS - 1) updates.add(cx + 1 + ',' + cz);
    if (z % CS === 0) updates.add(cx + ',' + (cz - 1));
    if (z % CS === CS - 1) updates.add(cx + ',' + (cz + 1));
    // trees can cross chunk borders: remesh a 3x3 neighborhood for safety at edits near trees
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
      this.remeshChunk(...key.split(',').map(Number));
    }
  }

  frame(dt) {
    if (this.locked) {
      this.player.move(dt);
      this.player.updateCamera();
      this.ensureChunks();
      this.updateHighlight();
      const bg = this.player.eyesSubmerged ? 0x2d5f96 : 0x9cd0f0;
      this.scene.background.setHex(bg);
      this.scene.fog.color.setHex(bg);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.resize.bind(this));
  }
}
