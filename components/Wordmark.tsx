import { BRAND } from '@/lib/brand';

// The logo, with the name set beside it where there is room for it.
// `light` is the version for dark backgrounds (the footer).
export default function Wordmark({ size = 22, name = true, light = false }: { size?: number; name?: boolean; light?: boolean }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <img src={light ? BRAND.logoLight : BRAND.logo} alt={name ? '' : BRAND.name} className="wordmark-img" width={124} height={112} />
      {name && <span className="wm-name"><span>Wear</span><span className="wm-sketch">Sketch</span></span>}
    </span>
  );
}
