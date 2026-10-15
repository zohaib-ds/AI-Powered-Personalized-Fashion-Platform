'use client';

import { useActionState } from 'react';
import { printerLogin } from '@/app/printer/actions';

export default function PrinterLogin() {
  const [error, action, pending] = useActionState(printerLogin, null);
  return (
    <form action={action} className="login-card">
      <h1>Printer portal</h1>
      <p className="muted">Sign in with the access code the WearSketch team gave you to see the shirts waiting for you.</p>
      <div className="field">
        <label htmlFor="code">Access code</label>
        <input className="inp code-inp" id="code" name="code" required autoComplete="one-time-code" autoCapitalize="characters" placeholder="WS-XXXXXX" />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
