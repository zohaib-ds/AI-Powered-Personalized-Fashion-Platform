'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isDelhiPincode, type Side } from '@/lib/design';
import { rupee } from '@/lib/pricing';
import type { Studio as Engine } from '@/lib/studio/engine';
import { renderPrintFile } from '@/lib/studio/paint';
import { summarise, type StudioStore } from '@/lib/studio/store';

interface Props {
  store: StudioStore;
  engine: Engine | null;
  total: number;
  onClose: () => void;
}

interface CreateResponse {
  orderId: string;
  total: number;
  uploads: Record<string, { path: string; signedUrl: string }>;
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the print file.'))), 'image/png'));

export default function Checkout({ store, engine, total, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); if (!busy) onClose(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [busy, onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const customer = {
      name: String(f.get('name') || '').trim(),
      phone: String(f.get('phone') || '').trim(),
      email: String(f.get('email') || '').trim(),
      address: String(f.get('address') || '').trim(),
      pincode: String(f.get('pincode') || '').trim(),
    };
    if (!isDelhiPincode(customer.pincode)) {
      setError('We deliver in Delhi only for now. Enter a Delhi pincode (it starts with 110).');
      return;
    }
    try {
      setBusy('Creating your order…');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ design: summarise(store), customer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the order.');
      const order = data as CreateResponse;

      setBusy('Preparing print files at 300 DPI…');
      const files: Record<string, Blob> = {};
      for (const side of ['front', 'back'] as Side[]) {
        const c = renderPrintFile(store.state.layers, side, 300);
        if (c) files[side] = await toBlob(c);
      }
      if (engine) files.preview = await (await fetch(engine.snapshot())).blob();

      setBusy('Uploading print files…');
      for (const [key, blob] of Object.entries(files)) {
        const up = order.uploads[key];
        if (!up) continue;
        const r = await fetch(up.signedUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'x-upsert': 'true' }, body: blob });
        if (!r.ok) throw new Error(`Upload failed for the ${key} file. Please try again.`);
      }

      setBusy('Confirming payment…');
      const pay = await fetch(`/api/orders/${order.orderId}/pay`, { method: 'POST' });
      const payData = await pay.json();
      if (!pay.ok) throw new Error(payData.error || 'Payment failed.');
      router.push(`/order/${order.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  return (
    <dialog ref={ref} className="sheet-dlg" aria-labelledby="coTitle">
      <form className="dlg" onSubmit={submit}>
        <h3 id="coTitle">Delivery details</h3>
        <p>We print your shirt in Delhi and Ekart delivers it to your door.</p>
        <div className="two">
          <div className="field"><label htmlFor="name">Full name</label><input className="inp" id="name" name="name" required autoComplete="name" /></div>
          <div className="field"><label htmlFor="phone">Phone</label><input className="inp" id="phone" name="phone" required inputMode="tel" pattern="[0-9+ ]{10,14}" autoComplete="tel" /></div>
        </div>
        <div className="field"><label htmlFor="email">Email (optional)</label><input className="inp" id="email" name="email" type="email" autoComplete="email" /></div>
        <div className="field"><label htmlFor="address">Address</label><textarea className="inp" id="address" name="address" required rows={3} autoComplete="street-address" /></div>
        <div className="field" style={{ maxWidth: 200 }}><label htmlFor="pincode">Pincode</label><input className="inp" id="pincode" name="pincode" required inputMode="numeric" maxLength={6} autoComplete="postal-code" /></div>
        <div className="sample-note">Sample payment: no money is charged yet. The order is saved and marked paid so the whole flow can be tested.</div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>Back to design</button>
          <button type="submit" className="btn primary" disabled={!!busy}>{busy ?? `Pay ${rupee(total)} (sample)`}</button>
        </div>
      </form>
    </dialog>
  );
}
