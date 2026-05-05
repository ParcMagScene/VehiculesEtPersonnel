// [SEC] Sanitize a filename for use in Content-Disposition headers.
// Bloque CR/LF (header injection), guillemets, slashes et caractères de contrôle.
// Conserve lettres/chiffres/espaces/-/_/./() et tronque à 80 caractères.
// Toujours fournir un fallback non-vide.
export function safeContentDispositionName(value, fallback = 'export') {
  return (
    String(value ?? '')
      .replace(/[\r\n"\\/]/g, '_')
      .replace(/[^\w\s\-().]/g, '_')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 80) || fallback
  );
}
