import PortalHeader from '@/components/PortalHeader';
import PrinterLogin from '@/components/PrinterLogin';
import PrintSpec from '@/components/PrintSpec';
import { AccountForm, PickupButton, WithdrawForm } from '@/components/MerchantForms';
import Tabs from '@/components/Tabs';
import { COLOURS, sizeShort, ZONE_INFO, zonesUsed } from '@/lib/design';
import { merchantMoney, WITHDRAW_EVERY_DAYS } from '@/lib/payouts';
import { currentPrinter } from '@/lib/printer-auth';
import { rupee } from '@/lib/pricing';
import { orderItems, orderPreview, payTo, signedLinks, supabaseAdmin, type OrderRow, type PayoutRow } from '@/lib/supabase-server';
import { printerLogout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Merchant portal · WearSketch', robots: { index: false } };

const fmt = (d: string | number) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const day = (d: number) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });

export default async function PrinterHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
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

  const db = supabaseAdmin();
  const [{ data: od }, { data: yd }] = await Promise.all([
    db.from('orders').select('*').eq('printer_id', printer.id).in('status', ['paid', 'sent_to_printer', 'printed', 'pickup_requested', 'shipped', 'delivered']).order('created_at', { ascending: true }).limit(1000),
    db.from('payouts').select('*').eq('printer_id', printer.id).order('created_at', { ascending: false }),
  ]);
  const all = (od ?? []) as OrderRow[];
  const payouts = (yd ?? []) as PayoutRow[];
  const toPrint = all.filter((o) => ['paid', 'sent_to_printer', 'printed'].includes(o.status));
  const waiting = all.filter((o) => o.status === 'pickup_requested');
  const done = all.filter((o) => o.status === 'delivered');
  const links = await signedLinks(db, [...toPrint, ...waiting].flatMap((o) => orderItems(o).flatMap((it) => Object.values(it.files ?? {}))));
  const money = merchantMoney(all, payouts);
  const payDetails = payTo(printer);
  const blocked = !payDetails ? 'Add your UPI ID or bank account in the Account tab first.'
    : money.available <= 0 ? 'Nothing to withdraw yet. You earn your rate when an order is delivered.'
    : !money.canNow ? `You can withdraw again on ${day(money.nextAt)}.` : null;

  const ordersPanel = (
    <>
      {!printer.address && <div className="warn">Add your shop address in the Account tab so the courier knows where to collect from.</div>}
      <h2 className="list-h">To print ({toPrint.length})</h2>
      {!toPrint.length && <div className="card empty">No orders to print right now.</div>}
      {toPrint.map((o) => {
        const items = orderItems(o);
        const pic = orderPreview(o);
        return (
          <div key={o.id} className="card m-order">
            <div className="m-order-top">
              <span className="m-thumb">{pic && links[pic] ? <img src={links[pic]} alt="" /> : null}</span>
              <div className="m-what">
                <strong>Order #{o.code ?? o.id.slice(0, 8).toUpperCase()}</strong>
                {items.map((it, i) => {
                  const colour = COLOURS.find((c) => c.id === it.colourId);
                  return <div key={i}><span className="swatch-dot sm" style={{ background: colour?.hex }} /> {colour?.name} shirt, size {sizeShort(it.size)}, {it.qty} piece{it.qty > 1 ? 's' : ''}. Print on {zonesUsed(it).map((z) => ZONE_INFO[z].label.toLowerCase()).join(', ')}.</div>;
                })}
                <div className="muted">Ordered {fmt(o.created_at)} · your rate {rupee(o.printer_cost ?? 0)}</div>
                {o.notes && <div className="note-line">Note from WearSketch: {o.notes}</div>}
              </div>
            </div>
            <details className="more">
              <summary>Print files</summary>
              {items.map((it, i) => (
                <section key={i} className="ao-item">
                  {items.length > 1 && <h4>Design {i + 1} of {items.length}</h4>}
                  {it.files.views && links[it.files.views] && <img className="views spec-views" src={links[it.files.views]} alt={`Design ${i + 1} from the front, left, back and right`} />}
                  <PrintSpec design={{ colourId: it.colourId, size: it.size, qty: it.qty, prints: it.prints }} files={it.files} links={links} />
                </section>
              ))}
            </details>
            <PickupButton id={o.id} />
          </div>
        );
      })}

      {waiting.length > 0 && (
        <>
          <h2 className="list-h">Waiting for the courier ({waiting.length})</h2>
          {waiting.map((o) => {
            const sr = o.shiprocket;
            return (
              <div key={o.id} className="card m-wait">
                <div>
                  <strong>Order #{o.code}</strong> · {o.qty} piece{o.qty > 1 ? 's' : ''}
                  <div className="muted">
                    {sr?.awb ? <>Courier {sr.courier ?? ''} booked, tracking {sr.awb}. Print the label and stick it on the parcel.</> : 'WearSketch is booking the courier. Keep the parcel packed and ready.'}
                  </div>
                </div>
                {sr?.label_url && <a className="btn primary" href={sr.label_url} target="_blank" rel="noreferrer">Download label</a>}
              </div>
            );
          })}
        </>
      )}
    </>
  );

  const moneyPanel = (
    <>
      <div className="stats">
        <div className="stat"><span className="stat-n">{done.length}</span><span className="stat-l">Orders completed</span></div>
        <div className="stat"><span className="stat-n">{rupee(money.earned)}</span><span className="stat-l">Earned on delivered orders</span></div>
        <div className="stat"><span className="stat-n">{rupee(money.paid)}</span><span className="stat-l">Paid to you</span></div>
        <div className="stat"><span className="stat-n">{rupee(money.available)}</span><span className="stat-l">Ready to withdraw</span></div>
      </div>
      <div className="card stack">
        <h3>Withdraw money</h3>
        <p className="muted">You can withdraw once every {WITHDRAW_EVERY_DAYS} days. We send it to {payDetails ?? 'the UPI ID or bank account in your Account tab'}.</p>
        <WithdrawForm amount={money.available > 0 ? rupee(money.available) : null} blocked={blocked} />
      </div>
      {payouts.length > 0 && (
        <div className="card">
          <h3>Your withdrawals</h3>
          <table className="data-table">
            <thead><tr><th>Asked on</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{payouts.map((p) => (
              <tr key={p.id}><td>{fmt(p.created_at)}</td><td>{rupee(p.amount)}</td><td>{p.status === 'paid' ? `Paid${p.reference ? `, ref ${p.reference}` : ''}` : p.status === 'rejected' ? 'Not paid, call WearSketch' : 'Waiting'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );

  const account = (
    <>
      <p className="muted">Your login ID is <code className="access">{printer.login_id ?? printer.access_code}</code></p>
      {/* only the fields the form shows: never send the password hash to the browser */}
      <AccountForm p={{ phone: printer.phone, address: printer.address, city: printer.city, pincode: printer.pincode, account_name: printer.account_name, account_number: printer.account_number, ifsc: printer.ifsc, upi_id: printer.upi_id }} />
    </>
  );

  return (
    <>
      <PortalHeader label="Merchant portal" right={<form action={printerLogout}><button className="btn small ghost">Sign out</button></form>} />
      <div className="portal">
        <div className="portal-head">
          <div>
            <h1>Hi, {printer.name}</h1>
            <p className="muted">Print the orders below. When an order is printed and packed, tap Printing done, request pickup.</p>
          </div>
        </div>
        <Tabs
          initial={sp.tab ?? 'orders'}
          tabs={[
            { key: 'orders', label: `Orders (${toPrint.length})` },
            { key: 'money', label: 'Money' },
            { key: 'account', label: 'Account' },
          ]}
          panels={{ orders: ordersPanel, money: moneyPanel, account }}
        />
      </div>
    </>
  );
}
