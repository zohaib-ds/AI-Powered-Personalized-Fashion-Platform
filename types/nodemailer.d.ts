// The small part of nodemailer that lib/mail.ts uses (the full type package pulls in large AWS types).
declare module 'nodemailer' {
  interface SendMailOptions { from: string; to: string; replyTo?: string; subject: string; text: string; html?: string }
  interface Transporter { sendMail(options: SendMailOptions): Promise<{ messageId: string }> }
  export function createTransport(options: { service?: string; host?: string; port?: number; secure?: boolean; auth: { user: string; pass: string } }): Transporter;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
