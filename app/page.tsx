import Link from 'next/link';
import ShirtShowcase from '@/components/ShirtShowcase';
import PriceCalc from '@/components/PriceCalc';
import Photo from '@/components/Photo';
import { Stars } from '@/components/PrintSpec';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { COLOURS, FONTS, ZONE_INFO } from '@/lib/design';
import { FROM_PRICE, PRICES, rupee } from '@/lib/pricing';
import { BRAND } from '@/lib/brand';
import { siteUrl } from '@/lib/site';
import { supabaseAdmin, type ReviewRow } from '@/lib/supabase-server';

export const revalidate = 300;
export const metadata = { alternates: { canonical: '/' } };

// Prices come from the same table the studio and checkout use.
const PRICE_ROWS: [string, string, number][] = [
  ['1 area', 'Front, back or one sleeve', PRICES.byAreas[0]],
  ['2 areas', 'For example front and back', PRICES.byAreas[1]],
  ['3 areas', 'For example front, back and one sleeve', PRICES.byAreas[2]],
  ['All 4 areas', 'Front, back and both sleeves', PRICES.byAreas[3]],
];
const D = PRICES.delivery;

async function publicReviews(): Promise<ReviewRow[]> {
  try {
    const { data } = await supabaseAdmin().from('reviews').select('*').eq('show_on_site', true).order('created_at', { ascending: false }).limit(6);
    return (data ?? []) as ReviewRow[];
  } catch {
    return [];
  }
}

const STEPS = [
  ['Design it', `Open the studio and draw with the pen, type text in one of ${Object.keys(FONTS).length} fonts, or upload a PNG or JPG. Turn the shirt to check the front, back and sleeves. If an image is too small for the size you picked, the studio tells you before you order.`],
  ['Add it to your cart', 'Add the design to your cart, then make another one if you like. One order can hold several designs, each in its own colour and quantity.'],
  ['We print it', 'Our print partner gets a 300 DPI file for each area you designed and prints your shirts. Your order page shows when they are printed.'],
  ['We deliver it to your door', 'When your parcel leaves, the tracking number appears on your order page.'],
];

const FAQ = [
  ['Is there a minimum order?', `No. You can order a single shirt. You can also add up to ${PRICES.maxItems} different designs to one order, with up to ${PRICES.maxQty} shirts of each.`],
  ['What sizes do you have?', 'S, M, L, XL and XXL. You pick the size when you add your design to the cart, and every size costs the same.'],
  ['Where can you print?', 'On the front, the back and the outside of each sleeve. We do not print on the sides of the shirt.'],
  ['What if my image is low quality?', 'The studio checks every image against the size you set it to and shows a warning if it will print soft.'],
];

// Tells Google the site's name and logo, so a search for the brand finds it.
function brandData() {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${url}/#org`, name: BRAND.name, url, logo: `${url}/logo.png`, ...(BRAND.email ? { email: BRAND.email } : {}) },
      { '@type': 'WebSite', '@id': `${url}/#site`, name: BRAND.name, url, publisher: { '@id': `${url}/#org` } },
    ],
  };
}

// Simple line icons (decoration only).
const ICON: Record<string, React.ReactNode> = {
  one: <><path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></>,
  redo: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  file: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></>,
  team: <><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 20c.6-3.6 2.8-5.5 5.5-5.5s4.9 1.9 5.5 5.5M14 15c2.9-.6 6 .9 7 5" /></>,
  star: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8c-1.5-4-6-4-6-1.5S10 8 12 8zM12 8c1.5-4 6-4 6-1.5S14 8 12 8z" /></>,
  shop: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-4.7 0A3 3 0 0 1 4 11z" /><path d="M5 13v8h14v-8" /></>,
  cup: <><path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2.5M8 3v2M12 3v2" /></>,
  note: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  heart: <><path d="M12 20s-7.5-4.6-9-9.5C2 6.9 4.4 4 7.5 4c2 0 3.6 1.1 4.5 2.7C12.9 5.1 14.5 4 16.5 4 19.6 4 22 6.9 21 10.5 19.5 15.4 12 20 12 20z" /></>,
  plane: <><path d="M3 13l18-8-6 16-3-7z" /><path d="M12 14l3-4" /></>,
};
function Icon({ name }: { name: string }) {
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg>;
}

const TRUST: [string, string, string][] = [
  ['one', 'No minimum order', `Order one shirt, or up to ${PRICES.maxItems} designs at once`],
  ['cash', 'Cash on delivery', 'Or pay by UPI before we print'],
  ['redo', 'Free reprint if we get it wrong', 'Tell us within 3 days of delivery'],
  ['file', 'Print files at 300 DPI', 'Made from your design at full size'],
];

