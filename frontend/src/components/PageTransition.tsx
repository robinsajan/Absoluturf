'use client';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
export default function PageTransition() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <motion.div key={pathname} aria-hidden="true" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: 0 }} transition={{ duration: 0.4 }} style={{position:'fixed',top:0,left:0,right:0,height:2,background:'var(--accent)',transformOrigin:'left',zIndex:99,pointerEvents:'none'}} />;
}
