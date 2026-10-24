import Link from 'next/link';
import PortalHeader from '@/components/PortalHeader';
import PrinterLogin from '@/components/PrinterLogin';
import { Stars } from '@/components/PrintSpec';
import { average, formatHours, hoursBetween, weekLabel, weekly } from '@/lib/analytics';
import { COLOURS, ZONE_INFO, zonesUsed } from '@/lib/design';
import { currentPrinter } from '@/lib/printer-auth';
import { rupee } from '@/lib/pricing';
import { orderItems, orderPreview, signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type OrderStatus, type ReviewRow } from '@/lib/supabase-server';
import { printerLogout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Merchant portal · WearSketch', robots: { index: false } };

const TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'todo', label: 'To print', statuses: ['paid', 'sent_to_printer'] },
  { key: 'ready', label: 'Printed', statuses: ['printed'] },
  { key: 'pickup', label: 'Pickup requested', statuses: ['pickup_requested'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { key: 'done', label: 'Delivered', statuses: ['delivered'] },
];

export default async function PrinterHome({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const printer = await currentPrinter().catch(() => null);
  if (!printer) {
    return (
      <>
        <PortalHeader label="Merchant portal" />
        <div className="portal center"><PrinterLogin /></div>
      </>
    );
  }

  const tab = TABS.find((t) => t.key === sp.s) ?? TABS[0];
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('printer_id', printer.id).order('created_at', { ascending: false }).limit(500);
  const all = ((data ?? []) as OrderRow[]).filter((o) => o.status !== 'pending_payment' && o.status !== 'cancelled');
  const ids = all.map((o) => o.id);
  const { data: rv } = ids.length ? await db.from('reviews').select('*').in('order_id', ids) : { data: [] };
  const reviews = (rv ?? []) as ReviewRow[];
  const byOrder = Object.fromEntries(reviews.map((r) => [r.order_id, r]));

  const list = all.filter((o) => tab.statuses.includes(o.status));
  const links = await signedLinks(db, list.map(orderPreview).filter((p): p is string => !!p));
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  // analysis
  const delivered = all.filter((o) => o.status === 'delivered');
  const earned = delivered.reduce((s, o) => s + (o.printer_cost ?? 0), 0);
  const pending = all.filter((o) => o.status !== 'delivered').reduce((s, o) => s + (o.printer_cost ?? 0), 0);
  const shirts = all.reduce((s, o) => s + o.qty, 0);
  const weeks = weekly(all);
  const toPrinted = average(all.map((o) => hoursBetween(o.status_times?.sent_to_printer ?? o.status_times?.paid, o.status_times?.printed)));
  const stars = [5, 4, 3, 2, 1].map((n) => [n, reviews.filter((r) => r.rating === n).length] as const);

  return (
    <>
      <PortalHeader label="Merchant portal" right={<form action={printerLogout}><button className="btn small ghost">Sign out</button></form>} />
      <div className="portal">
        <div className="portal-head">
          <div>
            <h1>Hi, {printer.name}</h1>
            <p className="muted">{printer.area ? `${printer.area} · ` : ''}Every order here is paid. Open an order, download the print files and print the shirts. When they are packed, tap Request pickup.</p>
          </div>
        </div>
        <div className="stats">
          {TABS.map((t) => (
            <Link key={t.key} href={`/printer?s=${t.key}`} className={`stat${t.key === tab.key ? ' on' : ''}`}>
              <span className="stat-n">{all.filter((o) => t.statuses.includes(o.status)).length}</span>
              <span className="stat-l">{t.label}</span>
            </Link>
          ))}
        </div>

        <h2 className="list-h">{tab.label}</h2>
        {!list.length && <div className="card empty">Nothing here right now.</div>}
        <div className="order-grid">
          {list.map((o) => {
            const items = orderItems(o);
            const pic = orderPreview(o);
            const r = byOrder[o.id];
            return (
              <Link key={o.id} href={`/printer/orders/${o.id}`} className="order-card">
                <div className="oc-img">{pic && links[pic] ? <img src={links[pic]} alt="" /> : null}</div>
                <div className="oc-body">
                  <div className="row between"><strong>#{o.code ?? o.id.slice(0, 8).toUpperCase()}</strong><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span></div>
                  {items.map((it, i) => {
                    const colour = COLOURS.find((c) => c.id === it.colourId);
                    return <div key={i} className="muted"><span className="swatch-dot sm" style={{ background: colour?.hex }} /> {colour?.name} × {it.qty} · {zonesUsed(it).map((z) => ZONE_INFO[z].short).join(', ')}</div>;
                  })}
                  <div className="row between muted">
                    <span>{new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    {r ? <Stars n={r.rating} size={12} /> : <span>{o.pincode}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <h2 className="list-h">Your numbers</h2>
        <div className="analysis">
          <table className="kv"><tbody>
            <tr><td>Orders so far</td><td>{all.length} ({shirts} shirts)</td></tr>
            <tr><td>Earned on delivered orders</td><td>{rupee(earned)}</td></tr>
            <tr><td>Still to be delivered</td><td>{rupee(pending)}</td></tr>
            <tr><td>Average time to print</td><td>{formatHours(toPrinted)}</td></tr>
            <tr><td>Average rating</td><td>{reviews.length ? <>{avg.toFixed(1)} from {reviews.length} review{reviews.length > 1 ? 's' : ''}</> : 'No reviews yet'}</td></tr>
          </tbody></table>
          <div>
            <table className="data-table">
              <thead><tr><th>Week from</th><th>Orders</th><th>Shirts</th><th>Your rate</th></tr></thead>
              <tbody>{weeks.map((w) => <tr key={w.start}><td>{weekLabel(w.start)}</td><td>{w.orders}</td><td>{w.shirts}</td><td>{rupee(w.cost)}</td></tr>)}</tbody>
            </table>
            {reviews.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Rating</th><th>Reviews</th></tr></thead>
                <tbody>{stars.map(([n, c]) => <tr key={n}><td><Stars n={n} size={12} /></td><td>{c}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>

        <h2 className="list-h">Customer reviews</h2>
        {!reviews.length && <div className="card empty">Reviews show up here when customers rate the shirts you printed.</div>}
        <div className="reviews">
          {reviews.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => {
            const o = all.find((x) => x.id === r.order_id);
            return (
              <div key={r.id} className="review">
                <div className="row between"><Stars n={r.rating} /><Link href={`/printer/orders/${r.order_id}`} className="muted">#{o?.code}</Link></div>
                {r.comment && <p>“{r.comment}”</p>}
                <div className="muted">{r.name || 'Customer'} · {new Date(r.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
