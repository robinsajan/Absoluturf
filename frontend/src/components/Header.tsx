'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, X, ArrowUpRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import Brand from './Brand';
export default function Header() {
  const { user, matches, groups, notifications, markNotificationsRead } = useStore();
  const path = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  if (!user) return null;
  const unread = notifications.filter(n => !n.read).length;
  const term = query.trim().toLowerCase();
  const results = [...matches.filter(m => `${m.turf_name} ${m.location}`.toLowerCase().includes(term)).map(m => ({ key: `m${m.id}`, label: m.turf_name, meta: `Match · ${m.match_date}`, href: `/matches?id=${m.id}` })), ...groups.filter(g => `${g.name} ${g.sport_type}`.toLowerCase().includes(term)).map(g => ({ key: `g${g.id}`, label: g.name, meta: `Group · ${g.sport_type}`, href: `/groups?id=${g.id}` }))].slice(0, 8);
  return <header className="app-header" ref={ref}>
    <div className="mobile-brand"><Brand /></div><div className="header-title"><span className="eyebrow">AbsoluTurf / Clubhouse</span><strong>{path.split('/')[1]}</strong></div>
    <div className="header-tools"><button className="icon-button mobile-search-toggle" aria-label="Search clubhouse" aria-expanded={showSearch} onClick={() => {setShowSearch(!showSearch);setOpen(false);}}><Search size={20}/></button><div className={showSearch ? 'global-search mobile-search-open' : 'global-search'}><Search size={17} /><input aria-label="Search matches and groups" placeholder="Search your clubhouse" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}
      {term && <div className="search-results"><p className="eyebrow">Matches & groups</p>{results.length ? results.map(r => <Link key={r.key} href={r.href} onClick={() => {setQuery('');setShowSearch(false);}}><span><strong>{r.label}</strong><small>{r.meta}</small></span><ArrowUpRight size={16} /></Link>) : <p className="muted">No matching matches or groups.</p>}</div>}
    </div>
    <button className="icon-button notification-trigger" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}><Bell size={20} />{unread > 0 && <span className="notification-dot" />}</button>
    <Link className="avatar" href="/profile" aria-label="My profile">{user.name[0]}</Link></div>
    {open && <section className="notification-panel" aria-label="Notifications"><div className="section-heading"><h3>Notifications</h3><button className="text-link" disabled={!unread} onClick={() => markNotificationsRead()}>Mark all read</button></div><div className="notification-list">{notifications.length ? notifications.slice(0, 30).map(n => <div className={`notification-item ${!n.read ? 'unread' : ''}`} key={n.id}><button onClick={() => markNotificationsRead(n.id)}><p>{n.message}</p><small>{new Date(n.created_at + (n.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></button>{n.match_id && <Link className="text-link" href={`/matches?id=${n.match_id}`} onClick={() => { markNotificationsRead(n.id); setOpen(false); }}>View match <ArrowUpRight size={14} /></Link>}</div>) : <div className="empty-state compact"><Bell size={28} /><h3>All caught up</h3><p>Match updates and payment confirmations will appear here.</p></div>}</div></section>}
  </header>;
}
