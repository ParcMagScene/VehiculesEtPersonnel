// apps/web/src/utils/leaves/v2Adapters.js
//
// Ticket : T-P1-04b (Leaves v2 — dogfooding UI calcul).
//
// Le service v2 `calculateLeavePeriod` retourne deja un objet
// **camelCase** (`workingDays`, `holidaysInPeriod`, `warnings`,
// `referencePeriod`, etc). La route v2 utilise pourtant
// `skipCamelCase: true` du cote client pour eviter la double
// conversion. On expose donc ici un simple `identity`-passthrough
// pour garder un point d'ancrage unique en cas de futur changement
// de shape.
//
// A l'inverse, le service `getBalanceForPerson` renvoie snake_case
// (`person_id`, `days_entitled`, `days_taken`, `days_remaining`) :
// pour cette raison les composants Leaves tolerent deja les deux
// shapes (`balance.daysEntitled ?? balance.days_entitled`). Ce
// ticket ne dogfoode pas encore les balances, donc pas d'adapter
// dedie ici (repris dans un T-P1-04c ulterieur).

/**
 * Passthrough pour la reponse `v2CalculateLeaves`. Renvoie l'objet
 * `data` du payload v2 (`{ workingDays, holidaysInPeriod, warnings,
 * referencePeriod, ... }`) tel quel. Renvoie null si le payload est
 * invalide, pour permettre au caller de faire fallback v1.
 *
 * @param {object|null|undefined} v2Response Reponse brute de
 *   `api.v2CalculateLeaves(data)` (shape `{ success, data, meta }`).
 * @returns {object|null}
 */
export function adaptV2CalculationToV1(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return data;
}

/**
 * Lit le flag client v2 pour Leaves. Convention Vite :
 * `VITE_FEATURE_V2_LEAVES=1` -> true, sinon false.
 *
 * @param {Record<string, string|undefined>} [env] Injection facultative
 *   (tests unitaires).
 * @returns {boolean}
 */
export function readLeavesV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_LEAVES;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
