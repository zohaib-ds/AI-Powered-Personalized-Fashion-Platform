'use client';

import { useState } from 'react';
import { submitReview } from '@/app/order/actions';

const LABELS = ['', 'Poor', 'Not great', 'Good', 'Great', 'Love it'];

export default function ReviewForm({ orderId, rating = 0, comment = '' }: { orderId: string; rating?: number; comment?: string }) {
  const [n, setN] = useState(rating);
  const [hover, setHover] = useState(0);
  return (
    <form action={submitReview} className="stack">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="rating" value={n || ''} />
      <div className="star-input" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" aria-label={`${i} star${i > 1 ? 's' : ''}`} aria-pressed={n === i}
            className={(hover || n) >= i ? 'on' : ''} onMouseEnter={() => setHover(i)} onClick={() => setN(i)}>★</button>
        ))}
        <span className="muted">{LABELS[hover || n]}</span>
      </div>
      <textarea className="inp" name="comment" rows={5} defaultValue={comment} placeholder="How did the print and the shirt turn out?" maxLength={800} />
      <button className="btn primary" disabled={!n}>{rating ? 'Update review' : 'Send review'}</button>
    </form>
  );
}
