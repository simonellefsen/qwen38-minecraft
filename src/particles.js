import * as THREE from 'three';

const COUNT = 64;

export class Particles {
  constructor(scene) {
    this.positions = new Float32Array(COUNT * 3);
    this.colors = new Float32Array(COUNT * 3);
    this.vel = new Float32Array(COUNT * 3);
    this.life = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3 + 1] = -1000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    this.pts = new THREE.Points(geo, this.mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  }

  burst(center, color) {
    for (let i = 0; i < COUNT; i++) {
      if (this.life[i] > 0) continue;
      const i3 = i * 3;
      this.positions[i3] = center.x + (Math.random() - 0.5) * 0.7;
      this.positions[i3 + 1] = center.y + (Math.random() - 0.5) * 0.7;
      this.positions[i3 + 2] = center.z + (Math.random() - 0.5) * 0.7;
      const sp = 1.2 + Math.random() * 2.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      this.vel[i3] = Math.sin(ph) * Math.cos(th) * sp;
      this.vel[i3 + 1] = Math.cos(ph) * sp + 1.2;
      this.vel[i3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      const j = 0.75 + Math.random() * 0.25;
      this.colors[i3] = color.r * j;
      this.colors[i3 + 1] = color.g * j;
      this.colors[i3 + 2] = color.b * j;
      this.life[i] = 0.4 + Math.random() * 0.4;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < COUNT; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      this.vel[i3 + 1] -= 10 * dt;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -1000;
      }
    }
    if (any) this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
