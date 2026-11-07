'use client';
import Link from 'next/link';
import { useState } from 'react';
import { deliveryFee, PRICES, rupee } from '@/lib/pricing';

// Home page price check. It only reads the same price table the studio and checkout use.
const AREA_LABELS = ['1 area', '2 areas', '3 areas', 'All 4'];

export default function PriceCalc() {
  const [areas, setAreas] = useState(1);
  const [qty, setQty] = useState(1);
  const each = PRICES.byAreas[areas - 1];
  const delivery = deliveryFee(qty);
  return (
    <div className="calc">
      <div className="calc-row">
        <span className="calc-lbl" id="calc-areas">Printed areas</span>
        <div className="calc-seg" role="radiogroup" aria-labelledby="calc-areas">
          {AREA_LABELS.map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={areas === i + 1} onClick={() => setAreas(i + 1)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="calc-row">
        <span className="calc-lbl" id="calc-qty">Shirts</span>
        <div className="calc-qty" aria-labelledby="calc-qty">
          <button type="button" aria-label="One shirt less" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
          <output aria-live="polite">{qty}</output>
          <button type="button" aria-label="One shirt more" disabled={qty >= PRICES.maxQty} onClick={() => setQty(qty + 1)}>+</button>
        </div>
      </div>
      <table className="calc-sum">
        <tbody>
          <tr><td>{qty} × {rupee(each)}</td><td>{rupee(each * qty)}</td></tr>
          <tr><td>Delivery</td><td>{rupee(delivery)}</td></tr>
          <tr className="calc-total"><td>Total</td><td>{rupee(each * qty + delivery)}</td></tr>
        </tbody>
      </table>
      <p className="calc-note">Every size costs the same. Cash on delivery adds {rupee(PRICES.codFee)}.</p>
      <Link href="/studio" className="btn primary big calc-cta">Start designing</Link>
    </div>
  );
}
