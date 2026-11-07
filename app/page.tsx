import Link from 'next/link';
import ShirtShowcase from '@/components/ShirtShowcase';
import PriceCalc from '@/components/PriceCalc';
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

// Simple line icons for the trust strip (decoration only).
const ICON: Record<string, React.ReactNode> = {
  one: <><path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></>,
  redo: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  file: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></>,
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

// 3D previews made in the studio (public/home), shown as examples of what people can make.
const GALLERY: [string, string, string][] = [
  ['weekend', 'Black tee', 'Text in Anton'],
  ['class', 'Navy tee', 'Text in Bebas Neue'],
  ['goodthings', 'Forest tee', 'Text in Playfair Display'],
  ['team', 'Red tee', 'Text in Anton'],
  ['logo', 'White tee', 'Your own logo or photo'],
  ['madebyme', 'Heather grey tee', 'Text in Permanent Marker'],
  ['hello', 'Sky tee', 'Text in IBM Plex Mono'],
  ['sunday', 'Mustard tee', 'Text in Pacifico'],
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
              <h1>Design your <span className="nowrap">T-shirt</span> on a 3D model. <span className="hl">We deliver it to your door.</span></h1>
              <p className="lead">Draw, add text or upload an image on the front, back and sleeves. Turn the shirt to see every side, then order a single shirt or several. We print each one to order.</p>
              <div className="hero-cta">
                <Link href="/studio" className="btn primary big">Open the studio</Link>
                <Link href="/#pricing" className="btn big">See prices</Link>
              </div>
              <dl className="hero-facts">
                <div><dt>Price</dt><dd>From {rupee(FROM_PRICE)}</dd></div>
                <div><dt>Delivery</dt><dd>From {rupee(D.base)}</dd></div>
                <div><dt>Minimum order</dt><dd>1 shirt</dd></div>
              </dl>
            </div>
            <div className="hero-visual"><ShirtShowcase /></div>
          </div>
        </section>

        <section className="trust" aria-label="Why order from us">
          <ul className="wrap trust-in">
            {TRUST.map(([icon, title, text]) => (
              <li key={title}><Icon name={icon} /><div><strong>{title}</strong><span>{text}</span></div></li>
            ))}
          </ul>
        </section>

        <section id="ideas" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Made in our studio</p>
                <h2>{COLOURS.length} colours, any design you like</h2>
              </div>
              <p>These shirts were designed in the WearSketch studio. What you see here is the same 3D preview you get for your own design, before you order.</p>
            </div>
            <ul className="gallery">
              {GALLERY.map(([file, name, detail]) => (
                <li key={file}>
                  <Link href="/studio" className="g-card">
                    <span className="g-img"><img src={`/home/tee-${file}.jpg`} alt={`${name} with a sample design: ${detail.toLowerCase()}`} width={720} height={880} loading="lazy" /></span>
                    <span className="g-name">{name}</span>
                    <span className="g-detail">{detail}</span>
                    <span className="g-price">From {rupee(FROM_PRICE)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="section alt">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">How an order works</p>
                <h2>Four steps from the studio to your door</h2>
              </div>
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

        <section id="pricing" className="section dark">
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

        <section id="areas" className="section">
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
          <section className="section alt">
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
          <div className="wrap">
            <div className="cta-band">
              <div>
                <h2>Ready to make yours?</h2>
                <p>Your design is saved in your browser as you go, so you can come back to it later.</p>
              </div>
              <Link href="/studio" className="btn light big">Open the studio</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
