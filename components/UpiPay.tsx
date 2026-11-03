'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendUtr } from '@/app/order/[id]/actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn primary" disabled={pending}>{pending ? 'Sending…' : label}</button>;
}

// Pay by UPI: QR code (made on the server) for the exact amount, a button for UPI apps on phones,
// and I have paid. The UPI reference number is asked for only after that.
export default function UpiPay({ orderId, amount, qr, link, missing }: {
  orderId: string; amount: string; qr: string; link: string; missing: string | null;
}) {
  const [error, action] = useActionState(sendUtr, null);

  return (
    <section className="card upi-pay" aria-label="Pay by UPI">
      <div className="upi-qr" role="img" aria-label={`UPI QR code for ${amount}`} dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="upi-body">
        <h2>Pay {amount} by UPI</h2>
        <ol className="upi-steps">
          <li>Scan the QR code with any UPI app, such as Google Pay, PhonePe, Paytm or BHIM. If you are on your phone, tap <strong>Open UPI app</strong> instead.</li>
          <li>Check that the amount is {amount} and pay.</li>
          <li>Come back here and tap <strong>I have paid</strong>.</li>
        </ol>
        <a className="btn upi-open" href={link}>Open UPI app</a>
        {missing !== null && <div className="err" role="alert">{missing
          ? `We could not find a payment with reference number ${missing}. Check the number in your UPI app and enter it again.`
          : 'We could not find your payment yet. Enter the 12 digit UPI reference number from your UPI app so we can find it.'}</div>}
        <form action={action} className="upi-form">
          <input type="hidden" name="id" value={orderId} />
          {/* the reference number box shows only after I have paid, or when we could not find the payment */}
          {missing !== null && (
            <>
              <label htmlFor="utr">UPI reference number</label>
              <input id="utr" name="utr" className="inp" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="12 digits" required />
            </>
          )}
          <Submit label="I have paid" />
          {error && <div className="err" role="alert">{error}</div>}
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
