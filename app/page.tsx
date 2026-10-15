import Link from 'next/link';
import ShirtShowcase from '@/components/ShirtShowcase';
import { Stars } from '@/components/PrintSpec';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { ZONE_INFO } from '@/lib/design';
import { PRICES, quote, rupee } from '@/lib/pricing';
import { supabaseAdmin, type ReviewRow } from '@/lib/supabase-server';

export const revalidate = 300;

const p = (zone: 'front' | 'back' | 'sleeveL' | 'sleeveR') => ({ type: 'text' as const, zone, x: 0, y: 0, wCm: 1, hCm: 1, rot: 0 });
const PLANS = [
  { name: 'Front', note: 'Your design on the chest', price: quote({ prints: [p('front')], qty: 1 }).each },
  { name: 'Front + back', note: 'The most popular way', price: quote({ prints: [p('front'), p('back')], qty: 1 }).each, hot: true },
  { name: 'All four areas', note: 'Front, back and both sleeves', price: quote({ prints: [p('front'), p('back'), p('sleeveL'), p('sleeveR')], qty: 1 }).each },
];

async function publicReviews(): Promise<ReviewRow[]> {
  try {
    const { data } = await supabaseAdmin().from('reviews').select('*').eq('show_on_site', true).order('created_at', { ascending: false }).limit(6);
    return (data ?? []) as ReviewRow[];
  } catch {
    return [];
  }
}

const FAQ = [
  ['Is there a minimum order?', 'No. You can order a single shirt. Up to 10 of the same design go in one order.'],
  ['How long does it take?', 'Your shirt is printed in Delhi after you order and Ekart delivers it. The order page shows each step and the tracking number.'],
  ['What size is the shirt?', 'For now every shirt is our free-size, relaxed fit tee, so there is no size to pick. More sizes are coming.'],
  ['What if my image is low quality?', 'The studio checks every image and tells you if it will look soft at the size you chose, before you pay.'],
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
              <p className="eyebrow">Custom tees, printed in Delhi</p>
              <h1>Sketch your tee in 3D.<br /><span className="hl">Wear it</span> in days.</h1>
              <p className="lead">Draw, type or upload on a real 3D shirt. See it from every side before you pay. A Delhi print partner prints your one piece and Ekart brings it to your door.</p>
              <div className="hero-cta">
                <Link href="/studio" className="btn primary big">Start designing</Link>
                <span className="muted">From <strong>{rupee(PLANS[0].price)}</strong> · no minimum</span>
              </div>
              <ul className="ticks">
                <li>Front, back and both sleeves</li>
                <li>300 DPI print files, checked for you</li>
                <li>Track every step</li>
              </ul>
            </div>
            <ShirtShowcase />
          </div>
        </section>

        <section className="strip" aria-label="Highlights">
          <div className="wrap strip-in">
            <span>One piece, no minimum</span><span>Live 3D preview</span><span>Printed in Delhi</span><span>Delivered by Ekart</span>
          </div>
        </section>

        <section id="how" className="section">
          <div className="wrap">
            <p className="eyebrow">How it works</p>
            <h2>From idea to doorstep in three steps</h2>
            <div className="steps3">
              <div className="step">
                <span className="step-n">1</span>
                <h3>Sketch it</h3>
                <p>Open the studio and draw straight on the shirt, add text in six fonts, or drop in a photo or logo. Turn it around and pick from nine shirt colours.</p>
              </div>
              <div className="step">
                <span className="step-n">2</span>
                <h3>We print it</h3>
                <p>Your design becomes print-ready files at 300 DPI. One of our Delhi print partners prints your shirt and checks it.</p>
              </div>
              <div className="step">
                <span className="step-n">3</span>
                <h3>Wear it</h3>
                <p>Ekart delivers to your door. Follow every step on your order page, then tell us how it came out.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="areas" className="section alt">
          <div className="wrap areas">
            <div>
              <p className="eyebrow">Print areas</p>
              <h2>Four places to make it yours</h2>
              <p className="lead">We print on the front, the back and the outside of each sleeve. The dashed boxes in the studio show exactly where ink can go, so what you see is what gets printed.</p>
              <table className="area-table"><tbody>
                <tr><td>Front</td><td>{ZONE_INFO.front.wCm} × {ZONE_INFO.front.hCm} cm</td></tr>
                <tr><td>Back</td><td>{ZONE_INFO.back.wCm} × {ZONE_INFO.back.hCm} cm</td></tr>
                <tr><td>Each sleeve</td><td>{ZONE_INFO.sleeveL.wCm} × {ZONE_INFO.sleeveL.hCm} cm</td></tr>
              </tbody></table>
            </div>
            <svg className="area-diagram" viewBox="0 0 420 260" role="img" aria-label="T-shirt outline with the front, back and sleeve print areas marked">
              <g className="tee">
                <path d="M70 40 L110 20 Q130 42 150 20 L190 40 L210 80 L185 92 L180 80 L180 230 L80 230 L80 80 L75 92 L50 80 Z" />
                <path d="M230 40 L270 20 Q290 30 310 20 L350 40 L370 80 L345 92 L340 80 L340 230 L240 230 L240 80 L235 92 L210 80 Z" />
              </g>
              <rect className="zone" x="98" y="62" width="64" height="80" rx="3" />
              <rect className="zone" x="258" y="56" width="64" height="80" rx="3" />
              <rect className="zone sm" x="186" y="52" width="14" height="14" rx="2" transform="rotate(25 193 59)" />
              <rect className="zone sm" x="58" y="52" width="14" height="14" rx="2" transform="rotate(-25 65 59)" />
              <text x="130" y="250" textAnchor="middle">Front</text>
              <text x="290" y="250" textAnchor="middle">Back</text>
            </svg>
          </div>
        </section>

        <section id="pricing" className="section">
          <div className="wrap">
            <p className="eyebrow">Pricing</p>
            <h2>Simple prices, no surprises</h2>
            <p className="lead">One free-size tee, printed with your design. Ekart delivery in Delhi is {rupee(PRICES.delivery)} per order.</p>
            <div className="plans">
              {PLANS.map((pl) => (
                <div key={pl.name} className={`plan${pl.hot ? ' hot' : ''}`}>
                  {pl.hot && <span className="badge">Popular</span>}
                  <h3>{pl.name}</h3>
                  <p className="plan-price">{rupee(pl.price)}</p>
                  <p className="muted">{pl.note}</p>
                  <Link href="/studio" className={`btn ${pl.hot ? 'primary' : ''}`}>Design yours</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="section alt">
            <div className="wrap">
              <p className="eyebrow">Reviews</p>
              <h2>What people say</h2>
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

        <section className="cta-band">
          <div className="wrap cta-in">
            <h2>Your next favourite tee starts with a sketch.</h2>
            <Link href="/studio" className="btn big light">Open the studio</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
