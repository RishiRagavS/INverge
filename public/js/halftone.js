// Poster-style generative art: a halftone "network" (glowing nodes joined by dotted links) and ID barcodes.
import { raw } from './core.js';

const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function halftone(canvas, { seed = 7, spacing = 8, color = '#0a1b1c', nodes = 10, bg = null } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
  const W = Math.max(200, r.width), H = Math.max(200, r.height);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
  const rand = rng(seed), pts = [];
  for (let i = 0; i < nodes; i++) pts.push({ x: W * (0.12 + rand() * 0.76), y: H * (0.08 + (i / nodes) * 0.84 + (rand() - 0.5) * 0.08), r: Math.min(W, H) * (0.05 + rand() * 0.13) });
  const edges = []; for (let i = 0; i < pts.length; i++) { edges.push([i, (i + 1) % pts.length]); if (rand() > 0.45) edges.push([i, Math.floor(rand() * pts.length)]); }
  const segDist = (px, py, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l)); return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)); };
  g.fillStyle = color;
  for (let y = spacing / 2, row = 0; y < H; y += spacing, row++) {
    for (let x = spacing / 2 + (row % 2 ? spacing / 2 : 0); x < W; x += spacing) {
      let f = 0;
      for (const p of pts) { const d = Math.hypot(x - p.x, y - p.y) / p.r; f += Math.exp(-d * d * 1.5); }
      for (const [a, b] of edges) { const d = segDist(x, y, pts[a], pts[b]); f += Math.exp(-(d * d) / 40) * 0.55; }
      f += 0.10 * Math.sin(x * 0.03 + y * 0.02);               // faint texture so the field never goes fully empty
      f = Math.max(0, Math.min(1, f));
      const rad = f * spacing * 0.52;
      if (rad > 0.35) { g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); }
    }
  }
}

export function barcode(seedText, { h = 42, color = '#0a1b1c' } = {}) {
  const rand = rng(hashStr(seedText)); let x = 0, bars = '';
  while (x < 200) { const w = [1, 1, 2, 3, 4][Math.floor(rand() * 5)], gap = [1, 2, 3][Math.floor(rand() * 3)]; bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w + gap; }
  return raw(`<svg class="barcode" viewBox="0 0 ${x} ${h}" preserveAspectRatio="none" fill="${color}" aria-hidden="true">${bars}</svg>`);
}
