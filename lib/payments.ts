// Payment provider seam. Only a sample provider exists for now: it approves
// every payment so the whole order flow can be tested. Replace `samplePay`
// with a real gateway (it needs an Indian merchant account) before taking money.

export interface PaymentResult {
  ok: boolean;
  provider: string;
  reference: string;
}

export async function samplePay(orderId: string): Promise<PaymentResult> {
  return { ok: true, provider: 'sample', reference: `SAMPLE-${orderId.slice(0, 8).toUpperCase()}` };
}
