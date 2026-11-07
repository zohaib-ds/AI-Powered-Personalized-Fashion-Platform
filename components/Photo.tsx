'use client';
import { useEffect, useState, type ReactNode } from 'react';

// A photo from public/photos that the team adds later. Until the file exists,
// the fallback shows instead, so the page never shows a broken image.
export default function Photo({ src, alt, className, fallback = null }: { src: string; alt: string; className?: string; fallback?: ReactNode }) {
  const [state, setState] = useState<'wait' | 'ok' | 'none'>('wait');
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setState(img.naturalWidth > 0 ? 'ok' : 'none');
    img.onerror = () => live && setState('none');
    img.src = src;
    return () => { live = false; };
  }, [src]);
  if (state === 'ok') return <img src={src} alt={alt} className={className} />;
  if (state === 'none') return <>{fallback}</>;
  return null;
}
