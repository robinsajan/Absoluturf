'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from './Sidebar';
export default function BottomNav() {
  const path = usePathname();
  return <nav className="bottom-nav" aria-label="Mobile navigation">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined}><Icon size={20} /><span>{label === 'Dashboard' ? 'Home' : label}</span></Link>)}</nav>;
}
