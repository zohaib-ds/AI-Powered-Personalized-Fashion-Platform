'use client';

import { useEffect, useRef, useState } from 'react';
import { COLOURS, ZONE_INFO } from '@/lib/design';

// The spinning 3D shirt on the home page, wearing a sample WearSketch design.
const PICKS = ['white', 'black', 'sky', 'mustard', 'forest', 'pink'];

function paintSample(ctx: CanvasRenderingContext2D, dark: boolean) {
  const ink = dark ? '#f4f4f1' : '#14161c';
  const f = ZONE_INFO.front, b = ZONE_INFO.back, sl = ZONE_INFO.sleeveL;
  const cx = f.x + f.w / 2;
  ctx.save();
  // front: a hand-drawn sun and a marker wordmark
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ff5fa2';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, f.y + 150, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd23f';
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
  ctx.fillStyle = '#2f80ed';
  ctx.fillText('WEAR IT IN DELHI', cx, f.y + 420);
  // back: big type
  const bx = b.x + b.w / 2;
  ctx.fillStyle = ink;
  ctx.font = '400 150px "Anton"';
  ctx.fillText('ONE', bx, b.y + 120);
  ctx.fillText('OF ONE', bx, b.y + 280);
  ctx.font = '700 40px "Space Mono"';
  ctx.fillStyle = '#e8352b';
  ctx.fillText('DESIGNED BY YOU', bx, b.y + 400);
  // sleeve badge
  ctx.fillStyle = '#2f4bff';
  ctx.beginPath();
  ctx.arc(sl.x + sl.w / 2, sl.y + sl.h / 2, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '400 54px "Bebas Neue"';
  ctx.fillText('WS', sl.x + sl.w / 2, sl.y + sl.h / 2 + 3);
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
      await Promise.all(['400 84px "Permanent Marker"', '400 64px "Bebas Neue"', '400 150px "Anton"', '700 40px "Space Mono"'].map((f) => document.fonts.load(f).catch(() => {})));
      if (gone || !host.current) return;
      const tex = document.createElement('canvas');
      tex.width = tex.height = TEX;
      const ctx = tex.getContext('2d')!;
      const S = createShirtScene(host.current, tex, geo);
      const paint = (id: string) => {
        const hex = COLOURS.find((c) => c.id === id)!.hex;
        paintFabric(ctx, hex);
        paintSample(ctx, hexLum(hex) < 0.45);
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
      <div className="showcase-view" ref={host}>{!ready && <span className="spinner" />}</div>
      <div className="showcase-swatches" role="group" aria-label="Try a shirt colour">
        {PICKS.map((id) => {
          const c = COLOURS.find((x) => x.id === id)!;
          return <button key={id} className="sw" style={{ background: c.hex }} aria-label={c.name} title={c.name} aria-pressed={colour === id} onClick={() => { setColourId(id); setColour.current(id); }} />;
        })}
      </div>
    </div>
  );
}
