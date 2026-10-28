// The design studio: draw, type and place images on a 3D t-shirt.
// Prints live in texture-pixel coordinates on the garment's UV layout and are
// clipped to the print zones (front, back, sleeves). The DOM controls are
// rendered by components/Studio.tsx; this file wires them up by id.
import * as THREE from 'three';
import {
  CM_PER_IN, COLOURS, FONTS, PRINT_DPI, PX_PER_CM, TEX, ZONE_INFO, ZONES, zoneAt,
  type Colour, type PrintSummary, type Zone,
} from '../design';
import { aiCut, edgeKind, needsDownload, opaqueBox, plainCut } from './cutout';
import { backdrop, createShirtScene, loadShirtGeometry, paintFabric, type ShirtScene } from './shirt';

// screen-print style inks
const SEL_INK = '#b8391a';
const INKS = [
  { hex: '#111111', name: 'Black' }, { hex: '#ffffff', name: 'White' }, { hex: '#c8302a', name: 'Red' },
  { hex: '#e0702a', name: 'Orange' }, { hex: '#efbf2f', name: 'Yellow' }, { hex: '#2f7d4a', name: 'Green' },
  { hex: '#2453a6', name: 'Blue' }, { hex: '#7a4b2a', name: 'Brown' }, { hex: '#8c8c8c', name: 'Grey' },
];
const BASE = 120; // text is laid out at 120 px and scaled
const fontCss = (f: string, px = BASE) => `${FONTS[f]?.style ?? ''}${FONTS[f]?.weight ?? '400'} ${px}px "${f}"`;
const STORE_KEY = 'wearsketch-design-v1';
const PRINT_SCALE = PRINT_DPI / CM_PER_IN / PX_PER_CM; // texture px → 300 DPI print px

// where the camera looks for each print zone
const ZONE_VIEW: Record<Zone, { yaw: number; pitch: number; zoom: number }> = {
  front: { yaw: 0, pitch: 0.06, zoom: 1 },
  back: { yaw: Math.PI, pitch: 0.06, zoom: 1 },
  sleeveL: { yaw: Math.PI / 2, pitch: 0.45, zoom: 0.72 },
  sleeveR: { yaw: -Math.PI / 2, pitch: 0.45, zoom: 0.72 },
};

type Mode = 'rotate' | 'move' | 'draw';
interface Stroke { pts: number[][]; size: number; color: string; erase: boolean }
interface Base { id: number; x: number; y: number; scale: number; rot: number; w: number; h: number }
interface TextObj extends Base { type: 'text'; text: string; font: string; color: string }
// orig: the image before its background was removed, and how to put it back where it was
interface Orig { img: HTMLImageElement; full: HTMLImageElement; src: string; r: number; lx: number; ly: number }
interface ImageObj extends Base { type: 'image'; img: HTMLImageElement; full: HTMLImageElement; src: string; orig?: Orig; cut?: 'plain' | 'ai' }
interface DrawObj extends Base {
  type: 'draw'; strokes: Stroke[]; ver: number;
  cache?: HTMLCanvasElement | null; cacheKey?: string; cb?: Bounds;
}
type Obj = TextObj | ImageObj | DrawObj;
interface Bounds { x0: number; y0: number; x1: number; y1: number }

export interface StudioChange {
  colour: Colour;
  prints: PrintSummary[];
  zones: Zone[];
}

// what the studio keeps of a design so it can be opened again (in this browser, and with each cart item)
export interface SavedDesign { colour?: string; objects?: Record<string, any>[] }

export interface StudioApi {
  summary(): StudioChange;
  design(): SavedDesign; // the editable design, with full size images, for the cart
  load(d: SavedDesign): Promise<void>; // replaces the shirt with a saved design (undo brings the old one back)
  printFiles(): Promise<Partial<Record<Zone, Blob>>>;
  previews(): Promise<{ preview: Blob; views: Blob }>;
  showZone(z: Zone): void;
  startNew(): void; // clears the shirt (undo brings it back)
  dispose(): void;
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the image.'))), 'image/png'));
const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
async function shrink(img: HTMLImageElement, max: number): Promise<HTMLImageElement> {
  const m = Math.max(img.naturalWidth, img.naturalHeight);
  if (m <= max) return img;
  const f = max / m;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * f);
  c.height = Math.round(img.naturalHeight * f);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return loadImg(c.toDataURL('image/png'));
}

