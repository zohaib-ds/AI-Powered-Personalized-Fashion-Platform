'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { sendCityRequest } from '@/app/your-city/actions';

export default function CityForm() {
  const [r, action, pending] = useActionState(sendCityRequest, null);
  if (r?.ok) {
    return (
      <div className="card stack" role="status">
        <h2>Thank you</h2>
        <p>We read every request. The cities people ask for most are where we go next.</p>
        <p><Link className="btn" href="/studio">Keep designing</Link></p>
      </div>
    );
  }
  const v = r?.values ?? {};
  return (
    <form action={action} className="card stack city-form">
      <div className="field"><label htmlFor="city">Which city are you in?</label><input className="inp" id="city" name="city" required maxLength={80} autoComplete="address-level2" defaultValue={v.city} placeholder="e.g. Jaipur" /></div>
      <div className="field"><label htmlFor="why">Why do you want WearSketch in your city?</label><textarea className="inp" id="why" name="why" required rows={4} maxLength={600} defaultValue={v.why} /></div>
      <div className="field"><label htmlFor="liked">What did you find amazing about WearSketch? <span className="muted">(optional)</span></label><textarea className="inp" id="liked" name="liked" rows={4} maxLength={600} defaultValue={v.liked} /></div>
      <div className="field"><label htmlFor="email">Email <span className="muted">(optional)</span></label><input className="inp" id="email" name="email" type="email" maxLength={160} autoComplete="email" defaultValue={v.email} /><span className="muted field-note">We email you once we deliver to your city. Nothing else.</span></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {r?.error && <div className="err" role="alert">{r.error}</div>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Sending…' : 'Send'}</button>
    </form>
  );
}
