import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import MyOrders from '@/components/MyOrders';
import TrackForm from '@/components/TrackForm';

export const metadata = { title: 'My orders · WearSketch', description: 'Find and track your WearSketch orders.', alternates: { canonical: '/track' } };

export default function Track() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <p className="eyebrow">My orders</p>
        <h1>Where is my shirt?</h1>
        <MyOrders />
        <h2 className="track-title">Find an order</h2>
        <p className="lead">Ordered on another phone or browser? Enter the order number from your confirmation page and the 10-digit mobile number you ordered with.</p>
        <TrackForm />
      </main>
      <SiteFooter />
    </>
  );
}
