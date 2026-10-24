'use client';

import { useActionState } from 'react';
import { trackOrder } from '@/app/order/actions';
import { mobileDigits } from '@/lib/design';

export default function TrackForm() {
  const [error, action, pending] = useActionState(trackOrder, null);
  return (
    <form action={action} className="card stack track-form">
      <div className="field"><label htmlFor="code">Order number</label><input className="inp code-inp" id="code" name="code" required placeholder="e.g. 3F9A12BC" maxLength={9} autoCapitalize="characters" /></div>
      <div className="field"><label htmlFor="phone">Mobile number</label><input className="inp" id="phone" name="phone" required inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" title="10-digit mobile number" onInput={(e) => { e.currentTarget.value = mobileDigits(e.currentTarget.value); }} /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Looking…' : 'Find my order'}</button>
    </form>
  );
}
