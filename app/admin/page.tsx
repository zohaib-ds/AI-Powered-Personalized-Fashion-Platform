import Link from 'next/link';
import AdminIdle from '@/components/AdminIdle';
import { AddMerchantForm, ResetPasswordForm } from '@/components/AdminForms';
import PortalHeader from '@/components/PortalHeader';
import PrintSpec, { Stars } from '@/components/PrintSpec';
import Tabs, { OrderFilter } from '@/components/Tabs';
import { weekLabel, weekly } from '@/lib/analytics';
import { COLOURS, SIZES } from '@/lib/design';
import { UTR_SENT } from '@/lib/payments';
import { merchantMoney } from '@/lib/payouts';
import { rupee } from '@/lib/pricing';
import { pickupName, shiprocketMode, shiprocketOn } from '@/lib/shiprocket';
import {
  addressText, ISSUE_LABEL, orderItems, orderPreview, payTo, signedLinks, STATUS_LABEL, supabaseAdmin,
  type OrderRow, type OrderStatus, type PayoutRow, type PrinterRow, type ReviewRow,
} from '@/lib/supabase-server';
import {
  assignOrder, deletePrinter, markDelivered, markShipped, retryShiprocket, setPrinterActive, setReviewPublic,
  payoutPaid, payoutRejected, paymentMissing, paymentReceived, setShiprocketPickup, updateOrder,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · WearSketch', robots: { index: false } };

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const counted = (o: OrderRow) => o.status !== 'pending_payment' && o.status !== 'cancelled';
// what an order leaves us after the printer, the delivery fee and any refund
const marginOf = (o: OrderRow) => o.total - (o.printer_cost ?? 0) - (o.price?.shipping ?? 0) - (o.refund_amount ?? 0);
const codeOf = (o: OrderRow) => o.code ?? o.id.slice(0, 8).toUpperCase();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const db = supabaseAdmin();
  const [{ data: od, error }, { data: pd }, { data: rd }, { data: yd }] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('printers').select('*').order('created_at', { ascending: true }),
    db.from('reviews').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('payouts').select('*').order('created_at', { ascending: false }).limit(300),
  ]);
  const orders = (od ?? []) as OrderRow[];
  const printers = (pd ?? []) as PrinterRow[];
  const reviews = (rd ?? []) as ReviewRow[];
  const payouts = (yd ?? []) as PayoutRow[];
  const reviewOf = Object.fromEntries(reviews.map((r) => [r.order_id, r]));
  const printerName = Object.fromEntries(printers.map((p) => [p.id, p.name]));
  const active = printers.filter((p) => p.active);

  const sold = orders.filter(counted);
  const revenue = sold.reduce((s, o) => s + o.total, 0);
  const refunds = orders.filter((o) => o.issue === 'refund' || o.issue === 'return');
  const refunded = refunds.reduce((s, o) => s + (o.refund_amount ?? 0), 0);
  const printerCost = sold.reduce((s, o) => s + (o.printer_cost ?? 0), 0);
  const delivery = sold.reduce((s, o) => s + (o.price?.shipping ?? 0), 0);
  const margin = sold.reduce((s, o) => s + marginOf(o), 0);
  const shirts = sold.reduce((s, o) => s + o.qty, 0);
  const weeks = weekly(sold);
  const weekMargin = (start: number) => sold.filter((o) => weekly([o], 8).some((w) => w.start === start && w.orders)).reduce((s, o) => s + marginOf(o), 0);
  const colours = COLOURS.map((c) => [c.name, sold.reduce((s, o) => s + orderItems(o).filter((it) => it.colourId === c.id).reduce((n, it) => n + it.qty, 0), 0)] as const)
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const sizes = SIZES.map((z) => [z.label, sold.reduce((s, o) => s + orderItems(o).filter((it) => (it.size ?? 'free') === z.id).reduce((n, it) => n + it.qty, 0), 0)] as const)
    .filter(([, n]) => n > 0);

  // the To do list
  const toCheck = orders.filter((o) => o.status === 'pending_payment' && o.payment_ref?.startsWith(UTR_SENT));
  const needPrinter = orders.filter((o) => o.status === 'paid' && !o.printer_id);
  const pickups = orders.filter((o) => o.status === 'pickup_requested');
  const onTheWay = orders.filter((o) => o.status === 'shipped');
  const toPay = payouts.filter((p) => p.status === 'requested');
  const todoCount = toCheck.length + needPrinter.length + pickups.length + onTheWay.length + toPay.length;

  // open orders first, then the most recent, so the list stays quick
  const open = orders.filter((o) => ['paid', 'sent_to_printer', 'printed', 'pickup_requested', 'shipped'].includes(o.status));
  const listed = [...open, ...orders.filter((o) => !open.includes(o)).slice(0, 100)];
  const links = await signedLinks(db, listed.flatMap((o) => orderItems(o).flatMap((it) => Object.values(it.files ?? {}))));
  const thumb = (o: OrderRow) => {
    const pic = orderPreview(o);
    return <span className="ao-thumb">{pic && links[pic] ? <img src={links[pic]} alt="" /> : null}</span>;
  };

  const todo = (
    <>
      {error && <div className="err">Could not load orders: {error.message}. If the site was just updated, run supabase/schema.sql again in Supabase.</div>}
      {!todoCount && !error && <div className="card empty">Nothing is waiting on you.</div>}

      {toCheck.length > 0 && (
        <section className="card">
          <h3>Check UPI payments</h3>
          <p className="muted">Open the bank or UPI app for the UPI ID customers pay to. Find each reference number and check the amount before you confirm.</p>
          {toCheck.map((o) => (
            <div key={o.id} className="todo-row">
              <div className="todo-main">
                {thumb(o)}
                <div>
                  <strong>{rupee(o.total)}</strong> for #{codeOf(o)} · UPI ref <code>{o.payment_ref!.slice(UTR_SENT.length)}</code>
                  <div className="muted">{o.customer_name}, {o.phone} · ordered {fmt(o.created_at)}</div>
                </div>
              </div>
              <div className="todo-act">
                <form action={paymentReceived}><input type="hidden" name="id" value={o.id} /><button className="btn primary small">Money received</button></form>
                <form action={paymentMissing}><input type="hidden" name="id" value={o.id} /><button className="btn small ghost">Not found</button></form>
              </div>
            </div>
          ))}
        </section>
      )}

      {toPay.length > 0 && (
        <section className="card">
          <h3>Pay merchants</h3>
          {toPay.map((p) => (
            <div key={p.id} className="todo-row">
              <div>
                <strong>{rupee(p.amount)}</strong> to {p.printer_name}
                <div className="muted">Asked {fmt(p.created_at)} · {p.pay_to ?? 'No bank or UPI details'}</div>
              </div>
              <form action={payoutPaid} className="todo-act">
                <input type="hidden" name="id" value={p.id} />
                <input className="inp" name="reference" placeholder="UPI or bank reference" aria-label="Payment reference" />
                <button className="btn primary small">Mark paid</button>
                <button className="btn small ghost" formAction={payoutRejected}>Turn down</button>
              </form>
            </div>
          ))}
        </section>
      )}

      {needPrinter.length > 0 && (
        <section className="card">
          <h3>Give to a merchant</h3>
          {needPrinter.map((o) => (
            <div key={o.id} className="todo-row">
              <div className="todo-main">
                {thumb(o)}
                <div><strong>#{codeOf(o)}</strong> · {plural(o.qty, 'shirt')} · {o.pincode}<div className="muted">{fmt(o.created_at)} · {rupee(o.total)}</div></div>
              </div>
              <form action={assignOrder} className="todo-act">
                <input type="hidden" name="id" value={o.id} />
                <select className="inp" name="printer_id" required defaultValue="" aria-label="Merchant">
                  <option value="" disabled>Pick a merchant</option>
                  {active.map((p) => <option key={p.id} value={p.id}>{p.name}{p.area ? ` (${p.area})` : ''}</option>)}
                </select>
                <button className="btn primary small">Give</button>
              </form>
            </div>
          ))}
          {!active.length && <p className="muted">Add a merchant in the Merchants tab first.</p>}
        </section>
      )}

      {pickups.length > 0 && (
        <section className="card">
          <h3>Pickups requested</h3>
          {pickups.map((o) => {
            const sr = o.shiprocket;
            return (
              <div key={o.id} className="todo-row">
                <div className="todo-main">
                  {thumb(o)}
                  <div>
                    <strong>#{codeOf(o)}</strong> from {o.printer_id ? printerName[o.printer_id] ?? 'a merchant' : 'a merchant'}{o.pickup_requested_at ? `, ${fmt(o.pickup_requested_at)}` : ''}
                    <div className="muted">
                      {sr?.error ? <span className="low">Shiprocket: {sr.error}</span>
                        : sr?.awb ? <>Courier booked: {sr.courier ?? 'Shiprocket'}, AWB {sr.awb}{sr.label_url ? <> · <a href={sr.label_url} target="_blank" rel="noreferrer">Label</a></> : null}</>
                        : sr?.shipment_id ? <>Test order made in Shiprocket (shipment {sr.shipment_id}). No courier booked.</>
                        : shiprocketOn() ? 'Not sent to Shiprocket yet.' : 'Book the courier, then mark it shipped with the tracking number.'}
                    </div>
                  </div>
                </div>
                <div className="todo-act">
                  {shiprocketOn() && (sr?.error || !sr?.shipment_id || (shiprocketMode() === 'live' && !sr?.awb)) && (
                    <form action={retryShiprocket}><input type="hidden" name="id" value={o.id} /><button className="btn small">Send to Shiprocket</button></form>
                  )}
                  <form action={markShipped} className="todo-act">
                    <input type="hidden" name="id" value={o.id} />
                    <input className="inp" name="tracking" defaultValue={sr?.awb ?? o.tracking ?? ''} placeholder="Tracking number" aria-label="Tracking number" />
                    <button className="btn primary small">Mark shipped</button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {onTheWay.length > 0 && (
        <section className="card">
          <h3>On the way</h3>
          {onTheWay.map((o) => (
            <div key={o.id} className="todo-row">
              <div className="todo-main">
                {thumb(o)}
                <div><strong>#{codeOf(o)}</strong> to {o.customer_name}, {o.pincode}<div className="muted">{o.tracking ? `Tracking ${o.tracking}` : 'No tracking number'}{o.status_times?.shipped ? ` · shipped ${fmt(o.status_times.shipped)}` : ''}</div></div>
              </div>
              <form action={markDelivered} className="todo-act">
                <input type="hidden" name="id" value={o.id} />
                <button className="btn small">Mark delivered</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </>
  );

  const ordersPanel = (
    <OrderFilter options={(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => ({ key: s, label: `${STATUS_LABEL[s]} (${orders.filter((o) => o.status === s).length})` }))}>
      {!listed.length && !error && <div className="card empty">No orders yet.</div>}
      {listed.map((o) => {
        const r = reviewOf[o.id];
        const items = orderItems(o);
        return (
          <details key={o.id} data-s={o.status} className="card admin-order">
            <summary>
              {thumb(o)}
              <span className="ao-main">
                <span><strong>#{codeOf(o)}</strong> · {o.customer_name} · {fmt(o.created_at)}</span>
                <span className="muted">{plural(o.qty, 'shirt')}{items.length > 1 ? `, ${items.length} designs` : ''} · {o.printer_id ? printerName[o.printer_id] ?? 'Unknown merchant' : 'No merchant yet'}{o.issue ? ` · ${ISSUE_LABEL[o.issue]}` : ''}{r ? ' · ' : ''}{r && <Stars n={r.rating} size={12} />}</span>
              </span>
              <span className="ao-right"><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span><strong>{rupee(o.total)}</strong></span>
            </summary>
            <div className="ao-body">
              <div>
                {items.map((it, i) => (
                  <section key={i} className="ao-item">
                    {items.length > 1 && <h4>Design {i + 1} of {items.length}</h4>}
                    {it.files.views && links[it.files.views] && <img className="views" src={links[it.files.views]} alt={`Design ${i + 1} from four sides`} />}
                    <PrintSpec design={{ colourId: it.colourId, size: it.size, qty: it.qty, prints: it.prints }} files={it.files} links={links} />
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
                  {o.shiprocket && <tr><td>Shiprocket</td><td>{o.shiprocket.error ? <span className="low">{o.shiprocket.error}</span> : o.shiprocket.awb ? `AWB ${o.shiprocket.awb}${o.shiprocket.courier ? `, ${o.shiprocket.courier}` : ''}` : `Shipment ${o.shiprocket.shipment_id ?? ''} (${o.shiprocket.mode})`}</td></tr>}
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
                  <details className="more" open={!!(o.notes || o.issue)}>
                    <summary>Return, refund or note</summary>
                    <div className="stack">
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
                    </div>
                  </details>
                  <button className="btn primary" type="submit">Save</button>
                </form>
              </div>
            </div>
          </details>
        );
      })}
      {orders.length > listed.length && <p className="muted">Showing every open order and the {listed.length - open.length} most recent others.</p>}
    </OrderFilter>
  );

  const merchants = (
    <>
      <AddMerchantForm />
      {printers.map((p) => {
        const mine = orders.filter((o) => o.printer_id === p.id && counted(o));
        const openHere = mine.filter((o) => ['sent_to_printer', 'printed'].includes(o.status)).length;
        const rs = reviews.filter((r) => mine.some((o) => o.id === r.order_id));
        const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
        const money = merchantMoney(mine, payouts.filter((y) => y.printer_id === p.id));
        return (
          <div key={p.id} className={`card printer-card${p.active ? '' : ' off'}`}>
            <div className="printer-row">
              <div>
                <strong>{p.name}</strong> <span className="muted">{p.area}{p.phone ? ` · ${p.phone}` : ''}{p.active ? '' : ' · turned off'}</span>
                <div className="muted">{plural(mine.length, 'order')} · {rupee(money.available)} to withdraw · {rs.length ? <><Stars n={Math.round(avg)} size={12} /> {avg.toFixed(1)} from {rs.length}</> : 'no reviews yet'}</div>
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
            <details className="more">
              <summary>Details and delete</summary>
              <table className="kv"><tbody>
                <tr><td>Pickup address</td><td>{p.address ? `${p.address}, ${p.city ?? ''} ${p.pincode ?? ''}` : 'Not added yet (the merchant adds it under Account)'}</td></tr>
                <tr><td>Pay to</td><td>{payTo(p) ?? 'Not added yet'}</td></tr>
              </tbody></table>
              <form action={setShiprocketPickup} className="inline-form">
                <input type="hidden" name="id" value={p.id} />
                <label htmlFor={`sp-${p.id}`}>Shiprocket pickup name</label>
                <input className="inp" id={`sp-${p.id}`} name="shiprocket_pickup" defaultValue={p.shiprocket_pickup ?? ''} placeholder={pickupName(p)} maxLength={36} />
                <button className="btn small">Save</button>
              </form>
              <details className="confirm">
                <summary className="btn small danger">Delete merchant</summary>
                <form action={deletePrinter} className="stack">
                  <input type="hidden" name="id" value={p.id} />
                  <p>Delete {p.name} for good? They can no longer sign in.{openHere ? ` Their ${plural(openHere, 'open order')} go back to "Give to a merchant".` : ''} Past orders stay in your numbers without a merchant name.</p>
                  <button className="btn small danger">Yes, delete {p.name}</button>
                </form>
              </details>
            </details>
          </div>
        );
      })}
    </>
  );

  const moneyPanel = (
    <>
      <div className="stats">
        <div className="stat"><span className="stat-n">{sold.length}</span><span className="stat-l">Paid orders ({shirts} shirts)</span></div>
        <div className="stat"><span className="stat-n">{rupee(revenue)}</span><span className="stat-l">Taken from customers</span></div>
        <div className="stat"><span className="stat-n">{rupee(margin)}</span><span className="stat-l">Left after printer, delivery and refunds</span></div>
        <div className="stat"><span className="stat-n">{sold.length ? rupee(revenue / sold.length) : rupee(0)}</span><span className="stat-l">Average order</span></div>
      </div>
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
          <h3>Colours and sizes sold</h3>
          {colours.length ? (
            <>
              <table className="data-table">
                <thead><tr><th>Colour</th><th>Shirts</th></tr></thead>
                <tbody>{colours.map(([name, n]) => <tr key={name}><td>{name}</td><td>{n}</td></tr>)}</tbody>
              </table>
              <table className="data-table">
                <thead><tr><th>Size</th><th>Shirts</th></tr></thead>
                <tbody>{sizes.map(([name, n]) => <tr key={name}><td>{name}</td><td>{n}</td></tr>)}</tbody>
              </table>
            </>
          ) : <p className="muted">No sales yet.</p>}
        </div>
      </div>
      <div className="card">
        <h3>Merchant withdrawals</h3>
        {payouts.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Asked</th><th>Merchant</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{payouts.map((p) => (
                <tr key={p.id}><td>{fmt(p.created_at)}</td><td>{p.printer_name}</td><td>{rupee(p.amount)}</td><td>{p.status === 'paid' ? `Paid${p.reference ? `, ${p.reference}` : ''}` : p.status === 'rejected' ? 'Turned down' : 'Waiting'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">No withdrawals yet. Merchants can ask for their money every 5 days from their page.</p>}
      </div>
    </>
  );

  const reviewsPanel = (
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
  );

  return (
    <>
      <PortalHeader label="Admin" right={<Link href="/admin/login" className="btn small ghost" prefetch={false}>Sign out</Link>} />
      <AdminIdle />
      <div className="portal">
        <Tabs
          initial={sp.tab ?? 'todo'}
          tabs={[
            { key: 'todo', label: todoCount ? `To do (${todoCount})` : 'To do' },
            { key: 'orders', label: `Orders (${orders.length})` },
            { key: 'printers', label: `Merchants (${printers.length})` },
            { key: 'money', label: 'Money' },
            { key: 'reviews', label: `Reviews (${reviews.length})` },
          ]}
          panels={{ todo, orders: ordersPanel, printers: merchants, money: moneyPanel, reviews: reviewsPanel }}
        />
      </div>
    </>
  );
}
