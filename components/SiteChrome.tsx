import Link from 'next/link';
import Wordmark from './Wordmark';
import { BRAND } from '@/lib/brand';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-in">
        <Link href="/" className="brand-link" aria-label={`${BRAND.name} home`}><Wordmark /></Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/#how">How it works</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/track">Track order</Link>
          <Link href="/help">Help</Link>
        </nav>
        <Link href="/studio" className="btn primary">Start designing</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-in">
        <div className="footer-brand">
          <Wordmark size={20} />
          <p className="muted">{BRAND.tagline} One piece, no minimum order.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Make</h4>
            <Link href="/studio">Design studio</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#areas">Print areas</Link>
          </div>
          <div>
            <h4>Orders</h4>
            <Link href="/track">Track your order</Link>
            <Link href="/help">Help and FAQ</Link>
            <Link href="/policies">Shipping and returns</Link>
          </div>
          <div>
            <h4>WearSketch</h4>
            <Link href="/about">About us</Link>
            <Link href="/policies#privacy">Privacy</Link>
            <Link href="/printer">For print partners</Link>
          </div>
        </div>
      </div>
      <div className="wrap footer-base muted">© {new Date().getFullYear()} {BRAND.name} · Printed in {BRAND.city}, delivered by Ekart</div>
    </footer>
  );
}
