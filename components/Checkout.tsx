'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isDelhiPincode, ZONE_INFO } from '@/lib/design';
import { rupee, type Quote } from '@/lib/pricing';
import type { StudioApi, StudioChange } from '@/lib/studio/engine';

interface Props {
  api: StudioApi;
  design: StudioChange;
  qty: number;
  quote: Quote;
  onClose: () => void;
}

interface CreateResponse {
  orderId: string;
  total: number;
  uploads: Record<string, { path: string; signedUrl: string }>;
}

export default function Checkout({ api, design, qty, quote: q, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); if (!busy) onClose(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [busy, onClose]);

  useEffect(() => {
    let url = '';
    api.previews().then(({ preview }) => { url = URL.createObjectURL(preview); setPreview(url); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [api]);

  const lowRes = design.prints.filter((p) => p.type === 'image' && (p.dpi ?? 300) < 120).length;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const customer = Object.fromEntries(['name', 'phone', 'email', 'address', 'pincode'].map((k) => [k, String(f.get(k) || '').trim()]));
    if (!isDelhiPincode(customer.pincode)) {
      setError('We deliver in Delhi only for now. Enter a Delhi pincode (it starts with 110).');
      return;
    }
    try {
      setBusy('Saving your order…');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ design: { colourId: design.colour.id, qty, prints: design.prints }, customer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the order.');
      const order = data as CreateResponse;

      setBusy('Making print files at 300 DPI…');
      const files: Record<string, Blob> = { ...(await api.printFiles()), ...(await api.previews()) };

      setBusy('Uploading print files…');
      for (const [key, blob] of Object.entries(files)) {
        const up = order.uploads[key];
        if (!up || !blob) continue;
        const r = await fetch(up.signedUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'x-upsert': 'true' }, body: blob });
        if (!r.ok) throw new Error('A print file did not upload. Please try again.');
      }

      setBusy('Confirming payment…');
      const pay = await fetch(`/api/orders/${order.orderId}/pay`, { method: 'POST' });
      const payData = await pay.json();
      if (!pay.ok) throw new Error(payData.error || 'Payment failed.');
      router.push(`/order/${order.orderId}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  return (
    <dialog ref={ref} className="checkout" aria-labelledby="coTitle">
      <form onSubmit={submit} className="co-grid">
        <div className="co-summary">
          <div className="co-preview">{preview ? <img src={preview} alt="Your shirt" /> : <span className="spinner" />}</div>
          <table className="lines"><tbody>
            {q.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{rupee(l.amount)}</td></tr>)}
            {qty > 1 && <tr><td>× {qty} shirts</td><td>{rupee(q.subtotal)}</td></tr>}
            <tr><td>Ekart delivery, Delhi</td><td>{rupee(q.shipping)}</td></tr>
            <tr className="total"><td>Total</td><td>{rupee(q.total)}</td></tr>
          </tbody></table>
          <p className="note">{design.colour.name} free-size tee, printed on {design.zones.map((z) => ZONE_INFO[z].label.toLowerCase()).join(', ')}.</p>
        </div>
        <div className="co-form">
          <h2 id="coTitle">Where should we deliver?</h2>
          <p className="muted">We print your shirt in Delhi and Ekart brings it to your door.</p>
          {lowRes > 0 && <div className="warn">One of your images is small for its print size, so it may look soft on the shirt. You can go back and make it smaller.</div>}
          <div className="two">
            <div className="field"><label htmlFor="name">Full name</label><input className="inp" id="name" name="name" required autoComplete="name" /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input className="inp" id="phone" name="phone" required inputMode="tel" pattern="[0-9+ ]{10,14}" autoComplete="tel" placeholder="98xxxxxxxx" /></div>
          </div>
          <div className="field"><label htmlFor="email">Email (optional)</label><input className="inp" id="email" name="email" type="email" autoComplete="email" /></div>
          <div className="field"><label htmlFor="address">Address</label><textarea className="inp" id="address" name="address" required rows={3} autoComplete="street-address" placeholder="House, street, area" /></div>
          <div className="field pin"><label htmlFor="pincode">Pincode</label><input className="inp" id="pincode" name="pincode" required inputMode="numeric" maxLength={6} autoComplete="postal-code" placeholder="110…" /></div>
          <div className="sample-note">Test mode: no money is charged yet. Your order is saved and marked paid so the whole flow can be tried.</div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="co-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>Back to design</button>
            <button type="submit" className="btn primary big" disabled={!!busy}>{busy ?? `Pay ${rupee(q.total)}`}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
