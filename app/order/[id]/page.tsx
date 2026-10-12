import { notFound } from 'next/navigation';
import BrandHeader from '@/components/BrandHeader';
import { COLOURS } from '@/lib/design';
import { rupee } from '@/lib/pricing';
import { PRINT_BUCKET, STATUS_LABEL, supabaseAdmin, type OrderRow } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  if (!data) notFound();
  const order = data as OrderRow;
  const colour = COLOURS.find((c) => c.id === order.colour_id)?.name ?? order.colour_id;
  let preview: string | null = null;
  if (order.files.preview) {
    const { data: s } = await db.storage.from(PRINT_BUCKET).createSignedUrl(order.files.preview, 3600);
    preview = s?.signedUrl ?? null;
  }

  return (
    <>
      <BrandHeader />
      <div className="page">
        <h1>{order.status === 'pending_payment' ? 'Your order is waiting for payment' : 'Thanks, your order is in'}</h1>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Order {order.id.slice(0, 8).toUpperCase()}</strong>
            <span className="status">{STATUS_LABEL[order.status]}</span>
          </div>
          {preview && <div className="thumbs"><img src={preview} alt="Your shirt design" style={{ width: 240, height: 240 }} /></div>}
          <table className="kv"><tbody>
            <tr><td>Shirt</td><td>Free-size oversized tee, {order.heavy ? '280' : '240'} GSM, {colour} × {order.qty}</td></tr>
            {order.price.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{rupee(l.amount)}</td></tr>)}
            <tr><td>Delivery</td><td>{order.price.shipping ? rupee(order.price.shipping) : 'Free'} (Ekart, Delhi)</td></tr>
            <tr><td>Total paid</td><td><strong>{rupee(order.total)}</strong>{order.payment_ref?.startsWith('SAMPLE') ? ' (sample payment)' : ''}</td></tr>
            <tr><td>Deliver to</td><td>{order.customer_name}, {order.address}, {order.pincode}</td></tr>
            {order.tracking && <tr><td>Ekart tracking</td><td>{order.tracking}</td></tr>}
          </tbody></table>
        </div>
        <div className="card">
          <strong>What happens next</strong>
          <ol className="steps">
            <li>A Delhi print partner prints your shirt.</li>
            <li>Ekart picks it up and delivers it to you.</li>
            <li>This page shows the tracking number once it ships. Keep the link.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
