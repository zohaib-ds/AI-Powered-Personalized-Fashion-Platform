// Fast pointer-to-shirt picking for the pen.
// three.js's own raycast tests every one of the shirt's ~22,000 triangles for each pointer
// event, which made drawing fall behind the finger on phones. Here the triangles are sorted
// once into a 3D grid, and a ray only tests the triangles in the grid cells it passes through,
// nearest cell first. The result is the same front-facing hit and texture position.
import * as THREE from 'three';

const N = 24; // grid cells per side

export function makePicker(geo: THREE.BufferGeometry) {
  const P = geo.getAttribute('position').array as ArrayLike<number>;
  const UV = geo.getAttribute('uv').array as ArrayLike<number>;
  const I = geo.getIndex()!.array as ArrayLike<number>;
  const triCount = Math.floor(I.length / 3);

  geo.computeBoundingBox();
  const box = geo.boundingBox!.clone().expandByScalar(1e-4);
  const lo = box.min, size = new THREE.Vector3().subVectors(box.max, box.min);
  const cs = [size.x / N, size.y / N, size.z / N];
  const cell = (v: number, k: number) => Math.min(N - 1, Math.max(0, Math.floor((v - [lo.x, lo.y, lo.z][k]) / cs[k])));

  // which triangles touch each cell (by the triangle's bounding box)
  const cells: number[][] = Array.from({ length: N * N * N }, () => []);
  for (let t = 0; t < triCount; t++) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < 3; j++) {
      const v = I[t * 3 + j] * 3;
      for (let k = 0; k < 3; k++) { const c = P[v + k]; if (c < mn[k]) mn[k] = c; if (c > mx[k]) mx[k] = c; }
    }
    const a = mn.map((v, k) => cell(v, k)), b = mx.map((v, k) => cell(v, k));
    for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) cells[(x * N + y) * N + z].push(t);
  }

  const seen = new Uint32Array(triCount);
  let stamp = 0;
  const inv = new THREE.Matrix4(), ray = new THREE.Ray();

  // Möller–Trumbore with back faces skipped, as three.js does for a front-side material
  function tri(t: number, o: THREE.Vector3, d: THREE.Vector3) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    // face normal; a ray going the same way as the normal sees the back of the triangle
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    if (d.x * nx + d.y * ny + d.z * nz >= 0) return null;
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return null;
    const id = 1 / det;
    const sx = o.x - P[a], sy = o.y - P[a + 1], sz = o.z - P[a + 2];
    const u = (sx * px + sy * py + sz * pz) * id;
    if (u < 0 || u > 1) return null;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * id;
    if (v < 0 || u + v > 1) return null;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * id;
    return dist < 0 ? null : { dist, u, v };
  }

  // world-space ray in, texture position (0..1, three.js uv) of the nearest front-facing hit out
  return function pick(world: THREE.Ray, matrixWorld: THREE.Matrix4): { u: number; v: number } | null {
    ray.copy(world).applyMatrix4(inv.copy(matrixWorld).invert());
    const o = ray.origin, d = ray.direction;
    const start = box.containsPoint(o) ? o.clone() : ray.intersectBox(box, new THREE.Vector3());
    if (!start) return null;
    const t0 = start.distanceTo(o);
    // walk the grid cells along the ray (Amanatides & Woo)
    const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], L = [lo.x, lo.y, lo.z];
    const S = [start.x, start.y, start.z];
    const c = S.map((v, k) => cell(v, k));
    const step = D.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
    const tMax = D.map((v, k) => (v === 0 ? Infinity : (L[k] + (c[k] + (v > 0 ? 1 : 0)) * cs[k] - O[k]) / v));
    const tDelta = D.map((v, k) => (v === 0 ? Infinity : cs[k] / Math.abs(v)));
    stamp++;
    let best: { dist: number; u: number; v: number; t: number } | null = null;
    for (;;) {
      for (const t of cells[(c[0] * N + c[1]) * N + c[2]]) {
        if (seen[t] === stamp) continue;
        seen[t] = stamp;
        const h = tri(t, o, d);
        if (h && (!best || h.dist < best.dist)) best = { ...h, t };
      }
      const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
      // a hit closer than where this cell ends cannot be beaten by any later cell
      if (best && best.dist <= Math.max(tMax[k], t0)) break;
      c[k] += step[k];
      if (c[k] < 0 || c[k] >= N) break;
      tMax[k] += tDelta[k];
    }
    if (!best) return null;
    const a = I[best.t * 3] * 2, b = I[best.t * 3 + 1] * 2, cc = I[best.t * 3 + 2] * 2, w = 1 - best.u - best.v;
    return { u: UV[a] * w + UV[b] * best.u + UV[cc] * best.v, v: UV[a + 1] * w + UV[b + 1] * best.u + UV[cc + 1] * best.v };
  };
}
