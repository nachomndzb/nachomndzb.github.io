// The room: an original three.js scene for nachomndzb.github.io.
// A desk at night in Abu Dhabi. The monitor runs a terminal that introduces the
// site, and the four sections are TV channels shown as cards over the scene.
// Everything is procedural (no model or image files), so the page stays small.
import * as THREE from 'three';

const d = document;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CHANNELS = [
  { id: 'about',     ch: '01', title: 'About' },
  { id: 'now',       ch: '02', title: 'Now' },
  { id: 'before',    ch: '03', title: 'Before' },
  { id: 'elsewhere', ch: '04', title: 'Elsewhere' },
];

const PROMPT = 'nacho@abu-dhabi ~ %';
const SCRIPT = [
  ['cmd', 'whoami'],
  ['out', 'Ignacio Méndez-Bonito'],
  ['out', 'Senior Forward Deployed Engineer · DGE, Abu Dhabi'],
  ['cmd', 'cat now.txt'],
  ['out', 'Agentic recruitment platform for the Abu Dhabi Government'],
  ['out', '50+ entities · ~10,000 HR users · time-to-hire 45 → ~20 days'],
  ['cmd', 'ls channels/'],
  ['out', '01-about   02-now   03-before   04-elsewhere'],
  ['cmd', ''],
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the monitor's terminal, drawn to a canvas texture ----------
function makeScreen() {
  const c = d.createElement('canvas'); c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const st = { line: 0, chars: 0, done: false, cursor: true, osd: null, osdT: 0, dirty: true, nextAt: 0 };
  let blinkAt = 0, startAt = null;

  function draw() {
    g.fillStyle = '#04090e'; g.fillRect(0, 0, 1024, 640);
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.font = '500 38px "IBM Plex Mono", Menlo, monospace';
    let y = 40;
    for (let i = 0; i <= st.line && i < SCRIPT.length; i++) {
      const [kind, text] = SCRIPT[i];
      const typed = i < st.line ? text : text.slice(0, st.chars);
      if (kind === 'cmd') {
        g.fillStyle = '#4fd1c5'; g.fillText(PROMPT, 40, y);
        const w = g.measureText(PROMPT + ' ').width;
        g.fillStyle = '#e8eef5'; g.fillText(typed, 40 + w, y);
        if (i === st.line && st.cursor) {
          const cw = g.measureText(typed).width;
          g.fillStyle = '#4fd1c5'; g.fillRect(40 + w + cw + 4, y + 3, 20, 42);
        }
      } else {
        g.fillStyle = '#b9e9e3'; g.fillText(typed, 40, y);
      }
      y += 58;
    }
    if (st.osd) {
      const a = Math.min(1, st.osdT * 4) * Math.min(1, Math.max(0, (2.2 - st.osdT) * 2));
      g.globalAlpha = a;
      g.font = '96px VT323, "IBM Plex Mono", monospace';
      g.fillStyle = '#9ff5ec'; g.textAlign = 'right';
      g.fillText(st.osd, 984, 28);
      g.textAlign = 'left'; g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let s = 0; s < 640; s += 4) g.fillRect(0, s, 1024, 2);
    const v = g.createRadialGradient(512, 320, 220, 512, 320, 720);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = v; g.fillRect(0, 0, 1024, 640);
    tex.needsUpdate = true; st.dirty = false;
  }

  function tick(t, dt) {
    if (startAt === null) startAt = t + 0.9;
    if (!st.done && t >= startAt && t >= st.nextAt) {
      const [kind, text] = SCRIPT[st.line];
      if (kind === 'cmd' && st.chars < text.length) {
        st.chars++; st.nextAt = t + (reduced ? 0 : 0.045 + Math.random() * 0.04);
      } else if (st.line < SCRIPT.length - 1) {
        st.line++; st.chars = 0;
        const [nk, nt] = SCRIPT[st.line];
        if (nk === 'out') st.chars = nt.length;
        st.nextAt = t + (reduced ? 0 : (nk === 'out' ? 0.18 : 0.5));
      } else {
        st.done = true;
      }
      st.dirty = true;
    }
    if (t >= blinkAt) { st.cursor = !st.cursor; blinkAt = t + 0.55; st.dirty = true; }
    if (st.osd) { st.osdT += dt; st.dirty = true; if (st.osdT > 2.2) st.osd = null; }
    if (st.dirty) draw();
  }

  return { tex, tick, osd(text) { st.osd = text; st.osdT = 0; st.dirty = true; } };
}

// ---------- the view out of the window: Abu Dhabi at night ----------
function makeCity() {
  const W = 1024, H = 704;
  const c = d.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = mulberry32(20261029);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#04060d'); sky.addColorStop(.5, '#111729');
  sky.addColorStop(.68, '#3b2b2c'); sky.addColorStop(.71, '#5a3b30');
  sky.addColorStop(.74, '#2a1c1f'); sky.addColorStop(1, '#05080e');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // a hazy moon
  const halo = g.createRadialGradient(790, 150, 20, 790, 150, 130);
  halo.addColorStop(0, 'rgba(255,230,190,.28)'); halo.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = halo; g.fillRect(600, 0, 400, 330);
  g.fillStyle = 'rgba(255,236,200,.92)'; g.beginPath(); g.arc(790, 150, 22, 0, Math.PI * 2); g.fill();
  // towers along the corniche
  const horizon = 500, towers = [];
  let x = 0;
  while (x < W) {
    const w = 18 + r() * 50, h = 40 + r() * 220 * (r() < .2 ? 1.4 : 1);
    towers.push({ x, w, h }); x += w + 2 + r() * 10;
  }
  for (const t of towers) {
    g.fillStyle = '#0a0d16'; g.fillRect(t.x, horizon - t.h, t.w, t.h);
    const cols = Math.max(1, Math.floor(t.w / 7)), rows = Math.floor(t.h / 9);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() < .45) {
        g.fillStyle = r() < .7 ? 'rgba(255,196,120,.85)' : 'rgba(170,210,255,.8)';
        g.fillRect(t.x + 3 + i * 7, horizon - t.h + 4 + j * 9, 3, 4);
      }
    }
  }
  const beacons = [...towers].sort((a, b) => b.h - a.h).slice(0, 3)
    .map(t => ({ u: (t.x + t.w / 2) / W, v: 1 - (horizon - t.h - 6) / H }));
  // the sea, with the towers' lights smeared into it
  g.fillStyle = '#070a12'; g.fillRect(0, horizon, W, H - horizon);
  for (const t of towers) {
    if (r() < .5) continue;
    const grd = g.createLinearGradient(0, horizon, 0, horizon + 120);
    grd.addColorStop(0, 'rgba(255,190,120,.22)'); grd.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = grd; g.fillRect(t.x + t.w * .3, horizon, t.w * .4, 120);
  }
  const hz = g.createLinearGradient(0, horizon - 140, 0, horizon + 40);
  hz.addColorStop(0, 'rgba(90,60,50,0)'); hz.addColorStop(1, 'rgba(90,60,50,.35)');
  g.fillStyle = hz; g.fillRect(0, horizon - 140, W, 180);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, beacons };
}

