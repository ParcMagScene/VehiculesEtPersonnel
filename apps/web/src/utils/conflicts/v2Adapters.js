// apps/web/src/utils/conflicts/v2Adapters.js
//
// Ticket : T-P1-05b (Conflicts v2 — helpers UI pre-check).
//
// Le service v2 `detectPersonConflicts` retourne un shape
// snake_case :
//   { conflicts: [{ source, entity_type, entity_id, date, period,
//                   label, start_date, end_date }],
//     has_conflict: boolean, count: number }
//
// Cet adapter normalise la reponse pour l'UI (camelCase) tout en
// preservant la traçabilite source/entity_type/entity_id (utile
// pour les logs et les exclusions futures).

/**
 * Normalise un conflit v2 (snake_case) vers un shape camelCase
 * consomme par l'UI (hooks, badges, alertes).
 *
 * @param {object|null|undefined} conflict
 * @returns {object|null}
 */
export function adaptConflictV2ToV1(conflict) {
  if (!conflict || typeof conflict !== 'object') return null;
  return {
    source: conflict.source ?? null,
    entityType: conflict.entity_type ?? null,
    entityId: conflict.entity_id ?? null,
    date: conflict.date ?? null,
    period: conflict.period ?? null,
    label: conflict.label ?? null,
    startDate: conflict.start_date ?? null,
    endDate: conflict.end_date ?? null,
  };
}

/**
 * Normalise la reponse complete de `v2CheckConflicts` :
 *   { conflicts: [...], hasConflict: bool, count: number }
 * @param {object|null|undefined} v2Response Payload brut
 *   `{ success, data, meta }`.
 * @returns {{ conflicts: Array<object>, hasConflict: boolean, count: number } | null}
 */
export function adaptV2ConflictsResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  const rawList = Array.isArray(data.conflicts) ? data.conflicts : [];
  const conflicts = rawList.map(adaptConflictV2ToV1).filter(Boolean);
  return {
    conflicts,
    hasConflict: Boolean(data.has_conflict),
    count: Number(data.count ?? conflicts.length),
  };
}

/**
 * Lit le flag client v2 pour Conflicts. Convention Vite :
 * `VITE_FEATURE_V2_CONFLICTS=1` -> true, sinon false.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function readConflictsV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_CONFLICTS;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
