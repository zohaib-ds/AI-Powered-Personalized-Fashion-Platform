'use client';

import { useActionState } from 'react';
import { createPrinter, resetPrinterPassword, type Credentials } from '@/app/admin/actions';

function Shown({ c, note }: { c: Credentials; note: string }) {
  return (
    <div className="creds" role="status">
      <p><strong>{c.name}</strong>: {note}</p>
      <table className="kv"><tbody>
        <tr><td>Login ID</td><td><code className="access">{c.loginId}</code></td></tr>
        <tr><td>Password</td><td><code className="access">{c.password}</code></td></tr>
      </tbody></table>
      <p className="muted">Copy the password now. It is not shown again. If it gets lost, make a new one.</p>
    </div>
  );
}

export function AddMerchantForm() {
  const [created, action, pending] = useActionState(createPrinter, null);
  return (
    <form action={action} className="card add-printer">
      <h3>Add a merchant</h3>
      <div className="three">
        <div className="field"><label htmlFor="pn">Name</label><input className="inp" id="pn" name="name" required placeholder="Shop name" /></div>
        <div className="field"><label htmlFor="pa">Area</label><input className="inp" id="pa" name="area" placeholder="e.g. Okhla" /></div>
        <div className="field"><label htmlFor="pp">Phone</label><input className="inp" id="pp" name="phone" inputMode="tel" /></div>
      </div>
      <button className="btn primary" disabled={pending}>{pending ? 'Adding…' : 'Add merchant'}</button>
      {created ? <Shown c={created} note="send these to the merchant with the link /printer on this site." /> : <p className="muted">Each merchant gets a login ID and a password to sign in at <strong>/printer</strong>.</p>}
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [made, action, pending] = useActionState(resetPrinterPassword, null);
  return (
    <form action={action} className="reset-pw">
      <input type="hidden" name="id" value={id} />
      <button className="btn small" disabled={pending}>{pending ? 'Making…' : 'New password'}</button>
      {made && <Shown c={made} note="new password made. The old one no longer works." />}
    </form>
  );
}
