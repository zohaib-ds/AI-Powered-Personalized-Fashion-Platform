'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Checkout from './Checkout';
import Wordmark from './Wordmark';
import { ZONE_INFO, ZONES, type Zone } from '@/lib/design';
import { FROM_PRICE, PRICES, quote, rupee } from '@/lib/pricing';
import type { StudioApi, StudioChange } from '@/lib/studio/engine';

const Icon = {
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>,
  rotL: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  rotR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>,
  undo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>,
  move: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
};

export default function Studio() {
  const rootRef = useRef<HTMLDivElement>(null);
  const api = useRef<StudioApi | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [design, setDesign] = useState<StudioChange | null>(null);
  const [qty, setQty] = useState(1);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    let gone = false;
    let mounted: StudioApi | null = null;
    import('@/lib/studio/engine')
      .then(({ mountStudio }) => mountStudio(rootRef.current!, (s) => !gone && setDesign(s)))
      .then((a) => {
        if (gone) { a.dispose(); return; }
        mounted = api.current = a;
        setState('ready');
      })
      .catch(() => !gone && setState('error'));
    return () => {
      gone = true;
      mounted?.dispose();
      api.current = null;
    };
  }, []);

  const prints = design?.prints ?? [];
  const q = quote({ prints, qty });
  const zones = design?.zones ?? [];

  return (
    <div className="studio" ref={rootRef}>
      <section className="stage" id="stage" data-mode="draw">
        <div id="view" aria-label="3D t-shirt preview" />
        {state !== 'ready' && (
          <div className="stage-msg">
            {state === 'loading' ? <><span className="spinner" />Loading your shirt…</> : 'Your browser could not show the 3D shirt. Try Chrome, or turn on hardware acceleration.'}
          </div>
        )}
        <div className="top">
          <div className="brand">
            <Link href="/" className="brand-link" aria-label="WearSketch home"><Wordmark /></Link>
            <p className="hint" id="hint">Sketch inside the dashed print areas. Switch to Move to drag or resize what you made.</p>
          </div>
          <div className="top-actions">
            <div className="seg" role="group" aria-label="View">
              <button id="vFront" aria-pressed="true">Front</button>
              <button id="vBack" aria-pressed="false">Back</button>
            </div>
            <button className="icon-btn" id="save" title="Download pictures of your shirt" aria-label="Download pictures of your shirt">{Icon.download}</button>
          </div>
        </div>
        <div className="selbar" id="selBar" hidden role="group" aria-label="Selected print">
          <button id="barMinus" aria-label="Make smaller">&minus;</button>
          <span id="barSize" className="barval">100%</span>
          <button id="barPlus" aria-label="Make bigger">+</button>
          <span className="sep" />
          <button id="barRotL" aria-label="Rotate left">{Icon.rotL}</button>
          <button id="barRotR" aria-label="Rotate right">{Icon.rotR}</button>
          <span className="sep" />
          <button id="barDel" aria-label="Delete" className="del">{Icon.trash}</button>
        </div>
        <div className="toast" id="toast" hidden role="status" />
        <div className="dock">
          <button className="icon-btn" id="undo" title="Undo" aria-label="Undo">{Icon.undo}</button>
          <div className="seg" role="group" aria-label="Tool">
            <button data-mode="rotate" aria-pressed="false">{Icon.rotR}Turn</button>
            <button data-mode="move" aria-pressed="false">{Icon.move}Move</button>
            <button data-mode="draw" aria-pressed="true">{Icon.pen}Draw</button>
          </div>
        </div>
      </section>

      <aside className="rail">
        <div className="rail-scroll">
          <div className="sec">
            <h2>Print on <small id="zoneSize" /></h2>
            <div className="zones" role="group" aria-label="Print area">
              {ZONES.map((z) => (
                <button key={z} data-zone={z} aria-pressed={z === 'front'}>
                  <span>{ZONE_INFO[z].short}</span>
                  {zones.includes(z) && <i className="dot" aria-label="has a print" />}
                </button>
              ))}
            </div>
            <p className="note">Front, back and the outside of each sleeve. Nothing prints on the sides.</p>
          </div>

          <div className="sec">
            <h2>Shirt colour <small id="colorName">White</small></h2>
            <div className="swatches" id="swatches" />
          </div>

          <div className="sec">
            <h2>Pen <small id="penLabel">Ink</small></h2>
            <div className="inks" id="inks" />
            <div className="row">
              <label className="lbl" htmlFor="penSize">Size</label>
              <input type="range" id="penSize" min="3" max="60" defaultValue="12" />
              <span className="val" id="penSizeVal">12 px</span>
            </div>
            <div className="row">
              <button className="btn" id="eraser" aria-pressed="false">Eraser</button>
              <button className="btn" id="newDrawing">New drawing</button>
            </div>
          </div>

          <div className="sec">
            <h2>Text <small>Edits the selected text</small></h2>
            <input type="text" id="txt" placeholder="Type your text" maxLength={40} aria-label="Text" />
            <div className="row">
              <select id="font" aria-label="Font" />
              <input type="color" className="dot" id="txtColor" defaultValue="#111111" aria-label="Text colour" />
            </div>
            <button className="btn primary" id="addText">Add text</button>
          </div>

          <div className="sec">
            <h2>Image</h2>
            <label className="drop" id="drop">
              <input type="file" id="file" accept="image/*" />
              <strong>Upload an image</strong><br />PNG with a transparent background prints best
            </label>
          </div>

          <div className="sec">
            <h2>Selected print <small id="selKind" /></h2>
            <p className="empty" id="selEmpty">Pick <strong>Move</strong>, then tap any text, image or drawing on the shirt. Drag it to move it, drag a corner dot or use − and + to resize. Two fingers also resize and rotate.</p>
            <div id="selCtl" hidden className="sel-ctl">
              <div className="row">
                <label className="lbl" htmlFor="selSize">Size</label>
                <input type="range" id="selSize" min="8" max="500" defaultValue="100" />
                <span className="val" id="selSizeVal">100%</span>
              </div>
              <div className="row">
                <label className="lbl" htmlFor="selRot">Rotate</label>
                <input type="range" id="selRot" min="-180" max="180" defaultValue="0" />
                <span className="val" id="selRotVal">0°</span>
              </div>
              <p className="quality" id="selQuality" />
              <div className="row">
                <button className="btn" id="centreIt">Centre</button>
                <button className="btn" id="toFront">Bring to front</button>
                <button className="btn danger" id="del">Delete</button>
              </div>
            </div>
          </div>

          <div className="sec">
            <h2>Your shirt</h2>
            <p className="empty">Your design is kept in this browser automatically. The download button saves a picture of your shirt from four sides.</p>
            <button className="btn danger" id="reset">Start over</button>
          </div>
        </div>

        <div className="order-bar">
          <div className="order-lines">
            {prints.length ? (
              <>
                <div className="order-zones">{zones.map((z) => ZONE_INFO[z as Zone].short).join(' + ')}</div>
                <div className="order-price">
                  <strong>{rupee(q.each)}</strong>
                  <span>per shirt · + {rupee(PRICES.delivery)} Ekart delivery</span>
                </div>
              </>
            ) : (
              <div className="order-zones">Add a print to see the price. From {rupee(FROM_PRICE)}.</div>
            )}
          </div>
          <div className="order-act">
            <div className="qty" role="group" aria-label="Quantity">
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="One less">−</button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty((n) => Math.min(PRICES.maxQty, n + 1))} aria-label="One more">+</button>
            </div>
            <button className="btn primary big" disabled={!prints.length || state !== 'ready'} onClick={() => setCheckout(true)}>
              {prints.length ? `Order · ${rupee(q.total)}` : 'Order'}
            </button>
          </div>
        </div>
      </aside>

      {checkout && design && api.current && (
        <Checkout api={api.current} design={design} qty={qty} quote={q} onClose={() => setCheckout(false)} />
      )}
    </div>
  );
}
