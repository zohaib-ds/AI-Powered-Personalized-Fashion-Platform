'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPickup, requestWithdrawal, saveAccount, type FormResult } from '@/app/printer/actions';
import type { PrinterRow } from '@/lib/supabase-server';

function Result({ r }: { r: FormResult }) {
  if (!r) return null;
  return (
    <>
      {r.ok && <div className="ok" role="status">{r.ok}</div>}
      {r.error && <div className="err" role="alert">{r.error}</div>}
    </>
  );
}

function Submit({ label, busy, className = 'btn primary big', disabled }: { label: string; busy: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending || disabled}>{pending ? busy : label}</button>;
}

export function PickupButton({ id }: { id: string }) {
  return (
    <form action={requestPickup}>
      <input type="hidden" name="id" value={id} />
      <Submit label="Printing done, request pickup" busy="Requesting pickup…" className="btn primary big wide" />
    </form>
  );
}

export function WithdrawForm({ amount, blocked }: { amount: string | null; blocked: string | null }) {
  const [r, action] = useActionState(requestWithdrawal, null);
  return (
    <form action={action} className="stack">
      {blocked ? <p className="muted">{blocked}</p> : null}
      <Submit label={amount ? `Withdraw ${amount}` : 'Withdraw money'} busy="Sending…" disabled={!!blocked} />
      <Result r={r} />
    </form>
  );
}

type Account = Pick<PrinterRow, 'phone' | 'address' | 'city' | 'pincode' | 'account_name' | 'account_number' | 'ifsc' | 'upi_id'>;

export function AccountForm({ p: saved }: { p: Account }) {
  const [r, action] = useActionState(saveAccount, null);
  // after a refusal, show what was typed rather than the saved values
  const p = (r?.values ?? saved) as Account;
  return (
    <form action={action} className="stack account-form">
      <section className="card stack">
        <h3>Pickup address</h3>
        <p className="muted">The courier collects your parcels from here.</p>
        <div className="field"><label htmlFor="phone">Mobile number</label><input className="inp" id="phone" name="phone" inputMode="tel" required defaultValue={p.phone ?? ''} placeholder="10 digits" /></div>
        <div className="field"><label htmlFor="address">Shop address</label><input className="inp" id="address" name="address" required defaultValue={p.address ?? ''} placeholder="Shop number, building, street, area" /></div>
        <div className="two">
          <div className="field"><label htmlFor="city">City</label><input className="inp" id="city" name="city" defaultValue={p.city ?? 'Delhi'} /></div>
          <div className="field"><label htmlFor="pincode">Pincode</label><input className="inp" id="pincode" name="pincode" inputMode="numeric" maxLength={6} required defaultValue={p.pincode ?? ''} /></div>
        </div>
      </section>
      <section className="card stack">
        <h3>Where we send your money</h3>
        <p className="muted">Add a UPI ID, a bank account, or both.</p>
        <div className="field"><label htmlFor="upi_id">UPI ID</label><input className="inp" id="upi_id" name="upi_id" defaultValue={p.upi_id ?? ''} placeholder="name@bank" autoCapitalize="none" /></div>
        <div className="field"><label htmlFor="account_name">Name on the bank account</label><input className="inp" id="account_name" name="account_name" defaultValue={p.account_name ?? ''} /></div>
        <div className="two">
          <div className="field"><label htmlFor="account_number">Account number</label><input className="inp" id="account_number" name="account_number" inputMode="numeric" defaultValue={p.account_number ?? ''} /></div>
          <div className="field"><label htmlFor="ifsc">IFSC code</label><input className="inp code-inp" id="ifsc" name="ifsc" maxLength={11} defaultValue={p.ifsc ?? ''} placeholder="SBIN0001234" /></div>
        </div>
      </section>
      <Result r={r} />
      <Submit label="Save" busy="Saving…" />
    </form>
  );
}
