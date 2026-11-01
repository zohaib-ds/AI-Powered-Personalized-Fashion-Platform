// Payment providers.
// - UPI: when UPI_ID is set in Vercel, customers pay that UPI ID by QR code with the exact amount
//   and type the 12 digit UPI reference (UTR). The admin checks the bank app and confirms.
//   No gateway fee, but every payment is confirmed by hand.
// - Cash on delivery: the customer pays the courier (₹15 extra, see lib/pricing.ts). The order is confirmed straight away.
// - Sample: without UPI_ID, a sample provider approves every payment so the order flow can be tested.
import { BRAND } from './brand';

export interface PaymentResult {
  ok: boolean;
  provider: string;
  reference: string;
}

export async function samplePay(orderId: string): Promise<PaymentResult> {
  return { ok: true, provider: 'sample', reference: `SAMPLE-${orderId.slice(0, 8).toUpperCase()}` };
}

export const upiOn = () => !!process.env.UPI_ID?.trim();

// payment_ref of a cash on delivery order: the courier collects the money, so it needs no check
export const COD_REF = 'COD';

// payment_ref while a UPI payment waits for the admin: "UTR 123456789012".
// "MISSING 123456789012" when the admin could not find it, so the customer can try again.
export const UTR_SENT = 'UTR ';
export const UTR_MISSING = 'MISSING ';
export const isUtr = (v: string) => /^\d{12}$/.test(v);

export function upiPayee() {
  return { id: (process.env.UPI_ID ?? '').trim(), name: (process.env.UPI_NAME ?? '').trim() || BRAND.name };
}

// The link every UPI app understands; the QR code holds the same text.
export function upiLink(code: string, total: number): string {
  const { id, name } = upiPayee();
  const q = [['pa', id], ['pn', name], ['am', total.toFixed(2)], ['cu', 'INR'], ['tn', `${BRAND.name} order ${code}`]];
  return `upi://pay?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}
