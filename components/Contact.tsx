import Link from 'next/link';
import { BRAND } from '@/lib/brand';

// How to reach us, used in the legal pages. Shows the support email once it is set in lib/brand.ts.
export default function Contact() {
  if (BRAND.email) return <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>;
  return <>the contact details on our <Link href="/help">Help page</Link></>;
}
