'use client';

import { useActionState } from 'react';
import { adminLogin } from '@/app/admin/login/actions';

export default function AdminLogin({ note }: { note: string | null }) {
  const [error, action, pending] = useActionState(adminLogin, null);
  return (
    <form action={action} className="login-card">
      <h1>Admin</h1>
      <p className="muted">Sign in with the admin password set in Vercel. You are signed out after 10 minutes without activity.</p>
      {note && !error && <div className="warn" role="status">{note}</div>}
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="inp" id="password" name="password" type="password" required autoFocus autoComplete="current-password" />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
