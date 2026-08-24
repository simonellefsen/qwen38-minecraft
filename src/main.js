import { Engine } from './engine.js';
import { HOTBAR, BLOCKS } from './blocks.js';

const engine = new Engine(document.getElementById('app'));
const hotbarEl = document.getElementById('hotbar');
const hudEl = document.getElementById('hud');
const overlayEl = document.getElementById('overlay');

function renderHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const def = BLOCKS[id];
    const el = document.createElement('div');
    el.className = 'slot' + (i === engine.selected ? ' selected' : '');
    const uv = engine.uvMap && engine.uvMap[def.icon];
    if (uv) {
      const px = uv.u0 * engine.sheetW;
      const py = uv.v0 * engine.sheetH;
      el.style.backgroundImage = 'url(./textures/atlas.png)';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundSize = `${engine.sheetW}px ${engine.sheetH}px`;
      el.style.backgroundPosition = `-${px}px -${py}px`;
    }
    el.title = `${def.name} (${i + 1})`;
    el.addEventListener('click', () => {
      engine.selected = i;
      renderHotbar();
    });
    hotbarEl.appendChild(el);
  });
}

function updateHud() {
  const p = engine.player.pos;
  const name = BLOCKS[HOTBAR[engine.selected]].name;
  hudEl.textContent = `x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}   ·   ${name}   ·   seed 1337`;
}

async function boot() {
  await engine.initTextures();
  const atlas = JSON.parse(await fetch('./textures/atlas.json').then((r) => r.text()));
  engine.sheetW = atlas.meta.size.w;
  engine.sheetH = atlas.meta.size.h;
  renderHotbar();
  engine.onSelect = () => renderHotbar();

  // pre-mesh the initial area around spawn
  for (let i = 0; i < 100 && engine.needsChunks(); i++) engine.ensureChunks();

  document.getElementById('play').addEventListener('click', () => {
    overlayEl.classList.remove('visible');
    engine.renderer.domElement.requestPointerLock();
  });
  document.getElementById('reset').addEventListener('click', () => {
    if (confirm('Reset the world? Your block edits will be cleared.')) {
      engine.resetWorld();
      engine.player.spawn();
    }
  });

  let last = performance.now();
  let lastHud = 0;
  function loop(now) {
    if (engine.disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    engine.frame(dt);
    if (now - lastHud > 200) {
      lastHud = now;
      updateHud();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  overlayEl.innerHTML = '<div class="panel"><h1>Failed to load</h1><p>' + (err.message || err) + '</p></div>';
  console.error(err);
});
