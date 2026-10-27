'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendUtr } from '@/app/order/[id]/actions';

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn primary" disabled={pending}>{pending ? 'Sending…' : 'I have paid'}</button>;
}

// Pay by UPI: QR code (made on the server) for the exact amount, a button for UPI apps on phones,
// and the box for the UPI reference number the admin checks against the bank.
export default function UpiPay({ orderId, amount, qr, link, upiId, payee, missing }: {
  orderId: string; amount: string; qr: string; link: string; upiId: string; payee: string; missing: string | null;
}) {
  const [error, action] = useActionState(sendUtr, null);
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(upiId).then(() => setCopied(true), () => {});

  return (
    <section className="card upi-pay" aria-label="Pay by UPI">
      <div className="upi-qr" role="img" aria-label={`UPI QR code for ${amount}`} dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="upi-body">
        <h2>Pay {amount} by UPI</h2>
        <ol className="upi-steps">
          <li>Scan the QR code with any UPI app, such as Google Pay, PhonePe, Paytm or BHIM. If you are on your phone, tap <strong>Open UPI app</strong> instead.</li>
          <li>Check that the amount is {amount} and pay.</li>
          <li>Find the 12 digit <strong>UPI reference number</strong> (also called UTR or UPI transaction ID) in your UPI app, and enter it below.</li>
        </ol>
        <a className="btn upi-open" href={link}>Open UPI app</a>
        <p className="muted upi-id">
          Paying to <strong>{payee}</strong>, UPI ID <code>{upiId}</code>{' '}
          <button type="button" className="btn small ghost" onClick={copy}>{copied ? 'Copied' : 'Copy UPI ID'}</button>
        </p>
        {missing && <div className="err" role="alert">We could not find a payment with reference number {missing}. Check the number in your UPI app and enter it again.</div>}
        <form action={action} className="upi-form">
          <input type="hidden" name="id" value={orderId} />
          <label htmlFor="utr">UPI reference number</label>
          <div className="upi-row">
            <input id="utr" name="utr" className="inp" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="12 digits" required />
            <Submit />
          </div>
          {error && <div className="err" role="alert">{error}</div>}
        </form>
      </div>
    </section>
  );
}
