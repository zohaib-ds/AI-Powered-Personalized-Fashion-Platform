// Free-size oversized tee, laid flat, in centimetres. The 3D shirt is this
// outline "inflated" into a front and a back surface; each surface is UV-mapped
// so 1 texture pixel = a fixed number of millimetres on the real garment.
import * as THREE from 'three';

export const BACK_NECK = (x: number) => 71 - 2.2 * Math.sqrt(Math.max(0, 1 - (x / 10) ** 2));
export const FRONT_NECK = (x: number) => 71 - 10 * Math.sqrt(Math.max(0, 1 - (x / 10) ** 2));

const RIGHT_HALF: [number, number][] = [
  [0, 0], [14, 0], [29, 0.3], [29.4, 12], [29.6, 30], [29.5, 44.5], [30.6, 45.9], [33, 44.6], [38, 42.4],
  [43.5, 40.2], [45.5, 45], [47.5, 50.2], [49.5, 55.6], [44, 59.6], [38, 63.6], [32, 67.2], [24, 68.9],
  [16, 70.2], [10, 71],
];
for (let i = 1; i <= 10; i++) RIGHT_HALF.push([10 - i, BACK_NECK(10 - i)]);

export const OUTLINE: [number, number][] = RIGHT_HALF.concat(
  RIGHT_HALF.slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as [number, number]),
);

export const XMIN = -52;
export const XMAX = 52;
export const YMIN = -1;
export const YMAX = 73;
export const W = XMAX - XMIN;
export const H = YMAX - YMIN;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function insidePoly(x: number, y: number, P: [number, number][]) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function nearestOnPoly(x: number, y: number, P: [number, number][]): [number, number, number] {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [cx, cy] = P[i];
    const dx = cx - ax, dy = cy - ay, L = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1);
    const px = ax + t * dx, py = ay + t * dy, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) { best = d; bx = px; by = py; }
  }
  return [Math.sqrt(best), bx, by];
}

// Builds front and back meshes that meet at the outline (the side seams).
export function buildShirtGeometry(): { front: THREE.BufferGeometry; back: THREE.BufferGeometry } {
  const step = 0.55, nx = Math.ceil(W / step) + 1, ny = Math.ceil(H / step) + 1, N = nx * ny;
  const inside = new Uint8Array(N), dist = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = XMIN + i * step, y = YMIN + j * step;
      px[k] = x; py[k] = y;
      if (insidePoly(x, y, OUTLINE)) { inside[k] = 1; dist[k] = nearestOnPoly(x, y, OUTLINE)[0]; }
    }
  // grid points just outside the outline snap onto it, so the edge is smooth
  const valid = new Uint8Array(N);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (inside[k]) { valid[k] = 1; continue; }
      const nb = (i > 0 && inside[k - 1]) || (i < nx - 1 && inside[k + 1]) || (j > 0 && inside[k - nx]) || (j < ny - 1 && inside[k + nx]);
      if (nb) { const [, bx, by] = nearestOnPoly(px[k], py[k], OUTLINE); px[k] = bx; py[k] = by; dist[k] = 0; valid[k] = 1; }
    }
  const idx = new Int32Array(N).fill(-1);
  let n = 0;
  for (let k = 0; k < N; k++) if (valid[k]) idx[k] = n++;

  const make = (sign: 1 | -1) => {
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let k = 0; k < N; k++) {
      if (idx[k] < 0) continue;
      const v = idx[k], x = px[k], y = py[k];
      const t = Math.min(dist[k] / 9, 1), prof = Math.sqrt(1 - (1 - t) ** 2);
      const body = Math.abs(x) < 30 ? 2.2 * (1 - (x / 30) ** 2) * Math.sin(Math.PI * clamp(y / 70, 0, 1)) : 0;
      const wr = 0.45 * vnoise(x * 0.11 + (sign > 0 ? 0 : 40), y * 0.09) + 0.25 * vnoise(x * 0.27, y * 0.21 + 9);
      const z = (5.2 + body + wr) * prof;
      let zz = z * sign;
      if (sign > 0 && Math.abs(x) < 10.4) {
        // inside the front neckline you see the inside of the back
        const k2 = clamp((y - FRONT_NECK(clamp(x, -10, 10))) / 1.4, 0, 1);
        zz = zz * (1 - k2) + -z * 0.82 * k2;
      }
      pos[v * 3] = x / 100; pos[v * 3 + 1] = y / 100 - 0.36; pos[v * 3 + 2] = zz / 100;
      const u = (x - XMIN) / W;
      uv[v * 2] = sign > 0 ? u : 1 - u; uv[v * 2 + 1] = (y - YMIN) / H;
    }
    const tri: number[] = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = idx[j * nx + i], b = idx[j * nx + i + 1], c = idx[(j + 1) * nx + i], d = idx[(j + 1) * nx + i + 1];
        const add = (p: number, q: number, r: number) => {
          if (p < 0 || q < 0 || r < 0) return;
          if (sign > 0) tri.push(p, q, r); else tri.push(p, r, q);
        };
        add(a, b, d); add(a, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(tri);
    g.computeVertexNormals();
    return g;
  };
  return { front: make(1), back: make(-1) };
}
