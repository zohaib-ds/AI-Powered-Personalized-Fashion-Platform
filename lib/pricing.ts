// One pricing module for the browser (live price, cart) and the server (checkout).
import { ZONE_INFO, ZONES, zonesUsed, type PrintSummary } from './design';

export const PRICES = {
  // what the customer pays per shirt, by how many areas are printed (1 to 4)
  byAreas: [359, 409, 439, 459],
  // delivery per order: ₹49 for up to 4 shirts, then ₹30 more for every further 4
  delivery: { base: 49, step: 30, perShirts: 4 },
  // what the print partner charges us per shirt (used for margins and the printer's rate)
  printer: {
    firstSide: 300, // blank free-size tee + the first printed side (front or back)
    secondSide: 50, // printing both front and back
    sleeve: 25, // each printed sleeve
  },
  maxQty: 10, // shirts of one design
  maxItems: 10, // designs in one cart
};

export interface ItemQuote {
  label: string; // e.g. "Front and back print"
  areas: number;
  each: number; // what the customer pays per shirt
  cost: number; // what the printer charges per shirt
  qty: number;
  subtotal: number;
}

export interface OrderQuote {
  items: ItemQuote[];
  shirts: number;
  subtotal: number;
  shipping: number;
  total: number;
  cost: number; // printer cost for the whole order
}

const clampQty = (n: number) => Math.min(PRICES.maxQty, Math.max(1, Math.floor(n) || 1));

export const TEST_PRICE = 1; // the ₹1 test size, with no delivery charge

export function quoteItem(d: { prints: PrintSummary[]; qty: number; size?: string }): ItemQuote {
  const zones = zonesUsed(d);
  const P = PRICES.printer;
  const sides = zones.filter((z) => z === 'front' || z === 'back').length;
  const sleeves = zones.length - sides;
  const cost = P.firstSide + (sides === 2 ? P.secondSide : 0) + sleeves * P.sleeve;
  const areas = Math.max(1, zones.length);
  const test = d.size === 'test';
  const each = test ? TEST_PRICE : PRICES.byAreas[areas - 1];
  const qty = clampQty(d.qty);
  const names = ZONES.filter((z) => zones.includes(z)).map((z) => ZONE_INFO[z].label.toLowerCase());
  const label = names.length ? `${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} print` : 'Blank shirt';
  return { label: label[0].toUpperCase() + label.slice(1), areas, each, cost: test ? 0 : cost, qty, subtotal: each * qty };
}

export function deliveryFee(shirts: number): number {
  const D = PRICES.delivery;
  return D.base + D.step * Math.floor((Math.max(1, shirts) - 1) / D.perShirts);
}

export function quoteOrder(items: { prints: PrintSummary[]; qty: number; size?: string }[]): OrderQuote {
  const q = items.map(quoteItem);
  const shirts = q.reduce((s, i) => s + i.qty, 0);
  const subtotal = q.reduce((s, i) => s + i.subtotal, 0);
  const shipping = q.length && !items.every((i) => i.size === 'test') ? deliveryFee(shirts) : 0;
  return { items: q, shirts, subtotal, shipping, total: subtotal + shipping, cost: q.reduce((s, i) => s + i.cost * i.qty, 0) };
}

// cheapest shirt: one printed area
export const FROM_PRICE = PRICES.byAreas[0];

export const rupee = (n: number) => (Math.round(n) < 0 ? '−₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN');
