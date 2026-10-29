'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { myOrders, type MyOrder } from '@/app/order/actions';
import { rememberedOrders } from '@/lib/my-orders';
import { rupee } from '@/lib/pricing';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Orders placed in this browser, newest first. Shows nothing until it knows there are some.
export default function MyOrders() {
  const [list, setList] = useState<MyOrder[] | null>(null);
  useEffect(() => {
    const ids = rememberedOrders();
    if (!ids.length) { setList([]); return; }
    myOrders(ids).then(setList, () => setList([]));
  }, []);
  if (!list) return <p className="muted my-orders-wait">Looking for orders placed on this phone…</p>;
  if (!list.length) return null;
  return (
    <section className="my-orders" aria-labelledby="myOrdersTitle">
      <h2 id="myOrdersTitle">Orders on this phone</h2>
      <ul className="my-orders-list">
        {list.map((o) => (
          <li key={o.id}>
            <Link href={`/order/${o.id}`} className="my-order">
              <span className="my-order-code">#{o.code}</span>
              <span className="my-order-state">{o.state}</span>
              <span className="muted">{day(o.createdAt)} · {rupee(o.total)}</span>
              <span className="my-order-open">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