// The rolling strip under the hero: what people make shirts for (no client logos).
const MADE_FOR: [string, string][] = [
  ['team', 'Sports teams'], ['star', 'College fests'], ['gift', 'Birthday gifts'], ['shop', 'Small brands'],
  ['cup', 'Cafes and shops'], ['note', 'Bands and gigs'], ['heart', 'Couples and friends'], ['plane', 'Family trips'],
];

// Photos the team adds to public/photos. Each tile shows a coloured panel until its photo exists.
const IDEAS: [string, string, string][] = [
  ['idea-team.jpg', 'Team shirts', 't1'],
  ['idea-fest.jpg', 'College fests', 't2'],
  ['idea-gift.jpg', 'Gifts', 't3'],
  ['idea-brand.jpg', 'Your own brand', 't4'],
  ['idea-friends.jpg', 'Friends and family', 't5'],
  ['idea-back.jpg', 'Big back prints', 't6'],
];

// real screens of the site for each step of an order
const STEP_IMAGES = ['step-design', 'step-cart', 'step-print', 'step-track'];

export default async function Home() {
  const reviews = await publicReviews();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(brandData()).replace(/</g, '\\u003c') }} />
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="wrap hero-in">
            <div className="hero-copy">
              <p className="eyebrow">Custom T-shirts, made to order</p>
              <h1>Design your <span className="nowrap">T-shirt</span> on a 3D model. We deliver it to your door.</h1>
              <p className="lead">Draw, add text or upload an image on the front, back and sleeves. Turn the shirt to see every side, then order a single shirt or several. We print each one to order.</p>
              <div className="hero-cta">
                <Link href="/studio" className="btn primary big">Open the studio</Link>
                <Link href="/#pricing" className="btn outline big">See prices</Link>
              </div>
              <dl className="hero-facts">
                <div><dt>Price</dt><dd>From {rupee(FROM_PRICE)}</dd></div>
                <div><dt>Delivery</dt><dd>From {rupee(D.base)}</dd></div>
                <div><dt>Minimum order</dt><dd>1 shirt</dd></div>
              </dl>
            </div>
            <div className="hero-photo">
              <Photo src="/photos/hero.jpg" alt="A customer wearing a T-shirt printed by WearSketch"
                fallback={<img src="/home/step-design.jpg" alt="The WearSketch 3D design studio" />} />
            </div>
          </div>
        </section>

        <section className="madefor" aria-label="What people make shirts for">
          <span className="madefor-lbl">Made for</span>
          <div className="marquee">
            {[0, 1].map((k) => (
              <ul key={k} className="marquee-track" aria-hidden={k === 1 ? true : undefined}>
                {MADE_FOR.map(([icon, label]) => <li key={label}><Icon name={icon} />{label}</li>)}
              </ul>
            ))}
          </div>
        </section>

        <section id="how" className="section teal">
          <div className="wrap">
            <div className="section-head center">
              <p className="eyebrow">How an order works</p>
              <h2>Four steps from the studio to your door</h2>
              <p>You can follow every step on your order page.</p>
            </div>
            <ol className="steps">
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span className="step-img"><img src={`/home/${STEP_IMAGES[i]}.jpg`} alt="" width={800} height={560} loading="lazy" /></span>
                  <span className="n">Step {i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section trust-sec" aria-label="Why order from us">
          <ul className="wrap trust-in">
            {TRUST.map(([icon, title, text]) => (
              <li key={title}><Icon name={icon} /><strong>{title}</strong><span>{text}</span></li>
            ))}
          </ul>
        </section>

        <section id="ideas" className="section ideas-sec">
          <div className="wrap">
            <ul className="ideas">
              <li className="ideas-lead">
                <h2>A shirt for every occasion</h2>
                <p>Print on the front, back and both sleeves, in {COLOURS.length} shirt colours and sizes S to XXL.</p>
                <Link href="/studio" className="btn primary">Start designing</Link>
              </li>
              {IDEAS.map(([file, label, tone]) => (
                <li key={file} className={`idea ${tone}`}>
                  <Link href="/studio" className="idea-link">
                    <span className="idea-img">
                      <Photo src={`/photos/${file}`} alt={label} fallback={<span className="idea-ph" aria-hidden="true">{label}</span>} />
                    </span>
                    <span className="idea-cap">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="section teal">
          <div className="wrap price-wrap">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2>You pay for the areas you print</h2>
              <p className="lead">Every price includes the shirt and the printing. The price depends only on how many areas you print, and the studio shows it as you design.</p>
              <table className="price-table">
                <tbody>
                  {PRICE_ROWS.map(([label, note, price]) => <tr key={label}><td><strong>{label}</strong><span className="td-note">{note}</span></td><td>{rupee(price)}</td></tr>)}
                </tbody>
              </table>
              <ul className="price-notes">
                <li><strong>Delivery: {rupee(D.base)} for up to {D.perShirts} shirts</strong><span>Then {rupee(D.step)} more for every {D.perShirts} shirts after that, for the whole order.</span></li>
                <li><strong>Sizes S to XXL</strong><span>Same price for every size, in {COLOURS.length} colours.</span></li>
              </ul>
            </div>
            <div className="calc-card">
              <h3>Work out your price</h3>
              <PriceCalc />
            </div>
          </div>
        </section>

        <section className="banner" aria-label="Printed one by one">
          <Photo src="/photos/banner.jpg" alt="" className="banner-img" />
          <div className="wrap banner-in">
            <h2>Printed one by one, for you</h2>
            <p>Every order is printed by hand from a full size 300 DPI file of your design, then packed and sent to your door.</p>
          </div>
        </section>

        <section id="try" className="section">
          <div className="wrap try">
            <div>
              <p className="eyebrow">Try it here</p>
              <h2>Turn the shirt. Pick a colour.</h2>
              <p className="lead">This is the same 3D model you design on in the studio. Drag it to see the back and the sleeves, then open the studio to make your own.</p>
              <Link href="/studio" className="btn primary big">Open the studio</Link>
            </div>
            <ShirtShowcase />
          </div>
        </section>

        <section id="areas" className="section soft">
          <div className="wrap areas">
            <div>
              <p className="eyebrow">Print areas</p>
              <h2>Front, back and both sleeves</h2>
              <p className="lead">The dashed boxes in the studio show exactly where ink can go. Anything outside them is not printed. The sides of the shirt stay blank.</p>
              <table className="area-table"><tbody>
                <tr><td>Front</td><td>{ZONE_INFO.front.wCm} × {ZONE_INFO.front.hCm} cm</td></tr>
                <tr><td>Back</td><td>{ZONE_INFO.back.wCm} × {ZONE_INFO.back.hCm} cm</td></tr>
                <tr><td>Each sleeve</td><td>{ZONE_INFO.sleeveL.wCm} × {ZONE_INFO.sleeveL.hCm} cm</td></tr>
              </tbody></table>
            </div>
            <div className="diagram-card">
              <svg className="area-diagram" viewBox="0 0 420 260" role="img" aria-label="T-shirt outline from the front and the back with the print areas marked">
                <g className="tee">
                  <path d="M70 40 L110 20 Q130 42 150 20 L190 40 L210 80 L185 92 L180 80 L180 230 L80 230 L80 80 L75 92 L50 80 Z" />
                  <path d="M230 40 L270 20 Q290 30 310 20 L350 40 L370 80 L345 92 L340 80 L340 230 L240 230 L240 80 L235 92 L210 80 Z" />
                </g>
                <rect className="zone" x="98" y="62" width="64" height="80" />
                <rect className="zone" x="258" y="56" width="64" height="80" />
                <rect className="zone sm" x="186" y="52" width="14" height="14" transform="rotate(25 193 59)" />
                <rect className="zone sm" x="58" y="52" width="14" height="14" transform="rotate(-25 65 59)" />
                <text x="130" y="250" textAnchor="middle">Front</text>
                <text x="290" y="250" textAnchor="middle">Back</text>
              </svg>
            </div>
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="section">
            <div className="wrap">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Reviews</p>
                  <h2>From people who ordered</h2>
                </div>
                <p>Only customers with a printed order can leave a review.</p>
              </div>
              <div className="reviews">
                {reviews.map((r) => (
                  <div key={r.id} className="review">
                    <Stars n={r.rating} />
                    {r.comment && <p>“{r.comment}”</p>}
                    <div className="muted">{r.name || 'Customer'}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="section">
          <div className="wrap faq-wrap">
            <div>
              <p className="eyebrow">Questions</p>
              <h2>Good to know</h2>
              <p className="lead">More answers on the <Link href="/help">help page</Link>.</p>
            </div>
            <div className="faq">
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-line">
          <div className="wrap cta-in">
            <h2>Ready to make yours?</h2>
            <p>Your design is saved in your browser as you go, so you can come back to it later.</p>
            <Link href="/studio" className="btn light big">Open the studio</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
