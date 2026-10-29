// The room: an original three.js scene for nachomndzb.github.io.
// A bedroom desk in Asturias around 2001, at night: a beige tower PC and a CRT
// monitor running a DOS-style terminal that introduces the site. The four
// sections are TV channels shown as cards over the scene. Everything but the
// portrait is procedural: textures are drawn to canvases at load, geometry is
// built from primitives, sound is synthesized.
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

const PROMPT = 'C:\\NACHO>';
const SCRIPT = [
  ['cmd', 'whoami'],
  ['out', 'Ignacio Méndez-Bonito'],
  ['out', 'Senior Forward Deployed Engineer - DGE, Abu Dhabi'],
  ['cmd', 'type now.txt'],
  ['out', 'Agentic recruitment platform for the Abu Dhabi Government'],
  ['out', '50+ entities - ~10,000 HR users - time-to-hire 45 -> ~20 days'],
  ['cmd', 'dir channels'],
  ['out', ' 01-ABOUT    02-NOW    03-BEFORE    04-ELSEWHERE'],
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
  const n1 = valueNoise(11), n2 = valueNoise(23), n3 = valueNoise(37), rr = mulberry32(99);
  // beech laminate: pale, fine straight grain
  const beechColor = pix(512, 512, (x, y) => {
    const grain = fbm(n1, x / 160, y / 4, 3), t = 0.5 + 0.35 * (grain - 0.5) + 0.12 * (fbm(n2, x / 40, y / 40, 2) - 0.5);
    return [200 + 45 * t, 160 + 42 * t, 105 + 35 * t];
  }, { repeat: [2, 1] });
  const beechBump = pix(256, 256, (x, y) => { const v = 128 + 60 * (fbm(n1, x / 80, y / 2.5, 3) - 0.5); return [v, v, v]; }, { repeat: [2, 1], srgb: false });
  const beech = new THREE.MeshStandardMaterial({ map: beechColor, bumpMap: beechBump, bumpScale: 0.004, roughness: 0.42, metalness: 0.02, envMapIntensity: 0.6 });

  // stippled cream plaster (gotelé)
  const goteleColor = tex(512, 512, (g) => {
    g.fillStyle = '#d3c7aa'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const x = rr() * 512, y = rr() * 512, r = 0.8 + rr() * 2.4;
      g.fillStyle = rr() < .5 ? 'rgba(255,250,235,.5)' : 'rgba(110,95,70,.35)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [6, 3] });
  const goteleBump = tex(256, 256, (g) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      const x = rr() * 256, y = rr() * 256, r = 1 + rr() * 2.6, grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [6, 3], srgb: false });
  const plaster = new THREE.MeshStandardMaterial({ map: goteleColor, bumpMap: goteleBump, bumpScale: 0.012, roughness: 0.95 });

  // terrazzo floor: amber and brown chips in a sand base, 40 cm tiles, polished
  const terrazzoColor = tex(512, 512, (g) => {
    g.fillStyle = '#cbbd9d'; g.fillRect(0, 0, 512, 512);
    const cols = ['#6e4123', '#9a5a2b', '#c98a45', '#3b2718', '#e2cfa6', '#a8713a', '#54301c', '#b58a4e'];
    for (let i = 0; i < 1500; i++) {
      const x = rr() * 512, y = rr() * 512, r = 1.5 + rr() * rr() * 9, a = rr() * Math.PI;
      g.fillStyle = cols[(rr() * cols.length) | 0];
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rr() * 0.5), a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(70,55,38,.4)';
    g.fillRect(0, 0, 512, 2); g.fillRect(0, 256, 512, 2); g.fillRect(0, 0, 2, 512); g.fillRect(256, 0, 2, 512);
  }, { repeat: [15, 15] });
  const terrazzoRough = pix(256, 256, (x, y) => { const v = 55 + 45 * fbm(n3, x / 30, y / 30, 3); return [v, v, v]; }, { repeat: [15, 15], srgb: false });
  const terrazzo = new THREE.MeshStandardMaterial({ map: terrazzoColor, roughnessMap: terrazzoRough, roughness: 1, metalness: 0.05, envMapIntensity: 0.9 });

  // the patchwork mousepad
  const padTex = tex(256, 256, (g) => {
    const cols = ['#c8322e', '#e8a02a', '#7b3fa0', '#2d7dd2', '#f0e14a', '#2aa36b', '#e0552b', '#f2f2f2', '#1d3a8a', '#d35fa0', '#5a3a1e', '#38b5c9'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = cols[(i * 4 + j) % cols.length]; g.fillRect(i * 64, j * 64, 64, 64);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(i * 64 + 18, j * 64 + 18, 28, 28);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(i * 64 + 24, j * 64 + 24, 16, 16);
    }
  }, { wrap: false });
  const pad = new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.95 });

  const clothBump = pix(256, 256, (x, y) => { const v = 128 + 60 * (Math.sin(x * 1.3) * Math.sin(y * 1.3)) + 20 * (n1(x / 3, y / 3) - .5); return [v, v, v]; }, { repeat: [3, 8], srgb: false });
  const sheer = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, bumpMap: clothBump, bumpScale: 0.0015, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });

  const beige = new THREE.MeshStandardMaterial({ color: 0xd9cdaa, roughness: 0.55, metalness: 0.02 });
  const beigeDark = new THREE.MeshStandardMaterial({ color: 0xbfb28f, roughness: 0.6 });
  const keycap = new THREE.MeshStandardMaterial({ color: 0xe0d6b8, roughness: 0.6 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d3a8a, roughness: 0.5 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.05 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8e949c, roughness: 0.35, metalness: 0.9 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.45, metalness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe4e2da, roughness: 0.5 });
  const vinyl = new THREE.MeshPhysicalMaterial({ color: 0x1e3f8f, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf1ece0, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  return { beech, plaster, terrazzo, pad, sheer, beige, beigeDark, keycap, navy, plastic, gloss, metal, darkMetal, white, vinyl, ceramic };
}

// ---------- the CRT's terminal, drawn to a canvas texture ----------
function makeScreen(onType) {
  const c = d.createElement('canvas'); c.width = 1024; c.height = 768;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const st = { line: 0, chars: 0, done: false, cursor: true, osd: null, osdT: 0, dirty: true, nextAt: 0 };
  let blinkAt = 0, startAt = null;

  function draw() {
    g.fillStyle = '#050607'; g.fillRect(0, 0, 1024, 768);
    g.textBaseline = 'top'; g.textAlign = 'left';
    g.font = '46px VT323, "IBM Plex Mono", monospace';
    let y = 52;
    for (let i = 0; i <= st.line && i < SCRIPT.length; i++) {
      const [kind, text] = SCRIPT[i];
      const typed = i < st.line ? text : text.slice(0, st.chars);
      if (kind === 'cmd') {
        g.fillStyle = '#e9e9e4'; g.fillText(PROMPT + typed, 48, y);
        if (i === st.line && st.cursor) { const cw = g.measureText(PROMPT + typed).width; g.fillRect(48 + cw + 6, y + 38, 22, 5); }
      } else {
        g.fillStyle = '#b9b9b2'; g.fillText(typed, 48, y);
      }
      y += 50;
    }
    if (st.osd) {
      const a = Math.min(1, st.osdT * 4) * Math.min(1, Math.max(0, (2.2 - st.osdT) * 2));
      g.globalAlpha = a; g.font = '110px VT323, monospace'; g.fillStyle = '#e9e9e4'; g.textAlign = 'right';
      g.fillText(st.osd, 976, 36); g.textAlign = 'left'; g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let s = 0; s < 768; s += 3) g.fillRect(0, s, 1024, 1);
    const v = g.createRadialGradient(512, 384, 300, 512, 384, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = v; g.fillRect(0, 0, 1024, 768);
    t.needsUpdate = true; st.dirty = false;
  }
  function tick(time, dt) {
    if (startAt === null) startAt = time + 1.1;
    if (!st.done && time >= startAt && time >= st.nextAt) {
      const [kind, text] = SCRIPT[st.line];
      if (kind === 'cmd' && st.chars < text.length) {
        st.chars++; st.nextAt = time + (reduced ? 0 : 0.05 + Math.random() * 0.05);
        onType && onType();
      } else if (st.line < SCRIPT.length - 1) {
        st.line++; st.chars = 0;
        const [nk, nt] = SCRIPT[st.line];
        if (nk === 'out') st.chars = nt.length;
        st.nextAt = time + (reduced ? 0 : (nk === 'out' ? 0.2 : 0.55));
      } else {
        st.done = true;
      }
      st.dirty = true;
    }
    if (time >= blinkAt) { st.cursor = !st.cursor; blinkAt = time + 0.5; st.dirty = true; }
    if (st.osd) { st.osdT += dt; st.dirty = true; if (st.osdT > 2.2) st.osd = null; }
    if (st.dirty) draw();
  }
  return { tex: t, tick, osd(text) { st.osd = text; st.osdT = 0; st.dirty = true; } };
}

// ---------- out of the window: an Asturian street on a rainy night, in three layers ----------
function makeStreet() {
  const r = mulberry32(2001);
  const W = 1024, H = 512, horizon = 350;
  const sky = tex(W, H, (g) => {
    const s = g.createLinearGradient(0, 0, 0, H);
    s.addColorStop(0, '#090b12'); s.addColorStop(.55, '#1a1d28'); s.addColorStop(.68, '#3a2e26'); s.addColorStop(.72, '#2a2320'); s.addColorStop(1, '#0a0b0e');
    g.fillStyle = s; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) {
      const x = r() * W, y = 40 + r() * 220, rad = 40 + r() * 90, grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(70,72,86,.12)'); grd.addColorStop(1, 'rgba(70,72,86,0)');
      g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // hills
    g.fillStyle = '#0c0f14'; g.beginPath(); g.moveTo(0, 300);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, 265 + Math.sin(x / 90) * 18 + Math.sin(x / 37) * 9 + r() * 4);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#0a0b0e'; g.fillRect(0, horizon, W, H - horizon);
  }, { wrap: false });
  // apartment blocks with balconies
  const blocks = tex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    let x = -30;
    while (x < W + 30) {
      const w = 90 + r() * 120, floors = 4 + ((r() * 5) | 0), fh = 26, h = floors * fh + 12;
      const tone = 40 + r() * 30;
      g.fillStyle = `rgb(${tone + 10},${tone + 4},${tone - 4})`; g.fillRect(x, horizon - h, w, h);
      for (let f = 0; f < floors; f++) {
        const fy = horizon - 12 - (f + 1) * fh;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, fy + fh - 4, w, 4);
        g.fillStyle = `rgb(${tone + 24},${tone + 16},${tone + 6})`; g.fillRect(x, fy + fh - 7, w, 3);
        const cols = Math.floor((w - 10) / 24);
        for (let i = 0; i < cols; i++) {
          const lit = r() < .33;
          g.fillStyle = lit ? (r() < .82 ? `rgba(255,${190 + (r() * 40) | 0},120,${.5 + r() * .5})` : 'rgba(150,190,255,.75)') : 'rgba(10,12,18,.9)';
          g.fillRect(x + 8 + i * 24, fy + 5, 11, 14);
        }
      }
      x += w + 6 + r() * 20;
    }
  }, { wrap: false });
  // the street itself: sodium lamps and a wet road
  const lamps = [];
  const street = tex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#121316'; g.fillRect(0, horizon - 4, W, H - horizon + 4);
    g.fillStyle = '#1c1d20'; g.fillRect(0, horizon - 4, W, 10);
    for (let x = 60; x < W; x += 170) {
      lamps.push(x / W);
      g.fillStyle = '#23262c'; g.fillRect(x - 2, horizon - 95, 4, 95);
      g.fillRect(x - 2, horizon - 95, 16, 4);
      const hx = x + 14, hy = horizon - 92;
      const halo = g.createRadialGradient(hx, hy, 2, hx, hy, 70);
      halo.addColorStop(0, 'rgba(255,170,70,.55)'); halo.addColorStop(.4, 'rgba(255,150,50,.18)'); halo.addColorStop(1, 'rgba(255,150,50,0)');
      g.fillStyle = halo; g.fillRect(hx - 70, hy - 70, 140, 140);
      g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(hx, hy, 4, 0, Math.PI * 2); g.fill();
      const refl = g.createLinearGradient(0, horizon, 0, horizon + 120);
      refl.addColorStop(0, 'rgba(255,160,70,.5)'); refl.addColorStop(1, 'rgba(255,160,70,0)');
      g.fillStyle = refl; g.fillRect(hx - 6, horizon, 12, 120);
    }
  }, { wrap: false });
  const rain = tex(256, 512, (g) => {
    g.clearRect(0, 0, 256, 512);
    for (let i = 0; i < 260; i++) {
      const x = r() * 256, y = r() * 512, len = 14 + r() * 40;
      g.strokeStyle = `rgba(200,210,230,${.15 + r() * .35})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + len); g.stroke();
    }
  }, { repeat: [3, 2] });
  const drops = tex(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const x = r() * 512, y = r() * 512, rad = 1.5 + r() * r() * 6;
      const grd = g.createRadialGradient(x - rad * .3, y - rad * .3, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(.6, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rad, rad * (1 + r() * 1.6), 0, 0, Math.PI * 2); g.fill();
      if (r() < .25) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 10 + r() * 40); g.stroke(); }
    }
  }, { wrap: false });
  return { sky, blocks, street, rain, drops, lamps, horizonV: 1 - horizon / H };
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
function makeSoftShadow() {
  const c = d.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,.75)'); grd.addColorStop(.45, 'rgba(0,0,0,.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function makeDot() {
  const c = d.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function makeDisc() {
  return tex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    const grd = g.createConicGradient ? g.createConicGradient(0, 128, 128) : null;
    if (grd) { ['#d8d8e0', '#b9c6ff', '#ffd1e8', '#d8ffe8', '#fff3c8', '#d8d8e0'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c)); g.fillStyle = grd; }
    else g.fillStyle = '#d8d8e0';
    g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(128, 128, 18, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(128, 128, 44, 0, Math.PI * 2); g.fill();
  }, { wrap: false });
}

const GrainShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.045 } },
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

// ---------- sound, all synthesized: rain, PC fan, CRT whine, key clicks, channel change ----------
function makeSound() {
  let ctx = null, master = null, clickBuf = null, amb = null, on = false, dripTimer = 0;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.12), b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    clickBuf = b;
  }
  function noiseLoop(seconds, brown) {
    const n = ctx.sampleRate * seconds, b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5; } else ch[i] = w; }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.start(); return src;
  }
  function ambient() {
    if (amb) return;
    // rain on the window: bright noise, gently swelling
    const rain = noiseLoop(3, false);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    const rg = ctx.createGain(); rg.gain.value = 0.045;
    rain.connect(hp).connect(lp).connect(rg).connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lg = ctx.createGain(); lg.gain.value = 0.015; lfo.connect(lg).connect(rg.gain); lfo.start();
    // the PC's fan and the CRT's whine
    const fan = noiseLoop(2, true);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 220; flp.Q.value = 0.5;
    const fg = ctx.createGain(); fg.gain.value = 0.11; fan.connect(flp).connect(fg).connect(master);
    const whine = ctx.createOscillator(); whine.frequency.value = 15600; const wg = ctx.createGain(); wg.gain.value = 0.0035; whine.connect(wg).connect(master); whine.start();
    const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.008; hum.connect(hg).connect(master); hum.start();
    amb = { rain, lfo, fan, whine, hum };
    const drip = () => {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      burst('bandpass', 2500 + Math.random() * 3500, 3, 0.05 + Math.random() * 0.06, 0.05, t);
      dripTimer = setTimeout(drip, 120 + Math.random() * 700);
    };
    dripTimer = setTimeout(drip, 400);
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
      burst('bandpass', 1100 + Math.random() * 1400, 0.9, 0.4 + Math.random() * 0.2, 0.055, t);
      tone('sine', 130 + Math.random() * 40, 80, 0.1, 0.003, 0.04, t);
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
    dispose() { clearTimeout(dripTimer); if (ctx) { try { ctx.close(); } catch (e) {} } ctx = null; amb = null; on = false; },
  };
}

// ---------- runtime ----------
let R = null;

export function start(room, hooks = {}) {
  if (R) return;
  const canvas = room.querySelector('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070a);
  scene.fog = new THREE.FogExp2(0x06070a, 0.1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.14;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);

  const mat = makeMaterials();
  const add = (geo, m, x, y, z, opt = {}) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
    mesh.castShadow = opt.cast !== false; mesh.receiveShadow = opt.receive !== false;
    if (opt.rot) mesh.rotation.set(...opt.rot);
    if (opt.scale) mesh.scale.set(...opt.scale);
    (opt.parent || scene).add(mesh); return mesh;
  };
  const box = (w, h, dd, m, x, y, z, opt) => add(new THREE.BoxGeometry(w, h, dd), m, x, y, z, opt);
  const rbox = (w, h, dd, rad, m, x, y, z, opt) => add(new RoundedBoxGeometry(w, h, dd, 4, rad), m, x, y, z, opt);
  const shadowTex = makeSoftShadow();
  const contact = (x, z, w, h, rot = 0, y = 0.7612, strength = 0.9) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: strength }));
    m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, y, z); m.renderOrder = 1; scene.add(m);
  };
  const tube = (points, radius, m) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 40, radius, 8, false), m, 0, 0, 0);

  // ---- the room shell ----
  add(new THREE.PlaneGeometry(12, 12), mat.terrazzo, 0, 0, 1, { rot: [-Math.PI / 2, 0, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 4), mat.plaster, -2.6, 2, 1, { rot: [0, Math.PI / 2, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 4), mat.plaster, 2.6, 2, 1, { rot: [0, -Math.PI / 2, 0], cast: false });
  add(new THREE.PlaneGeometry(12, 12), mat.white, 0, 2.7, 1, { rot: [Math.PI / 2, 0, 0], cast: false });
  box(4.6, 2.7, 0.2, mat.plaster, -2.7, 1.35, -1.7, { cast: false });
  box(3.9, 2.7, 0.2, mat.plaster, 3.05, 1.35, -1.7, { cast: false });
  box(1.5, 1.02, 0.2, mat.plaster, 0.35, 0.51, -1.7, { cast: false });
  box(1.5, 0.62, 0.2, mat.plaster, 0.35, 2.39, -1.7, { cast: false });
  box(5.2, 0.09, 0.016, mat.beige, 0, 0.045, -1.592, { cast: false });
  const fr = mat.white;
  box(1.56, 0.05, 0.2, fr, 0.35, 2.06, -1.7); box(1.56, 0.05, 0.2, fr, 0.35, 1.04, -1.7);
  box(0.05, 1.06, 0.2, fr, -0.38, 1.55, -1.7); box(0.05, 1.06, 0.2, fr, 1.08, 1.55, -1.7);
  box(0.035, 1.0, 0.04, fr, 0.35, 1.55, -1.68);
  rbox(1.7, 0.03, 0.16, 0.006, mat.white, 0.35, 1.0, -1.55);
  add(new THREE.PlaneGeometry(1.46, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0.6, envMapIntensity: 1.5, depthWrite: false }), 0.35, 1.55, -1.72, { cast: false, receive: false });
  const outside = makeStreet();
  add(new THREE.PlaneGeometry(1.46, 1.0), new THREE.MeshBasicMaterial({ map: outside.drops, transparent: true, opacity: 0.75, depthWrite: false }), 0.35, 1.55, -1.715, { cast: false, receive: false });
  // round outlet, radiator under the window
  add(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 24), mat.white, 0.25, 0.3, -1.594, { rot: [Math.PI / 2, 0, 0], cast: false });
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24), mat.beigeDark, 0.25, 0.3, -1.587, { rot: [Math.PI / 2, 0, 0], cast: false });
  box(0.006, 0.006, 0.004, mat.plastic, 0.24, 0.3, -1.583, { cast: false }); box(0.006, 0.006, 0.004, mat.plastic, 0.26, 0.3, -1.583, { cast: false });
  box(1.0, 0.55, 0.05, mat.white, 0.35, 0.45, -1.565, { cast: false });
  {
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.5, 0.045), mat.white, 20), m = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) { m.makeTranslation(0.35 - 0.475 + i * 0.05, 0.45, -1.515); fins.setMatrixAt(i, m); }
    fins.castShadow = true; fins.receiveShadow = true; scene.add(fins);
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 10), mat.white, -0.1, 0.1, -1.54); add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 10), mat.white, 0.8, 0.1, -1.54);
  }

  // ---- out of the window ----
  add(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: outside.sky, fog: false }), 0.35, 1.5, -6.0, { cast: false, receive: false });
  add(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: outside.blocks, transparent: true, fog: false }), 0.35, 1.45, -4.6, { cast: false, receive: false });
  add(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshBasicMaterial({ map: outside.street, transparent: true, fog: false }), 0.35, 1.4, -3.4, { cast: false, receive: false });
  const rainMat = new THREE.MeshBasicMaterial({ map: outside.rain, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  add(new THREE.PlaneGeometry(3.2, 2.2), rainMat, 0.35, 1.5, -2.5, { cast: false, receive: false });
  const rainMat2 = new THREE.MeshBasicMaterial({ map: outside.rain.clone(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  rainMat2.map.repeat.set(5, 3); rainMat2.map.needsUpdate = true;
  add(new THREE.PlaneGeometry(4.5, 3), rainMat2, 0.35, 1.5, -3.9, { cast: false, receive: false });
  const dot = makeDot();
  const sprite = (color, size, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s;
  };
  const roadY = 1.4 - 1.3 + outside.horizonV * 2.6 - 0.012;
  const cars = [];
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1, s = sprite(dir > 0 ? 0xff4a30 : 0xfff0c0, 0.016, -2.2 + Math.random() * 5, roadY + (dir > 0 ? 0 : 0.01), -3.36);
    s.userData.v = dir * (0.1 + Math.random() * 0.08); cars.push(s);
  }
  // sheer curtain at the right of the window, on a rod
  const curtainGeo = new THREE.PlaneGeometry(0.55, 1.55, 44, 4);
  { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 36) * 0.03 + Math.sin(p.getX(i) * 9) * 0.015); curtainGeo.computeVertexNormals(); }
  add(curtainGeo, mat.sheer, 1.22, 1.52, -1.5);
  box(1.3, 0.025, 0.025, mat.white, 0.75, 2.32, -1.5, { cast: false });
  rbox(0.64, 0.86, 0.025, 0.004, mat.plastic, -1.3, 1.5, -1.585, { cast: false });
  add(new THREE.PlaneGeometry(0.58, 0.78), new THREE.MeshStandardMaterial({ map: makePoster(), roughness: 0.9 }), -1.3, 1.5, -1.571, { cast: false });

  // ---- the beech desk: thick top on two side panels, a low shelf with a box of paper ----
  rbox(1.9, 0.03, 0.8, 0.008, mat.beech, 0, 0.745, -0.45);
  rbox(0.03, 0.73, 0.72, 0.004, mat.beech, -0.935, 0.365, -0.47); rbox(0.03, 0.73, 0.72, 0.004, mat.beech, 0.935, 0.365, -0.47);
  rbox(0.6, 0.025, 0.7, 0.004, mat.beech, -0.62, 0.3, -0.47);
  box(1.86, 0.1, 0.02, mat.beech, 0, 0.68, -0.83, { cast: false });
  rbox(0.48, 0.25, 0.33, 0.006, mat.navy, -0.62, 0.4375, -0.45);
  add(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.9 }), -0.62, 0.44, -0.284, { cast: false });

  // ---- the beige tower, on the desk at the left ----
  const towerG = new THREE.Group(); towerG.position.set(-0.66, 0.76, -0.5); scene.add(towerG);
  rbox(0.19, 0.42, 0.45, 0.006, mat.beige, 0, 0.21, 0, { parent: towerG });
  box(0.17, 0.4, 0.008, mat.beigeDark, 0, 0.21, 0.226, { parent: towerG, cast: false });
  box(0.17, 0.02, 0.01, mat.navy, 0, 0.405, 0.227, { parent: towerG, cast: false });
  box(0.012, 0.4, 0.01, mat.navy, 0.082, 0.21, 0.227, { parent: towerG, cast: false });
  for (const y of [0.36, 0.31]) { box(0.14, 0.038, 0.006, mat.beige, -0.01, y, 0.232, { parent: towerG, cast: false }); box(0.11, 0.004, 0.004, mat.plastic, -0.015, y - 0.006, 0.236, { parent: towerG, cast: false }); }
  box(0.09, 0.022, 0.006, mat.beige, -0.025, 0.255, 0.232, { parent: towerG, cast: false }); box(0.07, 0.003, 0.004, mat.plastic, -0.03, 0.252, 0.236, { parent: towerG, cast: false });
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 20), mat.beigeDark, -0.03, 0.12, 0.232, { parent: towerG, rot: [Math.PI / 2, 0, 0], cast: false });
  const pwrLed = add(new THREE.BoxGeometry(0.006, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3cff6a, emissiveIntensity: 2.5 }), 0.03, 0.125, 0.233, { parent: towerG, cast: false, receive: false });
  const hddLed = add(new THREE.BoxGeometry(0.006, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff8a1f, emissiveIntensity: 0 }), 0.03, 0.11, 0.233, { parent: towerG, cast: false, receive: false });
  contact(-0.66, -0.5, 0.3, 0.56);

  // ---- the CRT monitor ----
  const sound = makeSound();
  const screen = makeScreen(() => sound.key());
  const mon = new THREE.Group(); mon.position.set(0.03, 0.76, -0.55); scene.add(mon);
  add(new THREE.CylinderGeometry(0.12, 0.13, 0.025, 32), mat.beige, 0, 0.0125, 0.02, { parent: mon });
  rbox(0.34, 0.03, 0.26, 0.01, mat.beige, 0, 0.04, 0.02, { parent: mon });
  rbox(0.42, 0.38, 0.1, 0.012, mat.beige, 0, 0.245, 0.13, { parent: mon });
  { // tapered rear, a square frustum
    add(new THREE.CylinderGeometry(0.2, 0.275, 0.3, 4, 1), mat.beige, 0, 0.245, -0.07, { parent: mon, rot: [-Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.9] });
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 24), mat.beige, 0, 0.245, -0.07, { parent: mon, rot: [Math.PI / 2, 0, 0] });
  }
  // bezel around the tube, the tube itself bulging slightly
  const bez = mat.beige;
  box(0.42, 0.045, 0.012, bez, 0, 0.245 + 0.1675, 0.186, { parent: mon, cast: false }); box(0.42, 0.045, 0.012, bez, 0, 0.245 - 0.1675, 0.186, { parent: mon, cast: false });
  box(0.04, 0.38, 0.012, bez, -0.19, 0.245, 0.186, { parent: mon, cast: false }); box(0.04, 0.38, 0.012, bez, 0.19, 0.245, 0.186, { parent: mon, cast: false });
  const tubeGeo = new THREE.PlaneGeometry(0.34, 0.255, 28, 22);
  { const p = tubeGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 0.17, y = p.getY(i) / 0.1275; p.setZ(i, 0.014 * (1 - x * x * 0.85) * (1 - y * y * 0.85)); } tubeGeo.computeVertexNormals(); }
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffffff, emissiveMap: screen.tex, emissiveIntensity: 0, roughness: 0.3, metalness: 0 });
  add(tubeGeo, screenMat, 0, 0.245, 0.181, { parent: mon, cast: false, receive: false });
  add(tubeGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, depthWrite: false }), 0, 0.245, 0.1825, { parent: mon, cast: false, receive: false });
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), mat.beigeDark, 0.15, 0.06, 0.192, { parent: mon, rot: [Math.PI / 2, 0, 0], cast: false });
  const monLed = add(new THREE.BoxGeometry(0.006, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3cff6a, emissiveIntensity: 0 }), 0.12, 0.06, 0.192, { parent: mon, cast: false, receive: false });
  contact(0.03, -0.53, 0.42, 0.36);
  // speakers flanking the monitor
  for (const sx of [-0.4, 0.3]) {
    rbox(0.075, 0.17, 0.11, 0.006, mat.beige, sx, 0.845, -0.72, {});
    add(new THREE.CircleGeometry(0.024, 24), mat.plastic, sx, 0.86, -0.664, { cast: false });
    add(new THREE.CircleGeometry(0.012, 24), mat.plastic, sx, 0.805, -0.664, { cast: false });
    contact(sx, -0.72, 0.12, 0.16);
  }

  // ---- beige keyboard with keys, the ball mouse on the patchwork pad ----
  rbox(0.47, 0.025, 0.17, 0.006, mat.beige, 0.03, 0.7725, -0.16);
  box(0.45, 0.004, 0.15, mat.beigeDark, 0.03, 0.785, -0.16, { cast: false });
  contact(0.03, -0.16, 0.62, 0.3);
  {
    const rows = [15, 15, 14, 13, 12], count = rows.reduce((a, b) => a + b, 0) + 16;
    const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.0195, 0.008, 0.0195, 2, 0.002), mat.keycap, count);
    const m = new THREE.Matrix4(); let idx = 0;
    rows.forEach((n, r) => { const x0 = -(n - 1) / 2 * 0.0225 - 0.06; for (let i = 0; i < n; i++) { m.makeTranslation(0.03 + x0 + i * 0.0225, 0.79, -0.21 + r * 0.0225); keys.setMatrixAt(idx++, m); } });
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { m.makeTranslation(0.03 + 0.14 + i * 0.0225, 0.79, -0.2 + r * 0.0225); keys.setMatrixAt(idx++, m); }
    keys.castShadow = true; keys.receiveShadow = true; scene.add(keys);
  }
  add(new THREE.PlaneGeometry(0.22, 0.18), mat.pad, 0.42, 0.7615, -0.2, { rot: [-Math.PI / 2, 0, 0.1], cast: false });
  add(new THREE.SphereGeometry(1, 24, 16), mat.beige, 0.42, 0.78, -0.2, { scale: [0.03, 0.02, 0.045], rot: [0, 0.15, 0] });
  box(0.001, 0.014, 0.03, mat.beigeDark, 0.42, 0.79, -0.215, { cast: false, rot: [0, 0.15, 0] });
  contact(0.42, -0.2, 0.1, 0.13);
  tube([[0.42, 0.775, -0.24], [0.4, 0.765, -0.5], [0.1, 0.765, -0.82], [-0.5, 0.765, -0.8], [-0.62, 0.8, -0.74]], 0.0028, mat.beigeDark);
  tube([[0.03, 0.775, -0.245], [0.0, 0.765, -0.5], [-0.35, 0.765, -0.8], [-0.6, 0.78, -0.76], [-0.64, 0.86, -0.74]], 0.0028, mat.beigeDark);
  tube([[0.03, 0.85, -0.69], [0.05, 0.765, -0.86], [0.08, 0.3, -0.9], [0.24, 0.3, -1.58]], 0.004, mat.plastic);

  // ---- printer, CD stack, open jewel case, mug, pen, books ----
  {
    const pg = new THREE.Group(); pg.position.set(0.58, 0.76, -0.7); scene.add(pg);
    rbox(0.36, 0.15, 0.26, 0.012, mat.beigeDark, 0, 0.075, 0, { parent: pg });
    box(0.3, 0.05, 0.22, mat.beige, 0, 0.17, 0.0, { parent: pg });
    box(0.26, 0.004, 0.24, mat.plastic, 0, 0.1, 0.06, { parent: pg, cast: false });
    box(0.22, 0.006, 0.2, mat.beigeDark, 0, 0.21, -0.14, { parent: pg, rot: [-0.9, 0, 0] });
    add(new THREE.PlaneGeometry(0.19, 0.24), new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.95, side: THREE.DoubleSide }), 0, 0.235, -0.135, { parent: pg, rot: [-0.9, 0, 0], cast: false });
    add(new THREE.PlaneGeometry(0.19, 0.1), new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.95, side: THREE.DoubleSide }), 0, 0.105, 0.14, { parent: pg, rot: [-Math.PI / 2, 0, 0], cast: false });
    contact(0.58, -0.7, 0.46, 0.36);
  }
  [[0xe8b63a, 0], [0x1a1a1a, 0.05], [0x2d4ea0, -0.04], [0x9b2d2d, 0.02], [0xdedede, -0.06]].forEach(([c, ry], i) => {
    rbox(0.14, 0.014, 0.19, 0.002, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.5 }), 0.86, 0.767 + i * 0.015, -0.42, { rot: [0, ry, 0] });
  });
  contact(0.86, -0.42, 0.22, 0.28);
  {
    const disc = makeDisc();
    rbox(0.142, 0.01, 0.125, 0.002, new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.25, clearcoat: 0.6 }), -0.3, 0.765, -0.13, { rot: [0, -0.2, 0] });
    rbox(0.142, 0.006, 0.125, 0.002, new THREE.MeshPhysicalMaterial({ color: 0xcfd5dd, roughness: 0.1, transparent: true, opacity: 0.5, clearcoat: 1 }), -0.3 - 0.142 * Math.cos(-0.2), 0.763, -0.13 - 0.142 * Math.sin(-0.2), { rot: [0, -0.2, 0], cast: false });
    add(new THREE.CircleGeometry(0.058, 48), new THREE.MeshPhysicalMaterial({ map: disc, transparent: true, roughness: 0.15, metalness: 0.6, clearcoat: 1 }), -0.3, 0.7715, -0.13, { rot: [-Math.PI / 2, 0, -0.2], cast: false });
    contact(-0.37, -0.13, 0.36, 0.2, -0.2);
  }
  add(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32), mat.ceramic, -0.46, 0.81, -0.33);
  add(new THREE.TorusGeometry(0.028, 0.007, 12, 24), mat.ceramic, -0.505, 0.815, -0.33, { rot: [0, Math.PI / 2, 0] });
  add(new THREE.CircleGeometry(0.038, 32), new THREE.MeshPhysicalMaterial({ color: 0x3a1f10, roughness: 0.1, clearcoat: 1 }), -0.46, 0.852, -0.33, { rot: [-Math.PI / 2, 0, 0], cast: false });
  contact(-0.46, -0.33, 0.15, 0.15);
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x1f4fb0, roughness: 0.5 }), -0.2, 0.766, -0.06, { rot: [0, 0.4, Math.PI / 2], cast: false });
  [[0x3b4a6b, 0.17, 0.03, 0.24, 0], [0x9b7a2d, 0.16, 0.024, 0.23, 0.1], [0x6b3b3b, 0.15, 0.022, 0.22, -0.08]].forEach(([c, w, h, dd, ry], i) => {
    rbox(w, h, dd, 0.003, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }), -0.84, 0.76 + [0.015, 0.042, 0.065][i], -0.78, { rot: [0, ry, 0] });
  });

  // ---- the portrait, in a frame standing at the left of the desk ----
  {
    const fg = new THREE.Group(); fg.position.set(-0.8, 0.763, -0.16); fg.rotation.set(-0.1, 0.5, 0, 'YXZ'); scene.add(fg);
    rbox(0.2, 0.2, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.6 }), 0, 0.1, 0, { parent: fg });
    add(new THREE.PlaneGeometry(0.174, 0.174), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 }), 0, 0.1, 0.0065, { parent: fg, cast: false });
    const photoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    new THREE.TextureLoader().load('photo.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; photoMat.map = t; photoMat.needsUpdate = true; });
    add(new THREE.PlaneGeometry(0.15, 0.15), photoMat, 0, 0.1, 0.007, { parent: fg, cast: false });
    add(new THREE.PlaneGeometry(0.178, 0.178), new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }), 0, 0.1, 0.0075, { parent: fg, cast: false, receive: false });
    box(0.06, 0.16, 0.005, mat.plastic, 0, 0.07, -0.035, { parent: fg, rot: [0.4, 0, 0], cast: false });
    contact(-0.8, -0.16, 0.24, 0.16, 0.5);
  }

  // ---- desk lamp at the right front, leaning over the keyboard ----
  const lg = new THREE.Group(); lg.position.set(0.88, 0.76, -0.8); lg.rotation.y = Math.PI * 0.9; scene.add(lg);
  add(new THREE.CylinderGeometry(0.07, 0.075, 0.02, 32), mat.darkMetal, 0, 0.01, 0, { parent: lg }); contact(0.88, -0.8, 0.2, 0.2);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 12), mat.darkMetal, 0.042, 0.185, 0, { parent: lg, rot: [0, 0, -0.25] });
  add(new THREE.SphereGeometry(0.016, 16, 16), mat.darkMetal, 0.084, 0.35, 0, { parent: lg });
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), mat.darkMetal, 0.205, 0.437, 0, { parent: lg, rot: [0, 0, -0.95] });
  add(new THREE.ConeGeometry(0.1, 0.14, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }), 0.33, 0.5, 0, { parent: lg, rot: [0, 0, -0.5], cast: false });
  const bulb = add(new THREE.SphereGeometry(0.022, 16, 16), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd2a0, emissiveIntensity: 5 }), 0.35, 0.45, 0, { parent: lg, cast: false, receive: false });
  const bulbPos = new THREE.Vector3(); bulb.getWorldPosition(bulbPos);

  // ---- the stool: black tube legs, blue padded seat ----
  {
    const sg = new THREE.Group(); sg.position.set(0.5, 0, 0.42); sg.rotation.y = 0.3; scene.add(sg);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 32), mat.vinyl, 0, 0.47, 0, { parent: sg });
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 32), mat.plastic, 0, 0.435, 0, { parent: sg });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.45, 12), mat.plastic, Math.cos(a) * 0.14, 0.215, Math.sin(a) * 0.14, { parent: sg, rot: [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12] });
    }
    add(new THREE.TorusGeometry(0.15, 0.007, 8, 32), mat.plastic, 0, 0.18, 0, { parent: sg, rot: [Math.PI / 2, 0, 0] });
    contact(0.5, 0.42, 0.5, 0.5, 0, 0.006, 0.5);
  }

  // ---- light ----
  scene.add(new THREE.HemisphereLight(0x3a3426, 0x1a140f, 0.28));
  const lamp = new THREE.SpotLight(0xffb46b, 4.5, 3.5, Math.PI / 3.4, 0.85, 1.8);
  lamp.position.copy(bulbPos); lamp.target.position.set(0.15, 0.76, -0.25);
  lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);
  const bulbLight = new THREE.PointLight(0xffb46b, 0.5, 0.6, 2); bulbLight.position.copy(bulbPos); scene.add(bulbLight);
  const windowWash = new THREE.PointLight(0xff9a40, 0.5, 2.4, 2); windowWash.position.set(0.35, 1.55, -1.3); scene.add(windowWash);
  const screenLight = new THREE.RectAreaLight(0xcfe3ff, 0, 0.34, 0.26);
  screenLight.position.set(0.03, 1.005, -0.36); screenLight.lookAt(0.03, 0.95, 2); scene.add(screenLight);
  const windowLight = new THREE.RectAreaLight(0xff9a40, 1.1, 1.5, 1.06);
  windowLight.position.set(0.35, 1.55, -1.6); windowLight.lookAt(0.35, 1.2, 1); scene.add(windowLight);
  const skyFill = new THREE.DirectionalLight(0x6f7fa0, 0.22);
  skyFill.position.set(0.9, 2.6, -3); skyFill.target.position.set(0, 0.8, 0); scene.add(skyFill, skyFill.target);

  // dust in the lamp light
  const N = 170, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const yy = 0.78 + Math.random() * 0.42, sp = 0.12 + (1.2 - yy) * 0.55; pos[i * 3] = 0.3 + (Math.random() - 0.5) * sp * 2; pos[i * 3 + 1] = yy; pos[i * 3 + 2] = -0.2 + (Math.random() - 0.5) * sp * 2; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd9a8, map: dot, size: 0.01, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // ---- post ----
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 1.0));
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  if (!reduced) composer.addPass(grain);

  // ---- camera: orbit around the desk, with guided flights for the views ----
  const VIEWS = {
    desk: { pos: new THREE.Vector3(0.55, 1.3, 1.35), look: new THREE.Vector3(0, 0.95, -0.5) },
    zoom: { pos: new THREE.Vector3(0.06, 1.02, 0.42), look: new THREE.Vector3(0.03, 1.0, -0.37) },
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
  function flyTo(p, look) {
    fly = { p0: camera.position.clone(), p1: p.clone(), t0: controls.target.clone(), t1: look.clone(), s: 0 };
    controls.enabled = false;
  }
  function goTo(name) {
    view = name;
    const v = VIEWS[name], wide = window.innerWidth > 720;
    const sx = (!panel.hidden && name === 'zoom' && wide) ? 0.26 : 0, sy = (!panel.hidden && name === 'zoom' && !wide) ? -0.14 : 0;
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
    VIEWS.desk.pos.set(narrow ? 0.25 : 0.55, narrow ? 1.4 : 1.3, narrow ? 2.3 : 1.35);
  }
  on(window, 'resize', resize);
  resize();

  // ---- loop ----
  const clock = new THREE.Clock();
  let raf = 0, announced = false, hidden = false, hddUntil = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const onAmt = Math.min(1, Math.max(0, (t - 0.5) / 1.4));
    const e = onAmt * onAmt * (3 - 2 * onAmt);
    const flick = reduced ? 1 : 0.96 + 0.04 * Math.random();
    screenMat.emissiveIntensity = 1.15 * e * flick;
    screenLight.intensity = 3.2 * e * flick;
    monLed.material.emissiveIntensity = 2.5 * e;
    if (!reduced && Math.random() < 0.02) hddUntil = t + 0.05 + Math.random() * 0.12;
    hddLed.material.emissiveIntensity = t < hddUntil ? 3 : 0;
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

    if (!reduced) {
      rainMat.map.offset.y -= dt * 0.9; rainMat2.map.offset.y -= dt * 0.55;
      for (const c of cars) { c.position.x += c.userData.v * dt; if (c.position.x > 2.95) c.position.x = -2.25; if (c.position.x < -2.25) c.position.x = 2.95; }
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
  void pwrLed;

  const fontsReady = Promise.all([
    d.fonts.load('46px VT323'),
    d.fonts.load('500 28px "IBM Plex Mono"'),
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
