import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export default function BrandHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="top">
      <Link href="/" className="brand">
        <span className="brand-mark">{BRAND.logo ? <img src={BRAND.logo} alt="" /> : BRAND.mark}</span>
        <span className="brand-text">
          <span className="brand-name">{BRAND.name}</span>
          <span className="brand-tag">{BRAND.tagline}</span>
        </span>
      </Link>
      {right}
    </header>
  );
}
