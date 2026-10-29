'use client';

import { useEffect } from 'react';
import { rememberOrder } from '@/lib/my-orders';

// Adds this order to My orders in this browser.
export default function RememberOrder({ id }: { id: string }) {
  useEffect(() => rememberOrder(id), [id]);
  return null;
}
