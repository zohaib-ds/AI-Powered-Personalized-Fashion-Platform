import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import PortalHeader from '@/components/PortalHeader';
import PrintSpec, { Stars } from '@/components/PrintSpec';
import { currentPrinter } from '@/lib/printer-auth';
import { rupee } from '@/lib/pricing';
import { PRINTER_STATUSES, signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type ReviewRow } from '@/lib/supabase-server';
import { printerUpdate } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order · Printer portal', robots: { index: false } };

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
  const { data: rv } = await db.from('reviews').select('*').eq('order_id', id).maybeSingle();
  const review = rv as ReviewRow | null;
  const links = await signedLinks(db, Object.values(o.files ?? {}));

  return (
    <>
      <PortalHeader label="Printer portal" />
      <div className="portal">
        <Link href="/printer" className="back">← All orders</Link>
        <div className="portal-head">
          <div>
            <h1>Order #{o.code}</h1>
            <p className="muted">Placed {fmt(o.created_at)} · {o.payment_ref?.startsWith('SAMPLE') ? 'test payment' : 'paid'}</p>
          </div>
          <span className={`status big s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
        </div>

        <div className="detail">
          <div className="detail-main">
            {o.files.views && links[o.files.views] && (
              <div className="card flush"><img className="views" src={links[o.files.views]} alt="The shirt from the front, left, back and right" /></div>
            )}
            <div className="card">
              <h3>Print files</h3>
              <PrintSpec design={o.design} files={o.files} links={links} />
            </div>
          </div>

          <div className="detail-side">
            <form action={printerUpdate} className="card" key={`${o.status}|${o.tracking}|${o.printer_note}`}>
              <h3>Update this order</h3>
              <input type="hidden" name="id" value={o.id} />
              <div className="field"><label htmlFor="status">Status</label>
                <select className="inp" id="status" name="status" defaultValue={PRINTER_STATUSES.includes(o.status) ? o.status : 'sent_to_printer'}>
                  {PRINTER_STATUSES.map((s) => <option key={s} value={s}>{s === 'sent_to_printer' ? 'Printing' : STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="tracking">Ekart tracking number</label><input className="inp" id="tracking" name="tracking" defaultValue={o.tracking ?? ''} placeholder="Add it when you ship" /></div>
              <div className="field"><label htmlFor="printer_note">Note for WearSketch</label><textarea className="inp" id="printer_note" name="printer_note" rows={2} defaultValue={o.printer_note ?? ''} placeholder="Anything we should know" /></div>
              <button className="btn primary">Save</button>
            </form>

            <div className="card">
              <h3>Ship to</h3>
              <p className="addr"><strong>{o.customer_name}</strong><br />{o.address}<br />Delhi {o.pincode}<br /><a href={`tel:${o.phone.replace(/\s/g, '')}`}>{o.phone}</a></p>
            </div>

            <div className="card">
              <h3>Your rate</h3>
              <p className="big-num">{rupee(o.printer_cost ?? 0)}</p>
              <p className="muted">For {o.qty} shirt{o.qty > 1 ? 's' : ''}, printing included. Ekart delivery is booked separately.</p>
            </div>

            <div className="card">
              <h3>Customer review</h3>
              {review ? (
                <>
                  <Stars n={review.rating} size={18} />
                  {review.comment && <p>“{review.comment}”</p>}
                  <p className="muted">{review.name || 'Customer'} · {fmt(review.created_at)}</p>
                </>
              ) : <p className="muted">No review yet. Customers can rate their shirt once it is printed.</p>}
            </div>
            {o.notes && <div className="card"><h3>Note from WearSketch</h3><p>{o.notes}</p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
