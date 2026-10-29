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
          <li>Tap <strong>I have paid</strong>. We match your payment to this order and confirm it. Adding the 12 digit UPI reference number from your UPI app helps us find it faster, but you can leave it empty.</li>
        </ol>
        <a className="btn upi-open" href={link}>Open UPI app</a>
        <p className="muted upi-id">
          Paying to <strong>{payee}</strong>, UPI ID <code>{upiId}</code>{' '}
          <button type="button" className="btn small ghost" onClick={copy}>{copied ? 'Copied' : 'Copy UPI ID'}</button>
        </p>
        {missing !== null && <div className="err" role="alert">{missing
          ? `We could not find a payment with reference number ${missing}. Check the number in your UPI app and enter it again.`
          : 'We could not find your payment yet. Enter the 12 digit UPI reference number from your UPI app so we can find it.'}</div>}
        <form action={action} className="upi-form">
          <input type="hidden" name="id" value={orderId} />
          <label htmlFor="utr">UPI reference number{missing === null && <span className="muted"> (optional)</span>}</label>
          <div className="upi-row">
            <input id="utr" name="utr" className="inp" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="12 digits" required={missing !== null} />
            <Submit />
          </div>
          {error && <div className="err" role="alert">{error}</div>}
        </form>
      </div>
    </section>
  );
}
