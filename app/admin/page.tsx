import Link from 'next/link';
import PortalHeader from '@/components/PortalHeader';
import PrintSpec, { Stars } from '@/components/PrintSpec';
import { rupee } from '@/lib/pricing';
import { signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type PrinterRow, type ReviewRow } from '@/lib/supabase-server';
import { createPrinter, setPrinterActive, setReviewPublic, updateOrder } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · WearSketch', robots: { index: false } };

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? 'orders';
  const db = supabaseAdmin();
  const [{ data: od, error }, { data: pd }, { data: rd }] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('printers').select('*').order('created_at', { ascending: true }),
    db.from('reviews').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const orders = (od ?? []) as OrderRow[];
  const printers = (pd ?? []) as PrinterRow[];
  const reviews = (rd ?? []) as ReviewRow[];
  const reviewOf = Object.fromEntries(reviews.map((r) => [r.order_id, r]));
  const printerName = Object.fromEntries(printers.map((p) => [p.id, p.name]));
  const links = tab === 'orders' ? await signedLinks(db, orders.flatMap((o) => Object.values(o.files ?? {}))) : {};

  const paid = orders.filter((o) => o.status !== 'pending_payment' && o.status !== 'cancelled');
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const cost = paid.reduce((s, o) => s + (o.printer_cost ?? 0) + (o.price?.shipping ?? 0), 0);

  return (
    <>
      <PortalHeader label="Admin" />
      <div className="portal">
        <div className="stats">
          <div className="stat"><span className="stat-n">{paid.length}</span><span className="stat-l">Paid orders</span></div>
          <div className="stat"><span className="stat-n">{paid.filter((o) => o.status === 'paid').length}</span><span className="stat-l">Need a printer</span></div>
          <div className="stat"><span className="stat-n">{rupee(revenue)}</span><span className="stat-l">Taken</span></div>
          <div className="stat"><span className="stat-n">{rupee(revenue - cost)}</span><span className="stat-l">Margin after printer and Ekart</span></div>
        </div>
        <nav className="tabs">
          {[['orders', `Orders (${orders.length})`], ['printers', `Printers (${printers.length})`], ['reviews', `Reviews (${reviews.length})`]].map(([k, l]) => (
            <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'on' : ''}>{l}</Link>
          ))}
        </nav>
        {error && <div className="err">Could not load orders: {error.message}. If this is a new install, run supabase/schema.sql again.</div>}

        {tab === 'orders' && (
          <>
            {!orders.length && !error && <div className="card empty">No orders yet. Place one from the studio to test the flow.</div>}
            {orders.map((o) => {
              const r = reviewOf[o.id];
              return (
                <details key={o.id} className="card admin-order" open={o.status === 'paid'}>
                  <summary>
                    <span className="ao-thumb">{o.files.preview && links[o.files.preview] ? <img src={links[o.files.preview]} alt="" /> : null}</span>
                    <span className="ao-main">
                      <strong>#{o.code ?? o.id.slice(0, 8).toUpperCase()}</strong> · {o.customer_name} · {fmt(o.created_at)}
                      <span className="muted">{o.printer_id ? printerName[o.printer_id] ?? 'Unknown printer' : 'No printer yet'}{r ? ' · ' : ''}{r && <Stars n={r.rating} size={12} />}</span>
                    </span>
                    <span className="ao-right"><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span><strong>{rupee(o.total)}</strong></span>
                  </summary>
                  <div className="ao-body">
                    <div>
                      {o.files.views && links[o.files.views] && <img className="views" src={links[o.files.views]} alt="Four views of the shirt" />}
                      <PrintSpec design={o.design} files={o.files} links={links} />
                    </div>
                    <div className="ao-side">
                      <table className="kv"><tbody>
                        <tr><td>Customer</td><td>{o.customer_name}<br />{o.phone}{o.email ? <><br />{o.email}</> : null}</td></tr>
                        <tr><td>Address</td><td>{o.address}, {o.pincode}</td></tr>
                        <tr><td>Paid</td><td>{rupee(o.total)} {o.payment_ref && <span className="muted">({o.payment_ref})</span>}</td></tr>
                        <tr><td>Printer rate</td><td>{rupee(o.printer_cost ?? 0)}</td></tr>
                        {o.printer_note && <tr><td>Printer note</td><td>{o.printer_note}</td></tr>}
                        {r && <tr><td>Review</td><td><Stars n={r.rating} size={13} /> {r.comment}</td></tr>}
                      </tbody></table>
                      <form action={updateOrder} key={`${o.status}|${o.printer_id}|${o.tracking}|${o.notes}`} className="stack">
                        <input type="hidden" name="id" value={o.id} />
                        <div className="field"><label>Printer</label>
                          <select className="inp" name="printer_id" defaultValue={o.printer_id ?? ''}>
                            <option value="">Not assigned</option>
                            {printers.filter((p) => p.active || p.id === o.printer_id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.area ? ` (${p.area})` : ''}</option>)}
                          </select>
                        </div>
                        <div className="field"><label>Status</label>
                          <select className="inp" name="status" defaultValue={o.status}>
                            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div className="field"><label>Ekart tracking</label><input className="inp" name="tracking" defaultValue={o.tracking ?? ''} /></div>
                        <div className="field"><label>Note for the printer</label><input className="inp" name="notes" defaultValue={o.notes ?? ''} /></div>
                        <button className="btn primary" type="submit">Save</button>
                      </form>
                    </div>
                  </div>
                </details>
              );
            })}
          </>
        )}

        {tab === 'printers' && (
          <>
            <form action={createPrinter} className="card add-printer">
              <h3>Add a print partner</h3>
              <div className="three">
                <div className="field"><label htmlFor="pn">Name</label><input className="inp" id="pn" name="name" required placeholder="Shop name" /></div>
                <div className="field"><label htmlFor="pa">Area</label><input className="inp" id="pa" name="area" placeholder="e.g. Okhla, South Delhi" /></div>
                <div className="field"><label htmlFor="pp">Phone</label><input className="inp" id="pp" name="phone" inputMode="tel" /></div>
              </div>
              <button className="btn primary">Add printer</button>
              <p className="muted">Each printer gets an access code. Send them the code and the link <strong>/printer</strong> on this site.</p>
            </form>
            {printers.map((p) => {
              const mine = orders.filter((o) => o.printer_id === p.id);
              const rs = reviews.filter((r) => mine.some((o) => o.id === r.order_id));
              const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
              return (
                <div key={p.id} className={`card printer-row${p.active ? '' : ' off'}`}>
                  <div>
                    <strong>{p.name}</strong> <span className="muted">{p.area}{p.phone ? ` · ${p.phone}` : ''}</span>
                    <div className="muted">{mine.length} orders · {rs.length ? <><Stars n={Math.round(avg)} size={12} /> {avg.toFixed(1)} from {rs.length}</> : 'no reviews yet'}</div>
                  </div>
                  <code className="access">{p.access_code}</code>
                  <form action={setPrinterActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button className="btn small">{p.active ? 'Turn off' : 'Turn on'}</button>
                  </form>
                </div>
              );
            })}
          </>
        )}

        {tab === 'reviews' && (
          <>
            {!reviews.length && <div className="card empty">No reviews yet. Customers can review from their order page once the shirt is printed.</div>}
            <div className="reviews">
              {reviews.map((r) => {
                const o = orders.find((x) => x.id === r.order_id);
                return (
                  <div key={r.id} className="review">
                    <div className="row between"><Stars n={r.rating} /><span className="muted">#{o?.code} · {o?.printer_id ? printerName[o.printer_id] : 'no printer'}</span></div>
                    {r.comment && <p>“{r.comment}”</p>}
                    <div className="row between">
                      <span className="muted">{r.name || 'Customer'} · {fmt(r.created_at)}</span>
                      <form action={setReviewPublic}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="show" value={String(!r.show_on_site)} />
                        <button className="btn small">{r.show_on_site ? 'Hide from home page' : 'Show on home page'}</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
