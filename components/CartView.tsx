'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartItems, clearCart, copyCartItem, removeFromCart, setCartQty, setCartSize, type CartItem } from '@/lib/cart';
import { ADDRESS_FIELDS, COLOURS, isDelhiPincode, isMobile, isSize, mobileDigits, SIZES, type Address } from '@/lib/design';
import { PRICES, quoteOrder, rupee } from '@/lib/pricing';

interface CreateResponse {
  orderId: string;
  total: number;
  uploads: Record<string, { path: string; signedUrl: string }>;
  payment: 'upi' | 'sample';
}

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

export default function CartView({ upi }: { upi: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const notice = useRef<HTMLDialogElement>(null);
  const formTop = useRef<HTMLHeadingElement>(null);

  const load = () => cartItems().then(setItems).catch((e) => { setItems([]); setLoadError(e instanceof Error ? e.message : 'Could not open your cart.'); });
  useEffect(() => { load(); }, []);

  // pictures of each design, from the files saved with it
  const previews = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items ?? []) if (it.files.preview) m[it.id] = URL.createObjectURL(it.files.preview);
    return m;
  }, [items]);
  useEffect(() => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)), [previews]);

  if (items === null) return <p className="loading">Opening your cart…</p>;

  const q = quoteOrder(items);

  async function changeQty(it: CartItem, n: number) {
    const qty = Math.min(PRICES.maxQty, Math.max(1, n));
    if (qty === it.qty) return;
    await setCartQty(it.id, qty);
    await load();
  }
  async function changeSize(it: CartItem, v: string) {
    if (!isSize(v)) return;
    await setCartSize(it.id, v);
    await load();
  }
  async function copy(it: CartItem) {
    await copyCartItem(it.id);
    await load();
  }
  async function remove(it: CartItem) {
    await removeFromCart(it.id);
    await load();
  }

  function goToDetails() {
    notice.current?.close();
    setStep('details');
    requestAnimationFrame(() => formTop.current?.scrollIntoView({ block: 'start' }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!items?.length) return;
    setError(null);
    const f = new FormData(e.currentTarget);
    const address = Object.fromEntries(ADDRESS_FIELDS.map((a) => [a.key, String(f.get(a.key) || '').trim()])) as unknown as Address;
    const customer = { name: String(f.get('name') || '').trim(), phone, email: String(f.get('email') || '').trim(), address };
    if (!isMobile(phone)) { setError('Enter a 10-digit mobile number, without +91 or a leading 0.'); return; }
    if (!isDelhiPincode(address.pincode)) { setError('We deliver only in Delhi for now. Enter a pincode that starts with 110.'); return; }
    try {
      setBusy('Saving your order…');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: items.map((i) => ({ colourId: i.colourId, size: i.size ?? 'free', qty: i.qty, prints: i.prints })), customer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the order.');
      const order = data as CreateResponse;

      setBusy('Uploading print files…');
      const puts = items.flatMap((it, i) => Object.entries(it.files).map(([key, blob]) => {
        const up = order.uploads[`${i}:${key}`];
        return up ? fetch(up.signedUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'x-upsert': 'true' }, body: blob }) : null;
      }));
      // all files at once, which is much quicker than one after another
      const done = await Promise.all(puts);
      if (done.some((r) => r && !r.ok)) throw new Error('A print file did not upload. Please try again.');

      // with UPI the customer pays on the order page; the sample provider approves straight away
      if (order.payment !== 'upi') {
        setBusy('Confirming payment…');
        const pay = await fetch(`/api/orders/${order.orderId}/pay`, { method: 'POST' });
        const payData = await pay.json();
        if (!pay.ok) throw new Error(payData.error || 'Payment failed.');
      }
      await clearCart().catch(() => {});
      router.push(`/order/${order.orderId}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  if (!items.length) {
    return (
      <div className="cart-empty">
        {loadError && <div className="err">{loadError}</div>}
        <p className="lead">Your cart is empty. Designs you add from the studio show up here.</p>
        <Link href="/studio" className="btn primary big">Open the studio</Link>
      </div>
    );
  }

  return (
    <div className="cart-grid">
      <div>
        <ul className="cart-list">
          {items.map((it, i) => {
            const iq = q.items[i];
            const colour = COLOURS.find((c) => c.id === it.colourId);
            return (
              <li key={it.id} className="cart-item">
                <div className="ci-img">{previews[it.id] ? <img src={previews[it.id]} alt={`Design ${i + 1}`} /> : null}</div>
                <div className="ci-main">
                  <strong>Design {i + 1}</strong>
                  <span className="muted">{colour?.name ?? it.colourId} tee · {iq.label}, {rupee(iq.each)} each</span>
                  <label className="ci-size">
                    <span>Size</span>
                    <select value={it.size ?? 'free'} onChange={(e) => changeSize(it, e.target.value)} disabled={!!busy || step === 'details'} aria-label={`Size of design ${i + 1}`}>
                      {SIZES.map((s) => <option key={s.id} value={s.id}>{s.id === 'free' ? s.label : `${s.label} (${s.fit.toLowerCase()})`}</option>)}
                    </select>
                  </label>
                  <span className="ci-links">
                    {step === 'cart' && items.length < PRICES.maxItems && <button className="link-btn" onClick={() => copy(it)} disabled={!!busy}>Add another size</button>}
                    <button className="link-btn" onClick={() => remove(it)} disabled={!!busy}>Remove</button>
                  </span>
                </div>
                <div className="qty" role="group" aria-label={`Quantity of design ${i + 1}`}>
                  <button onClick={() => changeQty(it, it.qty - 1)} aria-label="One less" disabled={!!busy || step === 'details'}>−</button>
                  <span aria-live="polite">{it.qty}</span>
                  <button onClick={() => changeQty(it, it.qty + 1)} aria-label="One more" disabled={!!busy || step === 'details'}>+</button>
                </div>
                <div className="ci-price">{rupee(iq.subtotal)}</div>
              </li>
            );
          })}
        </ul>
        {items.length < PRICES.maxItems && step === 'cart' && <p><Link href="/studio">Add another design</Link></p>}

        {step === 'details' && (
          <form onSubmit={submit} className="checkout-form">
            <h2 ref={formTop}>Delivery details</h2>
            <div className="two">
              <div className="field"><label htmlFor="name">Full name</label><input className="inp" id="name" name="name" required autoComplete="name" maxLength={120} /></div>
              <div className="field">
                <label htmlFor="phone">Mobile number</label>
                <div className="phone-inp"><span>+91</span>
                  <input className="inp" id="phone" name="phone" required inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}"
                    title="10-digit mobile number" placeholder="98xxxxxxxx" value={phone} onChange={(e) => setPhone(mobileDigits(e.target.value))} />
                </div>
              </div>
            </div>
            <div className="field"><label htmlFor="email">Email (optional)</label><input className="inp" id="email" name="email" type="email" autoComplete="email" maxLength={160} /></div>
            <div className="addr-grid">
              {ADDRESS_FIELDS.map((a) => (
                <div key={a.key} className={`field f-${a.key}`}>
                  <label htmlFor={a.key}>{a.label}</label>
                  {a.key === 'pincode' ? (
                    <input className="inp" id="pincode" name="pincode" required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}"
                      title="6-digit pincode" value={pincode} onChange={(e) => setPincode(digits(e.target.value, 6))} />
                  ) : (
                    <input className="inp" id={a.key} name={a.key} required={a.required} maxLength={a.max} placeholder={a.placeholder}
                      autoComplete={a.key === 'city' ? 'address-level2' : a.key === 'house' ? 'address-line1' : a.key === 'building' ? 'address-line2' : 'off'} />
                  )}
                </div>
              ))}
            </div>
            {upi
              ? <p className="muted">After you place the order, the next page shows a UPI QR code for the exact amount. Pay with any UPI app.</p>
              : <div className="sample-note">Test mode: no money is charged yet. Your order is saved and marked paid so the whole flow can be tried.</div>}
            {error && <div className="err" role="alert">{error}</div>}
            <div className="co-actions">
              <button type="button" className="btn ghost" onClick={() => { setStep('cart'); setError(null); }} disabled={!!busy}>Back to cart</button>
              <button type="submit" className="btn primary big" disabled={!!busy}>{busy ?? `Place order · ${rupee(q.total)}`}</button>
            </div>
          </form>
        )}
      </div>

      <aside className="cart-sum">
        <h2>Summary</h2>
        <table className="lines"><tbody>
          <tr><td>{q.shirts} shirt{q.shirts > 1 ? 's' : ''}</td><td>{rupee(q.subtotal)}</td></tr>
          <tr><td>Delivery</td><td>{rupee(q.shipping)}</td></tr>
          <tr className="total"><td>Total</td><td>{rupee(q.total)}</td></tr>
        </tbody></table>
        <p className="note">Delivery is {rupee(PRICES.delivery.base)} for up to {PRICES.delivery.perShirts} shirts, then {rupee(PRICES.delivery.step)} more for every {PRICES.delivery.perShirts} shirts after that.</p>
        {step === 'cart' && <button className="btn primary big" onClick={() => notice.current?.showModal()}>Checkout</button>}
      </aside>

      <dialog ref={notice} className="notice-dialog" aria-labelledby="noticeTitle">
        <h2 id="noticeTitle">We deliver only in Delhi for now</h2>
        <p>Right now we can print and deliver orders only to addresses in Delhi, with a pincode that starts with 110. If your address is in Delhi, continue to checkout.</p>
        <p className="muted">Not in Delhi? Your designs stay saved in this browser.</p>
        <div className="co-actions">
          <button className="btn ghost" onClick={() => notice.current?.close()}>Back to cart</button>
          <button className="btn primary" onClick={goToDetails}>My address is in Delhi</button>
        </div>
      </dialog>
    </div>
  );
}
