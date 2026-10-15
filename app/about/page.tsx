import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata = { title: 'About · WearSketch' };

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">About</p>
        <h1>Made by you. Printed in Delhi.</h1>
        <p className="lead">WearSketch started with a simple idea: making your own T-shirt should feel as easy as doodling on paper.</p>
        <p>Most custom tee sites hand you a flat rectangle and a guess. We built a studio where you sketch straight onto a real 3D shirt, turn it around, and see exactly what you will wear, including the sleeves.</p>
        <p>Behind the studio is a small network of trusted Delhi print partners. Each order goes to one of them, printed from high-resolution files, and reaches you with Ekart. You can follow every step, and every review you leave goes straight to the people who printed your shirt.</p>
        <p>We are starting with one free-size tee in nine colours, in Delhi. More sizes, more cities and more products are on the way.</p>
        <p><Link href="/studio" className="btn primary big">Design your tee</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
