import BrandHeader from '@/components/BrandHeader';
import { COLOURS, CM_PER_IN, printedBox, type DesignSummary, type Side } from '@/lib/design';
import { rupee } from '@/lib/pricing';
import { PRINT_BUCKET, STATUS_LABEL, supabaseAdmin, type OrderRow } from '@/lib/supabase-server';
import { updateOrder } from './actions';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  const orders = (data ?? []) as OrderRow[];

  // one batch of signed links (1 hour) for every print file on the page
  const paths = orders.flatMap((o) => Object.values(o.files ?? {}));
  const links: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await db.storage.from(PRINT_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
  }

  return (
    <>
      <BrandHeader right={<span className="pill">Admin · orders</span>} />
      <div className="page">
        <h1>Orders</h1>
        {error && <div className="err">Could not load orders: {error.message}</div>}
        {!orders.length && !error && <div className="card empty">No orders yet. Place one from the home page to test the flow.</div>}
        {orders.map((o) => {
          const design = o.design as DesignSummary;
          const colour = COLOURS.find((c) => c.id === o.colour_id)?.name ?? o.colour_id;
          return (
            <div key={o.id} className="card admin-order">
              <div className="thumbs" style={{ alignContent: 'start' }}>
                {o.files.preview && links[o.files.preview] && <img src={links[o.files.preview]} alt="Design preview" style={{ width: 160, height: 160 }} />}
              </div>
              <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong>
                  <span className="status">{STATUS_LABEL[o.status]}</span>
                </div>
                <table className="kv"><tbody>
                  <tr><td>Shirt</td><td>{colour}, {o.heavy ? '280' : '240'} GSM, qty {o.qty}</td></tr>
                  {(['front', 'back'] as Side[]).map((side) => {
                    const b = printedBox(design.layers, side);
                    const path = o.files[side];
                    if (!b) return null;
                    const w = b.w / CM_PER_IN, h = b.h / CM_PER_IN;
                    return (
                      <tr key={side}><td>{side === 'front' ? 'Front' : 'Back'} print</td><td>
                        {w.toFixed(1)} × {h.toFixed(1)} in at 300 DPI{' '}
                        {path && links[path] ? <a href={links[path]} target="_blank" rel="noreferrer">Download PNG</a> : '(file missing)'}
                      </td></tr>
                    );
                  })}
                  <tr><td>Customer</td><td>{o.customer_name} · {o.phone}{o.email ? ` · ${o.email}` : ''}</td></tr>
                  <tr><td>Address</td><td>{o.address}, {o.pincode}</td></tr>
                  <tr><td>Total</td><td>{rupee(o.total)} {o.payment_ref && <span style={{ color: 'var(--muted)' }}>({o.payment_ref})</span>}</td></tr>
                </tbody></table>
                <form action={updateOrder} key={`${o.status}|${o.printer}|${o.tracking}|${o.notes}`}>
                  <input type="hidden" name="id" value={o.id} />
                  <div className="field"><label>Status</label>
                    <select className="inp" name="status" defaultValue={o.status}>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Printer</label><input className="inp" name="printer" defaultValue={o.printer ?? ''} placeholder="Which Delhi printer" /></div>
                  <div className="field"><label>Ekart tracking</label><input className="inp" name="tracking" defaultValue={o.tracking ?? ''} /></div>
                  <div className="field"><label>Notes</label><input className="inp" name="notes" defaultValue={o.notes ?? ''} /></div>
                  <button className="btn primary" type="submit">Save</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
