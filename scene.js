// The room: an original three.js scene for nachomndzb.github.io.
// A desk at night in Abu Dhabi. The monitor runs a terminal that introduces the
// site, and the four sections are TV channels shown as cards over the scene.
// Everything but the portrait is procedural: textures are drawn to canvases at
// load, geometry is built from primitives, sound is synthesized.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

// ---------- small procedural helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise(seed) {
  const r = mulberry32(seed), g = new Float32Array(256 * 256);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xf = Math.floor(x), yf = Math.floor(y);
    const xi = xf & 255, yi = yf & 255, u0 = x - xf, v0 = y - yf;
    const u = u0 * u0 * (3 - 2 * u0), v = v0 * v0 * (3 - 2 * v0);
    const a = g[yi * 256 + xi], b = g[yi * 256 + ((xi + 1) & 255)];
    const c = g[((yi + 1) & 255) * 256 + xi], e = g[((yi + 1) & 255) * 256 + ((xi + 1) & 255)];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  };
}
function fbm(n, x, y, oct = 4) {
  let s = 0, a = .5, f = 1;
  for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); a *= .5; f *= 2; }
  return s;
}
function tex(w, h, draw, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const c = d.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}
function pix(w, h, fn, opts) {
  return tex(w, h, (g) => {
    const img = g.createImageData(w, h), a = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [r, gg, b] = fn(x, y), i = (y * w + x) * 4;
      a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, opts);
}

function makeMaterials() {
  const n1 = valueNoise(11), n2 = valueNoise(23), n3 = valueNoise(37);
  const woodColor = pix(512, 512, (x, y) => {
    const grain = fbm(n1, x / 90, y / 7, 4);
    const rings = Math.sin((y / 512 * 9 + grain * 2.2) * Math.PI);
    const t = 0.55 + 0.25 * rings + 0.2 * (fbm(n2, x / 30, y / 30, 3) - 0.5);
    return [70 + 50 * t, 44 + 32 * t, 26 + 18 * t];
  }, { repeat: [2, 1] });
  const woodBump = pix(256, 256, (x, y) => { const v = 128 + 90 * (fbm(n1, x / 45, y / 3.5, 3) - 0.5) + 30 * (fbm(n3, x / 4, y / 4, 2) - 0.5); return [v, v, v]; }, { repeat: [2, 1], srgb: false });
  const woodRough = pix(256, 256, (x, y) => { const v = 120 + 60 * fbm(n2, x / 20, y / 20, 3); return [v, v, v]; }, { repeat: [2, 1], srgb: false });
  const wood = new THREE.MeshStandardMaterial({ map: woodColor, bumpMap: woodBump, bumpScale: 0.012, roughnessMap: woodRough, roughness: 1, metalness: 0.02 });

  const plasterColor = pix(512, 512, (x, y) => { const v = 34 + 10 * fbm(n2, x / 60, y / 60, 4) + 4 * (n3(x / 2, y / 2) - .5); return [v, v + 2, v + 6]; }, { repeat: [4, 2] });
  const plasterBump = pix(256, 256, (x, y) => { const v = 128 + 70 * (fbm(n3, x / 6, y / 6, 3) - .5); return [v, v, v]; }, { repeat: [4, 2], srgb: false });
  const plaster = new THREE.MeshStandardMaterial({ map: plasterColor, bumpMap: plasterBump, bumpScale: 0.004, roughness: 0.95 });

  const floorColor = pix(512, 512, (x, y) => { const v = 22 + 14 * fbm(n1, x / 40, y / 40, 5) + 6 * (n2(x, y) - .5); return [v, v + 1, v + 3]; }, { repeat: [5, 5] });
  const floorRough = pix(256, 256, (x, y) => { const v = 150 + 70 * fbm(n3, x / 15, y / 15, 3); return [v, v, v]; }, { repeat: [5, 5], srgb: false });
  const floor = new THREE.MeshStandardMaterial({ map: floorColor, roughnessMap: floorRough, roughness: 1, bumpMap: floorRough, bumpScale: 0.003 });

  const rugColor = pix(512, 512, (x, y) => {
    const band = Math.floor(y / 64) % 2, weave = (Math.sin(x * 1.1) * Math.sin(y * 1.1)) * 6;
    const base = band ? [92, 46, 40] : [74, 38, 34];
    const nn = 10 * (fbm(n2, x / 25, y / 25, 3) - .5);
    return [base[0] + weave + nn, base[1] + weave + nn, base[2] + weave + nn];
  }, { repeat: [2, 1.5] });
  const rugBump = pix(256, 256, (x, y) => { const v = 128 + 50 * Math.sin(x * 1.1) * Math.sin(y * 1.1); return [v, v, v]; }, { repeat: [12, 9], srgb: false });
  const rug = new THREE.MeshStandardMaterial({ map: rugColor, bumpMap: rugBump, bumpScale: 0.003, roughness: 1 });

  const clothBump = pix(256, 256, (x, y) => { const v = 128 + 60 * (Math.sin(x * 1.3) * Math.sin(y * 1.3)) + 20 * (n1(x / 3, y / 3) - .5); return [v, v, v]; }, { repeat: [3, 8], srgb: false });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3a2429, bumpMap: clothBump, bumpScale: 0.002, roughness: 1, side: THREE.DoubleSide });
  const seat = new THREE.MeshStandardMaterial({ color: 0x1b1e26, bumpMap: clothBump, bumpScale: 0.0015, roughness: 1 });

  const plastic = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.05 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8e949c, roughness: 0.35, metalness: 0.9 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.45, metalness: 0.8 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x0b6e6b, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const white = new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: 0.5 });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.9 });
  return { wood, plaster, floor, rug, cloth, seat, plastic, gloss, metal, darkMetal, ceramic, white, terracotta };
}

