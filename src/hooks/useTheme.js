import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour la gestion du thème (light/dark) avec persistance localStorage.
 * 
 * Priorité :
 * 1. localStorage ('emag-theme')
 * 2. Préférence système (prefers-color-scheme)
 * 3. Fallback: 'light'
 * 
 * Usage:
 *   const { theme, toggleTheme, setTheme } = useTheme();
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // 1. Vérifier localStorage
    const saved = localStorage.getItem('emag-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    
    // 2. Vérifier la préférence système
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    
    // 3. Fallback
    return 'light';
  });

  // Appliquer le thème au DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('emag-theme', theme);
  }, [theme]);

  // Écouter les changements de préférence système
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Ne changer que si l'utilisateur n'a pas explicitement choisi
      const saved = localStorage.getItem('emag-theme');
      if (!saved) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const isDark = theme === 'dark';

  return { theme, isDark, toggleTheme, setTheme };
}

export default useTheme;
