'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Wallet, UserRound, Plus, LogOut, ArrowUpRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import Brand from './Brand';
export const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Matches', href: '/matches', icon: CalendarDays },
  { label: 'Groups', href: '/groups', icon: Users },
  { label: 'Payments', href: '/payments', icon: Wallet },
  { label: 'Profile', href: '/profile', icon: UserRound },
];
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, groups, logout } = useStore();
  if (!user) return null;
  const admin = groups.some(g => g.role === 'Admin');
  return <aside className="app-sidebar">
    <Brand /><p className="eyebrow sidebar-label">Clubhouse</p>
    <nav aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) =>
      <Link key={href} href={href} className={`nav-item ${pathname === href ? 'active' : ''}`} aria-current={pathname === href ? 'page' : undefined}>
        <Icon size={19} /><span>{label}</span>{pathname === href && <span className="nav-dot" />}
      </Link>)}</nav>
    <Link href={admin ? '/matches?create=true' : '/groups?create=true'} className="btn btn-primary sidebar-create"><Plus size={18} />{admin ? 'Propose a match' : 'Create a group'}</Link>
    <div className="sidebar-note"><span className="eyebrow accent">Less organising.</span><h3>More time<br />on the pitch.</h3><Link href="/groups">Find your squad <ArrowUpRight size={16} /></Link></div>
    <div className="sidebar-user"><Link href="/profile" className="user-identity"><span className="avatar">{user.name[0]}</span><span><strong>{user.name}</strong><small>{admin ? 'Squad organiser' : 'Squad member'}</small></span></Link><button className="icon-button" aria-label="Sign out" onClick={async () => { await logout(); router.replace('/login'); }}><LogOut size={18} /></button></div>
  </aside>;
}
