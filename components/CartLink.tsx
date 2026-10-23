'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CART_EVENT, cartCount } from '@/lib/cart';

// "Cart (3)" in the header; updates when anything is added or removed.
export default function CartLink({ className = '' }: { className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => { cartCount().then(setN); };
    load();
    window.addEventListener(CART_EVENT, load);
    return () => window.removeEventListener(CART_EVENT, load);
  }, []);
  return <Link href="/cart" className={className}>Cart{n ? ` (${n})` : ''}</Link>;
}
