'use client';

import { useActionState } from 'react';
import { createPrinter, savePrinterDetails, setPrinterLogin, type Credentials, type CredentialsResult } from '@/app/admin/actions';
import type { PrinterRow } from '@/lib/supabase-server';

function Shown({ c, note }: { c: Credentials; note: string }) {
  return (
    <div className="creds" role="status">
      <p><strong>{c.name}</strong>: {note}</p>
      <table className="kv"><tbody>
        <tr><td>Login ID</td><td><code className="access">{c.loginId}</code></td></tr>
        <tr><td>Password</td><td><code className="access">{c.password}</code></td></tr>
      </tbody></table>
      <p className="muted">You can see this password again later with Show password on the merchant card below.</p>
    </div>
  );
}

function Failed({ r }: { r: CredentialsResult }) {
  return r && 'error' in r ? <p className="err" role="alert">{r.error}</p> : null;
}

export function AddMerchantForm() {
  const [created, action, pending] = useActionState(createPrinter, null);
  const v = (created && 'error' in created && created.values) || {};
  return (
    <form action={action} className="card add-printer">
      <h3>Add a merchant</h3>
      <div className="three">
        <div className="field"><label htmlFor="pn">Name</label><input className="inp" id="pn" name="name" required defaultValue={v.name} placeholder="Shop name" /></div>
        <div className="field"><label htmlFor="pa">Area</label><input className="inp" id="pa" name="area" defaultValue={v.area} placeholder="e.g. Okhla" /></div>
        <div className="field"><label htmlFor="pp">Phone</label><input className="inp" id="pp" name="phone" defaultValue={v.phone} inputMode="tel" /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="pl">Login ID</label><input className="inp code-inp" id="pl" name="login_id" required defaultValue={v.login_id} minLength={4} maxLength={30} pattern="[A-Za-z0-9\-]{4,30}" title="Letters, numbers and dashes, 4 to 30 characters" autoCapitalize="characters" autoComplete="off" placeholder="e.g. YADAV-01" /></div>
        <div className="field"><label htmlFor="pw">Password</label><input className="inp" id="pw" name="password" required defaultValue={v.password} minLength={6} maxLength={64} autoComplete="new-password" placeholder="At least 6 characters" /></div>
      </div>
      <button className="btn primary" disabled={pending}>{pending ? 'Adding…' : 'Add merchant'}</button>
      <Failed r={created} />
      {created && 'loginId' in created ? <Shown c={created} note="send these to the merchant with the link /printer on this site." /> : <p className="muted">The merchant signs in at <strong>/printer</strong> with the login ID and password you type here.</p>}
    </form>
  );
}

// Sets a merchant's login ID and password to what the admin types.
export function MerchantLoginForm({ id, loginId }: { id: string; loginId: string }) {
  const [made, action, pending] = useActionState(setPrinterLogin, null);
  const v = (made && 'error' in made && made.values) || {};
  return (
    <details className="more">
      <summary>Change login ID or password</summary>
      <form action={action} className="stack">
        <input type="hidden" name="id" value={id} />
        <div className="two">
          <div className="field"><label htmlFor={`ml-${id}`}>Login ID</label><input className="inp code-inp" id={`ml-${id}`} name="login_id" required defaultValue={v.login_id ?? loginId} minLength={4} maxLength={30} pattern="[A-Za-z0-9\-]{4,30}" title="Letters, numbers and dashes, 4 to 30 characters" autoCapitalize="characters" autoComplete="off" /></div>
          <div className="field"><label htmlFor={`mp-${id}`}>New password</label><input className="inp" id={`mp-${id}`} name="password" defaultValue={v.password} minLength={6} maxLength={64} autoComplete="new-password" placeholder="Leave empty to keep the password" /></div>
        </div>
        <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save login'}</button>
        <Failed r={made} />
        {made && 'loginId' in made && <Shown c={made} note="saved. Send the merchant the new login. A new password signs them out of /printer until they use it." />}
      </form>
    </details>
  );
}

type Details = Pick<PrinterRow, 'id' | 'phone' | 'address' | 'city' | 'pincode' | 'upi_id'>;

// Pickup address and UPI ID, so the admin can fill them in for the merchant.
export function MerchantDetailsForm({ p: saved }: { p: Details }) {
  const [res, action, pending] = useActionState(savePrinterDetails, null);
  // after a refusal, show what was typed rather than the saved values
  const p = res?.values ? { ...saved, ...res.values } : saved;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={p.id} />
      <div className="field"><label htmlFor={`ma-${p.id}`}>Pickup address</label><input className="inp" id={`ma-${p.id}`} name="address" defaultValue={p.address ?? ''} placeholder="Shop number, street and area" /></div>
      <div className="three">
        <div className="field"><label htmlFor={`mc-${p.id}`}>City</label><input className="inp" id={`mc-${p.id}`} name="city" defaultValue={p.city ?? 'Delhi'} /></div>
        <div className="field"><label htmlFor={`mz-${p.id}`}>Pincode</label><input className="inp" id={`mz-${p.id}`} name="pincode" defaultValue={p.pincode ?? ''} inputMode="numeric" maxLength={6} /></div>
        <div className="field"><label htmlFor={`mh-${p.id}`}>Phone</label><input className="inp" id={`mh-${p.id}`} name="phone" defaultValue={p.phone ?? ''} inputMode="tel" /></div>
      </div>
      <div className="field"><label htmlFor={`mu-${p.id}`}>UPI ID for payouts</label><input className="inp" id={`mu-${p.id}`} name="upi_id" defaultValue={p.upi_id ?? ''} placeholder="name@bank" autoCapitalize="none" /></div>
      <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button>
      {res?.ok && <p className="ok" role="status">{res.ok}</p>}
      {res?.error && <p className="err" role="alert">{res.error}</p>}
    </form>
  );
}
