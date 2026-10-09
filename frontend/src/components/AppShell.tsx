'use client';
import { usePathname } from 'next/navigation';
import ClientInit from './ClientInit';
import ThemeManager from './ThemeManager';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import PageContent from './PageContent';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, clearError } = useStore();
  if (path === '/' || path === '/login' || path.startsWith('/invite/')) return <>{children}</>;
  return <ClientInit><ThemeManager /><div className="app-shell"><Sidebar /><div className="app-workspace"><Header /><main className="app-main"><PageContent>{children}</PageContent></main></div><BottomNav />{error && <div className="error-toast" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={clearError}><X size={18} /></button></div>}</div></ClientInit>;
}
