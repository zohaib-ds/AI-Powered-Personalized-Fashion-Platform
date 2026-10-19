// The 3D t-shirt: mesh loading, the fabric texture and the three.js scene.
// Shared by the design studio and the spinning shirt on the home page.
import * as THREE from 'three';
import { TEX } from '../design';

// ---------- mesh (a real t-shirt model, quantised and packed into JSON) ----------
interface PackedMesh {
  n: number;
  lo: [number, number, number];
  hi: [number, number, number];
  pos: string;
  uv: string;
  nor: string;
  idx: string;
}

const b64 = (s: string) => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
};

let meshPromise: Promise<PackedMesh> | null = null;

export async function loadShirtGeometry(): Promise<THREE.BufferGeometry> {
  meshPromise ??= fetch('/models/tee-mesh.json').then((r) => {
    if (!r.ok) throw new Error('Could not load the 3D shirt.');
    return r.json();
  });
  const M = await meshPromise;
  const qp = new Uint16Array(b64(M.pos));
  const qu = new Uint16Array(b64(M.uv));
  const qn = new Int8Array(b64(M.nor));
  const ix = new Uint16Array(b64(M.idx));
  const n = M.n;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const nor = new Float32Array(n * 3);
  const c = [0, 1, 2].map((k) => (M.lo[k] + M.hi[k]) / 2);
  const sc = 2 / (M.hi[1] - M.lo[1]);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = M.lo[k] + (qp[i * 3 + k] / 65535) * (M.hi[k] - M.lo[k]);
      pos[i * 3 + k] = (v - c[k]) * sc;
      nor[i * 3 + k] = qn[i * 3 + k] / 127;
    }
    uv[i * 2] = qu[i * 2] / 65535;
    uv[i * 2 + 1] = qu[i * 2 + 1] / 65535;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(ix, 1));
  return g;
}

// ---------- the fabric texture: the model's UV layout (garment pattern pieces) ----------
const PIECES = {
  front: [0.02, 0.0219, 0.418, 0.5545],
  back: [0.5092, 0.02, 0.8971, 0.5545],
  sleeveA: [0.0807, 0.6337, 0.3573, 0.8194],
  sleeveB: [0.5649, 0.6337, 0.8415, 0.8194],
  rib1: [0.2633, 0.8706, 0.6351, 0.8885],
  rib2: [0.2633, 0.962, 0.6351, 0.98],
} as const;
type Piece = keyof typeof PIECES;
const BOX = Object.fromEntries(
  Object.entries(PIECES).map(([k, [u0, v0, u1, v1]]) => [k, { x: u0 * TEX - 6, y: (1 - v1) * TEX - 6, w: (u1 - u0) * TEX + 12, h: (v1 - v0) * TEX + 12 }]),
) as Record<Piece, { x: number; y: number; w: number; h: number }>;

export function hexLum(h: string) {
  const n = parseInt(h.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export function shade(h: string, amt: number) {
  const n = parseInt(h.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p);
  g = Math.round(g + (t - g) * p);
  b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}

let grain: HTMLCanvasElement | null = null;
function grainCanvas() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const g = grain.getContext('2d')!;
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return grain;
}

// fabric colour, knit grain, ribbed collar and hem stitching
export function paintFabric(ctx: CanvasRenderingContext2D, color: string) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainCanvas(), 'repeat')!;
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.restore();

  const dark = hexLum(color) < 0.35;
  const rib = dark ? shade(color, 0.1) : shade(color, -0.12);
  const stitch = dark ? shade(color, 0.24) : shade(color, -0.24);
  for (const k of ['rib1', 'rib2'] as Piece[]) {
    const b = BOX[k];
    ctx.fillStyle = rib;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = stitch;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let x = b.x; x < b.x + b.w; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x, b.y + b.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = stitch;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 8]);
  for (const k of ['front', 'back', 'sleeveA', 'sleeveB'] as Piece[]) {
    const b = BOX[k];
    for (const off of [38, 50]) {
      ctx.beginPath();
      ctx.moveTo(b.x + 6, b.y + b.h - off);
      ctx.lineTo(b.x + b.w - 6, b.y + b.h - off);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

// Flat studio background behind the shirt: darker stone for light shirts,
// pale paper for dark ones, so the shirt always stands out.
export function backdrop(hex: string) {
  return hexLum(hex) > 0.5
    ? { bg: '#c9c1b2', fg: '#1e1d1b', muted: 'rgba(30,29,27,.72)', shadow: 0.5 }
    : { bg: '#ece6db', fg: '#1e1d1b', muted: 'rgba(30,29,27,.66)', shadow: 1 };
}

// ---------- scene ----------
export interface ShirtScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
  cam: { yaw: number; pitch: number; zoom: number; target: number | null; baseDist: number };
  setColor(hex: string): void;
  place(): void;
  resize(): void;
  dispose(): void;
}

export function createShirtScene(host: HTMLElement, tex: HTMLCanvasElement, geo: THREE.BufferGeometry, opts: { preserve?: boolean } = {}): ShirtScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  // three ≥ r155 dropped the legacy light scale, so intensities carry a π
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d93a3, 0.95 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.75 * Math.PI);
  key.position.set(2.5, 3, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55 * Math.PI);
  rim.position.set(-3, 1.5, -4);
  scene.add(key, rim);

  const texture = new THREE.CanvasTexture(tex);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0, side: THREE.FrontSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95, metalness: 0, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh, new THREE.Mesh(geo, inner));

  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sg = sc.getContext('2d')!;
  const gr = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.28)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = gr;
  sg.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.03;
  scene.add(shadow);

  const cam = { yaw: 0, pitch: 0.06, zoom: 1, target: null as number | null, baseDist: 6 };
  const place = () => {
    const d = cam.baseDist * cam.zoom;
    camera.position.set(d * Math.sin(cam.yaw) * Math.cos(cam.pitch), d * Math.sin(cam.pitch), d * Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(0, -0.02, 0);
  };
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cam.baseDist = Math.max(3.9, 3.7 / camera.aspect) + 0.5;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  return {
    renderer, scene, camera, mesh, texture, cam, place, resize,
    setColor(hex) {
      inner.color.set(shade(hex, hexLum(hex) < 0.35 ? -0.35 : -0.18));
      shadowMat.opacity = backdrop(hex).shadow;
    },
    dispose() {
      ro.disconnect();
      texture.dispose();
      shadowTex.dispose();
      mat.dispose();
      inner.dispose();
      shadowMat.dispose();
      shadow.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
