import Link from 'next/link';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import UnboxingNotice from '@/components/UnboxingNotice';
import UpiPay from '@/components/UpiPay';
import { shirtName } from '@/lib/design';
import { upiLink, upiOn, upiPayee, UTR_MISSING, UTR_SENT } from '@/lib/payments';
import { rupee } from '@/lib/pricing';
import { addressText, JOURNEY, journeyIndex, orderItems, signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type ReviewRow } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order · WearSketch', robots: { index: false } };

const STEP_TEXT: Record<string, string> = {
  paid: 'Order placed',
  sent_to_printer: 'Printing',
  printed: 'Printed',
  shipped: 'On the way',
  delivered: 'Delivered',
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const fresh = (await searchParams).new === '1';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const o = data as OrderRow;
  const { data: rv } = await db.from('reviews').select('*').eq('order_id', id).maybeSingle();
  const review = rv as ReviewRow | null;
  const items = orderItems(o);
  const links = await signedLinks(db, items.flatMap((it) => [it.files.views, it.files.preview]).filter(Boolean));
  const at = journeyIndex(o.status);
  const canReview = ['printed', 'pickup_requested', 'shipped', 'delivered'].includes(o.status);
  const code = o.code ?? o.id.slice(0, 8).toUpperCase();
  // pay by UPI: a QR code until the customer sends the UPI reference, then a note while we check it
  const upi = o.status === 'pending_payment' && upiOn();
  const utrSent = upi && o.payment_ref?.startsWith(UTR_SENT) ? o.payment_ref.slice(UTR_SENT.length) : null;
  const utrMissing = o.payment_ref?.startsWith(UTR_MISSING) ? o.payment_ref.slice(UTR_MISSING.length) : null;
  const link = upi && !utrSent ? upiLink(code, o.total) : null;
  const qr = link ? await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }) : null;
  const payee = upiPayee();
  const heading = o.status === 'pending_payment'
    ? (utrSent ? 'We are checking your payment' : upi ? `Pay ${rupee(o.total)} to confirm your order` : 'Your order is waiting for payment')
    : o.status === 'cancelled' ? 'This order was cancelled' : fresh ? 'Thank you. Your order is in.' : STEP_TEXT[JOURNEY[at]] ?? STATUS_LABEL[o.status];

  return (
    <>
      <SiteHeader />
      {fresh && o.status !== 'pending_payment' && o.status !== 'cancelled' && <UnboxingNotice orderId={o.id} />}
      <main className="wrap page-narrow">
        <div className="order-hero">
          <div>
            <p className="eyebrow">Order #{code}</p>
            <h1>{heading}</h1>
            <p className="muted">Keep this page. It updates as your shirt is printed and shipped. You can also find it any time from <Link href="/track">Track order</Link> with #{code} and your phone number.</p>
          </div>
        </div>

        {qr && link && <UpiPay orderId={o.id} amount={rupee(o.total)} qr={qr} link={link} upiId={payee.id} payee={payee.name} missing={utrMissing} />}
        {utrSent && (
          <div className="card">
            <h3>Payment sent for checking</h3>
            <p className="muted">You gave UPI reference number {utrSent}. We check every payment against our bank account and start printing once it is confirmed. This page updates when it is.</p>
          </div>
        )}

        {at >= 0 && (
          <ol className="journey" aria-label="Order progress">
            {JOURNEY.map((s, i) => (
              <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>
                <span className="j-dot" />
                <span className="j-text">{STEP_TEXT[s]}</span>
                {s === 'shipped' && o.tracking && i <= at && <span className="j-sub">Tracking {o.tracking}</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="order-cols">
          {items.map((it, i) => {
            const pic = (it.files.views && links[it.files.views]) || (it.files.preview && links[it.files.preview]);
            return (
              <div key={i} className="card flush order-item">
                {pic ? <img className="views" src={pic} alt={`Design ${i + 1} from four sides`} /> : null}
                <div className="oi-body">
                  <strong>{items.length > 1 ? `Design ${i + 1}: ` : ''}{shirtName(it.colourId, it.size)} × {it.qty}</strong>
                  <span className="muted">{it.label}{it.each ? `, ${rupee(it.each)} each` : ''}</span>
                </div>
              </div>
            );
          })}
          <div className="card">
            <h3>Your order</h3>
            <table className="kv"><tbody>
              <tr><td>Shirts</td><td>{o.qty}</td></tr>
              <tr><td>Shirts total</td><td>{rupee(o.price.subtotal)}</td></tr>
              <tr><td>Delivery</td><td>{rupee(o.price.shipping)}</td></tr>
              <tr className="total"><td>Total</td><td>{rupee(o.total)}{o.payment_ref?.startsWith('SAMPLE') ? ' (test payment)' : ''}</td></tr>
              <tr><td>Deliver to</td><td>{o.customer_name}, {addressText(o)}, {o.pincode}</td></tr>
            </tbody></table>
          </div>
        </div>

        <div className="card">
          <h3>{review ? 'Your review' : 'Rate your shirt'}</h3>
          {canReview ? (
            <>
              {review && <p className="muted">Thanks for the review. You can change it any time.</p>}
              <ReviewForm orderId={o.id} rating={review?.rating} comment={review?.comment ?? ''} />
            </>
          ) : <p className="muted">Once your shirt is printed you can rate it here. Your review goes straight to the print partner who made it.</p>}
        </div>

        <div className="card">
          <h3>Need help?</h3>
          <p className="muted">Something wrong with the print or the shirt? See <Link href="/help">Help</Link> or our <Link href="/policies">reprint policy</Link>. Mention order #{code}.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
