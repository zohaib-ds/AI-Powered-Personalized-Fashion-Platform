import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import TrackForm from '@/components/TrackForm';

export const metadata = { title: 'Track your order · WearSketch', description: 'Track your WearSketch order with your order number and mobile number.', alternates: { canonical: '/track' } };

export default function Track() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <p className="eyebrow">Track order</p>
        <h1>Where is my shirt?</h1>
        <p className="lead">Enter the order number from your confirmation page and the 10-digit mobile number you ordered with.</p>
        <TrackForm />
      </main>
      <SiteFooter />
    </>
  );
}
