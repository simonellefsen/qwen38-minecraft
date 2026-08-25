import * as THREE from 'three';

const DAY_SECONDS = 420;

const DAY_TOP = new THREE.Color(0x5fa8e8);
const DAY_HOR = new THREE.Color(0xd4ecfc);
const NIGHT_TOP = new THREE.Color(0x040a17);
const NIGHT_HOR = new THREE.Color(0x12203a);
const DUSK_HOR = new THREE.Color(0xff9a5c);
const UNDERWATER = new THREE.Color(0x155a8c);

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export class Sky {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.day = DAY_SECONDS;
    this.t = 0.3; // morning
    this.submerged = 0;

    // skydome with vertex-color gradient
    const geo = new THREE.SphereGeometry(900, 28, 18);
    this.skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    this.skyDome = new THREE.Mesh(geo, this.skyMat);
    scene.add(this.skyDome);
    this.vertexCount = geo.attributes.position.count;
    this._facs = [];
    this.buildGradient();

    // fog (replaces the engine's static one)
    this.fog = new THREE.Fog(0xcfe9fb, 30, 105);
    scene.fog = this.fog;

    // clouds
    this.clouds = this.makeClouds();
    scene.add(this.clouds);

    // sun & moon discs
    const disc = (size, color) =>
      new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, transparent: true })
      );
    this.sun = disc(110, 0xffe9a0);
    this.moon = disc(64, 0xdce8fa);
    scene.add(this.sun, this.moon);

    // stars
    const starPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 860;
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph);
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);

    // light rig: directional sun + ambient
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.7);
    this.amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(this.sunLight, this.sunLight.target, this.amb);

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.topColor = new THREE.Color();
    this.horColor = new THREE.Color();
    this.update(0);
  }

  buildGradient() {
    const pos = this.skyDome.geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    this._unit = [];
    for (let i = 0; i < pos.count; i++) {
      const v = this._unit[i] = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      this._facs[i] = Math.pow(Math.max(0, v.y), 0.9);
    }
    this.skyDome.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  makeClouds() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, 256, 256);
    let seed = 9;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * 256;
      const cy = rnd() * 256;
      const r = 18 + rnd() * 34;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 110;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  update(dt, submerged = 0) {
    this.t = (this.t + dt / this.day) % 1;
    this.submerged = submerged;
    const e = Math.sin(this.t * Math.PI * 2 - Math.PI / 2); // -1..1 sun elevation
    const dayF = smoothstep(-0.12, 0.3, e);
    const nightF = 1 - dayF;
    const duskF = Math.exp(-Math.pow(e / 0.24, 2)) * 0.85;

    this.topColor.copy(NIGHT_TOP).lerp(DAY_TOP, dayF);
    this.horColor.copy(NIGHT_HOR).lerp(DAY_HOR, dayF);
    this.horColor.lerp(DUSK_HOR, duskF * 0.6);
    if (this.submerged > 0) {
      this.horColor.lerp(UNDERWATER, this.submerged * 0.75);
      this.topColor.lerp(UNDERWATER, this.submerged * 0.55);
    }
    const col = this.skyDome.geometry.attributes.color;
    for (let i = 0; i < this.vertexCount; i++) {
      const f = this._facs[i];
      col.setXYZ(i, this.horColor.r + (this.topColor.r - this.horColor.r) * f, this.horColor.g + (this.topColor.g - this.horColor.g) * f, this.horColor.b + (this.topColor.b - this.horColor.b) * f);
    }
    col.needsUpdate = true;
    this.fog.color.copy(this.horColor);
    this.fog.near = 30;
    this.fog.far = dayF > 0.3 ? 105 : 75;

    // celestial bodies
    const th = this.t * Math.PI * 2 - Math.PI / 2;
    const sd = new THREE.Vector3(Math.cos(th), Math.sin(th), -0.28).normalize();
    this.sunDir.copy(sd);
    const cp = this.camera.position;
    this.sun.position.copy(sd).multiplyScalar(820).add(cp);
    this.moon.position.copy(sd).multiplyScalar(-780).add(cp);
    this.sun.lookAt(cp);
    this.moon.lookAt(cp);
    this.sun.material.opacity = Math.max(0, dayF * 1.05);
    this.moon.material.opacity = Math.max(0, nightF - 0.15);
    this.stars.position.copy(cp);
    this.starMat.opacity = Math.max(0, nightF - 0.25) * 0.95;

    // clouds
    this.clouds.position.x = cp.x;
    this.clouds.position.z = cp.z;
    this.clouds.material.opacity = (0.18 + 0.68 * dayF) * Math.max(0.25, 1 - this.submerged);
    this.clouds.material.map.offset.x += dt * 0.0021;

    // lights follow the camera so shadows of the sun stay consistent
    this.sunLight.position.copy(sd).multiplyScalar(120).add(cp);
    this.sunLight.target.position.copy(cp);
    this.sunLight.intensity = 0.15 + 0.85 * dayF;
    this.amb.intensity = 0.16 + 0.55 * dayF + 0.08 * nightF;
    this.amb.color.copy(new THREE.Color(0x93a6c8)).lerp(new THREE.Color(0xffffff), dayF);
  }
}
