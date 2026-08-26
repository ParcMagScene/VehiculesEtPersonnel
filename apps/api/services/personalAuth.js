// ═══════════════════════════════════════════════════════════════
// services/personalAuth.js
//
// Vérification des identifiants personnels (PIN ou mot de passe)
// d'un membre du personnel rattaché à un compte utilisateur.
//
// Utilisé pour :
//   - L'auth Suivi (compte Equipe → fiche personnelle filtrée — flow legacy)
//   - L'authentification éphémère pour actions personnelles (planning,
//     congés, indispos) déclenchées depuis le compte commun@magsav.com.
//
// Pas d'effet de bord (pas de log, pas d'audit, pas de session) — ces
// responsabilités appartiennent à l'appelant.
// ═══════════════════════════════════════════════════════════════

import bcrypt from 'bcrypt';

/**
 * Vérifie qu'un PIN ou mot de passe correspond bien au compte lié au
 * personnel `personId`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db Instance DB ouverte.
 * @param {number} params.personId ID dans la table `persons`.
 * @param {string} [params.pin] PIN à 4 chiffres (au moins l'un des deux requis).
 * @param {string} [params.password] Mot de passe en clair.
 * @returns {Promise<{ ok: true, person: object, user: object }
 *   | { ok: false, status: number, code: string, error: string }>}
 */
export async function verifyPersonalCredentials({ db, personId, pin, password }) {
  if (!pin && !password) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_CREDENTIALS',
      error: 'Code PIN ou mot de passe requis',
    };
  }

  const person = db
    .prepare('SELECT id, first_name, last_name, user_id FROM persons WHERE id = ? AND status = ?')
    .get(personId, 'active');
  if (!person) {
    return {
      ok: false,
      status: 404,
      code: 'PERSON_NOT_FOUND',
      error: 'Personnel introuvable',
    };
  }
  if (!person.user_id) {
    return {
      ok: false,
      status: 403,
      code: 'NO_LINKED_USER',
      error: 'Aucun compte lié à ce personnel',
    };
  }

  const linkedUser = db
    .prepare(
      'SELECT id, email, password_hash, pin_hash, is_blocked, is_admin, permissions FROM users WHERE id = ?',
    )
    .get(person.user_id);
  if (!linkedUser || linkedUser.is_blocked) {
    return {
      ok: false,
      status: 403,
      code: 'USER_BLOCKED_OR_MISSING',
      error: 'Compte lié introuvable ou bloqué',
    };
  }

  let verified = false;
  if (pin && linkedUser.pin_hash) {
    verified = await bcrypt.compare(pin, linkedUser.pin_hash);
  } else if (password && linkedUser.password_hash) {
    verified = await bcrypt.compare(password, linkedUser.password_hash);
  }

  if (!verified) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      error: 'Code PIN ou mot de passe incorrect',
    };
  }

  return { ok: true, person, user: linkedUser };
}
