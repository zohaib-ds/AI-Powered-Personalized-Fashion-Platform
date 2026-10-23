import Link from 'next/link';
import { AddMerchantForm, ResetPasswordForm } from '@/components/AdminForms';
import PortalHeader from '@/components/PortalHeader';
import PrintSpec, { Stars } from '@/components/PrintSpec';
import { weekLabel, weekly } from '@/lib/analytics';
import { COLOURS } from '@/lib/design';
import { rupee } from '@/lib/pricing';
import {
  addressText, ISSUE_LABEL, orderItems, orderPreview, signedLinks, STATUS_LABEL, supabaseAdmin,
  type OrderRow, type OrderStatus, type PrinterRow, type ReviewRow,
} from '@/lib/supabase-server';
import { setPrinterActive, setReviewPublic, updateOrder } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · WearSketch', robots: { index: false } };

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const counted = (o: OrderRow) => o.status !== 'pending_payment' && o.status !== 'cancelled';
// what an order leaves us after the printer, the delivery fee and any refund
const marginOf = (o: OrderRow) => o.total - (o.printer_cost ?? 0) - (o.price?.shipping ?? 0) - (o.refund_amount ?? 0);

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; s?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'sales';
  const filter = sp.s && sp.s in STATUS_LABEL ? (sp.s as OrderStatus) : null;
  const db = supabaseAdmin();
  const [{ data: od, error }, { data: pd }, { data: rd }] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('printers').select('*').order('created_at', { ascending: true }),
    db.from('reviews').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  const orders = (od ?? []) as OrderRow[];
  const printers = (pd ?? []) as PrinterRow[];
  const reviews = (rd ?? []) as ReviewRow[];
  const reviewOf = Object.fromEntries(reviews.map((r) => [r.order_id, r]));
  const printerName = Object.fromEntries(printers.map((p) => [p.id, p.name]));

  const sold = orders.filter(counted);
  const revenue = sold.reduce((s, o) => s + o.total, 0);
  const refunds = orders.filter((o) => o.issue === 'refund' || o.issue === 'return');
  const refunded = refunds.reduce((s, o) => s + (o.refund_amount ?? 0), 0);
  const printerCost = sold.reduce((s, o) => s + (o.printer_cost ?? 0), 0);
  const delivery = sold.reduce((s, o) => s + (o.price?.shipping ?? 0), 0);
  const margin = sold.reduce((s, o) => s + marginOf(o), 0);
  const shirts = sold.reduce((s, o) => s + o.qty, 0);
  const pickups = orders.filter((o) => o.status === 'pickup_requested');
  const needPrinter = orders.filter((o) => o.status === 'paid');
  const weeks = weekly(sold);
  const weekMargin = (start: number) => sold.filter((o) => weekly([o], 8).some((w) => w.start === start && w.orders)).reduce((s, o) => s + marginOf(o), 0);
  const colours = COLOURS.map((c) => [c.name, sold.reduce((s, o) => s + orderItems(o).filter((it) => it.colourId === c.id).reduce((n, it) => n + it.qty, 0), 0)] as const)
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  const shown = tab === 'orders' ? orders.filter((o) => !filter || o.status === filter).slice(0, 150) : [];
  const links = tab === 'orders' ? await signedLinks(db, shown.flatMap((o) => orderItems(o).flatMap((it) => Object.values(it.files ?? {})))) : {};

  return (
    <>
      <PortalHeader label="Admin" />
      <div className="portal">
        <nav className="tabs">
          {[['sales', 'Sales'], ['orders', `Orders (${orders.length})`], ['printers', `Merchants (${printers.length})`], ['reviews', `Reviews (${reviews.length})`]].map(([k, l]) => (
            <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'on' : ''}>{l}</Link>
          ))}
        </nav>
        {error && <div className="err">Could not load orders: {error.message}. If this is a new install or the site was just updated, run supabase/schema.sql again.</div>}

        {tab === 'sales' && (
          <>
            <div className="stats">
              <div className="stat"><span className="stat-n">{sold.length}</span><span className="stat-l">Paid orders ({shirts} shirts)</span></div>
              <div className="stat"><span className="stat-n">{rupee(revenue)}</span><span className="stat-l">Taken from customers</span></div>
              <div className="stat"><span className="stat-n">{rupee(margin)}</span><span className="stat-l">Left after printer, delivery and refunds</span></div>
              <div className="stat"><span className="stat-n">{sold.length ? rupee(revenue / sold.length) : rupee(0)}</span><span className="stat-l">Average order</span></div>
            </div>

            {(needPrinter.length > 0 || pickups.length > 0) && (
              <div className="card">
                <h3>Waiting on you</h3>
                <table className="kv"><tbody>
                  {needPrinter.length > 0 && <tr><td>Need a merchant</td><td><Link href="/admin?tab=orders&s=paid">{needPrinter.length} order{needPrinter.length > 1 ? 's' : ''}</Link></td></tr>}
                  {pickups.map((o) => (
                    <tr key={o.id}><td>Pickup requested</td><td><Link href="/admin?tab=orders&s=pickup_requested">#{o.code}</Link> from {o.printer_id ? printerName[o.printer_id] ?? 'a merchant' : 'a merchant'}{o.pickup_requested_at ? `, ${fmt(o.pickup_requested_at)}` : ''}. Book the courier, then mark it shipped with the tracking number.</td></tr>
                  ))}
                </tbody></table>
              </div>
            )}

            <div className="analysis">
              <div className="card">
                <h3>Money</h3>
                <table className="kv"><tbody>
                  <tr><td>Taken from customers</td><td>{rupee(revenue)}</td></tr>
                  <tr><td>Printer cost</td><td>{rupee(printerCost)}</td></tr>
                  <tr><td>Delivery fees</td><td>{rupee(delivery)}</td></tr>
                  <tr><td>Refunded</td><td>{rupee(refunded)}</td></tr>
                  <tr className="total"><td>Left over</td><td>{rupee(margin)}</td></tr>
                </tbody></table>
                <p className="muted">Delivery fees are counted as paid on to the courier. Test payments are included until real payments start.</p>
              </div>
              <div className="card">
                <h3>Returns and problems</h3>
                <table className="kv"><tbody>
                  <tr><td>Cancelled orders</td><td>{orders.filter((o) => o.status === 'cancelled').length}</td></tr>
                  <tr><td>Reprints</td><td>{orders.filter((o) => o.issue === 'reprint').length}</td></tr>
                  <tr><td>Returns</td><td>{orders.filter((o) => o.issue === 'return').length}</td></tr>
                  <tr><td>Refunds</td><td>{orders.filter((o) => o.issue === 'refund').length}</td></tr>
                  <tr><td>Refunded in total</td><td>{rupee(refunded)}</td></tr>
                </tbody></table>
                <p className="muted">Record a reprint, return or refund on the order in the Orders tab.</p>
              </div>
            </div>

            <div className="analysis">
              <div className="card">
                <h3>Last 8 weeks</h3>
                <table className="data-table">
                  <thead><tr><th>Week from</th><th>Orders</th><th>Shirts</th><th>Taken</th><th>Left over</th></tr></thead>
                  <tbody>{weeks.map((w) => <tr key={w.start}><td>{weekLabel(w.start)}</td><td>{w.orders}</td><td>{w.shirts}</td><td>{rupee(w.revenue)}</td><td>{rupee(weekMargin(w.start))}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="card">
                <h3>Shirt colours sold</h3>
                {colours.length ? (
                  <table className="data-table">
                    <thead><tr><th>Colour</th><th>Shirts</th></tr></thead>
                    <tbody>{colours.map(([name, n]) => <tr key={name}><td>{name}</td><td>{n}</td></tr>)}</tbody>
                  </table>
                ) : <p className="muted">No sales yet.</p>}
              </div>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <>
            <div className="filters">
              <Link href="/admin?tab=orders" className={!filter ? 'on' : ''}>All</Link>
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                <Link key={s} href={`/admin?tab=orders&s=${s}`} className={filter === s ? 'on' : ''}>{STATUS_LABEL[s]} ({orders.filter((o) => o.status === s).length})</Link>
              ))}
            </div>
            {!shown.length && !error && <div className="card empty">No orders here.</div>}
            {shown.map((o) => {
              const r = reviewOf[o.id];
              const items = orderItems(o);
              const pic = orderPreview(o);
              return (
                <details key={o.id} className="card admin-order" open={o.status === 'paid' || o.status === 'pickup_requested'}>
                  <summary>
                    <span className="ao-thumb">{pic && links[pic] ? <img src={links[pic]} alt="" /> : null}</span>
                    <span className="ao-main">
                      <span><strong>#{o.code ?? o.id.slice(0, 8).toUpperCase()}</strong> · {o.customer_name} · {fmt(o.created_at)}</span>
                      <span className="muted">{o.qty} shirt{o.qty > 1 ? 's' : ''}{items.length > 1 ? `, ${items.length} designs` : ''} · {o.printer_id ? printerName[o.printer_id] ?? 'Unknown merchant' : 'No merchant yet'}{o.issue ? ` · ${ISSUE_LABEL[o.issue]}` : ''}{r ? ' · ' : ''}{r && <Stars n={r.rating} size={12} />}</span>
                    </span>
                    <span className="ao-right"><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span><strong>{rupee(o.total)}</strong></span>
                  </summary>
                  <div className="ao-body">
                    <div>
                      {items.map((it, i) => (
                        <section key={i} className="ao-item">
                          {items.length > 1 && <h4>Design {i + 1} of {items.length}</h4>}
                          {it.files.views && links[it.files.views] && <img className="views" src={links[it.files.views]} alt={`Design ${i + 1} from four sides`} />}
                          <PrintSpec design={{ colourId: it.colourId, qty: it.qty, prints: it.prints }} files={it.files} links={links} />
                        </section>
                      ))}
                    </div>
                    <div className="ao-side">
                      <table className="kv"><tbody>
                        <tr><td>Customer</td><td>{o.customer_name}<br />{o.phone}{o.email ? <><br />{o.email}</> : null}</td></tr>
                        <tr><td>Address</td><td>{addressText(o)}, {o.pincode}</td></tr>
                        <tr><td>Paid</td><td>{rupee(o.total)} {o.payment_ref && <span className="muted">({o.payment_ref})</span>}</td></tr>
                        <tr><td>Delivery fee</td><td>{rupee(o.price?.shipping ?? 0)}</td></tr>
                        <tr><td>Merchant rate</td><td>{rupee(o.printer_cost ?? 0)}</td></tr>
                        {o.pickup_requested_at && <tr><td>Pickup requested</td><td>{fmt(o.pickup_requested_at)}</td></tr>}
                        {o.printer_note && <tr><td>Merchant note</td><td>{o.printer_note}</td></tr>}
                        {r && <tr><td>Review</td><td><Stars n={r.rating} size={13} /> {r.comment}</td></tr>}
                      </tbody></table>
                      <form action={updateOrder} key={`${o.status}|${o.printer_id}|${o.tracking}|${o.notes}|${o.issue}|${o.refund_amount}`} className="stack">
                        <input type="hidden" name="id" value={o.id} />
                        <div className="field"><label>Merchant</label>
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
                        <div className="field"><label>Tracking number</label><input className="inp" name="tracking" defaultValue={o.tracking ?? ''} /></div>
                        <div className="field"><label>Note for the merchant</label><input className="inp" name="notes" defaultValue={o.notes ?? ''} /></div>
                        <div className="two">
                          <div className="field"><label>Return or problem</label>
                            <select className="inp" name="issue" defaultValue={o.issue ?? ''}>
                              <option value="">None</option>
                              {Object.entries(ISSUE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div className="field"><label>Refunded (₹)</label><input className="inp" name="refund_amount" inputMode="numeric" defaultValue={o.refund_amount ?? ''} placeholder="For refunds and returns" /></div>
                        </div>
                        <div className="field"><label>What happened</label><input className="inp" name="issue_note" defaultValue={o.issue_note ?? ''} /></div>
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
            <AddMerchantForm />
            {printers.map((p) => {
              const mine = orders.filter((o) => o.printer_id === p.id && counted(o));
              const rs = reviews.filter((r) => mine.some((o) => o.id === r.order_id));
              const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
              return (
                <div key={p.id} className={`card printer-row${p.active ? '' : ' off'}`}>
                  <div>
                    <strong>{p.name}</strong> <span className="muted">{p.area}{p.phone ? ` · ${p.phone}` : ''}</span>
                    <div className="muted">{mine.length} orders · {rupee(mine.reduce((s, o) => s + (o.printer_cost ?? 0), 0))} merchant rate · {rs.length ? <><Stars n={Math.round(avg)} size={12} /> {avg.toFixed(1)} from {rs.length}</> : 'no reviews yet'}</div>
                    {!p.password_hash && <div className="low">No password yet. Make one so this merchant can sign in.</div>}
                  </div>
                  <code className="access">{p.login_id ?? p.access_code}</code>
                  <ResetPasswordForm id={p.id} />
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
                    <div className="row between"><Stars n={r.rating} /><span className="muted">#{o?.code} · {o?.printer_id ? printerName[o.printer_id] : 'no merchant'}</span></div>
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
