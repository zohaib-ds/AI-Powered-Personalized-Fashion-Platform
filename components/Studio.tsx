'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import BrandHeader from './BrandHeader';
import Checkout from './Checkout';
import { CM_PER_IN, COLOURS, PRINT_AREAS } from '@/lib/design';
import { PRICES, quote, rupee } from '@/lib/pricing';
import { SAMPLE_ART, TEXT_FONTS, artCanvas, fontSpec, textCanvas } from '@/lib/studio/art';
import { createStudio, type Studio as Engine } from '@/lib/studio/engine';
import { lum } from '@/lib/studio/paint';
import { StudioStore, summarise, type Layer } from '@/lib/studio/store';

const thumbOf = (L: Layer) => {
  if (!L.thumb) L.thumb = L.src instanceof HTMLCanvasElement ? L.src.toDataURL() : L.src.src;
  return L.thumb;
};

export default function Studio() {
  const store = useMemo(() => new StudioStore(), []);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(true);
  const [glError, setGlError] = useState(false);
  const [artThumbs, setArtThumbs] = useState<Record<string, string>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const st = store.state;
  const colour = COLOURS.find((c) => c.id === st.colourId) ?? COLOURS[0];
  const sel = store.selected();
  const q = quote(summarise(store));

  // boot: 3D engine, fonts, sample design
  useEffect(() => {
    try {
      engine.current = createStudio(canvasRef.current!, store, () => setHint(false));
    } catch {
      setGlError(true);
      return;
    }
    let cancelled = false;
    const fonts = TEXT_FONTS.map((f) => fontSpec(f, 40)).concat(['700 20px Archivo', '500 20px "IBM Plex Mono"']);
    const fontsReady = Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => null)));
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => {
      if (cancelled) return;
      setArtThumbs(Object.fromEntries(Object.keys(SAMPLE_ART).map((n) => [n, artCanvas(n).toDataURL()])));
      if (!store.state.layers.length) {
        addLayer({ type: 'image', name: 'Sunset (sample)', src: artCanvas('Sunset'), aspect: 1, px: 1024, w: 20, side: 'front', x: 0, y: 44 }, false);
        addLayer({ type: 'text', name: 'Text', text: 'MADE IN DELHI', font: 'Anton', color: '#15171c', outline: false, w: 22, side: 'front', x: 0, y: 30 }, false);
        addLayer({ type: 'image', name: 'Badge (sample)', src: artCanvas('Badge'), aspect: 1, px: 1024, w: 24, side: 'back', x: 0, y: 48 }, false);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLayer(partial: Omit<Layer, 'id' | 'rot' | 'aspect' | 'side' | 'x' | 'y' | 'src'> & Partial<Layer>, select = true) {
    const L = { rot: 0, side: store.state.side, ...partial, id: store.newId() } as Layer;
    if (L.type === 'text') {
      L.src = textCanvas(L.text!, L.font!, L.color!, !!L.outline);
      L.aspect = L.src.width / L.src.height;
    }
    const pa = PRINT_AREAS[L.side];
    if (L.x == null || L.y == null) {
      L.x = pa.cx;
      L.y = pa.cy + (L.type === 'text' ? -10 : 4);
    }
    store.update((s) => {
      s.layers.push(L);
      if (select) s.sel = L.id;
    });
  }

  function updateSel(fn: (L: Layer) => void) {
    const L = store.selected();
    if (!L) return;
    store.update(() => {
      fn(L);
      if (L.type === 'text') {
        L.src = textCanvas(L.text || ' ', L.font!, L.color!, !!L.outline);
        L.aspect = L.src.width / L.src.height;
        L.thumb = undefined;
      }
    });
  }

  function loadFile(file?: File | null) {
    if (!file || !/^image\//.test(file.type)) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const aspect = im.naturalWidth / im.naturalHeight;
        addLayer({ type: 'image', name: file.name, src: im, aspect, px: im.naturalWidth, w: Math.min(22, 22 * Math.min(1, aspect / 0.75)) });
      };
      im.src = rd.result as string;
    };
    rd.readAsDataURL(file);
  }

  // keyboard: delete and nudge the selected print
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,dialog')) return;
      const L = store.selected();
      if (!L) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.update((s) => { s.layers = s.layers.filter((l) => l !== L); s.sel = null; });
        e.preventDefault();
        return;
      }
      const step = e.shiftKey ? 2 : 0.5;
      const mv = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, number[]>)[e.key];
      if (mv) { store.update(() => { L.x += mv[0]; L.y += mv[1]; }); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store]);

  const dpi = sel?.type === 'image' && sel.px ? Math.round(sel.px / (sel.w / CM_PER_IN)) : null;

  return (
    <div className="app">
      <BrandHeader right={<span className="pill">Free size · Delhi delivery</span>} />
      <main className="work">
        <section
          className="stage"
          aria-label="3D T-shirt preview"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}
        >
          <canvas ref={canvasRef} className="gl" aria-label="Free-size T-shirt in 3D. Drag to rotate, drag a print to move it." />
          {!ready && <div className="loading">{glError ? 'This browser could not start 3D (WebGL is off).' : 'Loading the 3D tee…'}</div>}
          <div className="stage-top">
            <div className="seg" role="group" aria-label="Side">
              <button aria-pressed={st.side === 'front'} onClick={() => engine.current?.setSide('front')}>Front</button>
              <button aria-pressed={st.side === 'back'} onClick={() => engine.current?.setSide('back')}>Back</button>
            </div>
            <label className="chip-toggle">
              <input type="checkbox" checked={st.guide} onChange={(e) => store.update((s) => { s.guide = e.target.checked; })} /> Print area
            </label>
          </div>
          <div className="stage-hint" style={{ opacity: hint ? 1 : 0 }}>Drag to rotate · drag a print to move it · scroll to zoom</div>
        </section>

        <aside className="panel">
          <div className="sec">
            <h2>Shirt colour <span>{colour.name}</span></h2>
            <div className="swatches" role="group" aria-label="Shirt colour">
              {COLOURS.map((c) => (
                <button key={c.id} className="sw" style={{ background: c.hex }} title={c.name} aria-label={c.name}
                  aria-pressed={c.id === st.colourId} onClick={() => store.update((s) => { s.colourId = c.id; })} />
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="lbl">Free size · oversized drop-shoulder</span>
              <label className="chip-toggle" style={{ padding: '5px 10px' }}>
                <input type="checkbox" checked={st.heavy} onChange={(e) => store.update((s) => { s.heavy = e.target.checked; })} /> 280 GSM heavyweight
              </label>
            </div>
          </div>

          <div className="sec">
            <h2>Add to the <span>{st.side}</span></h2>
            <div className="row">
              <label className="btn" htmlFor="file">Upload image</label>
              <input type="file" id="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
                onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button className="btn" onClick={() => addLayer({ type: 'text', name: 'Text', text: 'YOUR TEXT', font: 'Anton', color: lum(colour.hex) < 0.35 ? '#f3f2ee' : '#15171c', outline: false, w: 18 })}>Add text</button>
              <button className="btn ghost" disabled title="Planned for the AI phase">Generate with AI <span className="soon">Soon</span></button>
            </div>
            <div className="lbl">Sample artwork</div>
            <div className="art-grid">
              {Object.keys(SAMPLE_ART).map((name) => (
                <button key={name} className="art" aria-label={`Add sample artwork: ${name}`} title={`Add ${name}`}
                  onClick={() => addLayer({ type: 'image', name: `${name} (sample)`, src: artCanvas(name), aspect: 1, px: 1024, w: 20 })}>
                  {artThumbs[name] && <img src={artThumbs[name]} alt="" />}
                </button>
              ))}
            </div>
          </div>

          <div className="sec">
            <h2>Selected</h2>
            {!sel && <div className="empty">Tap a print on the shirt, or pick one below, to edit it.</div>}
            {sel && (
              <div style={{ display: 'grid', gap: 12 }}>
                {sel.type === 'text' && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="field">
                      <label htmlFor="tText">Text</label>
                      <input className="inp" id="tText" maxLength={40} value={sel.text} onChange={(e) => updateSel((L) => { L.text = e.target.value; })} />
                    </div>
                    <div className="two">
                      <div className="field">
                        <label htmlFor="tFont">Font</label>
                        <select className="inp" id="tFont" value={sel.font}
                          onChange={(e) => { const v = e.target.value; document.fonts.load(fontSpec(v, 40)).finally(() => updateSel((L) => { L.font = v; })); }}>
                          {TEXT_FONTS.map((f) => <option key={f} value={f}>{f === 'Playfair Display' ? 'Playfair Italic' : f}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="tColor">Ink colour</label>
                        <input className="inp" type="color" id="tColor" style={{ height: 40, padding: 4 }} value={sel.color} onChange={(e) => updateSel((L) => { L.color = e.target.value; })} />
                      </div>
                    </div>
                    <label className="chip-toggle" style={{ justifySelf: 'start' }}>
                      <input type="checkbox" checked={!!sel.outline} onChange={(e) => updateSel((L) => { L.outline = e.target.checked; })} /> Outline
                    </label>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="sSize">Width <span style={{ fontFamily: 'var(--f-mono)' }}>{(sel.w / CM_PER_IN).toFixed(1)} × {(sel.w / sel.aspect / CM_PER_IN).toFixed(1)} in</span></label>
                  <input type="range" id="sSize" min={4} max={30} step={0.1} value={sel.w} onChange={(e) => updateSel((L) => { L.w = +e.target.value; })} />
                </div>
                <div className="field">
                  <label htmlFor="sRot">Rotation <span style={{ fontFamily: 'var(--f-mono)' }}>{Math.round(sel.rot)}°</span></label>
                  <input type="range" id="sRot" min={-180} max={180} step={1} value={sel.rot} onChange={(e) => updateSel((L) => { L.rot = +e.target.value; })} />
                </div>
                {dpi !== null && (dpi < 150
                  ? <div className="warn">Low resolution: this image prints at about {dpi} DPI at this size. Make it smaller or upload a bigger file.</div>
                  : <div className="okline">Sharp: prints at about {Math.min(dpi, 300)} DPI.</div>)}
                {sel.type === 'text' && <div className="okline">Text stays sharp at any size.</div>}
                <div className="row">
                  <button className="btn" onClick={() => updateSel((L) => { L.x = PRINT_AREAS[L.side].cx; })}>Centre</button>
                  <button className="btn" onClick={() => store.update((s) => {
                    const i = s.layers.indexOf(sel);
                    if (i < s.layers.length - 1) { s.layers.splice(i, 1); s.layers.splice(i + 1, 0, sel); }
                  })}>Bring forward</button>
                  <button className="btn" onClick={() => store.update((s) => { s.layers = s.layers.filter((l) => l !== sel); s.sel = null; })}>Delete</button>
                </div>
              </div>
            )}
            <div className="lbl">Layers</div>
            <div className="layers">
              {!st.layers.length && <div className="empty">No prints yet. Upload an image or add text.</div>}
              {[...st.layers].reverse().map((L) => (
                <button key={L.id} className="layer" aria-current={L.id === st.sel}
                  onClick={() => { if (st.side !== L.side) engine.current?.setSide(L.side); store.update((s) => { s.sel = L.id; }); }}>
                  <span className="th"><img src={thumbOf(L)} alt="" /></span>
                  <span className="nm">{L.type === 'text' ? `“${L.text}”` : L.name}</span>
                  <span className="sd">{L.side}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="price">
            <div className="total">
              <div>
                <div className="amt">{rupee(q.total)}</div>
                <div className="sub">{q.shipping ? `incl. GST · free delivery above ${rupee(PRICES.freeShipAbove)}` : 'incl. GST · free Ekart delivery in Delhi'}</div>
              </div>
              <div className="qty" aria-label="Quantity">
                <button aria-label="Fewer" onClick={() => store.update((s) => { s.qty = Math.max(1, s.qty - 1); })}>−</button>
                <output>{st.qty}</output>
                <button aria-label="More" onClick={() => store.update((s) => { s.qty = Math.min(PRICES.maxQty, s.qty + 1); })}>+</button>
              </div>
            </div>
            <details className="brk">
              <summary>Price breakdown</summary>
              <table className="lines"><tbody>
                {q.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{rupee(l.amount)}</td></tr>)}
                {q.qty > 1 && <tr><td>× {q.qty} pieces</td><td>{rupee(q.subtotal)}</td></tr>}
                <tr><td>Ekart delivery, Delhi</td><td>{q.shipping ? rupee(q.shipping) : 'Free'}</td></tr>
              </tbody></table>
            </details>
            <div className="order-row">
              <button className="btn primary" disabled={!st.layers.length} onClick={() => setCheckoutOpen(true)}>Order now</button>
            </div>
          </div>
        </aside>
      </main>
      {checkoutOpen && (
        <Checkout store={store} engine={engine.current} total={q.total} onClose={() => setCheckoutOpen(false)} />
      )}
    </div>
  );
}
