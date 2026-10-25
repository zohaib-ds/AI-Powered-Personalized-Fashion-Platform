'use client';

import { useEffect, useRef, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { COLOURS, ZONE_INFO } from '@/lib/design';

// The 3D shirt on the home page, wearing a sample design in two inks.
const PICKS = ['white', 'black', 'heather-grey', 'navy', 'red', 'forest'];

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((done) => {
  const img = new Image();
  img.onload = () => done(img);
  img.onerror = () => done(null);
  img.src = src;
});

function paintSample(ctx: CanvasRenderingContext2D, dark: boolean, logo: HTMLImageElement | null) {
  const ink = dark ? '#f4f4f1' : '#1e1d1b';
  const red = dark ? '#e8775a' : '#b8391a';
  const f = ZONE_INFO.front, b = ZONE_INFO.back, sl = ZONE_INFO.sleeveL;
  const cx = f.x + f.w / 2;
  ctx.save();
  // front: a hand-drawn sun and a marker wordmark
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = red;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, f.y + 150, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = red;
  ctx.lineWidth = 12;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 100, f.y + 150 + Math.sin(a) * 100);
    ctx.lineTo(cx + Math.cos(a) * 135, f.y + 150 + Math.sin(a) * 135);
    ctx.stroke();
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 84px "Permanent Marker"';
  ctx.fillText('sketch it.', cx, f.y + 330);
  ctx.font = '400 64px "Bebas Neue"';
  ctx.fillStyle = red;
  ctx.fillText('DESIGNED BY YOU', cx, f.y + 420);
  // back: big type
  const bx = b.x + b.w / 2;
  ctx.fillStyle = ink;
  ctx.font = '400 150px "Anton"';
  ctx.fillText('ONE', bx, b.y + 120);
  ctx.fillText('OF ONE', bx, b.y + 280);
  ctx.font = '700 40px "IBM Plex Mono"';
  ctx.fillStyle = red;
  ctx.fillText('MADE TO ORDER', bx, b.y + 400);
  // sleeve: the WearSketch logo, fitted inside the print box
  if (logo) {
    const k = Math.min((sl.w * 0.9) / logo.width, (sl.h * 0.9) / logo.height);
    const w = logo.width * k, h = logo.height * k;
    ctx.drawImage(logo, sl.x + (sl.w - w) / 2, sl.y + (sl.h - h) / 2, w, h);
  }
  ctx.restore();
}

export default function ShirtShowcase() {
  const host = useRef<HTMLDivElement>(null);
  const setColour = useRef<(id: string) => void>(() => {});
  const [colour, setColourId] = useState('white');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let gone = false;
    let cleanup = () => {};
    (async () => {
      const [{ createShirtScene, loadShirtGeometry, paintFabric, hexLum }, { TEX }] = await Promise.all([import('@/lib/studio/shirt'), import('@/lib/design')]);
      const geo = await loadShirtGeometry();
      await Promise.all(['400 84px "Permanent Marker"', '400 64px "Bebas Neue"', '400 150px "Anton"', '700 40px "IBM Plex Mono"'].map((f) => document.fonts.load(f).catch(() => {})));
      // the logo with a black arrow for light shirts, and the light-arrow copy for dark ones
      const [logo, logoLight] = await Promise.all([loadImage(BRAND.logo), loadImage(BRAND.logoLight)]);
      if (gone || !host.current) return;
      const tex = document.createElement('canvas');
      tex.width = tex.height = TEX;
      const ctx = tex.getContext('2d')!;
      const S = createShirtScene(host.current, tex, geo);
      const paint = (id: string) => {
        const hex = COLOURS.find((c) => c.id === id)!.hex;
        paintFabric(ctx, hex);
        const dark = hexLum(hex) < 0.45;
        paintSample(ctx, dark, dark ? logoLight : logo);
        S.texture.needsUpdate = true;
        S.setColor(hex);
      };
      setColour.current = paint;
      paint('white');
      S.cam.zoom = 0.92;

      let drag: { x: number } | null = null, idleAt = 0, raf = 0;
      const el = S.renderer.domElement;
      el.style.touchAction = 'pan-y';
      const down = (e: PointerEvent) => { drag = { x: e.clientX }; el.setPointerCapture(e.pointerId); };
      const move = (e: PointerEvent) => { if (!drag) return; S.cam.yaw -= (e.clientX - drag.x) * 0.01; drag.x = e.clientX; idleAt = performance.now(); };
      const up = () => { drag = null; idleAt = performance.now(); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const frame = (t: number) => {
        if (!drag && !still && t - idleAt > 1500) S.cam.yaw += 0.006;
        S.place();
        S.renderer.render(S.scene, S.camera);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      setReady(true);
      cleanup = () => { cancelAnimationFrame(raf); S.dispose(); geo.dispose(); };
    })().catch(() => {});
    return () => { gone = true; cleanup(); };
  }, []);

  return (
    <div className="showcase">
      <div className="showcase-view" ref={host}>{!ready && <span className="loading">Loading the 3D shirt…</span>}</div>
      <div className="showcase-bar">
        <p className="showcase-note">Live 3D model with a sample design. Drag to turn it.</p>
        <div className="showcase-swatches" role="group" aria-label="Try a shirt colour">
          {PICKS.map((id) => {
            const c = COLOURS.find((x) => x.id === id)!;
            return <button key={id} className="sw" style={{ background: c.hex }} aria-label={c.name} title={c.name} aria-pressed={colour === id} onClick={() => { setColourId(id); setColour.current(id); }} />;
          })}
        </div>
      </div>
    </div>
  );
}
