import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { COLOURS, FONTS, ZONE_INFO } from '@/lib/design';
import { FROM_PRICE, PRICES, rupee } from '@/lib/pricing';

export const metadata = { title: `Help and FAQ · ${BRAND.name}` };

const D = PRICES.delivery;

const GROUPS: [string, [string, React.ReactNode][]][] = [
  ['Designing', [
    ['Where can I print?', <>On four areas: the front ({ZONE_INFO.front.wCm} × {ZONE_INFO.front.hCm} cm), the back ({ZONE_INFO.back.wCm} × {ZONE_INFO.back.hCm} cm) and the outside of each sleeve ({ZONE_INFO.sleeveL.wCm} × {ZONE_INFO.sleeveL.hCm} cm). In the studio these show as dashed boxes on the shirt. Anything you place outside a box is not printed, and we never print on the sides of the shirt.</>],
    ['How do I choose where my text or image goes?', 'In the Text and Image sections of the studio, pick Front, Back, L sleeve or R sleeve under "Add it to" before you add it. The shirt turns to that side and your text or image is placed inside that area. You can then drag it into position, resize it or rotate it.'],
    ['What images work best?', 'A PNG with a transparent background gives the cleanest result, because only your artwork is printed and not a white box around it. For a full front print, use an image at least 2000 pixels wide. After you add an image, the studio shows how many DPI it will print at for the size you chose and warns you if it will look soft.'],
    ['How do the pencil and eraser work?', 'Pick Pencil, choose an ink colour and draw straight on the shirt inside a dashed box. Every time you pick the pencil, your next lines become a new drawing, so you can move or resize it on its own later. The eraser only removes pencil lines. It does not touch text or images, which you delete with the Delete button instead.'],
    ['Will the colours on the shirt match my screen?', 'They will be close but not identical. A screen gives off light and fabric does not, so very bright colours, such as fluorescent greens and pinks, print a little duller than they look on screen. For the clearest result, use dark ink on a light shirt or light ink on a dark shirt.'],
    ['Is my design saved if I leave the page?', 'Yes. The studio saves your design in this browser as you work. If you come back later on the same phone or computer, in the same browser, it will still be there. Designs you add to the cart are saved in the same way. Clearing your browser data removes them.'],
  ]],
  ['Prices and orders', [
    ['How much does a shirt cost?', <>It depends only on how many of the four areas you print: {PRICES.byAreas.map((p, i) => `${i + 1} area${i ? 's' : ''} ${rupee(p)}`).join(', ')}. That price includes the shirt and the printing. See the <Link href="/#pricing">price table</Link>.</>],
    ['How much is delivery?', <>Delivery is {rupee(D.base)} for an order of up to {D.perShirts} shirts. For every {D.perShirts} shirts after that, it goes up by {rupee(D.step)}. For example, 5 to 8 shirts cost {rupee(D.base + D.step)} to deliver and 9 to 12 shirts cost {rupee(D.base + 2 * D.step)}. You see the delivery fee in your cart before you check out.</>],
    ['Can I order several different designs together?', `Yes. Add a design to your cart, change the shirt or start a new design, and add that one too. One order can hold up to ${PRICES.maxItems} designs with up to ${PRICES.maxQty} shirts of each, and you pay one delivery fee for the whole order.`],
    ['What size is the shirt?', `For now every shirt is the same free-size tee with a relaxed fit, so there is no size to choose. It comes in ${COLOURS.length} colours, and you can use ${Object.keys(FONTS).length} fonts for text. The cheapest shirt is ${rupee(FROM_PRICE)}.`],
    ['Where do you deliver?', 'You can design shirts from anywhere. At checkout we show which areas we can deliver to right now, before you enter your address or pay.'],
    ['How do I track my order?', <>Your order page updates at every step: placed, printing, printed, on the way and delivered. Once the parcel leaves, its tracking number is shown there too. If you lose the link, open <Link href="/track">Track order</Link> and enter your order number and the mobile number you ordered with.</>],
  ]],
  ['Problems', [
    ['My print came out wrong. What can I do?', <>If something is wrong on our side, such as a misprint, a print in the wrong place, a stain or a damaged shirt, tell us within 7 days of delivery. Send a photo and your order number, and we will print it again for free or refund you. The details are in our <Link href="/policies">reprint policy</Link>.</>],
    ['Can I cancel my order?', 'Yes, for a full refund, as long as the printer has not started on it. Once printing has started, your shirt is being made only for you, so we cannot cancel it.'],
    ['I typed the wrong address or phone number', 'Contact us as soon as possible with your order number and the correct details. If the parcel has not left yet, we will correct it before it ships.'],
  ]],
];

export default function Help() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <p className="eyebrow">Help</p>
        <h1>Help and questions</h1>
        {GROUPS.map(([title, items]) => (
          <section key={title} className="help-group">
            <h2>{title}</h2>
            <div className="faq">
              {items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </section>
        ))}
        <section className="card contact">
          <h2>Still need help?</h2>
          <p className="muted">Tell us your order number and what happened.</p>
          <div className="row">
            {BRAND.whatsapp && <a className="btn primary" href={`https://wa.me/${BRAND.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a>}
            {BRAND.email && <a className="btn" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>}
            {!BRAND.whatsapp && !BRAND.email && <span className="muted">Our support contact is being set up and will appear here.</span>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
