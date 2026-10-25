'use client';

import { useEffect } from 'react';

const IDLE_MS = 10 * 60 * 1000;
const PING_MS = 60 * 1000;

// Signs the admin out after 10 minutes with no mouse, touch, key or scroll activity.
// While someone is active it pings the server once a minute so the session stays alive.
export default function AdminIdle() {
  useEffect(() => {
    let last = Date.now();
    let pinged = Date.now();
    const seen = () => { last = Date.now(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, seen, { passive: true }));
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - last >= IDLE_MS) {
        window.location.href = '/admin/login?idle=1';
      } else if (last > pinged && now - pinged >= PING_MS) {
        pinged = now;
        fetch('/admin/ping', { cache: 'no-store' }).then((r) => { if (r.redirected || r.status === 401) window.location.href = '/admin/login?expired=1'; }).catch(() => {});
      }
    }, 5000);
    return () => {
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, seen));
    };
  }, []);
  return null;
}
