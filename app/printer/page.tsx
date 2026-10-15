import Link from 'next/link';
import PortalHeader from '@/components/PortalHeader';
import PrinterLogin from '@/components/PrinterLogin';
import { Stars } from '@/components/PrintSpec';
import { COLOURS, ZONE_INFO, zonesUsed } from '@/lib/design';
import { currentPrinter } from '@/lib/printer-auth';
import { rupee } from '@/lib/pricing';
import { signedLinks, STATUS_LABEL, supabaseAdmin, type OrderRow, type OrderStatus, type ReviewRow } from '@/lib/supabase-server';
import { printerLogout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Printer portal · WearSketch', robots: { index: false } };

const TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'todo', label: 'To print', statuses: ['paid', 'sent_to_printer'] },
  { key: 'ready', label: 'Ready to ship', statuses: ['printed'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { key: 'done', label: 'Delivered', statuses: ['delivered'] },
];

export default async function PrinterHome({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const printer = await currentPrinter().catch(() => null);
  if (!printer) {
    return (
      <>
        <PortalHeader label="Printer portal" />
        <div className="portal center"><PrinterLogin /></div>
      </>
    );
  }

  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.s) ?? TABS[0];
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('printer_id', printer.id).order('created_at', { ascending: false }).limit(200);
  const all = ((data ?? []) as OrderRow[]).filter((o) => o.status !== 'pending_payment' && o.status !== 'cancelled');
  const ids = all.map((o) => o.id);
  const { data: rv } = ids.length ? await db.from('reviews').select('*').in('order_id', ids) : { data: [] };
  const reviews = (rv ?? []) as ReviewRow[];
  const byOrder = Object.fromEntries(reviews.map((r) => [r.order_id, r]));

  const list = all.filter((o) => tab.statuses.includes(o.status));
  const links = await signedLinks(db, list.map((o) => o.files.preview).filter(Boolean));
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const earned = all.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.printer_cost ?? 0), 0);

  return (
    <>
      <PortalHeader label="Printer portal" right={<form action={printerLogout}><button className="btn small ghost">Sign out</button></form>} />
      <div className="portal">
        <div className="portal-head">
          <div>
            <h1>Hi, {printer.name}</h1>
            <p className="muted">{printer.area ? `${printer.area} · ` : ''}Every order here is paid. Download the print files, print, then mark it shipped with the Ekart tracking number.</p>
          </div>
        </div>
        <div className="stats">
          {TABS.map((t) => (
            <Link key={t.key} href={`/printer?s=${t.key}`} className={`stat${t.key === tab.key ? ' on' : ''}`}>
              <span className="stat-n">{all.filter((o) => t.statuses.includes(o.status)).length}</span>
              <span className="stat-l">{t.label}</span>
            </Link>
          ))}
          <div className="stat">
            <span className="stat-n">{reviews.length ? avg.toFixed(1) : '–'}</span>
            <span className="stat-l">{reviews.length ? <Stars n={Math.round(avg)} size={12} /> : 'No reviews yet'} {reviews.length ? `${reviews.length} review${reviews.length > 1 ? 's' : ''}` : ''}</span>
          </div>
          <div className="stat">
            <span className="stat-n">{rupee(earned)}</span>
            <span className="stat-l">Delivered orders, your rate</span>
          </div>
        </div>

        <h2 className="list-h">{tab.label}</h2>
        {!list.length && <div className="card empty">Nothing here right now.</div>}
        <div className="order-grid">
          {list.map((o) => {
            const colour = COLOURS.find((c) => c.id === o.colour_id);
            const r = byOrder[o.id];
            return (
              <Link key={o.id} href={`/printer/orders/${o.id}`} className="order-card">
                <div className="oc-img">{o.files.preview && links[o.files.preview] ? <img src={links[o.files.preview]} alt="" /> : null}</div>
                <div className="oc-body">
                  <div className="row between"><strong>#{o.code ?? o.id.slice(0, 8).toUpperCase()}</strong><span className={`status s-${o.status}`}>{STATUS_LABEL[o.status]}</span></div>
                  <div className="muted"><span className="swatch-dot sm" style={{ background: colour?.hex }} /> {colour?.name} × {o.qty} · {zonesUsed(o.design).map((z) => ZONE_INFO[z].short).join(', ')}</div>
                  <div className="row between muted">
                    <span>{new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    {r ? <Stars n={r.rating} size={12} /> : <span>{o.pincode}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
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
