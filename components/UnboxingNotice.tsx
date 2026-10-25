'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

// Shown once, right after an order is placed: asks the customer to film opening the parcel.
export default function UnboxingNotice({ orderId }: { orderId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const key = `ws-unboxing-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { /* storage blocked: still show it */ }
    ref.current?.showModal();
  }, [orderId]);
  return (
    <dialog ref={ref} className="notice-dialog" aria-labelledby="unboxTitle">
      <h2 id="unboxTitle">Record a video when you open your parcel</h2>
      <p>When your shirt arrives, please record a video while you open the parcel, from the sealed package to the shirt.</p>
      <p className="muted">If anything is damaged, missing or wrong, send us the video within 3 days of delivery with your order number. We may not be able to accept such a claim without it. <Link href="/policies#unboxing">Read the policy</Link>.</p>
      <div className="co-actions">
        <button type="button" className="btn primary" autoFocus onClick={() => ref.current?.close()}>OK, I will record it</button>
      </div>
    </dialog>
  );
}
