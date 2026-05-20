// ═══════════════════════════════════════════════════════════
// Chantier L8 — 3.2 : Import PDF commande fournisseur (diff/MAJ)
// Helpers purs ESM, testables sans DB ni HTTP.
// ═══════════════════════════════════════════════════════════
//
// Le frontend parse le PDF (réutilise apps/web/src/utils/catalogParsers.js
// du chantier L7) et envoie un tableau d'items canoniques :
//   { ref_code?, designation, quantity?, unit?, unit_price_ht? }
//
// Ce helper calcule le diff entre les lignes existantes d'une commande et
// les lignes importées, en gérant :
//   - références identiques (ref_code prioritaire sur désignation)
//   - désignations normalisées (insensible casse / accents / espaces)
//   - doublons à l'intérieur de l'import (fusion par sommation des qtés)
//   - conflits (plusieurs lignes existantes pour une même clé)
//
// La résolution finale est laissée à l'appelant via `applyImportDiff`,
// qui accepte un objet `decisions` (mode global + override par clé).
// ═══════════════════════════════════════════════════════════

const PRICE_EPSILON_DEFAULT = 0.01;

/**
 * Normalise une chaîne pour comparaison "loose" : NFKD, suppression
 * diacritiques, casse minuscule, collapse espaces, trim.
 */
