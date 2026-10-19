import Link from 'next/link';
import ShirtShowcase from '@/components/ShirtShowcase';
import { Stars } from '@/components/PrintSpec';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { COLOURS, FONTS, ZONE_INFO, type Zone } from '@/lib/design';
import { FROM_PRICE, PRICES, quote, rupee } from '@/lib/pricing';
import { supabaseAdmin, type ReviewRow } from '@/lib/supabase-server';

export const revalidate = 300;

// Prices come from the same function the studio and checkout use.
const at = (zones: Zone[]) => quote({ prints: zones.map((zone) => ({ type: 'text' as const, zone, x: 0, y: 0, wCm: 1, hCm: 1, rot: 0 })), qty: 1 }).each;
const PRICE_ROWS: [string, number][] = [
  ['Front only, or back only', at(['front'])],
  ['Front and back', at(['front', 'back'])],
  ['Front, back and one sleeve', at(['front', 'back', 'sleeveL'])],
  ['Front, back and both sleeves', at(['front', 'back', 'sleeveL', 'sleeveR'])],
];

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
  ['Order it', 'Enter a Delhi address (pincodes starting with 110). You get an order number and an order page that shows where your shirt is.'],
  ['We print it', 'A print shop in Delhi gets a 300 DPI file for each area you designed, prints your shirt and marks it as printed.'],
  ['Ekart delivers it', 'When the shirt ships, the Ekart tracking number appears on your order page.'],
];

const FAQ = [
  ['Is there a minimum order?', `No. You can order one shirt. Up to ${PRICES.maxQty} shirts with the same design fit in one order.`],
  ['What size is the shirt?', 'Every shirt is a free-size, relaxed fit tee for now, so there is no size to pick.'],
  ['Where can you print?', 'On the front, the back and the outside of each sleeve. We do not print on the sides of the shirt.'],
  ['What if my image is low quality?', 'The studio checks every image against the size you set it to and shows a warning if it will print soft.'],
];

export default async function Home() {
  const reviews = await publicReviews();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="wrap hero-in">
            <div className="hero-copy">
              <p className="eyebrow">Custom T-shirts, Delhi</p>
              <h1>Design your <span className="nowrap">T-shirt</span> on a 3D model. <span className="hl">We print it in Delhi.</span></h1>
              <p className="lead">Draw, add text or upload an image on the front, back and sleeves. Turn the shirt to see every side, then order a single piece. Ekart delivers it to your door.</p>
              <div className="hero-cta">
                <Link href="/studio" className="btn primary big">Open the studio</Link>
                <Link href="/#pricing" className="btn big">See prices</Link>
              </div>
              <dl className="hero-facts">
                <div><dt>Price</dt><dd>From {rupee(FROM_PRICE)}</dd></div>
                <div><dt>Delivery in Delhi</dt><dd>{rupee(PRICES.delivery)} per order</dd></div>
                <div><dt>Minimum order</dt><dd>1 shirt</dd></div>
              </dl>
            </div>
            <ShirtShowcase />
          </div>
        </section>

        <section id="how" className="section">
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
                  <span className="n">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="areas" className="section alt">
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
        </section>

        <section id="pricing" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Pricing</p>
                <h2>You pay for the areas you print</h2>
              </div>
              <p>Every price includes the shirt and the printing. The studio shows the exact price for your design before you order.</p>
            </div>
            <div className="price-wrap">
              <table className="price-table">
                <thead><tr><th>What gets printed</th><th>Per shirt</th></tr></thead>
                <tbody>
                  {PRICE_ROWS.map(([label, price]) => <tr key={label}><td>{label}</td><td>{rupee(price)}</td></tr>)}
                </tbody>
              </table>
              <ul className="price-notes">
                <li><strong>Delivery: {rupee(PRICES.delivery)} per order</strong><span>Ekart, anywhere in Delhi. One fee however many shirts are in the order.</span></li>
                <li><strong>Shirt: free-size tee</strong><span>Relaxed fit, in {COLOURS.length} colours.</span></li>
                <li><strong>Quantity: 1 to {PRICES.maxQty}</strong><span>All shirts in one order carry the same design.</span></li>
              </ul>
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
                    <div className="muted">{r.name || 'Customer'}, Delhi</div>
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
            <p>Your design is saved in your browser as you go, so you can come back to it later.</p>
            <Link href="/studio" className="btn primary big">Open the studio</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
