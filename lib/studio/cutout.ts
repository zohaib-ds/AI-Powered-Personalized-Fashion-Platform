// Background removal for uploaded images. Everything runs in the customer's browser, nothing is uploaded.
// - Plain backgrounds (a logo on white, a product on one colour) are cut straight away by colour.
// - Anything else uses an AI model. Where the browser can use the graphics card, that is BiRefNet lite
//   (MIT licence, about 115 MB, downloaded once and kept in the browser). Otherwise it is the small
//   U2-Net-P model (Apache 2.0 licence, 4.6 MB) served from public/models.

const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
const CACHE = 'wearsketch-models-v1';

interface Model { url: string; size: number; mb: number; gpu: boolean; sigmoid: boolean; maxNorm: boolean }
const BIG: Model = {
  url: 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/onnx/model_fp16.onnx',
  size: 1024, mb: 115, gpu: true, sigmoid: true, maxNorm: false,
};
const SMALL: Model = { url: '/models/u2netp.onnx', size: 320, mb: 5, gpu: false, sigmoid: false, maxNorm: true };

export type Cut = { canvas: HTMLCanvasElement; kind: 'plain' | 'ai' };

function pixels(img: HTMLImageElement | HTMLCanvasElement) {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return { c, g, w, h, d: g.getImageData(0, 0, w, h) };
}

// what the edge of the image looks like: already see-through, one plain colour, or a busy photo
export function edgeKind(img: HTMLImageElement): 'clear' | 'plain' | 'busy' {
  const { w, h, d } = pixels(img);
  const p = d.data, idx: number[] = [];
  for (let x = 0; x < w; x++) idx.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) idx.push(y * w, y * w + w - 1);
  if (idx.filter((i) => p[i * 4 + 3] < 16).length > idx.length * 0.6) return 'clear';
  const bg = edgeColour(p, idx);
  const close = idx.filter((i) => dist(p, i * 4, bg) < 30).length;
  return close >= idx.length * 0.9 ? 'plain' : 'busy';
}

function edgeColour(p: Uint8ClampedArray, idx: number[]) {
  const ch = [0, 1, 2].map((k) => idx.map((i) => p[i * 4 + k]).sort((a, b) => a - b)[idx.length >> 1]);
  return ch as [number, number, number];
}
const dist = (p: Uint8ClampedArray, o: number, c: number[]) => {
  const r = p[o] - c[0], g = p[o + 1] - c[1], b = p[o + 2] - c[2];
  return Math.sqrt(r * r + g * g + b * b);
};

// flood fill from the edges through everything close to the background colour; soft at the edges
export function plainCut(img: HTMLImageElement): HTMLCanvasElement {
  const { c, g, w, h, d } = pixels(img);
  const p = d.data, n = w * h, LO = 18, HI = 60;
  const idx: number[] = [];
  for (let x = 0; x < w; x++) idx.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) idx.push(y * w, y * w + w - 1);
  const bg = edgeColour(p, idx);
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let top = 0;
  for (const i of idx) if (!seen[i] && dist(p, i * 4, bg) <= HI) { seen[i] = 1; stack[top++] = i; }
  while (top) {
    const i = stack[--top], o = i * 4, x = i % w;
    const t = Math.min(1, Math.max(0, (dist(p, o, bg) - LO) / (HI - LO)));
    if (t === 0) p[o + 3] = 0;
    else {
      // take the background colour out of the soft edge so no light or dark rim is left
      for (let k = 0; k < 3; k++) p[o + k] = Math.min(255, Math.max(0, bg[k] + (p[o + k] - bg[k]) / t));
      p[o + 3] = Math.round(p[o + 3] * t);
    }
    if (x > 0 && !seen[i - 1] && dist(p, (i - 1) * 4, bg) <= HI) { seen[i - 1] = 1; stack[top++] = i - 1; }
    if (x < w - 1 && !seen[i + 1] && dist(p, (i + 1) * 4, bg) <= HI) { seen[i + 1] = 1; stack[top++] = i + 1; }
    if (i >= w && !seen[i - w] && dist(p, (i - w) * 4, bg) <= HI) { seen[i - w] = 1; stack[top++] = i - w; }
    if (i < n - w && !seen[i + w] && dist(p, (i + w) * 4, bg) <= HI) { seen[i + w] = 1; stack[top++] = i + w; }
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------- AI ----------
// the parts of onnxruntime-web used here; it is loaded from the CDN only when someone asks for an AI cut-out
interface Tensor { data: unknown; type: string; dispose?(): void }
interface Session {
  inputMetadata: readonly { name: string; type?: string }[];
  outputNames: readonly string[];
  run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: 'float32' | 'float16', data: Float32Array | Uint16Array, dims: number[]) => Tensor;
  InferenceSession: { create(model: Uint8Array, o: { executionProviders: string[] }): Promise<Session> };
}
let ortP: Promise<Ort> | null = null;
const sessions = new Map<string, Promise<Session>>();

