// apps/web/src/utils/affaires/v2Adapters.js
//
// Ticket : T-P0-09b (Affaires v2 — dogfooding UI lecture).
//
// Adaptateurs shape v2 -> shape v1 (camelCase) pour permettre a
// `affairesLoader.fetchAffaires()` et aux composants existants
// (`AffairesPanel`, `AffaireDetailPanel`, `useAffairesList`) de
// consommer indifferemment le namespace v1
// (`GET /api/affaires`, `GET /api/affaires/:id/history`) ou le
// namespace v2 (`GET /api/v2/affaires`, `GET /api/v2/affaires/:num`,
// `GET /api/v2/affaires/:num/history`).
//
// Rappel des differences de nommage :
//   v1 : { id, numeroAffaire, nom, type, client, interlocuteur,
//          tel, fax, dateDebut, dateFin, devis, adresseLivraison,
//          titre, description, googleEventId, eventName,
//          createdBy, createdAt, modifiedBy, modifiedAt }
//   v2 : { id, numero_affaire, nom, type, client, interlocuteur,
//          tel, fax, date_debut, date_fin, devis, adresse_livraison,
//          titre, description, google_event_id, event_name,
//          created_by, created_at, modified_by, modified_at }
//
// Le service v2 (`apps/api/services/affaires/affaires.js`) exporte
// systematiquement `skipCamelCase: true` cote client (`v2ListAffaires`,
// `v2GetAffaire`, `v2GetAffaireHistory`) : c'est donc ici, cote UI,
// que le mapping snake -> camel est realise. Ce choix isole la
// v2 de toute dependance a la couche `toCamelCase` de `ApiClient`.

/**
 * Convertit une affaire v2 (payload retourne par `v2GetAffaire` ou
 * `v2ListAffaires`) au shape v1 consomme par le frontend.
 *
 * @param {object|null|undefined} affaireV2
 * @returns {object|null}
 */
export function adaptAffaireV2ToV1(affaireV2) {
  if (!affaireV2 || typeof affaireV2 !== 'object') return null;
  return {
    id: affaireV2.id ?? null,
    numeroAffaire: affaireV2.numero_affaire ?? null,
    nom: affaireV2.nom ?? null,
    type: affaireV2.type ?? null,
    client: affaireV2.client ?? null,
    interlocuteur: affaireV2.interlocuteur ?? null,
    tel: affaireV2.tel ?? null,
    fax: affaireV2.fax ?? null,
    dateDebut: affaireV2.date_debut ?? null,
    dateFin: affaireV2.date_fin ?? null,
    devis: affaireV2.devis ?? null,
    adresseLivraison: affaireV2.adresse_livraison ?? null,
    titre: affaireV2.titre ?? null,
    description: affaireV2.description ?? null,
    googleEventId: affaireV2.google_event_id ?? null,
    eventName: affaireV2.event_name ?? null,
    createdBy: affaireV2.created_by ?? null,
    createdAt: affaireV2.created_at ?? null,
    modifiedBy: affaireV2.modified_by ?? null,
    modifiedAt: affaireV2.modified_at ?? null,
  };
}

/**
 * Convertit un lot d'affaires v2 (tableau `data.items` renvoye par
 * `v2ListAffaires`) au shape v1 (array).
 *
 * @param {Array<object>|null|undefined} itemsV2
 * @returns {Array<object>}
 */
export function adaptAffairesListV2ToV1(itemsV2) {
  if (!Array.isArray(itemsV2)) return [];
  return itemsV2.map(adaptAffaireV2ToV1).filter(Boolean);
}

/**
 * Convertit une entree d'historique v2 au shape v1 attendu par
 * `AffaireDetailPanel` (qui consomme aujourd'hui
 * `api.getAffaireHistory(id)` v1).
 *
 * Shape v2 (event-based, cf hotfix affaire_history L6) :
 *   { id, affaire_id, event_type, source, field_name, old_value,
 *     new_value, changed_by, changed_at, notes }
 * Shape v1 attendu :
 *   { id, affaireId, eventType, source, fieldName, oldValue,
 *     newValue, changedBy, changedAt, notes }
 *
 * @param {object|null|undefined} entryV2
 * @returns {object|null}
 */
export function adaptHistoryEntryV2ToV1(entryV2) {
  if (!entryV2 || typeof entryV2 !== 'object') return null;
  return {
    id: entryV2.id ?? null,
    affaireId: entryV2.affaire_id ?? null,
    eventType: entryV2.event_type ?? null,
    source: entryV2.source ?? null,
    fieldName: entryV2.field_name ?? null,
    oldValue: entryV2.old_value ?? null,
    newValue: entryV2.new_value ?? null,
    changedBy: entryV2.changed_by ?? null,
    changedAt: entryV2.changed_at ?? null,
    notes: entryV2.notes ?? null,
  };
}

/**
 * Convertit un tableau d'entrees d'historique v2 au shape v1.
 *
 * @param {Array<object>|null|undefined} entriesV2
 * @returns {Array<object>}
 */
export function adaptHistoryListV2ToV1(entriesV2) {
  if (!Array.isArray(entriesV2)) return [];
  return entriesV2.map(adaptHistoryEntryV2ToV1).filter(Boolean);
}

/**
 * Lit le flag client v2 pour Affaires. Convention Vite :
 * `VITE_FEATURE_V2_AFFAIRES=1` -> true, sinon false.
 *
 * @param {Record<string, string|undefined>} [env] - Injection facultative
 *   (utile pour les tests unitaires). Par defaut lit `import.meta.env`.
 * @returns {boolean}
 */
export function readAffairesV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_AFFAIRES;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
