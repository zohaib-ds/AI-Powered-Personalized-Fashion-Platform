import 'server-only';
import nodemailer from 'nodemailer';
import { BRAND } from './brand';
import { rupee } from './pricing';
import { siteUrl } from './site';
import type { OrderRow } from './supabase-server';

// Order emails, sent from the support Gmail. Set GMAIL_APP_PASSWORD in Vercel: in that Google
// account turn on 2-Step Verification, then make an app password at myaccount.google.com/apppasswords.
// Without it nothing is sent and orders work as before.
export const mailOn = () => !!(BRAND.email && process.env.GMAIL_APP_PASSWORD);

// How long checking a UPI payment takes, as promised on the order page and in the first email.
export const CHECK_PROMISE = 'We check payments every day, and your order is usually confirmed within 24 hours.';

export type OrderMail = 'claimed' | 'confirmed' | 'cod' | 'cancelled';

type MailOrder = Pick<OrderRow, 'id' | 'code' | 'customer_name' | 'email' | 'total'>;

function content(kind: OrderMail, o: MailOrder): { subject: string; lines: string[] } {
  const code = o.code ?? o.id.slice(0, 8).toUpperCase();
  const first = o.customer_name.trim().split(/\s+/)[0] || 'there';
  const hi = `Hi ${first},`;
  switch (kind) {
    case 'claimed':
      return {
        subject: `We are verifying your payment for order #${code}`,
        lines: [hi, `Thank you for placing your ${BRAND.name} order!`,
          `We have received your payment confirmation for ${rupee(o.total)}. We are verifying it against our bank records before sending your order for printing.`,
          'What happens next:', '1. We verify your payment.', '2. Your order is confirmed. We email you when it is.', '3. Your custom T-shirt goes into production.',
          CHECK_PROMISE],
      };
    case 'confirmed':
      return {
        subject: `Payment received. Order #${code} is confirmed`,
        lines: [hi, `We have received your payment of ${rupee(o.total)}. Your order is confirmed and goes to our print partner now.`,
          'Your order page shows each step as your shirt is printed and shipped.'],
      };
    case 'cod':
      return {
        subject: `Order #${code} is confirmed`,
        lines: [hi, `Thank you for your ${BRAND.name} order! It is confirmed and goes to our print partner now.`,
          `You chose cash on delivery: please keep ${rupee(o.total)} ready for the courier.`,
          'Your order page shows each step as your shirt is printed and shipped.'],
      };
    case 'cancelled':
      return {
        subject: `Order #${code} was cancelled`,
        lines: [hi, `We could not find a payment of ${rupee(o.total)} for order #${code}, so we have cancelled it. Nothing will be printed or charged.`,
          'If you did pay, reply to this email with the 12 digit UPI reference number from your UPI app and we will sort it out.'],
      };
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Sends one order email. Never throws: a failed email must not stop the order.
export async function sendOrderMail(kind: OrderMail, o: MailOrder): Promise<boolean> {
  if (!mailOn() || !o.email) return false;
  const code = o.code ?? o.id.slice(0, 8).toUpperCase();
  const link = `${siteUrl()}/order/${o.id}`;
  const { subject, lines } = content(kind, o);
  const footer = [`Order #${code}: ${link}`, `Need help? Reply to this email and mention order #${code}.`, `${BRAND.name}`];
  const text = [...lines, '', ...footer].join('\n\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1e1d1b;max-width:560px">${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}`
    + `<p style="margin:20px 0 12px"><a href="${esc(link)}" style="color:#b8391a">See order #${esc(code)}</a></p>`
    + `<p style="margin:0 0 12px;color:#5f5a52">Need help? Reply to this email and mention order #${esc(code)}.</p><p style="margin:0;color:#5f5a52">${esc(BRAND.name)}</p></div>`;
  try {
    const auth = { user: BRAND.email, pass: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '') };
    // MAIL_SMTP_PORT points at a local test mail server; real emails go through Gmail
    const t = process.env.MAIL_SMTP_PORT
      ? nodemailer.createTransport({ host: '127.0.0.1', port: Number(process.env.MAIL_SMTP_PORT), secure: false, auth })
      : nodemailer.createTransport({ service: 'gmail', auth });
    await t.sendMail({ from: `${BRAND.name} <${BRAND.email}>`, to: o.email, replyTo: BRAND.email, subject, text, html });
    return true;
  } catch (e) {
    console.error('order email failed', kind, code, (e as Error).message);
    return false;
  }
}
