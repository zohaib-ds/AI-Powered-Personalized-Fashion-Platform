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
        <Link href="/studio" className="btn primary">Open the studio</Link>
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
          <p className="muted">Custom T-shirts designed in 3D, printed in {BRAND.city} and delivered by Ekart.</p>
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
            <Link href="/policies">Shipping and reprints</Link>
          </div>
          <div>
            <h4>{BRAND.name}</h4>
            <Link href="/about">About us</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms and conditions</Link>
            <Link href="/printer">For print partners</Link>
          </div>
        </div>
      </div>
      <div className="wrap footer-base muted">© {new Date().getFullYear()} {BRAND.name}</div>
    </footer>
  );
}
