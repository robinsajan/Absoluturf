import Link from 'next/link';
export function Pitch({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 180 120" fill="none" aria-hidden="true">
    <rect x="8" y="8" width="164" height="104" rx="4" stroke="currentColor" />
    <path d="M90 8v104M8 35h27v50H8m164-50h-27v50h27" stroke="currentColor" />
    <circle cx="90" cy="60" r="22" stroke="currentColor" /><circle cx="90" cy="60" r="2" fill="currentColor" />
  </svg>;
}
export default function Brand() {
  return <Link href="/dashboard" className="brand" aria-label="AbsoluTurf home">
    <span className="brand-mark"><Pitch /></span>
    <span>ABSOLU<span className="accent">TURF</span><small>Your squad. Your game.</small></span>
  </Link>;
}
