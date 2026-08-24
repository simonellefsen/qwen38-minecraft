import * as THREE from 'three';
import { isSolid, isWater } from './blocks.js';
import { H } from './world.js';

const EYE = 1.62;
const HW = 0.3;
const HEIGHT = 1.8;

const GRAVITY = 27;
const WATER_GRAVITY = 5;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 7.2;
const SWIM_SPEED = 3.2;
const JUMP_VEL = 8.6;
const SWIM_UP = 3.4;
const MOUSE_SENS = 0.0022;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(8, 40, 8);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.eyesSubmerged = false;
    this.keys = Object.create(null);
    this.spawn();
  }

  spawn() {
    for (let r = 0; r < 400; r++) {
      const x = 8 + Math.floor(Math.random() * 6) * 2 - 6;
      const z = 8 + Math.floor(Math.random() * 6) * 2 - 6;
      const h = this.world.heightAt(x, z);
      const id = this.world.get(x, h, z);
      if (id && id !== 9 && h > 18 && h < H - 10) {
        this.pos.set(x + 0.5, h + 1.01, z + 0.5);
        this.vel.set(0, 0, 0);
        this.yaw = Math.PI / 4;
        this.pitch = -0.1;
        return;
      }
    }
    this.pos.set(8.5, this.world.heightAt(8, 8) + 2, 8.5);
  }

  look(dx, dy) {
    this.yaw -= dx * MOUSE_SENS;
    this.pitch -= dy * MOUSE_SENS;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  isEyeInWater() {
    const p = this.pos;
    return isWater(this.world.get(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)));
  }

  collides(px, py, pz) {
    const minX = Math.floor(px - HW);
    const maxX = Math.floor(px + HW);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + HEIGHT);
    const minZ = Math.floor(pz - HW);
    const maxZ = Math.floor(pz + HW);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++) {
          if (isSolid(this.world.get(x, y, z))) return true;
        }
    return false;
  }

  move(dt) {
    const p = this.pos;
    const v = this.vel;
    this.inWater = isWater(this.world.get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)));
    this.eyesSubmerged = this.isEyeInWater();

    const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = this.inWater ? SWIM_SPEED : sprint ? SPRINT_SPEED : WALK_SPEED;

    let ix = 0, iz = 0;
    if (this.keys['KeyW']) iz += 1;
    if (this.keys['KeyS']) iz -= 1;
    if (this.keys['KeyA']) ix -= 1;
    if (this.keys['KeyD']) ix += 1;
    const len = Math.hypot(ix, iz) || 1;
    ix /= len;
    iz /= len;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (ix * cos + iz * -sin) * speed;
    const dz = (iz * cos + ix * sin) * speed;

    const accel = this.onGround || this.inWater ? 14 : 3;
    v.x += (dx - v.x) * Math.min(1, accel * dt);
    v.z += (dz - v.z) * Math.min(1, accel * dt);

    if (this.inWater) {
      v.y -= WATER_GRAVITY * dt;
      v.y = Math.max(Math.min(v.y, SWIM_UP), -5);
      if (this.keys['Space']) v.y += (SWIM_UP - v.y) * Math.min(1, 6 * dt);
    } else {
      v.y -= GRAVITY * dt;
      v.y = Math.min(v.y, 40);
      if (this.keys['Space'] && this.onGround) {
        v.y = JUMP_VEL;
        this.onGround = false;
      }
    }

    this.onGround = false;
    const tryAxis = (axis, d) => {
      let rem = d;
      while (rem !== 0) {
        const step = Math.sign(rem) * Math.min(Math.abs(rem), 0.15);
        rem -= step;
        const np = p.clone();
        if (axis === 'x') np.x += step;
        else if (axis === 'y') np.y += step;
        else np.z += step;
        if (!this.collides(np.x, np.y, np.z)) {
          p.copy(np);
        } else {
          if (axis === 'y') {
            if (d < 0) this.onGround = true;
            v.y = 0;
          }
          if (axis === 'x') v.x = 0;
          if (axis === 'z') v.z = 0;
          return;
        }
      }
    };

    tryAxis('y', v.y * dt);
    tryAxis('x', v.x * dt);
    tryAxis('z', v.z * dt);

    if (p.y < -10) {
      this.spawn();
    }
  }

  updateCamera() {
    const p = this.pos;
    this.camera.position.set(p.x, p.y + EYE, p.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}