// ---------- the monitor's terminal, drawn to a canvas texture ----------
function makeScreen(onType) {
  const c = d.createElement('canvas'); c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const st = { line: 0, chars: 0, done: false, cursor: true, osd: null, osdT: 0, dirty: true, nextAt: 0 };
  let blinkAt = 0, startAt = null;

  function draw() {
    g.fillStyle = '#05090d'; g.fillRect(0, 0, 1024, 640);
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
    g.fillStyle = 'rgba(0,0,0,.16)';
    for (let s = 0; s < 640; s += 4) g.fillRect(0, s, 1024, 2);
    const v = g.createRadialGradient(512, 320, 260, 512, 320, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = v; g.fillRect(0, 0, 1024, 640);
    t.needsUpdate = true; st.dirty = false;
  }
  function tick(time, dt) {
    if (startAt === null) startAt = time + 0.9;
    if (!st.done && time >= startAt && time >= st.nextAt) {
      const [kind, text] = SCRIPT[st.line];
      if (kind === 'cmd' && st.chars < text.length) {
        st.chars++; st.nextAt = time + (reduced ? 0 : 0.045 + Math.random() * 0.04);
        onType && onType();
      } else if (st.line < SCRIPT.length - 1) {
        st.line++; st.chars = 0;
        const [nk, nt] = SCRIPT[st.line];
        if (nk === 'out') st.chars = nt.length;
        st.nextAt = time + (reduced ? 0 : (nk === 'out' ? 0.18 : 0.5));
      } else {
        st.done = true;
      }
      st.dirty = true;
    }
    if (time >= blinkAt) { st.cursor = !st.cursor; blinkAt = time + 0.55; st.dirty = true; }
    if (st.osd) { st.osdT += dt; st.dirty = true; if (st.osdT > 2.2) st.osd = null; }
    if (st.dirty) draw();
  }
  return { tex: t, tick, osd(text) { st.osd = text; st.osdT = 0; st.dirty = true; } };
}

// ---------- out of the window: Abu Dhabi at night, in three depth layers ----------
function makeCity() {
  const r = mulberry32(20261029);
  const W = 1024, H = 512, horizon = 330;
  function towers(minW, maxW, minH, maxH) {
    const list = []; let x = -40;
    while (x < W + 40) { const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH) * (r() < .15 ? 1.5 : 1); list.push({ x, w, h }); x += w + 4 + r() * 24; }
    return list;
  }
  function drawTowers(g, list, body, winAlpha, lit, winW, winH, pitch) {
    for (const t of list) {
      g.fillStyle = body; g.fillRect(t.x, horizon - t.h, t.w, t.h);
      const cols = Math.max(1, Math.floor((t.w - 4) / pitch)), rows = Math.floor((t.h - 6) / pitch);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < lit) {
          const warm = r() < .72;
          g.fillStyle = warm ? `rgba(255,${180 + (r() * 40) | 0},${110 + (r() * 40) | 0},${winAlpha * (0.6 + r() * 0.4)})` : `rgba(${160 + (r() * 40) | 0},${200 + (r() * 30) | 0},255,${winAlpha * (0.6 + r() * 0.4)})`;
          g.fillRect(t.x + 3 + i * pitch, horizon - t.h + 4 + j * pitch, winW, winH);
        }
      }
    }
  }
  const sky = tex(W, H, (g) => {
    const s = g.createLinearGradient(0, 0, 0, H);
    s.addColorStop(0, '#04060d'); s.addColorStop(.45, '#0f1527'); s.addColorStop(.6, '#2a2130');
    s.addColorStop(.64, '#4a3230'); s.addColorStop(.66, '#2a1c20'); s.addColorStop(1, '#05080e');
    g.fillStyle = s; g.fillRect(0, 0, W, H);
    const halo = g.createRadialGradient(760, 110, 14, 760, 110, 110);
    halo.addColorStop(0, 'rgba(255,230,190,.3)'); halo.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = halo; g.fillRect(620, 0, 300, 260);
    g.fillStyle = 'rgba(255,238,205,.95)'; g.beginPath(); g.arc(760, 110, 15, 0, Math.PI * 2); g.fill();
    drawTowers(g, towers(14, 40, 30, 150), '#0d1120', .55, .35, 2, 2, 5);
    g.fillStyle = '#060911'; g.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 40; i++) {
      const x = r() * W, w = 6 + r() * 30, grd = g.createLinearGradient(0, horizon, 0, horizon + 90 + r() * 60);
      grd.addColorStop(0, `rgba(255,190,120,${.12 + r() * .12})`); grd.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = grd; g.fillRect(x, horizon, w, 160);
    }
    const hz = g.createLinearGradient(0, horizon - 120, 0, horizon + 30);
    hz.addColorStop(0, 'rgba(90,60,50,0)'); hz.addColorStop(1, 'rgba(90,60,50,.4)');
    g.fillStyle = hz; g.fillRect(0, horizon - 120, W, 150);
  }, { wrap: false });
  const mid = tex(W, H, (g) => { g.clearRect(0, 0, W, H); drawTowers(g, towers(22, 56, 60, 230), '#090c16', .8, .36, 2, 3, 7); }, { wrap: false });
  let beacons = [];
  const near = tex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const list = towers(40, 90, 90, 300);
    drawTowers(g, list, '#070a12', .9, .3, 3, 4, 9);
    // the corniche: a lit road at the foot of the towers
    g.fillStyle = '#0a0d14'; g.fillRect(0, horizon - 2, W, 14);
    for (let x = 20; x < W; x += 46) { g.fillStyle = 'rgba(255,205,140,.9)'; g.fillRect(x, horizon - 8, 2, 2); }
    beacons = [...list].sort((a, b) => b.h - a.h).slice(0, 3).map(t => ({ u: (t.x + t.w / 2) / W, v: 1 - (horizon - t.h - 6) / H }));
  }, { wrap: false });
  return { sky, mid, near, beacons, horizonV: 1 - horizon / H };
}

