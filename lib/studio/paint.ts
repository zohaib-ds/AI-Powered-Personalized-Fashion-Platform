// Paints the fabric texture for one side of the shirt, and renders the
// printer's file (prints only, transparent background) at any DPI.
import { BRAND } from '../brand';
import { CM_PER_IN, COLOURS, PRINT_AREAS, layerCorners, printedBox, type Side } from '../design';
import { BACK_NECK, FRONT_NECK, W, H, XMIN, YMAX, clamp } from './garment';
import type { Layer, StudioState } from './store';

export const TEX_W = 1536;
export const TEX_H = Math.round((TEX_W * H) / W);
const S = TEX_W / W; // texture pixels per cm

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(h: string, f: number) {
  const [r, g, b] = hexToRgb(h);
  const c = (v: number) => clamp(Math.round(v * f), 0, 255);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
export function lum(h: string) {
  const [r, g, b] = hexToRgb(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

let knitPattern: HTMLCanvasElement | null = null;
function knit() {
  if (knitPattern) return knitPattern;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const img = x.createImageData(128, 128);
  for (let j = 0; j < 128; j++)
    for (let i = 0; i < 128; i++) {
      const rib = (Math.sin((i * Math.PI) / 2) * 0.5 + 0.5) * 18;
      const v = 128 + (Math.random() - 0.5) * 46 + rib - 9, o = (j * 128 + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  return (knitPattern = c);
}

const cmTransform = (ctx: CanvasRenderingContext2D) => ctx.setTransform(S, 0, 0, -S, -XMIN * S, YMAX * S);

function curve(ctx: CanvasRenderingContext2D, f: (x: number) => number, x0: number, x1: number, n = 24) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    if (i) ctx.lineTo(x, f(x)); else ctx.moveTo(x, f(x));
  }
}
function seam(ctx: CanvasRenderingContext2D, draw: () => void, dark: boolean) {
  ctx.save();
  draw();
  ctx.lineWidth = 0.14; ctx.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.14)'; ctx.stroke();
  ctx.setLineDash([0.32, 0.26]); ctx.lineWidth = 0.09; ctx.strokeStyle = dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.22)'; ctx.stroke();
  ctx.restore();
}

export function drawLayer(ctx: CanvasRenderingContext2D, L: Layer) {
  const h = L.w / L.aspect;
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.rotate((L.rot * Math.PI) / 180);
  ctx.scale(1, -1);
  ctx.drawImage(L.src, -L.w / 2, -h / 2, L.w, h);
  ctx.restore();
}

export function paintSide(canvas: HTMLCanvasElement, side: Side, st: StudioState) {
  const ctx = canvas.getContext('2d')!;
  const hex = (COLOURS.find((c) => c.id === st.colourId) ?? COLOURS[0]).hex;
  const dark = lum(hex) < 0.35;
  const pa = PRINT_AREAS[side];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  cmTransform(ctx);

  if (side === 'front') {
    // inside of the back, seen through the neckline, with the neck label
    ctx.save();
    curve(ctx, FRONT_NECK, -10, 10);
    ctx.lineTo(10, 72.5); ctx.lineTo(-10, 72.5); ctx.closePath();
    ctx.fillStyle = shade(hex, dark ? 0.75 : 0.78); ctx.fill(); ctx.clip();
    ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.5)';
    ctx.save(); ctx.translate(0, 67.1); ctx.scale(1, -1); ctx.textAlign = 'center';
    ctx.font = '700 1.15px Archivo, sans-serif'; ctx.fillText(BRAND.name.toUpperCase(), 0, 0);
    ctx.font = '500 0.75px "IBM Plex Mono", monospace'; ctx.fillText('FREE SIZE · 100% COTTON', 0, 1.15);
    ctx.restore();
    ctx.restore();
    ctx.save(); curve(ctx, BACK_NECK, -10, 10); ctx.lineWidth = 2.6; ctx.strokeStyle = shade(hex, dark ? 0.85 : 0.86); ctx.stroke(); ctx.restore();
    ctx.save(); curve(ctx, (x) => FRONT_NECK(x) - 0.9, -10.6, 10.6, 40); ctx.lineWidth = 1.9; ctx.strokeStyle = shade(hex, dark ? 1.18 : 0.95); ctx.stroke(); ctx.restore();
    seam(ctx, () => curve(ctx, (x) => FRONT_NECK((x * 10) / 11.8) - 2.0, -11.8, 11.8, 40), dark);
  } else {
    ctx.save(); curve(ctx, (x) => BACK_NECK(x) - 0.9, -10.6, 10.6, 30); ctx.lineWidth = 1.9; ctx.strokeStyle = shade(hex, dark ? 1.18 : 0.95); ctx.stroke(); ctx.restore();
    seam(ctx, () => curve(ctx, (x) => BACK_NECK((x * 10) / 11.6) - 2.0, -11.6, 11.6, 30), dark);
  }
  for (const m of [1, -1]) {
    seam(ctx, () => { ctx.beginPath(); ctx.moveTo(32 * m, 67.2); ctx.quadraticCurveTo(31.2 * m, 55, 30.4 * m, 45.9); }, dark);
    seam(ctx, () => { ctx.beginPath(); ctx.moveTo(41.6 * m, 41.0); ctx.lineTo(47.3 * m, 56.8); }, dark);
  }
  seam(ctx, () => { ctx.beginPath(); ctx.moveTo(-29.2, 2.4); ctx.lineTo(29.2, 2.4); }, dark);

  // prints, clipped to the print area
  ctx.save();
  ctx.beginPath(); ctx.rect(pa.cx - pa.w / 2, pa.cy - pa.h / 2, pa.w, pa.h); ctx.clip();
  ctx.globalAlpha = 0.97;
  for (const L of st.layers) if (L.side === side) drawLayer(ctx, L);
  ctx.restore();

  // cotton grain over everything so the ink sits in the fabric
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = dark ? 0.16 : 0.14;
  ctx.fillStyle = ctx.createPattern(knit(), 'repeat')!;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.restore();

  // editor overlays
  cmTransform(ctx);
  if (st.guide && side === st.side) {
    ctx.save(); ctx.setLineDash([0.8, 0.6]); ctx.lineWidth = 0.12;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(20,22,28,.38)';
    ctx.strokeRect(pa.cx - pa.w / 2, pa.cy - pa.h / 2, pa.w, pa.h); ctx.restore();
  }
  const sel = st.layers.find((l) => l.id === st.sel && l.side === side);
  if (sel) {
    const c = layerCorners(sel);
    ctx.save(); ctx.lineWidth = 0.16; ctx.strokeStyle = '#e8a20c'; ctx.beginPath();
    c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#e8a20c';
    for (const [x, y] of c) { ctx.beginPath(); ctx.arc(x, y, 0.45, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

// The file the printer gets: only the printed area of one side, transparent,
// at `dpi`. Returns null when nothing is printed on that side.
export function renderPrintFile(layers: Layer[], side: Side, dpi: number): HTMLCanvasElement | null {
  const b = printedBox(layers, side);
  if (!b) return null;
  const pxPerCm = dpi / CM_PER_IN;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b.w * pxPerCm));
  c.height = Math.max(1, Math.round(b.h * pxPerCm));
  const ctx = c.getContext('2d')!;
  ctx.setTransform(pxPerCm, 0, 0, -pxPerCm, -b.x0 * pxPerCm, b.y1 * pxPerCm);
  for (const L of layers) if (L.side === side) drawLayer(ctx, L);
  return c;
}
