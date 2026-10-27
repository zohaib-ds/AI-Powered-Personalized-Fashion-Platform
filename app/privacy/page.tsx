import Link from 'next/link';
import Contact from '@/components/Contact';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { upiOn } from '@/lib/payments';

export const metadata = { title: `Privacy policy · ${BRAND.name}`, alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">Legal</p>
        <h1>Privacy policy</h1>
        <p className="updated">Last updated 19 October 2026</p>
        <p>This policy explains what personal data {BRAND.name} collects when you use this website, why we collect it, who we share it with and what you can ask us to do with it. It is written to meet India&apos;s Digital Personal Data Protection Act, 2023.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>When you order:</strong> your name, mobile number, delivery address (house number, floor, street, area, landmark, city and pincode) and, if you give it, your email address.</li>
          <li><strong>Your design:</strong> the text, drawings and images you put on the shirt, and the print files and preview pictures made from them.</li>
          <li><strong>If you leave a review:</strong> your rating, your comment and the name you enter.</li>
          <li><strong>Technical data:</strong> like any website, our hosting provider receives your IP address and browser details when you load a page.</li>
        </ul>
        <p>We do not ask for your date of birth, and we do not use advertising or tracking cookies.</p>

        <h2>Why we use it</h2>
        <ul>
          <li>To print your shirt and deliver it to you.</li>
          <li>To show you the status of your order and let you find it again with your order number and phone number.</li>
          <li>To contact you about your order, for example if there is a problem with an image or the address.</li>
          <li>To handle reprints, refunds and complaints, and to keep the records that tax and accounting rules require.</li>
        </ul>
        <p>By placing an order you consent to us using your data for these purposes. We do not use it for anything else, and we do not sell it.</p>

        <h2>Who we share it with</h2>
        <ul>
          <li><strong>Our print partner</strong> who prints your order sees your name, phone number, delivery address, the print files and your review of that order.</li>
          <li><strong>Our delivery partner</strong> receives your name, phone number and address to deliver the parcel.</li>
          <li><strong>Our service providers</strong> store and run the website for us: Vercel hosts the site, Supabase stores the order database and print files, and Google Fonts serves the typefaces. Their servers may be outside India.</li>
          {upiOn()
            ? <li><strong>Your UPI app and bank</strong> process your payment. We see the amount and the UPI reference number you give us, to match the payment to your order. We never see your UPI PIN or bank login.</li>
            : <li><strong>A payment provider</strong>, once online payment is switched on, will process your payment. We will never see or store your full card details.</li>}
        </ul>
        <p>We may also share data when the law requires it.</p>

        <h2>Data kept in your browser</h2>
        <p>The design studio saves your current design in your own browser (local storage) so it is still there when you come back. It never leaves your device until you place an order. Clearing your browser data deletes it. The printer portal uses one cookie to keep print partners signed in. Customers do not get any cookies from us.</p>

        <h2>How long we keep it</h2>
        <p>We keep order details and print files while we need them to make, deliver and reprint your order, and for as long as tax and accounting rules require after that. Reviews stay until you or we remove them. When we no longer need your data, we delete it.</p>

        <h2>Your rights</h2>
        <p>You can ask us to:</p>
        <ul>
          <li>tell you what personal data we hold about you and who we have shared it with,</li>
          <li>correct or complete it,</li>
          <li>delete it, unless the law requires us to keep it,</li>
          <li>withdraw your consent, which stops future use but does not affect an order already made.</li>
        </ul>
        <p>You can also nominate someone to use these rights for you if you die or become unable to. To make any of these requests, or to complain about how we handle your data, contact us through <Contact />. Include your order number if you have one. If you are not happy with our answer, you can complain to the Data Protection Board of India.</p>

        <h2>Children</h2>
        <p>If you are under 18, please ask a parent or guardian to place the order for you.</p>

        <h2>Security</h2>
        <p>Order data and print files are stored privately and are only reachable by our team and by the print partner handling that order. Your order page can only be found with its private link, or with your order number and phone number together.</p>

        <h2>Changes</h2>
        <p>If we change this policy, we will update the date at the top of this page. See also our <Link href="/terms">terms and conditions</Link>.</p>
      </main>
      <SiteFooter />
    </>
  );
}
