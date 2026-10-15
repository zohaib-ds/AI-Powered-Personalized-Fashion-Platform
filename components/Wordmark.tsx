import { BRAND } from '@/lib/brand';

// The logo when there is one, otherwise a type wordmark with a pencil stroke.
export default function Wordmark({ size = 22 }: { size?: number }) {
  if (BRAND.logo) return <img src={BRAND.logo} alt={BRAND.name} className="wordmark-img" style={{ height: size * 1.3 }} />;
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span>Wear</span>
      <span className="wm-sketch">
        Sketch
        <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 20 2, 38 11, 55 6 S 86 3, 98 7" /></svg>
      </span>
    </span>
  );
}
