'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CartLink from './CartLink';
import Wordmark from './Wordmark';
import { addToCart, cartItem, replaceCartDesign } from '@/lib/cart';
import { isSize, SIZES, ZONE_INFO, ZONES, type SizeId, type Zone } from '@/lib/design';
import { FROM_PRICE, PRICES, quoteItem, rupee } from '@/lib/pricing';
import type { StudioApi, StudioChange } from '@/lib/studio/engine';

const Icon = {
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>,
  rotL: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  rotR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>,
  undo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>,
  move: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" /></svg>,
  eraser: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4-4L14 6l6 6-9 9Z" /><path d="M7 21h13" /><path d="m9 11 6 6" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
};

export default function Studio() {
  const rootRef = useRef<HTMLDivElement>(null);
  const api = useRef<StudioApi | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [design, setDesign] = useState<StudioChange | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [size, setSize] = useState<SizeId | null>(null);
  const [addedSize, setAddedSize] = useState<SizeId | null>(null);
  const sizeDialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  // /studio?edit=<cart item>: the design is opened from the cart and saved back over it
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    let mounted: StudioApi | null = null;
    const edit = new URLSearchParams(window.location.search).get('edit');
    import('@/lib/studio/engine')
      .then(({ mountStudio }) => mountStudio(rootRef.current!, (s) => !gone && setDesign(s)))
      .then(async (a) => {
        if (gone) { a.dispose(); return; }
        mounted = api.current = a;
        if (edit) {
          const it = await cartItem(edit).catch(() => undefined);
          if (gone) return;
          if (it?.design) {
            await a.load(it.design);
            setEditId(it.id);
            setQty(it.qty);
            setSize(isSize(it.size) ? it.size : null);
          } else setAddError('That design is no longer in your cart, so this is a new design.');
        }
        if (!gone) setState('ready');
      })
      .catch(() => !gone && setState('error'));
    return () => {
      gone = true;
      mounted?.dispose();
      api.current = null;
    };
  }, []);

  const prints = design?.prints ?? [];
  const q = quoteItem({ prints, qty });
  const zones = design?.zones ?? [];
  const lowRes = prints.filter((p) => p.type === 'image' && (p.dpi ?? 300) < 120).length;

  // changing the design after adding it means the next click adds a new cart item
  const designKey = design ? design.colour.id + JSON.stringify(design.prints) : '';
  useEffect(() => { setAdded(false); }, [designKey]);

  // the size is asked for when the design is finished, just before it goes in the cart
  function askSize() {
    setAddError(null);
    sizeDialog.current?.showModal();
  }

  async function add() {
    const now = api.current?.summary();
    if (!api.current || !now || !now.prints.length || !size) return;
    sizeDialog.current?.close();
    setAdding(true);
    setAddError(null);
    try {
      const zoneFiles = await api.current.printFiles();
      const files: Record<string, Blob> = { ...(await api.current.previews()) };
      for (const [z, blob] of Object.entries(zoneFiles)) if (blob) files[z] = blob;
      const design = api.current.design();
      if (editId) {
        await replaceCartDesign(editId, { colourId: now.colour.id, size, qty, prints: now.prints, files, design });
        router.push('/cart');
        return;
      }
      await addToCart({ colourId: now.colour.id, size, qty, prints: now.prints, files, design });
      setAddedSize(size);
      setAdded(true);
      setQty(1);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not add this design to the cart.');
    } finally {
      setAdding(false);
    }
  }

  // the same four choices, shown wherever a print is added
  const zonePicker = (label: string) => (
    <div className="zones" role="group" aria-label={label}>
      {ZONES.map((z) => (
        <button key={z} data-zone={z} aria-pressed={z === 'front'}>
          <span>{ZONE_INFO[z].short}</span>
          {zones.includes(z) && <i className="dot" aria-label="has a print" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="studio" ref={rootRef}>
      <section className="stage" id="stage" data-mode="draw">
        <div id="view" aria-label="3D t-shirt preview" />
        {state !== 'ready' && (
          <div className="stage-msg">
            {state === 'loading' ? <span className="loading">Loading the 3D shirt…</span> : 'Your browser could not show the 3D shirt. Try Chrome, or turn on hardware acceleration.'}
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
            <CartLink className="btn cart-btn" />
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
            {zonePicker('Print area')}
            <p className="note">Front, back and the outside of each sleeve. Nothing prints on the sides.</p>
          </div>

          <div className="sec">
            <h2>Shirt colour <small id="colorName">White</small></h2>
            <div className="swatches" id="swatches" />
          </div>

          <div className="sec">
            <h2>Draw <small id="penLabel">Pencil</small></h2>
            <div className="seg pen-seg" role="group" aria-label="Drawing tool">
              <button id="pencil" aria-pressed="true">{Icon.pen}Pencil</button>
              <button id="eraser" aria-pressed="false">{Icon.eraser}Eraser</button>
            </div>
            <div className="inks" id="inks" />
            <div className="row">
              <label className="lbl" htmlFor="penSize">Size</label>
              <input type="range" id="penSize" min="3" max="60" defaultValue="12" />
              <span className="val" id="penSizeVal">12 px</span>
            </div>
            <p className="note">Each time you pick the pencil, your next lines start a new drawing that you can move on its own.</p>
          </div>

          <div className="sec">
            <h2>Text <small>Edits the selected text</small></h2>
            <label className="lbl">Add it to</label>
            {zonePicker('Where the text goes')}
            <input type="text" id="txt" placeholder="Type your text" maxLength={40} aria-label="Text" />
            <div className="row">
              <select id="font" aria-label="Font" />
              <input type="color" className="dot" id="txtColor" defaultValue="#111111" aria-label="Text colour" />
            </div>
            <button className="btn primary" id="addText">Add text</button>
          </div>

          <div className="sec">
            <h2>Image</h2>
            <label className="lbl">Add it to</label>
            {zonePicker('Where the image goes')}
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
                <div className="order-zones">{q.label}</div>
                <div className="order-price">
                  <strong>{rupee(q.each)}</strong>
                  <span>per shirt, delivery from {rupee(PRICES.delivery.base)} added in the cart</span>
                </div>
              </>
            ) : (
              <div className="order-zones">Add a print to see the price. From {rupee(FROM_PRICE)}.</div>
            )}
          </div>
          {lowRes > 0 && <div className="warn">An image is small for its print size and may look soft. Make it smaller for a sharper print.</div>}
          {addError && <div className="err" role="alert">{addError}</div>}
          {added ? (
            <div className="added" role="status">
              <p><strong>Added to your cart{addedSize ? `, ${SIZES.find((s) => s.id === addedSize)?.label}` : ''}.</strong> Change the shirt to make another design, or check out.</p>
              <button className="link-btn" onClick={askSize}>Add this design in another size</button>
              <div className="order-act">
                <button className="btn" onClick={() => { api.current?.startNew(); }}>Start a new design</button>
                <Link href="/cart" className="btn primary">Go to cart</Link>
              </div>
            </div>
          ) : (
            <div className="order-act">
              <div className="qty" role="group" aria-label="Quantity">
                <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="One less">−</button>
                <span aria-live="polite">{qty}</span>
                <button onClick={() => setQty((n) => Math.min(PRICES.maxQty, n + 1))} aria-label="One more">+</button>
              </div>
              <button className="btn primary big" disabled={!prints.length || state !== 'ready' || adding} onClick={askSize}>
                {adding ? (editId ? 'Saving…' : 'Adding…') : editId ? `Save changes · ${rupee(q.subtotal)}` : prints.length ? `Add to cart · ${rupee(q.subtotal)}` : 'Add to cart'}
              </button>
            </div>
          )}
          {editId && !added && <p className="muted edit-note">You are editing a design from your cart. <Link href="/cart">Back to cart without saving</Link></p>}
        </div>
      </aside>

      <dialog ref={sizeDialog} className="notice-dialog size-dialog" aria-labelledby="sizeTitle">
        <h2 id="sizeTitle">Pick a size</h2>
        <div className="size-grid" role="radiogroup" aria-label="Shirt size">
          {SIZES.map((s) => (
            <button key={s.id} data-size={s.id} role="radio" aria-checked={size === s.id} onClick={() => setSize(s.id)}>
              <strong>{s.label}</strong>
              <span>{s.fit}</span>
            </button>
          ))}
        </div>
        <p className="muted">Every size costs the same. To order this design in more than one size, add it once for each size.</p>
        <div className="co-actions">
          <button className="btn ghost" onClick={() => sizeDialog.current?.close()}>Back to design</button>
          <button className="btn primary" disabled={!size || adding} onClick={add}>
            {editId ? 'Save changes' : qty > 1 ? `Add ${qty} to cart` : 'Add to cart'} · {rupee(q.subtotal)}
          </button>
        </div>
      </dialog>
    </div>
  );
}
