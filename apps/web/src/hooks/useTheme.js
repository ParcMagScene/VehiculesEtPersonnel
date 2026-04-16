import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour la gestion du thème eM@g (mode + palette + densité).
 *
 * Trois axes indépendants :
 *   • mode    : 'light' | 'dark'             → data-theme="light|dark"
 *   • palette : 'default' | 'flat-*' | ...   → data-palette="..."
 *   • density : 'normal' | 'compact'          → data-density="compact"
 *
 * Persistance :
 *   1. localStorage ('emag-theme', 'emag-palette', 'emag-density')
 *   2. API préférences (via le composant UserPreferencesModal)
 *
 * Priorité mode :
 *   1. localStorage ('emag-theme')
 *   2. Préférence système (prefers-color-scheme)
 *   3. Fallback: 'light'
 *
 * Usage:
 *   const { theme, palette, density, toggleTheme, setTheme, setPalette, setDensity, isDark, isCompact } = useTheme();
 */

export const PALETTES = [
  {
    id: 'default',
    name: 'Violet (défaut)',
    description: 'Thème violet classique eM@g',
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#a855f7',
      bg: '#f8fafc',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#818cf8',
      secondary: '#a78bfa',
      accent: '#c084fc',
      bg: '#0f172a',
      card: '#1e293b',
    },
  },
  {
    id: 'flat-pastel',
    name: 'Flat Pastel',
    description: 'Tons doux et chaleureux',
    colors: {
      primary: '#7b8fb2',
      secondary: '#a08db8',
      accent: '#d4849a',
      bg: '#f6f2ed',
      card: '#fffdfb',
    },
    darkColors: {
      primary: '#99aed0',
      secondary: '#bca8d4',
      accent: '#e0a0b2',
      bg: '#151820',
      card: '#1e2230',
    },
  },
  {
    id: 'flat-material',
    name: 'Flat Material',
    description: 'Google Material Design',
    colors: {
      primary: '#1976d2',
      secondary: '#455a64',
      accent: '#ff6d00',
      bg: '#fafafa',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#64b5f6',
      secondary: '#90a4ae',
      accent: '#ffab40',
      bg: '#121212',
      card: '#1e1e1e',
    },
  },
  {
    id: 'flat-minimal',
    name: 'Flat Minimal',
    description: 'Monochrome épuré, accent rouge',
    colors: {
      primary: '#37474f',
      secondary: '#78909c',
      accent: '#d32f2f',
      bg: '#f5f5f5',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#b0bec5',
      secondary: '#78909c',
      accent: '#ef5350',
      bg: '#0a0a0a',
      card: '#141414',
    },
  },
  {
    id: 'flat-neon-soft',
    name: 'Flat Néon',
    description: 'Cyberpunk adouci',
    colors: {
      primary: '#00acc1',
      secondary: '#7b1fa2',
      accent: '#76ff03',
      bg: '#f2f8fa',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#4dd0e1',
      secondary: '#ce93d8',
      accent: '#b9f6ca',
      bg: '#0d1117',
      card: '#161b22',
    },
  },
  {
    id: 'flat-warm',
    name: 'Flat Warm',
    description: 'Terracotta et tons chauds',
    colors: {
      primary: '#bf6530',
      secondary: '#795548',
      accent: '#c0a030',
      bg: '#faf6f1',
      card: '#fffdfb',
    },
    darkColors: {
      primary: '#e09060',
      secondary: '#a1887f',
      accent: '#d4b640',
      bg: '#1a1410',
      card: '#251e18',
    },
  },
  {
    id: 'flat-cold',
    name: 'Flat Cold',
    description: 'Acier bleu, tons froids',
    colors: {
      primary: '#0277bd',
      secondary: '#455a64',
      accent: '#00bcd4',
      bg: '#f0f5f8',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#4fc3f7',
      secondary: '#78909c',
      accent: '#4dd0e1',
      bg: '#0a1929',
      card: '#132f4c',
    },
  },
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    description: 'Thème sombre Visual Studio Code',
    colors: {
      primary: '#0078d4',
      secondary: '#264f78',
      accent: '#dcdcaa',
      bg: '#1e1e1e',
      card: '#252526',
    },
    darkColors: {
      primary: '#0078d4',
      secondary: '#264f78',
      accent: '#dcdcaa',
      bg: '#1e1e1e',
      card: '#252526',
    },
  },
  {
    id: 'vscode-light',
    name: 'VS Code Light+',
    description: 'Thème clair Visual Studio Code',
    colors: {
      primary: '#0078d4',
      secondary: '#005a9e',
      accent: '#e8ab53',
      bg: '#f3f3f3',
      card: '#ffffff',
    },
    darkColors: {
      primary: '#0078d4',
      secondary: '#005a9e',
      accent: '#e8ab53',
      bg: '#f3f3f3',
      card: '#ffffff',
    },
  },
  {
    id: 'tv-display',
    name: 'TV Display',
    description: 'Contraste élevé pour écrans distants',
    colors: {
      primary: '#00e1ff',
      secondary: '#00b8d4',
      accent: '#00e5ff',
      bg: '#000000',
      card: '#0a1929',
    },
    darkColors: {
      primary: '#00e1ff',
      secondary: '#00b8d4',
      accent: '#00e5ff',
      bg: '#000000',
      card: '#0a1929',
    },
  },
];

export const DENSITIES = [
  { id: 'normal', name: 'Normal', description: 'Espacement standard' },
  { id: 'compact', name: 'Compact', description: 'Densité réduite, plus de contenu visible' },
];

export function useTheme() {
  // ─── Mode (light/dark) ───
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('emag-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  // ─── Palette ───
  const [palette, setPaletteState] = useState(() => {
    const saved = localStorage.getItem('emag-palette');
    if (saved && PALETTES.some((p) => p.id === saved)) return saved;
    return 'default';
  });

  // ─── Densité (normal/compact) ───
  const [density, setDensityState] = useState(() => {
    const saved = localStorage.getItem('emag-density');
    if (saved === 'compact' || saved === 'normal') return saved;
    return 'normal';
  });

  // Appliquer le mode au DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('emag-theme', theme);
  }, [theme]);

  // Appliquer la palette au DOM
  useEffect(() => {
    if (palette === 'default') {
      document.documentElement.removeAttribute('data-palette');
    } else {
      document.documentElement.setAttribute('data-palette', palette);
    }
    localStorage.setItem('emag-palette', palette);
  }, [palette]);

  // Appliquer la densité au DOM
  useEffect(() => {
    if (density === 'compact') {
      document.documentElement.setAttribute('data-density', 'compact');
    } else {
      document.documentElement.removeAttribute('data-density');
    }
    localStorage.setItem('emag-density', density);
  }, [density]);

  // Écouter les changements de préférence système
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
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
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPalette = useCallback((newPalette) => {
    if (PALETTES.some((p) => p.id === newPalette)) {
      setPaletteState(newPalette);
    }
  }, []);

  const setDensity = useCallback((newDensity) => {
    if (newDensity === 'compact' || newDensity === 'normal') {
      setDensityState(newDensity);
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => (prev === 'compact' ? 'normal' : 'compact'));
  }, []);

  const isDark = theme === 'dark';
  const isCompact = density === 'compact';

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme,
    palette,
    setPalette,
    density,
    isCompact,
    setDensity,
    toggleDensity,
  };
}

export default useTheme;
