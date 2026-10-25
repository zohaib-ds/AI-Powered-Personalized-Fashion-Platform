'use client';

import { useEffect, useState } from 'react';

// Tabs that switch instantly: every panel is already on the page and only one is shown.
// The open tab is kept in the address as #name so a refresh stays on it. (Not ?tab=: changing the
// query makes Next.js treat it as a new page after a form is sent, which would wipe form results.)
export default function Tabs({ tabs, initial, panels }: { tabs: { key: string; label: string }[]; initial: string; panels: Record<string, React.ReactNode> }) {
  const known = (k: string) => tabs.some((t) => t.key === k);
  const [on, setOn] = useState(known(initial) ? initial : tabs[0].key);
  useEffect(() => {
    const k = window.location.hash.slice(1);
    if (known(k)) setOn(k);
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (key: string) => {
    setOn(key);
    window.history.replaceState(null, '', `#${key}`);
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={on === t.key} className={on === t.key ? 'on' : ''} onClick={() => pick(t.key)}>{t.label}</button>
        ))}
      </nav>
      {tabs.map((t) => <div key={t.key} role="tabpanel" hidden={on !== t.key}>{panels[t.key]}</div>)}
    </>
  );
}

// Status filter for a list of orders: each child carries data-s="<status>".
export function OrderFilter({ options, children }: { options: { key: string; label: string }[]; children: React.ReactNode }) {
  const [f, setF] = useState('');
  return (
    <>
      <div className="filters">
        {[{ key: '', label: 'All' }, ...options].map((o) => (
          <button key={o.key} type="button" className={f === o.key ? 'on' : ''} aria-pressed={f === o.key} onClick={() => setF(o.key)}>{o.label}</button>
        ))}
      </div>
      <div className="order-list" data-f={f}>{children}</div>
    </>
  );
}