// ---------- runtime ----------
let R = null;

export function start(room, hooks = {}) {
  if (R) return;
  const canvas = room.querySelector('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.FogExp2(0x05070a, 0.16);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 30);

  const M = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, opt = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = opt.cast !== false; m.receiveShadow = opt.receive !== false;
    if (opt.rot) m.rotation.set(...opt.rot);
    scene.add(m); return m;
  };
  const box = (w, h, dd, mat, x, y, z, opt) => add(new THREE.BoxGeometry(w, h, dd), mat, x, y, z, opt);

  // walls and floor
  const wallMat = M({ color: 0x12151c, roughness: 1 });
  add(new THREE.PlaneGeometry(10, 10), M({ color: 0x0a0c11, roughness: .95 }), 0, 0, 0, { rot: [-Math.PI / 2, 0, 0], cast: false });
  add(new THREE.PlaneGeometry(10, 4), wallMat, 0, 2, -1.6, { cast: false });
  add(new THREE.PlaneGeometry(10, 4), wallMat, -2.4, 2, 0, { rot: [0, Math.PI / 2, 0], cast: false });
  add(new THREE.PlaneGeometry(10, 4), wallMat, 2.4, 2, 0, { rot: [0, -Math.PI / 2, 0], cast: false });

  // the window
  const city = makeCity();
  add(new THREE.PlaneGeometry(1.5, 1.03), new THREE.MeshBasicMaterial({ map: city.tex, toneMapped: false }), 0.35, 1.55, -1.585, { cast: false, receive: false });
  const frameMat = M({ color: 0x1c2029, roughness: .7 });
  box(1.58, 0.05, 0.06, frameMat, 0.35, 2.09, -1.57);
  box(1.58, 0.05, 0.06, frameMat, 0.35, 1.01, -1.57);
  box(0.05, 1.13, 0.06, frameMat, -0.44, 1.55, -1.57);
  box(0.05, 1.13, 0.06, frameMat, 1.14, 1.55, -1.57);
  box(0.03, 1.08, 0.04, frameMat, 0.35, 1.55, -1.57);
  const beacons = city.beacons.map((b, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3b30, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(0.018, 0.018, 1);
    s.position.set(0.35 - 0.75 + b.u * 1.5, 1.55 - 0.515 + b.v * 1.03, -1.58);
    s.userData.phase = i * 2.1; scene.add(s); return s;
  });

  // desk
  const wood = M({ color: 0x4a3524, roughness: .55, metalness: .05 });
  box(1.9, 0.04, 0.85, wood, 0, 0.74, -0.45);
  const legMat = M({ color: 0x1a1c22, roughness: .6, metalness: .4 });
  for (const [lx, lz] of [[-0.9, -0.82], [0.9, -0.82], [-0.9, -0.08], [0.9, -0.08]]) box(0.04, 0.72, 0.04, legMat, lx, 0.36, lz);

  // monitor
  const dark = M({ color: 0x15171d, roughness: .5, metalness: .3 });
  add(new THREE.CylinderGeometry(0.13, 0.14, 0.015, 32), dark, 0, 0.7675, -0.58);
  add(new THREE.CylinderGeometry(0.02, 0.025, 0.16, 16), dark, 0, 0.855, -0.58);
  box(0.62, 0.37, 0.045, dark, 0, 1.09, -0.57);
  const screen = makeScreen();
  const screenMat = new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false, color: 0x000000 });
  add(new THREE.PlaneGeometry(0.565, 0.318), screenMat, 0, 1.095, -0.546, { cast: false, receive: false });

  // things on the desk
  box(0.44, 0.02, 0.15, M({ color: 0x1b1e26, roughness: .6 }), 0.05, 0.77, -0.22);
  box(0.06, 0.025, 0.1, M({ color: 0x22252d, roughness: .5 }), 0.4, 0.772, -0.22);
  add(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 24), M({ color: 0x0b6e6b, roughness: .4 }), -0.48, 0.81, -0.42);
  box(0.22, 0.012, 0.3, M({ color: 0x2b2e36, roughness: .9 }), -0.32, 0.766, -0.18);

  // desk lamp
  add(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 32), dark, -0.72, 0.77, -0.6);
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 12), dark, -0.72, 1.055, -0.6);
  add(new THREE.ConeGeometry(0.11, 0.14, 32, 1, true), M({ color: 0x1a1d24, roughness: .5, metalness: .4, side: THREE.DoubleSide }), -0.69, 1.37, -0.59, { rot: [0, 0, -0.28], cast: false });
  add(new THREE.SphereGeometry(0.022, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffd2a0 }), -0.67, 1.32, -0.585, { cast: false, receive: false });

  // light
  scene.add(new THREE.HemisphereLight(0x2a3a55, 0x080708, 0.45));
  const lamp = new THREE.SpotLight(0xffb673, 10, 3.2, Math.PI / 4.6, 0.7, 1.7);
  lamp.position.set(-0.67, 1.32, -0.585); lamp.target.position.set(-0.3, 0.76, -0.4);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0005;
  scene.add(lamp, lamp.target);
  const glow = new THREE.PointLight(0x7fd8ff, 0, 2.4, 2); glow.position.set(0, 1.05, -0.35); scene.add(glow);
  const moon = new THREE.DirectionalLight(0x6f86b8, 0.35);
  moon.position.set(0.6, 2.2, -1.5); moon.target.position.set(0, 0.8, 0); scene.add(moon, moon.target);

  // dust in the lamp light
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = -0.95 + Math.random() * 0.9;
    pos[i * 3 + 1] = 0.78 + Math.random() * 0.65;
    pos[i * 3 + 2] = -0.9 + Math.random() * 0.8;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd9a8, size: 0.006, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // camera
  const VIEWS = {
    desk: { pos: new THREE.Vector3(0.5, 1.32, 1.3), look: new THREE.Vector3(0, 1.0, -0.5) },
    zoom: { pos: new THREE.Vector3(0.04, 1.1, 0.3), look: new THREE.Vector3(0, 1.09, -0.57) },
  };
  let view = 'desk';
  const cur = { pos: VIEWS.desk.pos.clone(), look: VIEWS.desk.look.clone() };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const sh = { x: 0, y: 0 };

  // HUD
  const panel = room.querySelector('#panel');
  const pBody = room.querySelector('#p-body');
  const pCh = room.querySelector('#p-ch');
  const pTitle = room.querySelector('#p-title');
  const navLinks = [...room.querySelectorAll('.menu a')];
  const zoomBtn = room.querySelector('#zoom');

  function open(id) {
    const c = CHANNELS.find(x => x.id === id);
    if (!c) return close();
    const src = d.getElementById(id);
    pBody.replaceChildren();
    if (src) {
      const clone = src.cloneNode(true); clone.removeAttribute('id');
      const h = clone.querySelector('h1,h2'); if (h) h.remove();
      pBody.append(...clone.childNodes);
    }
    pCh.textContent = 'CH ' + c.ch; pTitle.textContent = c.title;
    panel.hidden = false;
    navLinks.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + id));
    screen.osd('CH ' + c.ch + '  ' + c.title.toUpperCase());
    view = 'zoom'; zoomBtn.textContent = 'Back to the desk';
    panel.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    navLinks.forEach(a => a.removeAttribute('aria-current'));
    view = 'desk'; zoomBtn.textContent = 'Zoom';
  }
  function route() {
    const h = location.hash.replace('#', '');
    if (CHANNELS.some(c => c.id === h)) open(h); else close();
  }
  function leave() { if (location.hash && location.hash !== '#') location.hash = ''; else close(); }
  function toggleZoom() {
    if (!panel.hidden) return leave();
    view = view === 'zoom' ? 'desk' : 'zoom';
    zoomBtn.textContent = view === 'zoom' ? 'Back to the desk' : 'Zoom';
  }

  const L = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); L.push(() => el.removeEventListener(ev, fn, o)); };
  on(window, 'hashchange', route);
  on(room.querySelector('#p-close'), 'click', leave);
  on(room.querySelector('#home-link'), 'click', (e) => { e.preventDefault(); leave(); });
  on(zoomBtn, 'click', toggleZoom);
  on(room.querySelector('#lofi'), 'click', () => { stop(); hooks.onLofi && hooks.onLofi(); });
  on(canvas, 'click', toggleZoom);
  on(room, 'pointermove', (e) => {
    ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ptr.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  on(window, 'keydown', (e) => {
    if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'Escape') leave();
    else if (e.key >= '1' && e.key <= '4') location.hash = '#' + CHANNELS[+e.key - 1].id;
    else if (e.key === 'z' || e.key === 'Z') toggleZoom();
  });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = camera.aspect < 0.85;
    VIEWS.desk.pos.set(narrow ? 0.25 : 0.5, narrow ? 1.4 : 1.32, narrow ? 2.2 : 1.3);
  }
  on(window, 'resize', resize);
  resize();

  // loop
  const clock = new THREE.Clock();
  let raf = 0, announced = false, hidden = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const onAmt = Math.min(1, Math.max(0, (t - 0.4) / 1.1));
    const e = onAmt * onAmt * (3 - 2 * onAmt);
    const flick = reduced ? 1 : 0.965 + 0.035 * Math.random();
    screenMat.color.setScalar(e * flick);
    glow.intensity = 1.8 * e * flick;
    screen.tick(t, dt);

    const target = VIEWS[view], k = 1 - Math.exp(-dt * 2.2);
    cur.pos.lerp(target.pos, k); cur.look.lerp(target.look, k);
    const pk = 1 - Math.exp(-dt * 3);
    ptr.x += (ptr.tx - ptr.x) * pk; ptr.y += (ptr.ty - ptr.y) * pk;
    const drift = reduced ? 0 : 1;
    // with a card open, slide the framing so the monitor stays visible beside (or above) it
    const wide = window.innerWidth > 720;
    const ox = panel.hidden ? 0 : (wide ? 0.3 : 0), oy = panel.hidden ? 0 : (wide ? 0 : -0.16);
    sh.x += (ox - sh.x) * k; sh.y += (oy - sh.y) * k;
    camera.position.set(
      cur.pos.x + sh.x + ptr.x * 0.08 + drift * Math.sin(t * 0.25) * 0.015,
      cur.pos.y + ptr.y * 0.04 + drift * Math.sin(t * 0.33) * 0.008,
      cur.pos.z);
    camera.lookAt(cur.look.x + sh.x + ptr.x * 0.02, cur.look.y + sh.y + ptr.y * 0.01, cur.look.z);

    for (const s of beacons) s.material.opacity = 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 + s.userData.phase), 6);
    if (!reduced) {
      const a = dust.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < N; i++) {
        arr[i * 3 + 1] -= dt * 0.012;
        arr[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.004;
        if (arr[i * 3 + 1] < 0.78) arr[i * 3 + 1] = 1.43;
      }
      a.needsUpdate = true;
    }
    renderer.render(scene, camera);
    if (!announced) { announced = true; hooks.onReady && hooks.onReady(); }
  }
  on(d, 'visibilitychange', () => { hidden = d.hidden; if (!hidden) clock.getDelta(); });

  function stop() {
    if (!R) return;
    cancelAnimationFrame(raf);
    L.forEach(f => f());
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    renderer.dispose();
    R = null;
  }
  R = { stop };

  // wait briefly for the fonts the screen uses, then roll
  const fontsReady = Promise.all([
    d.fonts.load('500 38px "IBM Plex Mono"'),
    d.fonts.load('96px VT323'),
  ]).catch(() => {});
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 2500))]).then(() => {
    if (!R) return;
    route();
    clock.start();
    frame();
  });
}

export function stop() { if (R) R.stop(); }
