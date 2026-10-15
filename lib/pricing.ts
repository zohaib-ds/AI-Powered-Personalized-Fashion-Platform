// One pricing function for the browser (live price) and the server (checkout).
// Delhi printers quoted ₹300–400 for a printed free-size tee; Ekart delivers
// in Delhi for under ₹50. We sell at printer cost + 15%.
import { ZONE_INFO, zonesUsed, type DesignSummary } from './design';

export const PRICES = {
  printer: {
    firstSide: 300, // blank free-size tee + the first printed side (front or back)
    secondSide: 50, // printing both front and back
    sleeve: 25, // each printed sleeve
  },
  delivery: 50, // Ekart, within Delhi, per order
  margin: 0.15,
  maxQty: 10,
};

// round up to the next ₹5 so prices look tidy and never dip under the margin
const up5 = (n: number) => Math.ceil(n / 5) * 5;

export interface Quote {
  lines: { label: string; amount: number }[];
  cost: number; // what the printer charges us per shirt
  each: number; // what the customer pays per shirt
  qty: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export function quote(d: Pick<DesignSummary, 'prints' | 'qty'>): Quote {
  const P = PRICES.printer;
  const zones = zonesUsed(d);
  const sides = zones.filter((z) => z === 'front' || z === 'back');
  const sleeves = zones.filter((z) => z === 'sleeveR' || z === 'sleeveL');
  const lines: { label: string; cost: number }[] = [
    { label: sides.length ? `Tee with ${ZONE_INFO[sides[0]].label.toLowerCase()} print` : 'Free-size tee', cost: P.firstSide },
  ];
  if (sides.length === 2) lines.push({ label: 'Back print', cost: P.secondSide });
  for (const z of sleeves) lines.push({ label: `${ZONE_INFO[z].label} print`, cost: P.sleeve });

  const qty = Math.min(PRICES.maxQty, Math.max(1, Math.floor(d.qty) || 1));
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const each = up5(cost * (1 + PRICES.margin));
  // spread the rounding across the lines so they add up to `each`
  const priced = lines.map((l) => ({ label: l.label, amount: Math.round(l.cost * (1 + PRICES.margin)) }));
  priced[0].amount += each - priced.reduce((s, l) => s + l.amount, 0);
  const subtotal = each * qty;
  return { lines: priced, cost, each, qty, subtotal, shipping: PRICES.delivery, total: subtotal + PRICES.delivery };
}

// cheapest shirt: one printed side
export const FROM_PRICE = quote({ prints: [{ type: 'text', zone: 'front', x: 0, y: 0, wCm: 1, hCm: 1, rot: 0 }], qty: 1 }).each;

export const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
