// Politique de mots de passe (allégée — décision produit 2026-06-16) :
// au moins 1 majuscule, 1 minuscule et 1 chiffre.
// Pas de contrainte de longueur, pas d'obligation de caractère spécial.

export function validatePassword(password) {
  if (!password) {
    return 'Mot de passe requis';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule';
  }
  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule';
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre';
  }
  return null;
}
