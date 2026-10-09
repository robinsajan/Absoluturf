'use client';

import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export default function ThemeManager() {
  const { theme, setTheme } = useStore();

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return null;
}
