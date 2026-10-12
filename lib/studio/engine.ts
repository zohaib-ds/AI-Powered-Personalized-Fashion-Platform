// The 3D view: renders the shirt, lets people orbit it and drag prints on it.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { COLOURS, PRINT_AREAS, type Side } from '../design';
import { buildShirtGeometry, clamp, H, W, XMIN, YMIN } from './garment';
import { lum, paintSide, TEX_H, TEX_W } from './paint';
import type { Layer, StudioStore } from './store';

export interface Studio {
  setSide(side: Side, animate?: boolean): void;
  snapshot(): string;
  dispose(): void;
}

export function createStudio(canvas: HTMLCanvasElement, store: StudioStore, onFirstInteraction: () => void): Studio {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  camera.position.set(0, 0.08, 2.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(1.2, 1.6, 2.2);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0);
  rim.position.set(-1.6, 0.8, -2);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x666670, 0.3));

  // shirt
  const geo = buildShirtGeometry();
  const canv: Record<Side, HTMLCanvasElement> = { front: document.createElement('canvas'), back: document.createElement('canvas') };
  const tex = {} as Record<Side, THREE.CanvasTexture>;
  const mesh = {} as Record<Side, THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>>;
  for (const side of ['front', 'back'] as Side[]) {
    canv[side].width = TEX_W;
    canv[side].height = TEX_H;
    tex[side] = new THREE.CanvasTexture(canv[side]);
    tex[side].colorSpace = THREE.SRGBColorSpace;
    tex[side].anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshPhysicalMaterial({ map: tex[side], roughness: 0.93, metalness: 0, sheen: 0.25, sheenRoughness: 0.8, envMapIntensity: 0.62 });
    mesh[side] = new THREE.Mesh(geo[side], mat);
    mesh[side].userData.side = side;
    scene.add(mesh[side]);
  }

  // soft floor shadow
  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sx = sc.getContext('2d')!;
  const grad = sx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = grad;
  sx.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.4;
  scene.add(shadow);

  // pointer handling is attached before OrbitControls so a drag on a print wins
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag: { L: Layer; ox: number; oy: number; side: Side } | null = null;
  let downAt: { x: number; y: number } | null = null;
  let touched = false;
  let turnTo: number | null = null;

  const hitAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects([mesh.front, mesh.back])[0];
    if (!h || !h.uv) return null;
    return { side: h.object.userData.side as Side, x: h.uv.x * W + XMIN, y: h.uv.y * H + YMIN };
  };
  const layerAt = (side: Side, x: number, y: number) => {
    const layers = store.state.layers;
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      if (L.side !== side) continue;
      const c = Math.cos((-L.rot * Math.PI) / 180), s = Math.sin((-L.rot * Math.PI) / 180);
      const dx = x - L.x, dy = y - L.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= L.w / 2 + 0.6 && Math.abs(ly) <= L.w / L.aspect / 2 + 0.6) return L;
    }
    return null;
  };

  const onDown = (e: PointerEvent) => {
    controls.autoRotate = false;
    turnTo = null;
    if (!touched) { touched = true; onFirstInteraction(); }
    downAt = { x: e.clientX, y: e.clientY };
    const h = hitAt(e);
    if (!h) return;
    const L = layerAt(h.side, h.x, h.y);
    if (L) {
      controls.enabled = false;
      drag = { L, ox: L.x - h.x, oy: L.y - h.y, side: h.side };
      store.update((s) => { s.side = h.side; s.sel = L.id; });
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    const h = hitAt(e);
    if (!drag) {
      canvas.style.cursor = h && layerAt(h.side, h.x, h.y) ? 'move' : 'grab';
      return;
    }
    if (!h || h.side !== drag.side) return;
    const pa = PRINT_AREAS[drag.side];
    const L = drag.L;
    L.x = clamp(h.x + drag.ox, pa.cx - pa.w / 2, pa.cx + pa.w / 2);
    L.y = clamp(h.y + drag.oy, pa.cy - pa.h / 2, pa.cy + pa.h / 2);
    store.update();
  };
  const onUp = (e: PointerEvent) => {
    const moved = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    if (!drag && !moved) {
      const h = hitAt(e);
      if (h) store.update((s) => { s.side = h.side; s.sel = null; });
    }
    drag = null;
    controls.enabled = true;
    downAt = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = Math.PI * 0.32;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;

  const resize = () => {
    const r = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const fit = Math.max(0.95 / (2 * t), 1.2 / (2 * t * camera.aspect));
    controls.minDistance = fit * 0.45;
    controls.maxDistance = fit * 1.35;
    camera.position.multiplyScalar(fit / camera.position.length());
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  resize();

  // repaint textures when the design changes
  const dirty: Record<Side, boolean> = { front: true, back: true };
  const unsub = store.subscribe(() => { dirty.front = dirty.back = true; });
  const tint = (side: Side) => {
    const hex = (COLOURS.find((c) => c.id === store.state.colourId) ?? COLOURS[0]).hex;
    const d = lum(hex) < 0.35;
    const m = mesh[side].material;
    m.sheenColor.set(hex).lerp(new THREE.Color(0xffffff), d ? 0.12 : 0.5);
    m.sheen = d ? 0.35 : 0.25;
    m.envMapIntensity = d ? 0.5 : 0.5;
  };

  let lastFacing: Side = 'front';
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (turnTo !== null) {
      const r = Math.hypot(camera.position.x, camera.position.z);
      const a = Math.atan2(camera.position.x, camera.position.z);
      let d = turnTo - a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.002) turnTo = null;
      const na = a + d * 0.12;
      camera.position.x = r * Math.sin(na);
      camera.position.z = r * Math.cos(na);
    }
    controls.update();
    const facing: Side = Math.cos(Math.atan2(camera.position.x, camera.position.z)) >= 0 ? 'front' : 'back';
    if (facing !== lastFacing) {
      lastFacing = facing;
      if (!drag && turnTo === null && facing !== store.state.side) store.update((s) => { s.side = facing; });
    }
    for (const s of ['front', 'back'] as Side[]) {
      if (!dirty[s]) continue;
      paintSide(canv[s], s, store.state);
      tex[s].needsUpdate = true;
      tint(s);
      dirty[s] = false;
    }
    renderer.render(scene, camera);
  };
  loop();

  return {
    setSide(side, animate = true) {
      store.update((s) => { s.side = side; });
      if (animate) {
        turnTo = side === 'front' ? 0 : Math.PI;
        controls.autoRotate = false;
      }
    },
    // a clean picture of the shirt for the order: no print-area guide, no selection box
    snapshot() {
      const st = store.state;
      const keep = { sel: st.sel, guide: st.guide };
      st.sel = null;
      st.guide = false;
      for (const s of ['front', 'back'] as Side[]) {
        paintSide(canv[s], s, st);
        tex[s].needsUpdate = true;
      }
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      Object.assign(st, keep);
      dirty.front = dirty.back = true;
      return url;
    },
    dispose() {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      controls.dispose();
      for (const s of ['front', 'back'] as Side[]) {
        mesh[s].geometry.dispose();
        mesh[s].material.dispose();
        tex[s].dispose();
      }
      shadowTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
