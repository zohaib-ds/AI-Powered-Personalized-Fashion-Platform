import AdminLogin from '@/components/AdminLogin';
import PortalHeader from '@/components/PortalHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in · WearSketch', robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; idle?: string }> }) {
  const sp = await searchParams;
  const note = sp.idle ? 'You were signed out after 10 minutes without activity.' : sp.expired ? 'Please sign in again.' : null;
  return (
    <>
      <PortalHeader label="Admin" />
      <div className="portal center"><AdminLogin note={note} /></div>
    </>
  );
}
