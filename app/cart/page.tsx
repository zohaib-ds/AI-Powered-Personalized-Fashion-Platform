import CartView from '@/components/CartView';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';

export const metadata = { title: `Your cart · ${BRAND.name}`, robots: { index: false } };

export default function Cart() {
  return (
    <>
      <SiteHeader />
      <main className="wrap cart-page">
        <h1>Your cart</h1>
        <CartView />
      </main>
      <SiteFooter />
    </>
  );
}
