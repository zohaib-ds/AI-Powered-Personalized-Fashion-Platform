'use client';

import { useActionState } from 'react';
import { printerLogin } from '@/app/printer/actions';

export default function PrinterLogin() {
  const [error, action, pending] = useActionState(printerLogin, null);
  return (
    <form action={action} className="login-card">
      <h1>Merchant portal</h1>
      <p className="muted">Sign in with the login ID and password the WearSketch team gave you to see the shirts waiting for you.</p>
      <div className="field">
        <label htmlFor="login_id">Login ID</label>
        <input className="inp code-inp" id="login_id" name="login_id" required autoComplete="username" autoCapitalize="characters" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="inp" id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