function normalizeForKey(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Produit une clé déterministe pour identifier un article d'une commande.
 * Priorité au code référence (`ref_code`), sinon à la désignation normalisée.
 *
 * @param {{ ref_code?: string|null, designation?: string|null }} item
 * @returns {string} clé canonique (préfixe `R:` pour ref, `D:` pour désignation)
 */
export function makeItemKey(item) {
  if (!item) return 'D:';
  if (item.ref_code != null) {
    const r = String(item.ref_code).trim().toUpperCase().replace(/\s+/g, '');
    if (r) return `R:${r}`;
  }
  return `D:${normalizeForKey(item.designation)}`;
}

/**
 * Fusionne des doublons d'un même import (clé identique) en sommant les quantités
 * et en gardant le premier prix unitaire non nul.
 */
function mergeIncomingDuplicates(list) {
  if (list.length === 1) return { ...list[0] };
  const first = list[0];
  const totalQty = list.reduce((s, it) => s + (Number(it.quantity) || 1), 0);
  const firstPrice = list.find((it) => Number(it.unit_price_ht) > 0)?.unit_price_ht;
  return {
    ...first,
    quantity: totalQty,
    unit_price_ht: firstPrice != null ? firstPrice : first.unit_price_ht,
    _mergedFrom: list.length,
  };
}

/**
 * Calcule le diff entre les lignes existantes d'une commande et un lot importé.
 *
 * @param {Array} existing - Lignes actuelles (`order_items`). Chaque item doit
 *                           exposer `id`, `designation`, `ref_code`, `quantity`,
 *                           `unit_price_ht`.
 * @param {Array} incoming - Lignes importées (issues du parsing PDF).
 * @param {Object} [opts]
 * @param {number} [opts.epsilonPrice=0.01]  Tolérance prix (€) pour considérer
 *                                            qu'il n'y a pas de changement.
 * @param {'sum'|'replace'} [opts.quantityMode='sum']  Comment proposer la nouvelle
 *                                            quantité quand une ligne existe déjà.
 *                                            - 'sum' (défaut) : qty existante + qty importée
 *                                            - 'replace'      : qty importée
 *
 * @returns {{
 *   added:     Array<{ key:string, item:object }>,
 *   updated:   Array<{ key:string, existingId:any, existing:object, incoming:object, changes:{quantity:boolean,price:boolean}, suggested:{quantity:number, unit_price_ht:number} }>,
 *   unchanged: Array<{ key:string, existingId:any }>,
 *   conflicts: Array<{ key:string, item:object, reason:string, existingCount?:number }>,
 *   summary:   { existingCount:number, incomingCount:number, addedCount:number, updatedCount:number, unchangedCount:number, conflictsCount:number }
 * }}
 */
export function diffOrderItems(existing, incoming, opts = {}) {
  const epsilonPrice = opts.epsilonPrice ?? PRICE_EPSILON_DEFAULT;
  const quantityMode = opts.quantityMode === 'replace' ? 'replace' : 'sum';

  const ex = Array.isArray(existing) ? existing : [];
  const inc = Array.isArray(incoming) ? incoming : [];

  // Index existing par clé
  const existingByKey = new Map();
  for (const it of ex) {
    if (!it) continue;
    const k = makeItemKey(it);
    if (!existingByKey.has(k)) existingByKey.set(k, []);
    existingByKey.get(k).push(it);
  }

  // Index incoming par clé + fusion des doublons internes
  const incomingByKey = new Map();
  for (const it of inc) {
    if (!it) continue;
    const k = makeItemKey(it);
    if (!incomingByKey.has(k)) incomingByKey.set(k, []);
    incomingByKey.get(k).push(it);
  }

  const added = [];
  const updated = [];
  const unchanged = [];
  const conflicts = [];

  for (const [key, list] of incomingByKey.entries()) {
    const merged = mergeIncomingDuplicates(list);
    // Valeurs incoming normalisées
    const qtyInc = Number(merged.quantity) || 1;
    const priceInc = Number(merged.unit_price_ht) || 0;

    const matches = existingByKey.get(key);
    if (!matches || matches.length === 0) {
      added.push({
        key,
        item: { ...merged, quantity: qtyInc, unit_price_ht: priceInc },
      });
      continue;
    }
    if (matches.length > 1) {
      conflicts.push({
        key,
        item: merged,
        reason: 'multiple_existing',
        existingCount: matches.length,
      });
      continue;
    }
    const e = matches[0];
    const qtyEx = Number(e.quantity) || 0;
    const priceEx = Number(e.unit_price_ht) || 0;
    const qtyDiff = qtyInc !== qtyEx;
    const priceDiff = Math.abs(priceEx - priceInc) > epsilonPrice;
    if (!qtyDiff && !priceDiff) {
      unchanged.push({ key, existingId: e.id });
      continue;
    }
    const suggestedQty = quantityMode === 'replace' ? qtyInc : qtyEx + qtyInc;
    const suggestedPrice = priceInc > 0 ? priceInc : priceEx;
    updated.push({
      key,
      existingId: e.id,
      existing: {
        id: e.id,
        designation: e.designation,
        ref_code: e.ref_code ?? null,
        quantity: qtyEx,
        unit_price_ht: priceEx,
      },
      incoming: {
        designation: merged.designation,
        ref_code: merged.ref_code ?? null,
        quantity: qtyInc,
        unit_price_ht: priceInc,
      },
      changes: { quantity: qtyDiff, price: priceDiff },
      suggested: { quantity: suggestedQty, unit_price_ht: suggestedPrice },
    });
  }

  return {
    added,
    updated,
    unchanged,
    conflicts,
    summary: {
      existingCount: ex.length,
      incomingCount: inc.length,
      addedCount: added.length,
      updatedCount: updated.length,
      unchangedCount: unchanged.length,
      conflictsCount: conflicts.length,
    },
  };
}

/**
 * Applique un diff à la liste existante selon des décisions optionnelles.
 *
 * Action par clé (`decisions.perKey[key]`) :
 *   - 'skip'   : ignorer cette ligne
 *   - 'add'    : ajouter en nouvelle ligne (même si match)
 *   - 'update' : mettre à jour la ligne existante avec les valeurs suggérées
 *
 * Par défaut (sans override) :
 *   - `added`   → ajoutées
 *   - `updated` → mises à jour avec `suggested` (mode 'merge' / 'sum')
 *   - `unchanged` → laissées telles quelles
 *   - `conflicts` → ignorés (l'appelant doit les résoudre explicitement)
 *
 * @param {Array} existingItems  Lignes actuelles (référence `id`)
 * @param {ReturnType<typeof diffOrderItems>} diff
 * @param {{ perKey?: Record<string, 'skip'|'add'|'update'> }} [decisions]
 * @returns {{
 *   items: Array,
 *   actions: { added:number, updated:number, skipped:number, kept:number }
 * }}
 */
export function applyImportDiff(existingItems, diff, decisions = {}) {
  const perKey = decisions.perKey || {};
  const out = (existingItems || []).map((it) => ({ ...it }));
  const byId = new Map(out.map((it, idx) => [it.id, idx]));

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const keptCount = out.length;

  for (const a of diff.added) {
    const action = perKey[a.key] || 'add';
    if (action === 'skip') {
      skippedCount++;
      continue;
    }
    out.push({ ...a.item });
    addedCount++;
  }

  for (const u of diff.updated) {
    const action = perKey[u.key] || 'update';
    if (action === 'skip') {
      skippedCount++;
      continue;
    }
    if (action === 'add') {
      out.push({
        designation: u.incoming.designation,
        ref_code: u.incoming.ref_code,
        quantity: u.incoming.quantity,
        unit_price_ht: u.incoming.unit_price_ht,
      });
      addedCount++;
      continue;
    }
    const idx = byId.get(u.existingId);
    if (idx == null) continue;
    out[idx] = {
      ...out[idx],
      quantity: u.suggested.quantity,
      unit_price_ht: u.suggested.unit_price_ht,
    };
    updatedCount++;
  }

  return {
    items: out,
    actions: {
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      kept: keptCount,
    },
  };
}
