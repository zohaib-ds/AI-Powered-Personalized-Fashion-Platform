import { BRAND } from '@/lib/brand';

// The logo when there is one, otherwise the name set in type.
export default function Wordmark({ size = 22 }: { size?: number }) {
  if (BRAND.logo) return <img src={BRAND.logo} alt={BRAND.name} className="wordmark-img" style={{ height: size * 1.3 }} />;
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span>Wear</span><span className="wm-sketch">Sketch</span>
    </span>
  );
}
