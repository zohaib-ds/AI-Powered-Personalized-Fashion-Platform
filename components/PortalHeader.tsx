import Link from 'next/link';
import Wordmark from './Wordmark';

export default function PortalHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <header className="portal-header">
      <Link href="/" className="brand-link" aria-label="WearSketch home"><Wordmark size={19} /></Link>
      <span className="pill">{label}</span>
      <span className="grow" />
      {right}
    </header>
  );
}
