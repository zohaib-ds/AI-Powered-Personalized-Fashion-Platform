import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { COLOURS, ZONE_INFO, zonesUsed } from '@/lib/design';
import { rupee } from '@/lib/pricing';
import { JOURNEY, signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type ReviewRow } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order · WearSketch', robots: { index: false } };

const STEP_TEXT: Record<string, string> = {
  paid: 'Order placed',
  sent_to_printer: 'Printing in Delhi',
  printed: 'Printed and checked',
  shipped: 'On the way with Ekart',
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
  const links = await signedLinks(db, [o.files.preview, o.files.views].filter(Boolean));
  const colour = COLOURS.find((c) => c.id === o.colour_id);
  const at = JOURNEY.indexOf(o.status);
  const canReview = ['printed', 'shipped', 'delivered'].includes(o.status);
  const code = o.code ?? o.id.slice(0, 8).toUpperCase();

  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <div className="order-hero">
          <div>
            <p className="eyebrow">Order #{code}</p>
            <h1>{o.status === 'pending_payment' ? 'Your order is waiting for payment' : o.status === 'cancelled' ? 'This order was cancelled' : fresh ? 'Thank you! Your shirt is on its way to the printer.' : STEP_TEXT[o.status] ?? STATUS_LABEL[o.status]}</h1>
            <p className="muted">Keep this page. It updates as your shirt is printed and shipped. You can also find it any time from <Link href="/track">Track order</Link> with #{code} and your phone number.</p>
          </div>
        </div>

        {at >= 0 && (
          <ol className="journey" aria-label="Order progress">
            {JOURNEY.map((s, i) => (
              <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>
                <span className="j-dot" />
                <span className="j-text">{STEP_TEXT[s]}</span>
                {s === 'shipped' && o.tracking && i <= at && <span className="j-sub">Ekart tracking {o.tracking}</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="order-cols">
          <div className="card flush">
            {o.files.views && links[o.files.views] ? <img className="views" src={links[o.files.views]} alt="Your shirt from four sides" />
              : o.files.preview && links[o.files.preview] ? <img className="views" src={links[o.files.preview]} alt="Your shirt" /> : null}
          </div>
          <div className="card">
            <h3>Your shirt</h3>
            <table className="kv"><tbody>
              <tr><td>Shirt</td><td>{colour?.name} free-size tee × {o.qty}</td></tr>
              <tr><td>Printed on</td><td>{zonesUsed(o.design).map((z) => ZONE_INFO[z].label).join(', ')}</td></tr>
              {o.price.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{rupee(l.amount)}</td></tr>)}
              {o.qty > 1 && <tr><td>× {o.qty} shirts</td><td>{rupee(o.price.subtotal)}</td></tr>}
              <tr><td>Ekart delivery</td><td>{rupee(o.price.shipping)}</td></tr>
              <tr className="total"><td>Total</td><td>{rupee(o.total)}{o.payment_ref?.startsWith('SAMPLE') ? ' (test payment)' : ''}</td></tr>
              <tr><td>Deliver to</td><td>{o.customer_name}, {o.address}, Delhi {o.pincode}</td></tr>
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
          <p className="muted">Something wrong with the print or the size? See <Link href="/help">Help</Link> or our <Link href="/policies">reprint policy</Link>. Mention order #{code}.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