function loadOrt(): Promise<Ort> {
  ortP ??= import(/* webpackIgnore: true */ ORT_URL + 'ort.webgpu.min.mjs').then((ort: Ort) => {
    ort.env.wasm.wasmPaths = ORT_URL;
    ort.env.wasm.numThreads = 1;
    return ort;
  });
  ortP.catch(() => (ortP = null));
  return ortP;
}

// set when the big model failed on this device, so it isn't downloaded or tried again
const BROKEN = 'wearsketch-ai-small';
const bigBroken = () => { try { return localStorage.getItem(BROKEN) === '1'; } catch { return false; } };
let gpuP: Promise<boolean> | null = null;
function gpuOk(): Promise<boolean> {
  if (bigBroken()) return Promise.resolve(false);
  // the big model needs WebGPU with 16 bit floats, which most phones and computers from the last few years have
  gpuP ??= (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
      const a = gpu ? await gpu.requestAdapter() : null;
      return !!a && a.features.has('shader-f16');
    } catch { return false; }
  })();
  return gpuP;
}

async function cached(url: string) {
  try { return (await (await caches.open(CACHE)).match(url)) ?? null; } catch { return null; }
}

// true when the next AI cut-out first needs the big download, so the studio can ask before using data
export async function needsDownload(): Promise<number | null> {
  if (!(await gpuOk())) return null;
  return (await cached(BIG.url)) ? null : BIG.mb;
}

class DownloadError extends Error { constructor() { super('Could not download the AI model.'); } }

async function download(m: Model, onPct: (pct: number) => void): Promise<Uint8Array> {
  const hit = await cached(m.url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const res = await fetch(m.url).catch(() => null);
  if (!res?.ok || !res.body) throw new DownloadError();
  const size = Number(res.headers.get('content-length')) || 0;
  // one buffer for the whole file when its size is known, so a phone doesn't hold several copies
  let buf = new Uint8Array(size || m.mb * 1e6), got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read().catch(() => { throw new DownloadError(); });
    if (done) break;
    if (got + value.length > buf.length) { const b = new Uint8Array(Math.max(buf.length * 1.5, got + value.length)); b.set(buf.subarray(0, got)); buf = b; }
    buf.set(value, got);
    got += value.length;
    onPct(Math.min(99, Math.round((got / (size || m.mb * 1e6)) * 100)));
  }
  if (got !== buf.length) buf = buf.slice(0, got);
  try { await (await caches.open(CACHE)).put(m.url, new Response(new Blob([buf as BlobPart]))); } catch { /* not kept: downloads again next visit */ }
  return buf;
}

function session(m: Model, onPct: (pct: number) => void) {
  let s = sessions.get(m.url);
  if (!s) {
    s = (async () => {
      const [ort, buf] = await Promise.all([loadOrt(), download(m, onPct)]);
      return ort.InferenceSession.create(buf, { executionProviders: m.gpu ? ['webgpu'] : ['wasm'] });
    })();
    s.catch(() => sessions.delete(m.url));
    sessions.set(m.url, s);
  }
  return s;
}

