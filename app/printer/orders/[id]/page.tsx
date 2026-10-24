import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import PortalHeader from '@/components/PortalHeader';
import PrintSpec, { Stars } from '@/components/PrintSpec';
import { currentPrinter } from '@/lib/printer-auth';
import { rupee } from '@/lib/pricing';
import { orderItems, PRINTER_STATUSES, signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type ReviewRow } from '@/lib/supabase-server';
import { printerUpdate, requestPickup } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order · Merchant portal', robots: { index: false } };

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function PrinterOrder({ params }: { params: Promise<{ id: string }> }) {
  const printer = await currentPrinter().catch(() => null);
  if (!printer) redirect('/printer');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).eq('printer_id', printer.id).maybeSingle();
  if (!data) notFound();
  const o = data as OrderRow;
  const items = orderItems(o);
  const { data: rv } = await db.from('reviews').select('*').eq('order_id', id).maybeSingle();
  const review = rv as ReviewRow | null;
  const links = await signedLinks(db, items.flatMap((it) => Object.values(it.files ?? {})));
  const a = o.address_parts;
  const canRequest = o.status === 'sent_to_printer' || o.status === 'printed';

  return (
    <>
      <PortalHeader label="Merchant portal" />
      <div className="portal">
        <Link href="/printer" className="back">Back to all orders</Link>
        <div className="portal-head">
          <div>
            <h1>Order #{o.code}</h1>
            <p className="muted">Placed {fmt(o.created_at)} · {o.payment_ref?.startsWith('SAMPLE') ? 'test payment' : 'paid'} · {o.qty} shirt{o.qty > 1 ? 's' : ''}{items.length > 1 ? ` in ${items.length} designs` : ''}</p>
          </div>
          <span className={`status big s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
        </div>

        <div className="detail">
          <div className="detail-main">
            {items.map((it, i) => (
              <section key={i} className="card">
                <h3>{items.length > 1 ? `Design ${i + 1} of ${items.length}` : 'The design'}</h3>
                {it.files.views && links[it.files.views] && <img className="views spec-views" src={links[it.files.views]} alt={`Design ${i + 1} from the front, left, back and right`} />}
                <PrintSpec design={{ colourId: it.colourId, size: it.size, qty: it.qty, prints: it.prints }} files={it.files} links={links} />
              </section>
            ))}
          </div>

          <div className="detail-side">
            <div className="card">
              <h3>Pickup</h3>
              {canRequest ? (
                <form action={requestPickup} className="stack">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="muted">When every shirt in this order is printed and packed, request a pickup. The WearSketch team books the courier and the parcel is collected from you.</p>
                  <button className="btn primary big">Request pickup</button>
                </form>
              ) : o.status === 'pickup_requested' ? (
                <p>Pickup requested {o.pickup_requested_at ? fmt(o.pickup_requested_at) : ''}. Keep the parcel ready for the courier.</p>
              ) : o.status === 'shipped' || o.status === 'delivered' ? (
                <p className="muted">This order has left your shop{o.tracking ? `, tracking ${o.tracking}` : ''}.</p>
              ) : <p className="muted">You can request a pickup once printing starts.</p>}
            </div>

            <form action={printerUpdate} className="card" key={`${o.status}|${o.tracking}|${o.printer_note}`}>
              <h3>Update this order</h3>
              <input type="hidden" name="id" value={o.id} />
              <div className="field"><label htmlFor="status">Status</label>
                <select className="inp" id="status" name="status" defaultValue={PRINTER_STATUSES.includes(o.status) ? o.status : 'sent_to_printer'}>
                  {PRINTER_STATUSES.map((s) => <option key={s} value={s}>{s === 'sent_to_printer' ? 'Printing' : STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="tracking">Tracking number</label><input className="inp" id="tracking" name="tracking" defaultValue={o.tracking ?? ''} placeholder="Add it when the parcel leaves" /></div>
              <div className="field"><label htmlFor="printer_note">Note for WearSketch</label><textarea className="inp" id="printer_note" name="printer_note" rows={2} defaultValue={o.printer_note ?? ''} placeholder="Anything we should know" /></div>
              <button className="btn">Save</button>
            </form>

            <div className="card">
              <h3>Ship to</h3>
              {a ? (
                <table className="kv"><tbody>
                  <tr><td>Name</td><td><strong>{o.customer_name}</strong></td></tr>
                  <tr><td>Mobile</td><td><a href={`tel:+91${o.phone}`}>{o.phone}</a></td></tr>
                  <tr><td>House or flat</td><td>{a.house}</td></tr>
                  {a.floor && <tr><td>Floor</td><td>{a.floor}</td></tr>}
                  <tr><td>Building, street</td><td>{a.building}</td></tr>
                  <tr><td>Area</td><td>{a.area}</td></tr>
                  {a.landmark && <tr><td>Landmark</td><td>{a.landmark}</td></tr>}
                  <tr><td>City</td><td>{a.city}</td></tr>
                  <tr><td>Pincode</td><td>{a.pincode}</td></tr>
                </tbody></table>
              ) : (
                <p className="addr"><strong>{o.customer_name}</strong><br />{o.address}<br />{o.pincode}<br /><a href={`tel:${o.phone.replace(/\s/g, '')}`}>{o.phone}</a></p>
              )}
            </div>

            <div className="card">
              <h3>Your rate</h3>
              <p className="big-num">{rupee(o.printer_cost ?? 0)}</p>
              <p className="muted">For {o.qty} shirt{o.qty > 1 ? 's' : ''}, printing included. Delivery is booked by WearSketch.</p>
            </div>

            <div className="card">
              <h3>Customer review</h3>
              {review ? (
                <>
                  <Stars n={review.rating} size={18} />
                  {review.comment && <p>“{review.comment}”</p>}
                  <p className="muted">{review.name || 'Customer'} · {fmt(review.created_at)}</p>
                </>
              ) : <p className="muted">No review yet. Customers can rate their shirts once they are printed.</p>}
            </div>
            {o.notes && <div className="card"><h3>Note from WearSketch</h3><p>{o.notes}</p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
