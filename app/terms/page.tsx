import Link from 'next/link';
import Contact from '@/components/Contact';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { upiOn } from '@/lib/payments';
import { PRICES, rupee } from '@/lib/pricing';

export const metadata = { title: `Terms and conditions · ${BRAND.name}`, alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">Legal</p>
        <h1>Terms and conditions</h1>
        <p className="updated">Last updated 19 October 2026</p>
        <p>These terms apply when you use the {BRAND.name} website or order a shirt from us. By placing an order you agree to them. Please also read our <Link href="/privacy">privacy policy</Link> and our <Link href="/policies">shipping and reprint policy</Link>.</p>

        <h2>1. What we sell</h2>
        <p>{BRAND.name} lets you design a T-shirt in the online studio. Each shirt is printed to order by our print partner and delivered to your door by our delivery partner. For now we offer one style of tee in the sizes shown in the studio, and we deliver only to the areas shown at checkout.</p>

        <h2>2. Prices and payment</h2>
        <p>Prices are in Indian rupees. The studio and the checkout show the full price before you order: the price per shirt, which depends on the areas you print, plus delivery: {rupee(PRICES.delivery.base)} for up to {PRICES.delivery.perShirts} shirts and {rupee(PRICES.delivery.step)} more for every further {PRICES.delivery.perShirts} shirts in the order. The price shown when you place the order is the price you pay.</p>
        {upiOn()
          ? <p>You pay by UPI to the UPI ID shown on your order page, using any UPI app. We start on your order once we have checked that the payment reached us. If we cannot find it, your order page asks you to check the UPI reference number.</p>
          : <p>While online payment is being set up, checkout runs in test mode and no money is charged. We will update these terms when real payments start.</p>}

        <h2>3. Your order</h2>
        <p>An order is accepted when you see its order page with an order number. We may cancel an order and give a full refund if we cannot print it, for example because a file is unusable, the address is outside our delivery area or the design breaks section 4.</p>

        <h2>4. Your design</h2>
        <p>You are responsible for what you upload or write. By ordering, you confirm that you own the text, images and artwork in your design, or have permission to use them. You allow us and our print partner to use your design only to print, show you and deliver your order.</p>
        <p>We will not print designs that copy someone else&apos;s trademark, artwork or photo without permission, or that are hateful, threatening, obscene or illegal. We may cancel such orders and refund you.</p>

        <h2>5. How your shirt will look</h2>
        <p>The 3D studio shows a close preview of your shirt, but a screen is not fabric. Printed colours can look slightly different from your screen A print can also sit slightly differently on the shirt than in the preview. Images that the studio marks as low quality may print soft.</p>

        <h2>6. Cancellations, reprints and refunds</h2>
        <p>You can cancel until the printer starts on your order. Because each shirt is made for you, we do not accept returns for a change of mind. If there is a mistake on our side, such as a misprint, a print in the wrong place or a damaged shirt, we reprint it or refund you. The details and time limits are in our <Link href="/policies">shipping and reprint policy</Link>.</p>

        <h2>7. Delivery</h2>
        <p>We deliver your order to the address you give. Please check it carefully. If a parcel cannot be delivered because the address or phone number is wrong, contact us and we will help arrange another delivery.</p>

        <h2>8. Our responsibility</h2>
        <p>We are responsible for printing and delivering your order as described on this website. If something goes wrong, the most we will pay is the amount you paid for that order. Nothing in these terms limits your rights under the Consumer Protection Act, 2019 or any other law that cannot be excluded.</p>

        <h2>9. Using the website</h2>
        <p>Please do not misuse the website, for example by trying to get into other people&apos;s orders, the admin pages or the printer portal, or by uploading harmful files.</p>

        <h2>10. Changes to these terms</h2>
        <p>We may update these terms. The version on this page when you place an order applies to that order.</p>

        <h2>11. Law and disputes</h2>
        <p>These terms are governed by the laws of India. If you have a complaint, contact us first through <Contact /> and we will try to fix it. Any dispute that we cannot settle goes to the courts of India.</p>
      </main>
      <SiteFooter />
    </>
  );
}