const toHalf = (f: Float32Array) => {
  const out = new Uint16Array(f.length), v = new Float32Array(1), u = new Uint32Array(v.buffer);
  for (let i = 0; i < f.length; i++) {
    v[0] = f[i];
    const x = u[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
    out[i] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >>> 13);
  }
  return out;
};
const fromHalf = (h: Uint16Array) => {
  const out = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) {
    const x = h[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 0x1f, m = x & 0x3ff;
    out[i] = e === 0 ? s * m * 2 ** -24 : e === 31 ? s * Infinity : s * (1 + m / 1024) * 2 ** (e - 15);
  }
  return out;
};

async function mask(m: Model, img: HTMLImageElement, onPct: (pct: number) => void): Promise<HTMLCanvasElement> {
  const [ort, s] = await Promise.all([loadOrt(), session(m, onPct)]);
  const S = m.size, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, S, S);
  const px = g.getImageData(0, 0, S, S).data, n = S * S;
  let top = 1;
  if (m.maxNorm) { top = 0; for (let i = 0; i < n * 4; i++) if (i % 4 !== 3 && px[i] > top) top = px[i]; top = top / 255 || 1; }
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225], x = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) x[k * n + i] = (px[i * 4 + k] / 255 / top - mean[k]) / std[k];

  const meta = s.inputMetadata[0];
  const half = meta.type === 'float16';
  const input = half ? new ort.Tensor('float16', toHalf(x), [1, 3, S, S]) : new ort.Tensor('float32', x, [1, 3, S, S]);
  const res = await s.run({ [meta.name]: input });
  const out = res[s.outputNames.includes('output_image') ? 'output_image' : s.outputNames[0]];
  const raw = out.data as ArrayLike<number>;
  const v = out.type === 'float16' && raw instanceof Uint16Array ? fromHalf(raw) : Float32Array.from(raw);
  Object.values(res).forEach((t) => t.dispose?.());

  if (m.sigmoid) for (let i = 0; i < n; i++) v[i] = 1 / (1 + Math.exp(-v[i]));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
  // some graphics cards give back nothing useful (all the same or not a number); the small model is used then
  if (!(hi - lo > 1e-3)) throw new Error('The AI gave back an empty result.');
  if (m.sigmoid) { lo = 0; hi = 1; }
  const md = g.createImageData(S, S);
  for (let i = 0; i < n; i++) {
    const a = (v[i] - lo) / (hi - lo || 1);
    md.data[i * 4 + 3] = a < 0.04 ? 0 : a > 0.96 ? 255 : Math.round(a * 255);
  }
  g.putImageData(md, 0, 0);
  return c;
}

export async function aiCut(img: HTMLImageElement, onStatus: (s: string) => void): Promise<HTMLCanvasElement> {
  const onPct = (p: number) => onStatus(`Getting the AI ready… ${p}%`);
  onStatus('Getting the AI ready…');
  let m: HTMLCanvasElement;
  try {
    if (!(await gpuOk())) throw new Error('no WebGPU');
    m = await mask(BIG, img, onPct);
  } catch (e) {
    if (!(e instanceof Error && e.message === 'no WebGPU') && !(e instanceof DownloadError)) {
      console.warn('Big background model failed, using the small one', e);
      try { localStorage.setItem(BROKEN, '1'); } catch { /* tried again next visit */ }
    }
    m = await mask(SMALL, img, onPct);
  }
  onStatus('Removing background…');
  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  const g = out.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingQuality = 'high';
  g.drawImage(m, 0, 0, out.width, out.height);
  return out;
}

// the part of a cut image that is not see-through, so the selection box hugs what is left
export function opaqueBox(c: HTMLCanvasElement) {
  const { w, h, d } = pixels(c);
  const p = d.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