function makePoster() {
  return tex(600, 800, (g) => {
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 600, 800);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(80, 120); g.lineTo(80, 700); g.stroke();
    const stops = [['2015', 'OVIEDO'], ['2020', 'MADRID'], ['2021', 'GENÈVE'], ['2026', 'ABU DHABI']];
    g.textBaseline = 'middle';
    stops.forEach(([y, name], i) => {
      const yy = 160 + i * 170;
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(80, yy, 8, 0, Math.PI * 2); g.fill();
      g.font = '500 28px "IBM Plex Mono", monospace'; g.fillStyle = '#6b6b6b'; g.fillText(y, 120, yy - 26);
      g.font = '800 54px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#1b1b1b'; g.fillText(name, 120, yy + 18);
    });
  }, { wrap: false });
}
function makeLeaf() {
  return tex(128, 256, (g) => {
    g.clearRect(0, 0, 128, 256);
    g.fillStyle = '#2f6b3a'; g.beginPath(); g.moveTo(64, 250); g.bezierCurveTo(0, 180, 0, 60, 64, 6); g.bezierCurveTo(128, 60, 128, 180, 64, 250); g.fill();
    g.strokeStyle = '#3f8a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 250); g.lineTo(64, 12); g.stroke();
    g.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const y = 40 + i * 28; g.beginPath(); g.moveTo(64, y + 10); g.lineTo(18, y - 8); g.moveTo(64, y + 10); g.lineTo(110, y - 8); g.stroke(); }
  }, { wrap: false });
}
function makeSoftShadow() {
  const c = d.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,.75)'); grd.addColorStop(.45, 'rgba(0,0,0,.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function makeDustSprite() {
  const c = d.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const GrainShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.04 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(time) * 100.0) - 0.5;
      c.rgb += g * amount * (0.4 + 0.6 * (1.0 - c.g));
      vec2 q = vUv - 0.5; float v = 1.0 - dot(q, q) * 0.95;
      c.rgb *= clamp(v, 0.0, 1.0);
      gl_FragColor = c;
    }`,
};

// ---------- sound, all synthesized: AC hum, monitor hum, key clicks, channel change ----------
function makeSound() {
  let ctx = null, master = null, clickBuf = null, amb = null, on = false;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.12), b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    clickBuf = b;
  }
  function ambient() {
    if (amb) return;
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.16;
    src.connect(lp).connect(g).connect(master); src.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.04; lfo.connect(lg).connect(g.gain); lfo.start();
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 50;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 100;
    const hg = ctx.createGain(); hg.gain.value = 0.012;
    o1.connect(hg); o2.connect(hg); hg.connect(master); o1.start(); o2.start();
    amb = { src, lfo, o1, o2 };
  }
  function burst(filterType, freq, q, gain, decay, t) {
    const src = ctx.createBufferSource(); src.buffer = clickBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + decay + 0.02);
  }
  function tone(type, f0, f1, gain, attack, decay, t) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay * 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(master); o.start(t); o.stop(t + attack + decay + 0.02);
  }
  return {
    get on() { return on; },
    set(v) {
      ensure(); on = v;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      if (v) { ctx.resume(); ambient(); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0.7, t + 0.9); tone('sine', 520, 520, 0.05, 0.01, 0.12, t + 0.05); }
      else { master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.4); }
    },
    key() {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      burst('bandpass', 1600 + Math.random() * 2200, 1.1, 0.35 + Math.random() * 0.2, 0.045, t);
      tone('sine', 150 + Math.random() * 50, 90, 0.09, 0.003, 0.035, t);
    },
    channel() {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      burst('highpass', 900, 0.7, 0.3, 0.16, t);
      burst('bandpass', 2400, 0.4, 0.25, 0.09, t + 0.03);
      tone('square', 880, 1320, 0.035, 0.05, 0.18, t + 0.06);
    },
    pause() { if (ctx && on) ctx.suspend(); },
    resume() { if (ctx && on) ctx.resume(); },
    dispose() { if (ctx) { try { ctx.close(); } catch (e) {} } ctx = null; amb = null; on = false; },
  };
}

// ---------- runtime ----------
let R = null;

export function start(room, hooks = {}) {
  if (R) return;
  const canvas = room.querySelector('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  scene.fog = new THREE.FogExp2(0x04060a, 0.11);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.12;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);

  const mat = makeMaterials();
  const add = (geo, m, x, y, z, opt = {}) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
    mesh.castShadow = opt.cast !== false; mesh.receiveShadow = opt.receive !== false;
    if (opt.rot) mesh.rotation.set(...opt.rot);
    (opt.parent || scene).add(mesh); return mesh;
  };
  const box = (w, h, dd, m, x, y, z, opt) => add(new THREE.BoxGeometry(w, h, dd), m, x, y, z, opt);
  const rbox = (w, h, dd, rad, m, x, y, z, opt) => add(new RoundedBoxGeometry(w, h, dd, 4, rad), m, x, y, z, opt);
  const shadowTex = makeSoftShadow();
  // soft contact shadow under an object standing on the desk (or floor)
  const contact = (x, z, w, h, rot = 0, y = 0.7612, strength = 0.9) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: strength }));
    m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, y, z); m.renderOrder = 1; scene.add(m);
  };

  // ---- the room shell ----
  add(new THREE.PlaneGeometry(12, 12), mat.floor, 0, 0, 1, { rot: [-Math.PI / 2, 0, 0], cast: false });
  add(new THREE.PlaneGeometry(2.8, 2.0), mat.rug, 0, 0.004, -0.2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 4), mat.plaster, -2.6, 2, 1, { rot: [0, Math.PI / 2, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 4), mat.plaster, 2.6, 2, 1, { rot: [0, -Math.PI / 2, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 12), mat.plaster, 0, 3.2, 1, { rot: [Math.PI / 2, 0, 0], cast: false });
  box(4.6, 3.2, 0.2, mat.plaster, -2.7, 1.6, -1.7, { cast: false });
  box(3.9, 3.2, 0.2, mat.plaster, 3.05, 1.6, -1.7, { cast: false });
  box(1.5, 1.02, 0.2, mat.plaster, 0.35, 0.51, -1.7, { cast: false });
  box(1.5, 1.12, 0.2, mat.plaster, 0.35, 2.64, -1.7, { cast: false });
  box(5.2, 0.1, 0.02, mat.plastic, 0, 0.05, -1.59, { cast: false });
  const fr = mat.darkMetal;
  box(1.56, 0.04, 0.2, fr, 0.35, 2.06, -1.7); box(1.56, 0.04, 0.2, fr, 0.35, 1.04, -1.7);
  box(0.04, 1.06, 0.2, fr, -0.38, 1.55, -1.7); box(0.04, 1.06, 0.2, fr, 1.08, 1.55, -1.7);
  box(0.025, 1.0, 0.03, fr, 0.35, 1.55, -1.68);
  rbox(1.7, 0.03, 0.14, 0.006, mat.wood, 0.35, 1.0, -1.55);
  add(new THREE.PlaneGeometry(1.46, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0.6, envMapIntensity: 1.5, depthWrite: false }), 0.35, 1.55, -1.72, { cast: false, receive: false });
  // outlet on the wall and the AC unit above the window
  rbox(0.08, 0.08, 0.012, 0.004, mat.white, 0.25, 0.3, -1.594, { cast: false });
  box(0.006, 0.012, 0.004, mat.plastic, 0.238, 0.3, -1.586, { cast: false }); box(0.006, 0.012, 0.004, mat.plastic, 0.262, 0.3, -1.586, { cast: false });
  rbox(0.82, 0.27, 0.2, 0.03, mat.white, 1.75, 2.62, -1.5, { cast: false });
  box(0.7, 0.012, 0.06, mat.plastic, 1.75, 2.5, -1.4, { cast: false });
  add(new THREE.BoxGeometry(0.006, 0.006, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3cff6a, emissiveIntensity: 3 }), 2.1, 2.53, -1.398, { cast: false, receive: false });

  // ---- out of the window ----
  const city = makeCity();
  add(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: city.sky, fog: false }), 0.35, 1.5, -6.0, { cast: false, receive: false });
  add(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: city.mid, transparent: true, fog: false }), 0.35, 1.45, -4.6, { cast: false, receive: false });
  add(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshBasicMaterial({ map: city.near, transparent: true, fog: false }), 0.35, 1.4, -3.4, { cast: false, receive: false });
  const dot = makeDustSprite();
  const sprite = (color, size, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s;
  };
  const beacons = city.beacons.map((b, i) => { const s = sprite(0xff2a1f, 0.05, 0.35 - 2.6 + b.u * 5.2, 1.4 - 1.3 + b.v * 2.6, -3.38); s.userData.phase = i * 2.1; return s; });
  const roadY = 1.4 - 1.3 + city.horizonV * 2.6 - 0.02;
  const cars = [];
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1, s = sprite(dir > 0 ? 0xff5a3a : 0xfff1c8, 0.014, -2.2 + Math.random() * 5, roadY + (dir > 0 ? 0.0 : 0.012), -3.36);
    s.userData.v = dir * (0.12 + Math.random() * 0.08); cars.push(s);
  }
  const plane = sprite(0xffffff, 0.02, -4, 2.4, -5.9); plane.userData.t = Math.random() * 60;
  // curtain, rod, poster
  const curtainGeo = new THREE.PlaneGeometry(0.5, 1.6, 40, 4);
  { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 38) * 0.03 + Math.sin(p.getX(i) * 11) * 0.015); curtainGeo.computeVertexNormals(); }
  add(curtainGeo, mat.cloth, -0.52, 1.5, -1.5);
  box(1.2, 0.025, 0.025, mat.darkMetal, -0.1, 2.32, -1.5, { cast: false });
  rbox(0.64, 0.86, 0.025, 0.004, mat.plastic, -1.3, 1.5, -1.585, { cast: false });
  add(new THREE.PlaneGeometry(0.58, 0.78), new THREE.MeshStandardMaterial({ map: makePoster(), roughness: 0.9 }), -1.3, 1.5, -1.571, { cast: false });

  // ---- desk ----
  rbox(1.9, 0.04, 0.85, 0.008, mat.wood, 0, 0.74, -0.45);
  for (const [lx, lz] of [[-0.9, -0.82], [0.9, -0.82], [-0.9, -0.08], [0.9, -0.08]]) box(0.04, 0.72, 0.04, mat.darkMetal, lx, 0.36, lz);
  box(1.8, 0.04, 0.03, mat.darkMetal, 0, 0.6, -0.82);

  // ---- monitor ----
  rbox(0.62, 0.37, 0.035, 0.012, mat.plastic, 0, 1.09, -0.57);
  const sound = makeSound();
  const screen = makeScreen(() => sound.key());
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screen.tex, emissiveIntensity: 0, roughness: 0.35, metalness: 0 });
  add(new THREE.PlaneGeometry(0.575, 0.325), screenMat, 0, 1.095, -0.5515, { cast: false, receive: false });
  add(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.16, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false }), 0, 1.095, -0.5505, { cast: false, receive: false });
  const led = add(new THREE.BoxGeometry(0.008, 0.003, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4fd1c5, emissiveIntensity: 3 }), 0.27, 0.912, -0.551, { cast: false, receive: false });
  rbox(0.05, 0.2, 0.03, 0.008, mat.darkMetal, 0, 0.86, -0.59);
  rbox(0.26, 0.012, 0.18, 0.005, mat.darkMetal, 0, 0.766, -0.59);
  contact(0, -0.59, 0.4, 0.3);
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.95, -0.6), new THREE.Vector3(0.02, 0.86, -0.72), new THREE.Vector3(0.1, 0.765, -0.86), new THREE.Vector3(0.16, 0.4, -0.88), new THREE.Vector3(0.2, 0.3, -1.1), new THREE.Vector3(0.24, 0.3, -1.58)]);
  add(new THREE.TubeGeometry(cable, 48, 0.004, 8, false), mat.plastic, 0, 0, 0);

  // ---- keyboard, mouse, phone ----
  rbox(0.44, 0.018, 0.15, 0.006, mat.plastic, 0.05, 0.769, -0.22);
  contact(0.05, -0.22, 0.6, 0.28);
  {
    const rows = [15, 15, 14, 13, 12], count = rows.reduce((a, b) => a + b, 0);
    const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.0235, 0.007, 0.0235, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0x2a2e37, roughness: 0.55 }), count);
    const m = new THREE.Matrix4(); let idx = 0;
    rows.forEach((n, r) => { const x0 = -(n - 1) / 2 * 0.0285; for (let i = 0; i < n; i++) { m.makeTranslation(0.05 + x0 + i * 0.0285, 0.7815, -0.277 + r * 0.0285); keys.setMatrixAt(idx++, m); } });
    keys.castShadow = true; keys.receiveShadow = true; scene.add(keys);
  }
  rbox(0.06, 0.03, 0.1, 0.012, mat.gloss, 0.4, 0.775, -0.22); contact(0.4, -0.22, 0.13, 0.17);
  rbox(0.07, 0.008, 0.145, 0.004, mat.gloss, 0.56, 0.764, -0.3, { rot: [0, 0.2, 0] }); contact(0.56, -0.3, 0.13, 0.2, 0.2);

  // ---- mug, notebook and pen, books, plant ----
  add(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32), mat.ceramic, -0.48, 0.81, -0.42);
  add(new THREE.TorusGeometry(0.028, 0.007, 12, 24), mat.ceramic, -0.525, 0.815, -0.42, { rot: [0, Math.PI / 2, 0] });
  add(new THREE.CircleGeometry(0.038, 32), new THREE.MeshPhysicalMaterial({ color: 0x1a0d08, roughness: 0.1, clearcoat: 1 }), -0.48, 0.852, -0.42, { rot: [-Math.PI / 2, 0, 0], cast: false });
  contact(-0.48, -0.42, 0.15, 0.15);
  rbox(0.22, 0.014, 0.3, 0.004, new THREE.MeshStandardMaterial({ color: 0x2b2e36, roughness: 0.9 }), -0.32, 0.767, -0.18, { rot: [0, -0.12, 0] });
  contact(-0.32, -0.18, 0.32, 0.4, -0.12);
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 12), mat.metal, -0.3, 0.779, -0.2, { rot: [0, 0, Math.PI / 2], cast: false });
  [[0x3b4a6b, 0.16, 0.034, 0.22, 0], [0x6b3b3b, 0.15, 0.028, 0.21, 0.12], [0x4b4b3b, 0.14, 0.024, 0.2, -0.08]].forEach(([c, w, h, dd, ry], i) => {
    const y = 0.76 + [0.017, 0.048, 0.074][i];
    rbox(w, h, dd, 0.003, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }), -0.78, y, -0.72, { rot: [0, ry, 0] });
  });
  contact(-0.78, -0.72, 0.26, 0.32);
  {
    add(new THREE.CylinderGeometry(0.06, 0.045, 0.11, 32), mat.terracotta, 0.8, 0.815, -0.72);
    add(new THREE.CircleGeometry(0.055, 32), new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 }), 0.8, 0.868, -0.72, { rot: [-Math.PI / 2, 0, 0], cast: false });
    contact(0.8, -0.72, 0.2, 0.2);
    const leafMat = new THREE.MeshStandardMaterial({ map: makeLeaf(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
    const rr = mulberry32(7);
    for (let i = 0; i < 11; i++) {
      const pivot = new THREE.Group(); pivot.position.set(0.8, 0.86, -0.72);
      pivot.rotation.set(-0.55 - rr() * 0.7, i * (Math.PI * 2 / 11) + rr() * 0.4, 0, 'YXZ');
      const len = 0.16 + rr() * 0.1;
      add(new THREE.PlaneGeometry(len * 0.5, len), leafMat, 0, len / 2, 0, { parent: pivot, receive: false });
      scene.add(pivot);
    }
  }

  // ---- the portrait, in a frame standing at the left of the desk ----
  {
    const fg = new THREE.Group(); fg.position.set(-0.7, 0.763, -0.33); fg.rotation.set(-0.1, 0.55, 0, 'YXZ'); scene.add(fg);
    rbox(0.2, 0.2, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.6 }), 0, 0.1, 0, { parent: fg });
    add(new THREE.PlaneGeometry(0.174, 0.174), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 }), 0, 0.1, 0.0065, { parent: fg, cast: false });
    const photoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    new THREE.TextureLoader().load('photo.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; photoMat.map = t; photoMat.needsUpdate = true; });
    add(new THREE.PlaneGeometry(0.15, 0.15), photoMat, 0, 0.1, 0.007, { parent: fg, cast: false });
    add(new THREE.PlaneGeometry(0.178, 0.178), new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }), 0, 0.1, 0.0075, { parent: fg, cast: false, receive: false });
    box(0.06, 0.16, 0.005, mat.plastic, 0, 0.07, -0.035, { parent: fg, rot: [0.4, 0, 0], cast: false });
    contact(-0.7, -0.33, 0.24, 0.16, 0.55);
  }

  // ---- desk lamp ----
  add(new THREE.CylinderGeometry(0.07, 0.075, 0.02, 32), mat.darkMetal, -0.78, 0.77, -0.62); contact(-0.78, -0.62, 0.2, 0.2);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 12), mat.darkMetal, -0.738, 0.945, -0.62, { rot: [0, 0, -0.25] });
  add(new THREE.SphereGeometry(0.016, 16, 16), mat.darkMetal, -0.696, 1.11, -0.62);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), mat.darkMetal, -0.575, 1.197, -0.62, { rot: [0, 0, -0.95] });
  add(new THREE.ConeGeometry(0.1, 0.14, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }), -0.45, 1.26, -0.62, { rot: [0, 0, -0.5], cast: false });
  const bulb = add(new THREE.SphereGeometry(0.022, 16, 16), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd2a0, emissiveIntensity: 5 }), -0.43, 1.21, -0.62, { cast: false, receive: false });

  // ---- the chair, pushed aside to the right ----
  {
    const cg = new THREE.Group(); cg.position.set(0.85, 0, 0.5); cg.rotation.y = -0.6; scene.add(cg);
    rbox(0.46, 0.07, 0.46, 0.03, mat.seat, 0, 0.47, 0, { parent: cg });
    rbox(0.44, 0.5, 0.06, 0.03, mat.seat, 0, 0.78, -0.22, { parent: cg, rot: [-0.15, 0, 0] });
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 16), mat.darkMetal, 0, 0.26, 0, { parent: cg });
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.03, 16), mat.darkMetal, 0, 0.43, 0, { parent: cg });
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const leg = add(new THREE.BoxGeometry(0.3, 0.02, 0.03), mat.darkMetal, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, { parent: cg, rot: [0, -a, 0] });
      add(new THREE.SphereGeometry(0.025, 12, 12), mat.plastic, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, { parent: cg });
      void leg;
    }
    contact(0.85, 0.5, 0.8, 0.8, 0, 0.006, 0.6);
  }

  // ---- light ----
  scene.add(new THREE.HemisphereLight(0x22304a, 0x0a0806, 0.3));
  const lamp = new THREE.SpotLight(0xffb46b, 11, 4, Math.PI / 3.6, 0.8, 1.8);
  lamp.position.copy(bulb.position); lamp.target.position.set(-0.2, 0.76, -0.45);
  lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);
  const bulbLight = new THREE.PointLight(0xffb46b, 0.5, 0.6, 2); bulbLight.position.copy(bulb.position); scene.add(bulbLight);
  const windowWash = new THREE.PointLight(0x6f86b8, 0.45, 2.2, 2); windowWash.position.set(0.35, 1.55, -1.3); scene.add(windowWash);
  const screenLight = new THREE.RectAreaLight(0x9fe0ff, 0, 0.56, 0.32);
  screenLight.position.set(0, 1.095, -0.54); screenLight.lookAt(0, 1.0, 2); scene.add(screenLight);
  const windowLight = new THREE.RectAreaLight(0x6f86b8, 1.4, 1.5, 1.06);
  windowLight.position.set(0.35, 1.55, -1.6); windowLight.lookAt(0.35, 1.2, 1); scene.add(windowLight);
  const moon = new THREE.DirectionalLight(0x7f90bf, 0.3);
  moon.position.set(0.9, 2.6, -3); moon.target.position.set(0, 0.8, 0); scene.add(moon, moon.target);

  // dust in the lamp light
  const N = 170, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const yy = 0.78 + Math.random() * 0.42, sp = 0.12 + (1.2 - yy) * 0.55; pos[i * 3] = -0.3 + (Math.random() - 0.5) * sp * 2; pos[i * 3 + 1] = yy; pos[i * 3 + 2] = -0.5 + (Math.random() - 0.5) * sp * 2; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd9a8, map: makeDustSprite(), size: 0.01, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // ---- post ----
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.75, 0.9));
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  if (!reduced) composer.addPass(grain);

  // ---- camera: orbit around the desk, with guided flights for the views ----
  const VIEWS = {
    desk: { pos: new THREE.Vector3(0.5, 1.3, 1.3), look: new THREE.Vector3(0, 1.0, -0.5) },
    zoom: { pos: new THREE.Vector3(0.04, 1.1, 0.3), look: new THREE.Vector3(0, 1.09, -0.57) },
  };
  camera.position.copy(VIEWS.desk.pos);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
  controls.minDistance = 0.45; controls.maxDistance = 3.0;
  controls.minPolarAngle = 0.8; controls.maxPolarAngle = 1.62;
  controls.minAzimuthAngle = -0.9; controls.maxAzimuthAngle = 0.9;
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7;
  controls.target.copy(VIEWS.desk.look);
  let fly = null, view = 'desk';
  function flyTo(pos, look) {
    fly = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: look.clone(), s: 0 };
    controls.enabled = false;
  }
  function goTo(name) {
    view = name;
    const v = VIEWS[name], wide = window.innerWidth > 720;
    const sx = (!panel.hidden && name === 'zoom' && wide) ? 0.3 : 0, sy = (!panel.hidden && name === 'zoom' && !wide) ? -0.16 : 0;
    flyTo(v.pos.clone().add(new THREE.Vector3(sx, 0, 0)), v.look.clone().add(new THREE.Vector3(sx, sy, 0)));
  }

  // ---- HUD ----
  const panel = room.querySelector('#panel');
  const pBody = room.querySelector('#p-body');
  const pCh = room.querySelector('#p-ch');
  const pTitle = room.querySelector('#p-title');
  const navLinks = [...room.querySelectorAll('.menu a')];
  const zoomBtn = room.querySelector('#zoom');
  const soundBtn = room.querySelector('#sound');
  const fullBtn = room.querySelector('#full');
  function setSound(v) {
    try { sound.set(v); } catch (e) { return; }
    soundBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
    soundBtn.textContent = v ? 'Sound on' : 'Sound off';
    try { localStorage.setItem('site.sound', v ? '1' : '0'); } catch (e) {}
  }
  function toggleFull() {
    if (d.fullscreenElement) { d.exitFullscreen && d.exitFullscreen().catch(() => {}); return; }
    const p = room.requestFullscreen && room.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  }

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
    sound.channel();
    goTo('zoom'); zoomBtn.textContent = 'Back to the desk';
    panel.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    navLinks.forEach(a => a.removeAttribute('aria-current'));
    goTo('desk'); zoomBtn.textContent = 'Zoom';
  }
  function route() {
    const h = location.hash.replace('#', '');
    if (CHANNELS.some(c => c.id === h)) open(h); else close();
  }
  function leave() { if (location.hash && location.hash !== '#') location.hash = ''; else close(); }
  function toggleZoom() {
    if (!panel.hidden) return leave();
    goTo(view === 'zoom' ? 'desk' : 'zoom');
    zoomBtn.textContent = view === 'zoom' ? 'Back to the desk' : 'Zoom';
  }

  const L = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); L.push(() => el.removeEventListener(ev, fn, o)); };
  on(window, 'hashchange', route);
  on(room.querySelector('#p-close'), 'click', leave);
  on(room.querySelector('#home-link'), 'click', (e) => { e.preventDefault(); leave(); });
  on(zoomBtn, 'click', toggleZoom);
  on(soundBtn, 'click', () => setSound(!sound.on));
  on(fullBtn, 'click', toggleFull);
  on(room.querySelector('#lofi'), 'click', () => { stop(); hooks.onLofi && hooks.onLofi(); });
  // a click on the scene (not a drag) toggles the zoom
  let down = null;
  on(canvas, 'pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  on(canvas, 'click', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) toggleZoom(); down = null; });
  let wantSound = false; try { wantSound = localStorage.getItem('site.sound') === '1'; } catch (e) {}
  if (wantSound) { const arm = () => { if (!sound.on) setSound(true); }; on(window, 'pointerdown', arm, { once: true }); on(window, 'keydown', arm, { once: true }); }
  on(window, 'keydown', (e) => {
    if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'Escape') leave();
    else if (e.key >= '1' && e.key <= '4') location.hash = '#' + CHANNELS[+e.key - 1].id;
    else if (e.key === 'z' || e.key === 'Z') toggleZoom();
    else if (e.key === 'm' || e.key === 'M') setSound(!sound.on);
    else if (e.key === 'f' || e.key === 'F') toggleFull();
  });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = camera.aspect < 0.85;
    VIEWS.desk.pos.set(narrow ? 0.25 : 0.5, narrow ? 1.4 : 1.3, narrow ? 2.2 : 1.3);
  }
  on(window, 'resize', resize);
  resize();

  // ---- loop ----
  const clock = new THREE.Clock();
  let raf = 0, announced = false, hidden = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const onAmt = Math.min(1, Math.max(0, (t - 0.4) / 1.1));
    const e = onAmt * onAmt * (3 - 2 * onAmt);
    const flick = reduced ? 1 : 0.97 + 0.03 * Math.random();
    screenMat.emissiveIntensity = 1.35 * e * flick;
    screenLight.intensity = 6 * e * flick;
    led.material.emissiveIntensity = 3 * e;
    screen.tick(t, dt);
    grain.uniforms.time.value = t;

    if (fly) {
      fly.s = Math.min(1, fly.s + dt / (reduced ? 0.01 : 1.3));
      const k = fly.s * fly.s * (3 - 2 * fly.s);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.s >= 1) { fly = null; controls.enabled = true; }
    }
    controls.update();

    for (const s of beacons) s.material.opacity = 0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 + s.userData.phase), 8);
    if (!reduced) {
      for (const c of cars) { c.position.x += c.userData.v * dt; if (c.position.x > 2.95) c.position.x = -2.25; if (c.position.x < -2.25) c.position.x = 2.95; }
      plane.userData.t += dt; const pt = (plane.userData.t % 70) / 70;
      plane.position.set(-4.2 + pt * 8.6, 2.45 + Math.sin(pt * 3) * 0.05, -5.9);
      plane.material.opacity = pt < 0.75 ? (Math.sin(t * 6) > 0.6 ? 0.6 : 0.12) : 0;
      const a = dust.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < N; i++) {
        arr[i * 3 + 1] -= dt * 0.01;
        arr[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.004;
        if (arr[i * 3 + 1] < 0.78) arr[i * 3 + 1] = 1.2;
      }
      a.needsUpdate = true;
    }
    composer.render();
    if (!announced) { announced = true; hooks.onReady && hooks.onReady(); }
  }
  on(d, 'visibilitychange', () => { hidden = d.hidden; if (hidden) sound.pause(); else { sound.resume(); clock.getDelta(); } });

  function stop() {
    if (!R) return;
    cancelAnimationFrame(raf);
    sound.dispose();
    controls.dispose();
    L.forEach(f => f());
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) { for (const k of ['map', 'bumpMap', 'roughnessMap', 'emissiveMap']) if (m[k]) m[k].dispose(); m.dispose(); }
    });
    composer.dispose(); target.dispose();
    if (scene.environment) scene.environment.dispose();
    renderer.dispose();
    R = null;
  }
  R = { stop };

  const fontsReady = Promise.all([
    d.fonts.load('500 38px "IBM Plex Mono"'),
    d.fonts.load('96px VT323'),
    d.fonts.load('800 54px "Bricolage Grotesque"'),
  ]).catch(() => {});
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 2500))]).then(() => {
    if (!R) return;
    route();
    clock.start();
    frame();
  });
}

export function stop() { if (R) R.stop(); }
