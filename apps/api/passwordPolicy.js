// [AUDIT FIX HIGH-2] Politique de mots de passe centralisée
// Minimum 10 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial

export function validatePassword(password) {
  if (!password || password.length < 10) {
    return 'Le mot de passe doit contenir au moins 10 caractères';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule';
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un caractère spécial';
  }
  return null;
}