export async function mountStudio(root: HTMLElement, onChange: (s: StudioChange) => void): Promise<StudioApi> {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const geo = await loadShirtGeometry();

  // ---------- texture ----------
  const tex = document.createElement('canvas');
  tex.width = tex.height = TEX;
  const ctx = tex.getContext('2d')!;
  const host = $('view');
  const S: ShirtScene = createShirtScene(host, tex, geo, { preserve: true });
  const { renderer, camera, mesh, cam } = S;

  // ---------- state ----------
  const state = {
    colour: COLOURS[0], mode: 'draw' as Mode, ink: INKS[0].hex, size: 12, eraser: false,
    objects: [] as Obj[], sel: null as number | null, dirty: true, curDraw: null as number | null,
    hideSel: false, zone: 'front' as Zone,
  };
  let uid = 1;
  const undoStack: { objects: Obj[]; sel: number | null; colour: Colour }[] = [];
  const selected = () => state.objects.find((o) => o.id === state.sel) ?? null;
  let saveTimer = 0;
  let restored = false;
  const dirty = () => {
    state.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { persist(); onChange(summary()); }, 300);
  };

  function measure(o: TextObj) {
    ctx.font = fontCss(o.font);
    o.w = Math.max(20, ctx.measureText(o.text).width);
    o.h = BASE * 1.15;
  }
  const makeText = (text: string, font: string, color: string, x: number, y: number, scale = 1): TextObj => {
    const o: TextObj = { id: uid++, type: 'text', text, font, color, x, y, scale, rot: 0, w: 0, h: 0 };
    measure(o);
    return o;
  };
  const makeImage = (img: HTMLImageElement, full: HTMLImageElement, src: string, x: number, y: number, scale = 1): ImageObj => {
    const m = Math.max(img.naturalWidth, img.naturalHeight), f = 360 / m;
    return { id: uid++, type: 'image', img, full, src, w: img.naturalWidth * f, h: img.naturalHeight * f, x, y, scale, rot: 0 };
  };
  const makeDraw = (x: number, y: number): DrawObj => ({ id: uid++, type: 'draw', strokes: [], x, y, scale: 1, rot: 0, w: 0, h: 0, ver: 0 });

  const toLocal = (o: Base, p: { x: number; y: number }) => {
    const dx = p.x - o.x, dy = p.y - o.y, c = Math.cos(-o.rot), s = Math.sin(-o.rot);
    return { x: (dx * c - dy * s) / o.scale, y: (dx * s + dy * c) / o.scale };
  };
  const toWorld = (o: Base, l: { x: number; y: number }) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot), x = l.x * o.scale, y = l.y * o.scale;
    return { x: o.x + x * c - y * s, y: o.y + x * s + y * c };
  };
  const zoneOf = (o: Base) => zoneAt(o.x, o.y);
  const clampToZone = (z: Zone, x: number, y: number) => {
    const b = ZONE_INFO[z];
    return { x: Math.min(b.x + b.w, Math.max(b.x, x)), y: Math.min(b.y + b.h, Math.max(b.y, y)) };
  };

  // ---------- drawings as resizable prints ----------
  function drawBounds(o: DrawObj): Bounds | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of o.strokes) {
      if (s.erase) continue;
      const r = s.size / 2 + 2;
      for (const p of s.pts) {
        x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r);
        x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r);
      }
    }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
  function normalizeDraw(o: DrawObj) {
    const b = drawBounds(o);
    if (!b) { o.w = o.h = 0; return; }
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, wc = toWorld(o, { x: cx, y: cy });
    for (const s of o.strokes) for (const p of s.pts) { p[0] -= cx; p[1] -= cy; }
    o.x = wc.x; o.y = wc.y; o.w = b.x1 - b.x0; o.h = b.y1 - b.y0; o.ver++;
  }
  function strokePath(g: CanvasRenderingContext2D, s: Stroke) {
    const P = s.pts;
    g.beginPath();
    if (P.length === 1) { g.arc(P[0][0], P[0][1], s.size / 2, 0, Math.PI * 2); g.fill(); return; }
    g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) {
      const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
      g.quadraticCurveTo(P[i][0], P[i][1], mx, my);
    }
    g.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    g.stroke();
  }
  // strokes go to their own layer so the eraser only removes ink, not the shirt
  function strokesTo(o: DrawObj, k: number): { c: HTMLCanvasElement; b: Bounds } | null {
    const b = drawBounds(o);
    if (!b) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((b.x1 - b.x0) * k));
    c.height = Math.max(1, Math.ceil((b.y1 - b.y0) * k));
    const g = c.getContext('2d')!;
    g.setTransform(k, 0, 0, k, -b.x0 * k, -b.y0 * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of o.strokes) {
      g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      g.strokeStyle = g.fillStyle = s.erase ? '#000' : s.color;
      g.lineWidth = s.size;
      strokePath(g, s);
    }
    return { c, b };
  }
  function renderDraw(o: DrawObj) {
    const b = drawBounds(o);
    if (!b) { o.cache = null; return; }
    const k = Math.min(Math.max(o.scale, 0.25), 2400 / Math.max(b.x1 - b.x0, b.y1 - b.y0));
    const key = `${o.ver}|${o.strokes.length}|${k.toFixed(3)}|${b.x0}|${b.y0}|${b.x1}|${b.y1}`;
    if (o.cache && o.cacheKey === key) return;
    const r = strokesTo(o, k);
    o.cache = r?.c ?? null;
    o.cacheKey = key;
    o.cb = b;
  }

  // ---------- compositing ----------
  function drawObj(g: CanvasRenderingContext2D, o: Obj, forPrint = false) {
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.rot);
    g.scale(o.scale, o.scale);
    if (o.type === 'text') {
      g.font = fontCss(o.font);
      g.fillStyle = o.color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(o.text, 0, 4);
    } else if (o.type === 'image') {
      g.drawImage(forPrint ? o.full : o.img, -o.w / 2, -o.h / 2, o.w, o.h);
    } else if (forPrint) {
      const r = strokesTo(o, Math.min(PRINT_SCALE * o.scale, 8000 / Math.max(o.w, o.h, 1)));
      if (r) g.drawImage(r.c, r.b.x0, r.b.y0, r.b.x1 - r.b.x0, r.b.y1 - r.b.y0);
    } else {
      renderDraw(o);
      if (o.cache && o.cb) g.drawImage(o.cache, o.cb.x0, o.cb.y0, o.cb.x1 - o.cb.x0, o.cb.y1 - o.cb.y0);
    }
    g.restore();
  }
  function drawSel(o: Obj) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    const w = (o.w * o.scale) / 2 + 12, h = (o.h * o.scale) / 2 + 12;
    ctx.strokeStyle = SEL_INK;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(-w, -h, w * 2, h * 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 5;
    for (const [x, y] of [[-w, -h], [w, -h], [-w, h], [w, h]]) {
      ctx.fillRect(x - 13, y - 13, 26, 26);
      ctx.strokeRect(x - 13, y - 13, 26, 26);
    }
    ctx.restore();
  }
  function drawGuides() {
    const dark = backdrop(state.colour.hex).shadow < 1; // light shirt → dark guide
    ctx.save();
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.font = '600 22px "Archivo", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (const z of ZONES) {
      const b = ZONE_INFO[z];
      const active = z === state.zone;
      ctx.strokeStyle = dark ? (active ? 'rgba(184,57,26,.9)' : 'rgba(30,29,27,.32)') : active ? 'rgba(255,190,160,.95)' : 'rgba(255,255,255,.42)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (z === 'front' || z === 'back') {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(`${b.wCm} × ${b.hCm} cm print area`, b.x + 10, b.y + 10);
      }
    }
    ctx.restore();
  }
  function composite() {
    paintFabric(ctx, state.colour.hex);
    for (const z of ZONES) {
      const b = ZONE_INFO[z];
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
      for (const o of state.objects) if (zoneOf(o) === z) drawObj(ctx, o);
      ctx.restore();
    }
    if (!state.hideSel && state.mode !== 'rotate') drawGuides();
    const s = selected();
    if (s && state.mode === 'move' && !state.hideSel) drawSel(s);
    S.texture.needsUpdate = true;
  }

  // ---------- interaction ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(cx: number, cy: number) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(mesh)[0];
    if (!h || !h.uv) return null;
    return { x: h.uv.x * TEX, y: (1 - h.uv.y) * TEX };
  }
  function pickObj(p: { x: number; y: number }, type?: Obj['type']) {
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (type && o.type !== type) continue;
      const l = toLocal(o, p), pad = 24 / o.scale;
      if (Math.abs(l.x) <= o.w / 2 + pad && Math.abs(l.y) <= o.h / 2 + pad) return o;
    }
    return null;
  }
  function onHandle(o: Obj, p: { x: number; y: number }) {
    const l = toLocal(o, p), hw = o.w / 2 + 12 / o.scale, hh = o.h / 2 + 12 / o.scale, r = 34 / o.scale;
    return Math.abs(Math.abs(l.x) - hw) < r && Math.abs(Math.abs(l.y) - hh) < r;
  }

  const cloneObj = (o: Obj): Obj =>
    o.type === 'draw' ? { ...o, strokes: o.strokes.map((s) => ({ ...s, pts: s.pts.map((p) => p.slice()) })), cache: null, cacheKey: '' } : { ...o };
  const undoBtn = $<HTMLButtonElement>('undo');
  function snapshot() {
    undoStack.push({ objects: state.objects.map(cloneObj), sel: state.sel, colour: state.colour });
    if (undoStack.length > 40) undoStack.shift();
    undoBtn.disabled = false;
  }
  function undo() {
    const s = undoStack.pop();
    if (!s) return;
    state.objects = s.objects;
    state.sel = state.objects.some((o) => o.id === s.sel) ? s.sel : null;
    state.curDraw = null;
    if (s.colour !== state.colour) setShirt(s.colour);
    undoBtn.disabled = !undoStack.length;
    syncSel();
    dirty();
  }

  // pen: strokes are points inside a drawing print, so a drawing can be moved and resized later
  let stroke: Stroke | null = null, strokeObj: DrawObj | null = null;
  function penStart(h: { x: number; y: number }) {
    const zone = zoneAt(h.x, h.y);
    if (!zone) return;
    let o: DrawObj | undefined;
    if (state.eraser) {
      o = (pickObj(h, 'draw') as DrawObj | null) ?? undefined;
      if (!o) return;
    } else {
      o = state.objects.find((x): x is DrawObj => x.id === state.curDraw && x.type === 'draw');
      if (!o || zoneOf(o) !== zone) {
        o = makeDraw(h.x, h.y);
        state.objects.push(o);
        state.curDraw = o.id;
      }
    }
    const l = toLocal(o, h);
    stroke = { pts: [[l.x, l.y]], size: state.size / o.scale, color: state.ink, erase: state.eraser };
    o.strokes.push(stroke);
    o.ver++;
    strokeObj = o;
    setZone(zone, false);
    dirty();
  }
  function penTo(h: { x: number; y: number }) {
    if (!stroke || !strokeObj) { penStart(h); return; }
    const o = strokeObj, l = toLocal(o, h), last = stroke.pts[stroke.pts.length - 1];
    const jump = Math.hypot(l.x - last[0], l.y - last[1]) * o.scale;
    if (jump > 140 || zoneAt(h.x, h.y) !== zoneOf(o)) { penEnd(); penStart(h); return; }
    if (jump < 0.8) return;
    stroke.pts.push([l.x, l.y]);
    o.ver++;
    dirty();
  }
  function penEnd() {
    if (strokeObj) {
      normalizeDraw(strokeObj);
      if (!drawBounds(strokeObj)) {
        const gone = strokeObj;
        state.objects = state.objects.filter((x) => x !== gone);
        if (state.curDraw === gone.id) state.curDraw = null;
      }
      dirty();
    }
    stroke = null;
    strokeObj = null;
  }

  const clampS = (s: number) => Math.max(0.08, Math.min(5, s));
  type Act =
    | { t: 'draw' } | { t: 'orbit' } | { t: 'idle' }
    | { t: 'drag'; o: Obj; ox: number; oy: number }
    | { t: 'resize'; o: Obj; s0: number; d0: number }
    | { t: 'pinch' | 'pinchObj'; o: Obj | null; span: number; ang: number; s0: number; r0: number; z0: number };
  const ptrs = new Map<number, { x: number; y: number }>();
  let act: Act | null = null;
  let hintGone = false;
  const el = renderer.domElement;

  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.target = null;
    if (!hintGone) { hintGone = true; $('hint').classList.add('dim'); }
    if (ptrs.size === 1) {
      const h = state.mode === 'rotate' ? null : hit(e.clientX, e.clientY);
      const s = selected();
      if (state.mode === 'draw' && h && zoneAt(h.x, h.y)) {
        snapshot();
        act = { t: 'draw' };
        penStart(h);
      } else if (state.mode === 'move' && h && s && onHandle(s, h)) {
        snapshot();
        act = { t: 'resize', o: s, s0: s.scale, d0: Math.max(8, Math.hypot(h.x - s.x, h.y - s.y)) };
      } else if (state.mode === 'move' && h && pickObj(h)) {
        const o = pickObj(h)!;
        snapshot();
        state.sel = o.id;
        const z = zoneOf(o);
        if (z) setZone(z, false);
        syncSel();
        dirty();
        act = { t: 'drag', o, ox: o.x - h.x, oy: o.y - h.y };
        el.style.cursor = 'grabbing';
      } else {
        if (state.mode === 'move' && h) { state.sel = null; syncSel(); dirty(); }
        if (state.mode === 'draw' && h && !zoneAt(h.x, h.y)) toast('Draw inside a dashed box. Only those areas get printed.');
        act = { t: 'orbit' };
        el.style.cursor = 'grabbing';
      }
    } else if (ptrs.size === 2) {
      if (act && act.t === 'draw') penEnd();
      const [a, b] = [...ptrs.values()];
      const o = state.mode === 'move' ? selected() : null;
      if (o && act && act.t !== 'drag' && act.t !== 'resize') snapshot();
      act = { t: o ? 'pinchObj' : 'pinch', o, span: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), s0: o ? o.scale : 0, r0: o ? o.rot : 0, z0: cam.zoom };
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId)!;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!act) return;
    if (act.t === 'draw') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        const h = hit(ev.clientX, ev.clientY);
        if (h && zoneAt(h.x, h.y)) penTo(h);
        else if (stroke) penEnd();
      }
    } else if (act.t === 'drag') {
      const h = hit(e.clientX, e.clientY);
      if (!h) return;
      const o = act.o, hz = zoneAt(h.x, h.y);
      if (!hz) return;
      if (hz !== zoneOf(o)) { act.ox = 0; act.oy = 0; setZone(hz, false); }
      const p = clampToZone(hz, h.x + act.ox, h.y + act.oy);
      o.x = p.x;
      o.y = p.y;
      dirty();
    } else if (act.t === 'resize') {
      const h = hit(e.clientX, e.clientY);
      if (!h) return;
      act.o.scale = clampS((act.s0 * Math.hypot(h.x - act.o.x, h.y - act.o.y)) / act.d0);
      syncSel(true);
      dirty();
    } else if (act.t === 'orbit') {
      cam.yaw -= (e.clientX - prev.x) * 0.009;
      cam.pitch = Math.max(-0.6, Math.min(0.75, cam.pitch + (e.clientY - prev.y) * 0.006));
      syncView();
    } else if (act.t === 'pinch' || act.t === 'pinchObj') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()], span = Math.hypot(a.x - b.x, a.y - b.y) || 1, ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (act.t === 'pinchObj' && act.o) {
        act.o.scale = clampS((act.s0 * span) / act.span);
        act.o.rot = act.r0 + (ang - act.ang);
        syncSel(true);
        dirty();
      } else cam.zoom = Math.max(0.55, Math.min(1.6, (act.z0 * act.span) / span));
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (act && act.t === 'draw') penEnd();
    if (ptrs.size === 0) { act = null; el.style.cursor = ''; }
    else if (act && (act.t === 'pinch' || act.t === 'pinchObj')) act = { t: 'idle' };
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const o = state.mode === 'move' ? selected() : null;
    if (o && e.shiftKey) { o.scale = clampS(o.scale * (1 - e.deltaY * 0.001)); syncSel(true); dirty(); return; }
    cam.zoom = Math.max(0.55, Math.min(1.6, cam.zoom * (1 + e.deltaY * 0.0012)));
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  // ---------- UI ----------
  const stage = $('stage'), hint = $('hint');
  undoBtn.disabled = true;
  undoBtn.onclick = undo;
  let toastTimer = 0;
  function toast(msg: string) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (t.hidden = true), 3200);
  }

  const HINTS: Record<Mode, string> = {
    draw: 'Sketch inside the dashed print areas. Switch to Move to drag or resize what you made.',
    move: 'Tap a print to select it. Drag it to move, drag a corner dot to resize.',
    rotate: 'Drag anywhere to turn the shirt. Pinch or scroll to zoom.',
  };
  function setMode(m: Mode) {
    if (m !== 'draw') state.curDraw = null;
    state.mode = m;
    stage.dataset.mode = m;
    hint.textContent = HINTS[m];
    root.querySelectorAll<HTMLElement>('.dock [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    syncSel(true);
    dirty();
  }
  root.querySelectorAll<HTMLElement>('.dock [data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode as Mode)));

  function syncView() {
    const front = Math.cos(cam.yaw) >= 0;
    $('vFront').setAttribute('aria-pressed', String(front));
    $('vBack').setAttribute('aria-pressed', String(!front));
  }
  function turnTo(y: number) {
    const k = Math.round((cam.yaw - y) / (Math.PI * 2));
    cam.target = y + k * Math.PI * 2;
  }
  $('vFront').onclick = () => showZone('front');
  $('vBack').onclick = () => showZone('back');

  // print zone picker: turns the shirt and sets where new prints go
  function setZone(z: Zone, turn: boolean) {
    if (state.zone !== z) { state.zone = z; dirty(); }
    root.querySelectorAll<HTMLElement>('[data-zone]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === z)));
    $('zoneSize').textContent = `${ZONE_INFO[z].wCm} × ${ZONE_INFO[z].hCm} cm`;
    if (turn) {
      const v = ZONE_VIEW[z];
      turnTo(v.yaw);
      cam.pitch = v.pitch;
      cam.zoom = v.zoom;
    }
  }
  function showZone(z: Zone) { setZone(z, true); }
  root.querySelectorAll<HTMLElement>('[data-zone]').forEach((b) => (b.onclick = () => showZone(b.dataset.zone as Zone)));

  // shirt colours
  const sw = $('swatches');
  for (const c of COLOURS) {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.background = c.hex;
    b.title = c.name;
    b.dataset.id = c.id;
    b.setAttribute('aria-label', c.name);
    b.onclick = () => { snapshot(); setShirt(c); };
    sw.appendChild(b);
  }
  function setShirt(c: Colour) {
    state.colour = c;
    $('colorName').textContent = c.name;
    sw.querySelectorAll<HTMLElement>('.sw').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === c.id)));
    const bd = backdrop(c.hex), st = stage.style;
    st.setProperty('--bd-bg', bd.bg);
    st.setProperty('--bd-fg', bd.fg);
    st.setProperty('--bd-muted', bd.muted);
    S.setColor(c.hex);
    dirty();
  }

  // pen
  const inks = $('inks');
  // pencil and eraser are one choice: exactly one of them is on
  function setPen(eraser: boolean) {
    state.eraser = eraser;
    $('pencil').setAttribute('aria-pressed', String(!eraser));
    $('eraser').setAttribute('aria-pressed', String(eraser));
    $('penLabel').textContent = eraser ? 'Eraser' : 'Pencil';
    setMode('draw');
  }
  for (const c of INKS) {
    const b = document.createElement('button');
    b.className = 'ink';
    b.style.background = c.hex;
    b.title = c.name;
    b.setAttribute('aria-label', c.name + ' ink');
    b.setAttribute('aria-pressed', String(c.hex === state.ink));
    b.onclick = () => {
      state.ink = c.hex;
      inks.querySelectorAll('.ink').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      setPen(false);
    };
    inks.appendChild(b);
  }
  const penSize = $<HTMLInputElement>('penSize');
  penSize.oninput = () => { state.size = +penSize.value; $('penSizeVal').textContent = state.size + ' px'; };
  // the pencil always starts a new drawing, so its lines can be moved on their own
  $('pencil').onclick = () => { state.curDraw = null; setPen(false); };
  $('eraser').onclick = () => setPen(true);

  // where a new print goes: the middle of the chosen zone, upper third on front and back
  const centre = () => {
    const b = ZONE_INFO[state.zone];
    const big = state.zone === 'front' || state.zone === 'back';
    return { x: b.x + b.w / 2, y: b.y + b.h * (big ? 0.3 : 0.5) };
  };
  const fitScale = (w: number, h: number) => {
    const b = ZONE_INFO[state.zone];
    return Math.min(1.6, (b.w * 0.8) / w, (b.h * 0.6) / h);
  };

  // text
  const fontSel = $<HTMLSelectElement>('font');
  for (const f of Object.keys(FONTS)) {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    fontSel.appendChild(o);
  }
  const txt = $<HTMLInputElement>('txt'), txtColor = $<HTMLInputElement>('txtColor');
  $('addText').onclick = async () => {
    const text = txt.value.trim() || 'Your text';
    await document.fonts.load(fontCss(fontSel.value)).catch(() => {});
    snapshot();
    const c = centre();
    ctx.font = fontCss(fontSel.value);
    const w = ctx.measureText(text).width || 1;
    const o = makeText(text, fontSel.value, txtColor.value, c.x, c.y, Math.min(1, fitScale(w, BASE * 1.15)));
    state.objects.push(o);
    state.sel = o.id;
    setMode('move');
    syncSel();
    dirty();
  };
  function editText() {
    const o = selected();
    if (!o || o.type !== 'text') return;
    o.text = txt.value || ' ';
    o.font = fontSel.value;
    o.color = txtColor.value;
    document.fonts.load(fontCss(o.font)).then(() => { measure(o); dirty(); }).catch(() => {});
    measure(o);
    syncSel(true);
    dirty();
  }
  let editSnap = false;
  for (const n of [txt, fontSel, txtColor]) {
    n.addEventListener('focus', () => { editSnap = false; });
    n.addEventListener('input', () => {
      const o = selected();
      if (o && o.type === 'text' && !editSnap) { snapshot(); editSnap = true; }
      editText();
    });
  }

  // images: a small copy for the 3D view and a large one for the print file
  function addImageFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = async () => {
      const raw = await loadImg(String(r.result)).catch(() => null);
      if (!raw) { toast("That image couldn't be opened. Try a PNG or JPG."); return; }
      const full = await shrink(raw, 4200);
      const img = await shrink(raw, 1400);
      snapshot();
      const c = centre();
      const o = makeImage(img, full, img.src, c.x, c.y);
      o.scale = fitScale(o.w, o.h);
      state.objects.push(o);
      state.sel = o.id;
      setMode('move');
      syncSel();
      dirty();
    };
    r.readAsDataURL(f);
  }
  const fileInput = $<HTMLInputElement>('file');
  fileInput.onchange = () => { addImageFile(fileInput.files?.[0]); fileInput.value = ''; };
  const drop = $('drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addImageFile(e.dataTransfer?.files[0]); };
  const onPaste = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])][0]; if (f) addImageFile(f); };
  document.addEventListener('paste', onPaste);

  // print sharpness of an image at its printed size
  const dpiOf = (o: ImageObj) => Math.round(o.full.naturalWidth / ((o.w * o.scale) / PX_PER_CM / CM_PER_IN));
  const cmOf = (o: Obj) => ({ w: (o.w * o.scale) / PX_PER_CM, h: (o.h * o.scale) / PX_PER_CM });

  // selection: panel + floating bar on the shirt view
  const KIND = { text: 'Text', image: 'Image', draw: 'Drawing' };
  const selSize = $<HTMLInputElement>('selSize'), selRot = $<HTMLInputElement>('selRot');
  function syncSel(onlyValues = false) {
    const o = selected(), show = !!o && state.mode === 'move';
    $('selEmpty').hidden = !!o;
    $('selCtl').hidden = !o;
    $('selBar').hidden = !show;
    syncBg();
    $('selKind').textContent = o ? (o.type === 'text' ? `“${o.text.slice(0, 18)}”` : KIND[o.type]) : '';
    if (!o) return;
    const pct = Math.round(o.scale * 100), deg = Math.round((((o.rot * 180) / Math.PI + 540) % 360) - 180);
    selSize.value = String(Math.min(500, pct));
    $('selSizeVal').textContent = pct + '%';
    $('barSize').textContent = pct + '%';
    selRot.value = String(deg);
    $('selRotVal').textContent = deg + '°';
    const cm = cmOf(o), q = $('selQuality');
    let line = `Prints about ${cm.w.toFixed(1)} × ${cm.h.toFixed(1)} cm`;
    q.className = 'quality';
    if (o.type === 'image') {
      const dpi = dpiOf(o);
      if (dpi >= 200) line += ` · sharp (${dpi} DPI)`;
      else if (dpi >= 120) { line += ` · okay (${dpi} DPI)`; q.classList.add('ok'); }
      else { line += ` · may look blurry (${dpi} DPI). Use a bigger image or make it smaller.`; q.classList.add('low'); }
    }
    q.textContent = line;
    if (!onlyValues && o.type === 'text') { txt.value = o.text; fontSel.value = o.font; txtColor.value = o.color; }
  }
  for (const n of [selSize, selRot]) n.addEventListener('pointerdown', () => { if (selected()) snapshot(); });
  selSize.oninput = () => { const o = selected(); if (!o) return; o.scale = +selSize.value / 100; syncSel(true); dirty(); };
  selRot.oninput = () => { const o = selected(); if (!o) return; o.rot = (+selRot.value * Math.PI) / 180; $('selRotVal').textContent = selRot.value + '°'; dirty(); };
  const bump = (f: number) => { const o = selected(); if (!o) return; snapshot(); o.scale = clampS(o.scale * f); syncSel(true); dirty(); };
  const turn = (d: number) => { const o = selected(); if (!o) return; snapshot(); o.rot += (d * Math.PI) / 180; syncSel(true); dirty(); };
  $('barMinus').onclick = () => bump(1 / 1.15);
  $('barPlus').onclick = () => bump(1.15);
  $('barRotL').onclick = () => turn(-15);
  $('barRotR').onclick = () => turn(15);
  $('toFront').onclick = () => { const o = selected(); if (!o) return; snapshot(); state.objects = state.objects.filter((x) => x !== o).concat(o); dirty(); };
  $('centreIt').onclick = () => {
    const o = selected(), z = o && zoneOf(o);
    if (!o || !z) return;
    snapshot();
    o.x = ZONE_INFO[z].x + ZONE_INFO[z].w / 2;
    dirty();
  };
  function del() {
    const o = selected();
    if (!o) return;
    snapshot();
    state.objects = state.objects.filter((x) => x !== o);
    state.sel = null;
    syncSel();
    dirty();
  }
  $('del').onclick = del;
  $('barDel').onclick = del;

  // remove background: a plain background is cut by colour straight away, anything else by AI.
  // Nothing pops up: the button shows progress, and Undo or "Put background back" restores the image.
  const bgBar = $<HTMLButtonElement>('barBg'), bgSel = $<HTMLButtonElement>('selBg'), bgAi = $<HTMLButtonElement>('selBgAi');
  const bg = { busy: null as number | null, label: '', armed: null as number | null, mb: 0, timer: 0 };
  function syncBg() {
    const o = selected(), img = o?.type === 'image' ? o : null;
    bgBar.hidden = !img || state.mode !== 'move';
    $('selBgRow').hidden = !img;
    if (!img) return;
    const label = bg.busy === img.id ? bg.label
      : bg.busy !== null ? 'Busy with another image…'
      : img.orig ? 'Put background back'
      : bg.armed === img.id ? `AI download, ${bg.mb} MB once. Tap again`
      : 'Remove background';
    for (const b of [bgBar, bgSel]) { b.textContent = label; b.disabled = bg.busy !== null; }
    bgAi.hidden = img.cut !== 'plain' || bg.busy !== null;
  }
  const disarm = () => { clearTimeout(bg.timer); bg.armed = null; };
  const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const sizeOf = (img: HTMLImageElement) => 360 / Math.max(img.naturalWidth, img.naturalHeight);

  // back to the image as uploaded, keeping where it is now
  function uncut(o: ImageObj) {
    const g = o.orig;
    if (!g) return;
    const scale = o.scale * g.r, c = toWorld({ ...o, scale }, { x: -g.lx, y: -g.ly }), f = sizeOf(g.img);
    Object.assign(o, { img: g.img, full: g.full, src: g.src, scale, x: c.x, y: c.y, w: g.img.naturalWidth * f, h: g.img.naturalHeight * f, orig: undefined, cut: undefined });
  }
  // use the cut image, trimmed to what is left, so the picture stays exactly where it was on the shirt
  async function applyCut(id: number, cut: HTMLCanvasElement, kind: 'plain' | 'ai') {
    const box = opaqueBox(cut);
    if (!box) { toast('Nothing would be left after removing the background, so the image is unchanged.'); return false; }
    const x0 = Math.max(0, box.x0 - 2), y0 = Math.max(0, box.y0 - 2);
    const x1 = Math.min(cut.width, box.x1 + 2), y1 = Math.min(cut.height, box.y1 + 2);
    const crop = document.createElement('canvas');
    crop.width = x1 - x0;
    crop.height = y1 - y0;
    crop.getContext('2d')!.drawImage(cut, -x0, -y0);
    // toBlob encodes off the main thread, so the page doesn't freeze on big images
    const blob = await toBlob(crop);
    const full = await loadImg(await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(blob);
    }));
    const img = await shrink(full, 1400);
    const o = state.objects.find((x) => x.id === id);
    if (!o || o.type !== 'image') return false;
    snapshot();
    uncut(o);
    const k = o.w / cut.width, lx = ((x0 + x1) / 2 - cut.width / 2) * k, ly = ((y0 + y1) / 2 - cut.height / 2) * k;
    const f = sizeOf(img), w = img.naturalWidth * f, h = img.naturalHeight * f, scale = ((x1 - x0) * k * o.scale) / w;
    const c = toWorld(o, { x: lx, y: ly });
    o.orig = { img: o.img, full: o.full, src: o.src, r: o.scale / scale, lx, ly };
    Object.assign(o, { img, full, src: img.src, w, h, scale, x: c.x, y: c.y, cut: kind });
    dirty();
    return true;
  }
  async function removeBg(ai: boolean) {
    const o = selected();
    if (!o || o.type !== 'image' || bg.busy !== null) return;
    if (o.orig && !ai) {
      snapshot();
      uncut(o);
      syncSel();
      dirty();
      return;
    }
    const kind = ai ? 'busy' : edgeKind(o.img);
    if (kind === 'clear') { toast('This image already has a see-through background.'); return; }
    Object.assign(bg, { busy: o.id, label: 'Removing background…' });
    syncBg();
    try {
      if (kind === 'busy') {
        const mb = await needsDownload();
        if (mb && bg.armed !== o.id) {
          // the big model is a one time download, so a second tap confirms it
          disarm();
          Object.assign(bg, { armed: o.id, mb, timer: window.setTimeout(() => { bg.armed = null; syncBg(); }, 8000) });
          return;
        }
      }
      disarm();
      await nextPaint();
      const src = o.orig?.full ?? o.full;
      const cut = kind === 'plain' ? plainCut(src) : await aiCut(src, (t) => { bg.label = t; syncBg(); });
      if (await applyCut(o.id, cut, kind === 'plain' ? 'plain' : 'ai')) toast('Background removed. Undo brings it back.');
    } catch (e) {
      console.warn('Background removal failed', e);
      toast("Couldn't remove the background. Check your internet and try again.");
    } finally {
      bg.busy = null;
      syncSel();
    }
  }
  bgBar.onclick = () => removeBg(false);
  bgSel.onclick = () => removeBg(false);
  bgAi.onclick = () => removeBg(true);
  const onKey = (e: KeyboardEvent) => {
    const a = document.activeElement as HTMLInputElement | null;
    const typing = !!a && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && a.type !== 'range';
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && state.mode === 'move' && selected()) { e.preventDefault(); del(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
  };
  document.addEventListener('keydown', onKey);

  // start over, with a confirm step built into the button
  let resetArmed = false, resetTimer = 0;
  const reset = $('reset');
  reset.onclick = () => {
    if (!resetArmed) {
      resetArmed = true;
      reset.textContent = 'Tap again to clear everything';
      clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => { resetArmed = false; reset.textContent = 'Start over'; }, 3500);
      return;
    }
    resetArmed = false;
    reset.textContent = 'Start over';
    snapshot();
    state.objects = [];
    state.sel = null;
    state.curDraw = null;
    syncSel();
    dirty();
    toast('Shirt cleared. Undo brings it back.');
  };

  // ---------- keep the design in this browser ----------
  // withFull adds each image's large copy, so a design opened from the cart prints as sharp as before
  function designData(withFull: boolean): SavedDesign {
    return {
      colour: state.colour.id,
      objects: state.objects.map((o) => {
        const c: Record<string, unknown> = { type: o.type, x: o.x, y: o.y, scale: o.scale, rot: o.rot };
        if (o.type === 'text') Object.assign(c, { text: o.text, font: o.font, color: o.color });
        if (o.type === 'image') Object.assign(c, { src: o.src }, withFull && o.full.src !== o.src ? { full: o.full.src } : {});
        if (o.type === 'draw') Object.assign(c, { strokes: o.strokes });
        return c;
      }),
    };
  }
  function persist() {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(designData(false)));
    } catch {
      /* storage full or blocked: the design still works, it just isn't kept */
    }
  }
  async function restore() {
    let data: SavedDesign | null = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { /* ignore */ }
    if (data) await loadData(data);
  }
  async function loadData(data: SavedDesign) {
    const c = COLOURS.find((x) => x.id === data.colour);
    if (c) setShirt(c);
    for (const c of data.objects ?? []) {
      if (!zoneAt(c.x, c.y)) continue;
      if (c.type === 'text') state.objects.push(Object.assign(makeText(String(c.text), c.font in FONTS ? c.font : 'Anton', c.color, c.x, c.y, c.scale), { rot: c.rot }));
      else if (c.type === 'image') {
        const img = await loadImg(c.src).catch(() => null);
        const full = c.full ? await loadImg(c.full).catch(() => null) : null;
        if (img) state.objects.push(Object.assign(makeImage(img, full ?? img, c.src, c.x, c.y, c.scale), { rot: c.rot }));
      } else if (c.type === 'draw') {
        const o = makeDraw(c.x, c.y);
        Object.assign(o, { scale: c.scale, rot: c.rot, strokes: c.strokes || [] });
        normalizeDraw(o);
        state.objects.push(o);
      }
    }
    dirty();
  }

  // ---------- outputs for the order ----------
  function summary(): StudioChange {
    const prints: PrintSummary[] = [];
    for (const o of state.objects) {
      const z = zoneOf(o);
      if (!z || (o.type === 'draw' && !o.w)) continue;
      const b = ZONE_INFO[z], cm = cmOf(o);
      const p: PrintSummary = {
        type: o.type, zone: z,
        x: +((o.x - (b.x + b.w / 2)) / PX_PER_CM).toFixed(1),
        y: +((o.y - (b.y + b.h / 2)) / PX_PER_CM).toFixed(1),
        wCm: +cm.w.toFixed(1), hCm: +cm.h.toFixed(1),
        rot: Math.round((o.rot * 180) / Math.PI),
      };
      if (o.type === 'text') Object.assign(p, { text: o.text.slice(0, 60), font: o.font, color: o.color });
      if (o.type === 'image') p.dpi = dpiOf(o);
      prints.push(p);
    }
    return { colour: state.colour, prints, zones: ZONES.filter((z) => prints.some((p) => p.zone === z)) };
  }

  // one transparent PNG per zone at 300 DPI, the exact size the printer prints
  async function printFiles() {
    if (stroke) penEnd();
    await Promise.all(Object.keys(FONTS).map((f) => document.fonts.load(fontCss(f)).catch(() => {})));
    const out: Partial<Record<Zone, Blob>> = {};
    for (const z of summary().zones) {
      const b = ZONE_INFO[z];
      const c = document.createElement('canvas');
      c.width = Math.round((b.wCm / CM_PER_IN) * PRINT_DPI);
      c.height = Math.round((b.hCm / CM_PER_IN) * PRINT_DPI);
      const g = c.getContext('2d')!;
      g.scale(c.width / b.w, c.height / b.h);
      g.translate(-b.x, -b.y);
      for (const o of state.objects) if (zoneOf(o) === z) drawObj(g, o, true);
      out[z] = await toBlob(c);
    }
    return out;
  }

  // pictures of the finished shirt: the front, and a sheet with four views
  function renderViews() {
    const W = 900, H = 1080, shots: HTMLCanvasElement[] = [];
    const keep = { yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom, target: cam.target, pr: renderer.getPixelRatio() };
    state.hideSel = true;
    composite();
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    cam.baseDist = Math.max(3.9, 3.7 / camera.aspect) + 0.5;
    cam.pitch = 0.05;
    cam.zoom = 1;
    cam.target = null;
    const bd = backdrop(state.colour.hex);
    for (const [name, yaw] of [['front', 0], ['left sleeve', Math.PI / 2], ['back', Math.PI], ['right sleeve', -Math.PI / 2]] as const) {
      cam.yaw = yaw;
      S.place();
      renderer.render(S.scene, camera);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = bd.bg;
      g.fillRect(0, 0, W, H);
      g.drawImage(renderer.domElement, 0, 0, W, H);
      g.fillStyle = bd.muted;
      g.font = "600 28px 'Archivo', system-ui, sans-serif";
      g.textAlign = 'center';
      g.fillText(name.toUpperCase(), W / 2, H - 36);
      shots.push(c);
    }
    Object.assign(cam, { yaw: keep.yaw, pitch: keep.pitch, zoom: keep.zoom, target: keep.target });
    renderer.setPixelRatio(keep.pr);
    S.resize();
    state.hideSel = false;
    dirty();
    const sheet = document.createElement('canvas');
    sheet.width = W * 4;
    sheet.height = H;
    shots.forEach((c, i) => sheet.getContext('2d')!.drawImage(c, i * W, 0));
    return { front: shots[0], sheet };
  }
  async function previews() {
    if (stroke) penEnd();
    const v = renderViews();
    return { preview: await toBlob(v.front), views: await toBlob(v.sheet) };
  }

  // save one picture with four views
  let saving = false;
  $('save').onclick = async () => {
    if (saving) return;
    saving = true;
    persist();
    try {
      const { views } = await previews();
      const url = URL.createObjectURL(views), a = document.createElement('a');
      a.href = url;
      a.download = 'my-wearsketch-tee.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
      toast('Downloading my-wearsketch-tee.png');
    } catch {
      toast("Couldn't save the picture. Your design is still kept in this browser.");
    } finally {
      saving = false;
    }
  };

  // ---------- start ----------
  setShirt(state.colour);
  setZone('front', false);
  setMode('draw');
  syncSel();
  const ready = restore().catch(() => {}).finally(() => { restored = true; onChange(summary()); });
  Promise.all(Object.keys(FONTS).map((f) => document.fonts.load(fontCss(f)).catch(() => {}))).then(() => {
    state.objects.forEach((o) => { if (o.type === 'text') measure(o); });
    dirty();
  });

  let raf = 0;
  const frame = () => {
    if (cam.target !== null) {
      const d = cam.target - cam.yaw;
      cam.yaw += d * 0.12;
      if (Math.abs(d) < 0.002) { cam.yaw = cam.target; cam.target = null; }
      syncView();
    }
    if (state.dirty) { state.dirty = false; composite(); }
    S.place();
    renderer.render(S.scene, camera);
    raf = requestAnimationFrame(frame);
  };
  frame();
  root.dataset.ready = 'true';

  function startNew() {
    snapshot();
    state.objects = [];
    state.sel = null;
    state.curDraw = null;
    syncSel();
    setZone('front', true);
    setPen(false);
    dirty();
  }

  async function load(d: SavedDesign) {
    await ready;
    snapshot();
    state.objects = [];
    state.sel = null;
    state.curDraw = null;
    await loadData(d);
    syncSel();
    setZone('front', true);
    dirty();
    onChange(summary());
  }

  return {
    summary, printFiles, previews, showZone, startNew, load,
    design: () => designData(true),
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(saveTimer);
      persist();
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
      S.dispose();
      geo.dispose();
    },
  };
}
