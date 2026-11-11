'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendUtr } from '@/app/order/[id]/actions';
import { BRAND } from '@/lib/brand';

function Submit({ label, className = 'btn primary' }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? 'Sending…' : label}</button>;
}

// Pay by UPI: QR code (made on the server) for the exact amount, a button for UPI apps on phones,
// and I have paid. Tapping it first explains what happens next, so nobody wonders if their money is safe.
// The UPI reference number is asked for only after that.
export default function UpiPay({ orderId, code, amount, qr, link, missing, email }: {
  orderId: string; code: string; amount: string; qr: string; link: string; missing: string | null; email: string | null;
}) {
  const [error, action] = useActionState(sendUtr, null);
  const form = useRef<HTMLFormElement>(null);
  const popup = useRef<HTMLDialogElement>(null);
  const open = () => { if (form.current?.reportValidity()) popup.current?.showModal(); };

  return (
    <section className="card upi-pay" aria-label="Pay by UPI">
      <div className="upi-left">
        <div className="upi-qr" role="img" aria-label={`UPI QR code for ${amount}`} dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="upi-scan">Scan with any UPI app</p>
      </div>
      <div className="upi-body">
        <div className="upi-amount">
          <span>Amount to pay</span>
          <strong>{amount}</strong>
          <span>Order #{code}</span>
        </div>
        <h2>Pay {amount} by UPI</h2>
        <ol className="upi-steps upi-num">
          <li>Scan the QR code with any UPI app, such as Google Pay, PhonePe, Paytm or BHIM. If you are on your phone, tap <strong>Open UPI app</strong> instead.</li>
          <li>Check that the amount is {amount} and pay.</li>
          <li>After your payment is done, tap <strong>I have paid</strong>.</li>
        </ol>
        <a className="btn upi-open" href={link}>Open UPI app</a>
        {missing !== null && <div className="err" role="alert">{missing
          ? `We could not find a payment with reference number ${missing}. Check the number in your UPI app and enter it again.`
          : 'We could not find your payment yet. Enter the 12 digit UPI reference number from your UPI app so we can find it.'}</div>}
        <form action={action} className="upi-form" ref={form}>
          <input type="hidden" name="id" value={orderId} />
          {/* the reference number box shows only after I have paid, or when we could not find the payment */}
          {missing !== null && (
            <>
              <label htmlFor="utr">UPI reference number</label>
              <input id="utr" name="utr" className="inp" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="12 digits" required />
            </>
          )}
          <p className="pay-alert">After your payment is done, tap <strong>I have paid</strong> below so we can confirm your order.</p>
          <button type="button" className="btn primary big paid-btn" onClick={open}>I have paid</button>
          {error && <div className="err" role="alert">{error}</div>}

          <dialog ref={popup} className="notice-dialog paid-dialog" aria-labelledby="paidTitle">
            <h2 id="paidTitle">We will verify your payment</h2>
            <ol className="upi-steps">
              <li>Checking a UPI payment takes up to 24 hours. We match it with our bank account by the amount, {amount}, and your order number, #{code}.</li>
              <li>Once it is verified, your order is confirmed and goes for printing.{email ? ` We email you at ${email}.` : ' This page shows it.'}</li>
              <li>If we cannot find a payment from you, {email ? 'we email you' : 'this page tells you'} and you can send us the UPI reference number from your UPI app. Nothing is printed until your payment is confirmed.</li>
            </ol>
            <p className="muted">Questions? Write to {BRAND.email} and mention order #{code}.</p>
            <div className="co-actions">
              <button type="button" className="btn ghost" onClick={() => popup.current?.close()}>Not yet</button>
              <Submit label="Yes, I have paid" />
            </div>
          </dialog>
        </form>
      </div>
    </section>
  );
}

// Shown once the customer has tapped I have paid: the UPI reference number helps us find the payment faster.
export function AddUtr({ orderId }: { orderId: string }) {
  const [error, action] = useActionState(sendUtr, null);
  return (
    <form action={action} className="upi-form">
      <input type="hidden" name="id" value={orderId} />
      <label htmlFor="utr">UPI reference number <span className="muted">(optional)</span></label>
      <p className="muted">It is the 12 digit number on the payment in your UPI app. Adding it helps us find your payment faster.</p>
      <input id="utr" name="utr" className="inp" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="12 digits" required />
      <Submit label="Send reference number" />
      {error && <div className="err" role="alert">{error}</div>}
    </form>
  );
}
