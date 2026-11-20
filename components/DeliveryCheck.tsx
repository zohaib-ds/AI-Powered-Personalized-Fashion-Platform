'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { checkDelivery } from '@/app/admin/actions';

const word = (f: string) => (f === 'Y' ? 'yes' : f === 'N' ? 'no' : 'not sure');

function Btn() {
  const { pending } = useFormStatus();
  return <button className="btn small" disabled={pending}>{pending ? 'Checking…' : 'Check with iCarry'}</button>;
}

// Admin: asks iCarry whether it delivers to an order's pincode. Changes nothing.
export default function DeliveryCheck({ pincode }: { pincode: string }) {
  const [r, action] = useActionState(checkDelivery, null);
  return (
    <form action={action} className="todo-act">
      <input type="hidden" name="pincode" value={pincode} />
      <Btn />
      {r && ('error' in r
        ? <span className="low">{r.error}</span>
        : r.covered === 'yes'
          ? <span>iCarry delivers here. Prepaid: {word(r.prepaid)}, cash on delivery: {word(r.cod)}.</span>
          : r.covered === 'unsure'
            ? <span className="low">iCarry is not sure about {pincode}. Check it on the iCarry site.</span>
            : <span className="low">iCarry does not deliver to {pincode}.</span>)}
    </form>
  );
}
