'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../store/useStore';
export default function ClientInit({ children }: { children: React.ReactNode }) {
  const { fetchMe, fetchGroups, fetchMatches, fetchNotifications, user } = useStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = await fetchMe();
      if (!mounted) return;
      if (!current) { router.replace('/login'); return; }
      await Promise.all([fetchGroups(), fetchMatches(), fetchNotifications()]);
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [fetchMe, fetchGroups, fetchMatches, fetchNotifications, router]);
  useEffect(() => {
    if (!user && ready) router.replace('/login');
  }, [user, ready, router]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') fetchNotifications(); }, 15000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);
  if (!ready) return <div className="boot-skeleton" aria-label="Loading clubhouse"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>;
  return user ? <>{children}</> : null;
}
