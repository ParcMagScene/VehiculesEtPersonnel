import { useMemo } from 'react';
import { useTheme } from './useTheme';

/**
 * Hook pour détecter si le mode VS Code est actif.
 *
 * Le mode VS Code s'active automatiquement quand l'utilisateur
 * choisit la palette "vscode-dark" ou "vscode-light" dans les préférences.
 *
 * Les overrides CSS sont gérés via [data-palette^="vscode"] dans theme-vscode.css.
 * Ce hook fournit uniquement des booléens utilitaires pour les composants React
 * qui auraient besoin de conditionner du rendu.
 *
 * Usage:
 *   const { isVSCode, isVSCodeDark, isVSCodeLight } = useVSCodeTheme();
 */
export function useVSCodeTheme() {
  const { palette, theme } = useTheme();

  const isVSCode = useMemo(() => palette?.startsWith('vscode'), [palette]);
  const isVSCodeDark = useMemo(() => palette === 'vscode-dark', [palette]);
  const isVSCodeLight = useMemo(() => palette === 'vscode-light', [palette]);

  return { isVSCode, isVSCodeDark, isVSCodeLight, palette, theme };
}

export default useVSCodeTheme;
