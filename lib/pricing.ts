// One pricing function for the browser (live price) and the server (checkout).
// Numbers are placeholders until the Delhi printers' rates are in.
import { COLOURS, printedBox, type DesignSummary, type Side } from './design';

export const PRICES = {
  base: 349, // free-size 240 GSM tee, blank + handling
  heavy: 120, // 280 GSM upgrade
  tiers: [
    { name: 'Small (up to A5)', maxCm2: 311, price: 60 },
    { name: 'Medium (up to A4)', maxCm2: 624, price: 110 },
    { name: 'Large (up to A3+)', maxCm2: Infinity, price: 160 },
  ],
  freeShipAbove: 799,
  ship: 79, // Ekart, within Delhi
  maxQty: 10,
};

export interface Quote {
  lines: { label: string; amount: number }[];
  each: number;
  qty: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export function quote(d: DesignSummary): Quote {
  const colour = COLOURS.find((c) => c.id === d.colourId) ?? COLOURS[0];
  const qty = Math.min(PRICES.maxQty, Math.max(1, Math.floor(d.qty) || 1));
  const lines = [{ label: `Free-size tee, ${colour.name}`, amount: PRICES.base }];
  if (d.heavy) lines.push({ label: '280 GSM heavyweight', amount: PRICES.heavy });
  for (const side of ['front', 'back'] as Side[]) {
    const b = printedBox(d.layers, side);
    if (!b) continue;
    const tier = PRICES.tiers.find((t) => b.w * b.h <= t.maxCm2)!;
    lines.push({ label: `${side === 'front' ? 'Front' : 'Back'} print, ${tier.name}`, amount: tier.price });
  }
  const each = lines.reduce((s, l) => s + l.amount, 0);
  const subtotal = each * qty;
  const shipping = subtotal >= PRICES.freeShipAbove ? 0 : PRICES.ship;
  return { lines, each, qty, subtotal, shipping, total: subtotal + shipping };
}

export const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
