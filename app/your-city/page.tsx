import CityForm from '@/components/CityForm';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';

export const metadata = { title: 'Want it in your city? · WearSketch', description: `Tell us where you are and we will let you know when ${BRAND.name} delivers there.`, alternates: { canonical: '/your-city' } };

export default function YourCity() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <p className="eyebrow">Outside {BRAND.city}</p>
        <h1>Want it in your city?</h1>
        <p className="lead">We deliver only in {BRAND.city} for now. Tell us where you are and what you would like from us. Your designs stay saved in this browser.</p>
        <CityForm />
      </main>
      <SiteFooter />
    </>
  );
}
