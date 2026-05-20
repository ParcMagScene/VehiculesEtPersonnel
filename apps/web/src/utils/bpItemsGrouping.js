// ─────────────────────────────────────────────────────────────
// bpItemsGrouping.js — L4 (méga-prompt 1.2)
// Regroupe les lignes de matériels identiques (même désignation)
// dans l'affichage et l'export pour éviter les doublons lorsqu'un
// même article apparaît plusieurs fois — typiquement sur les
// unités sérialisées listées une ligne par numéro de série.
// Pure : aucun side effect, facile à tester.
// ─────────────────────────────────────────────────────────────

/**
 * Calcule la clé de regroupement d'un item BP.
 *  - priorité à la référence (normalisée)
 *  - fallback : description normalisée
 *  - si aucun des deux : null (l'item ne sera pas fusionné)
 */
function groupingKey(item) {
  const ref = String(item?.reference || '')
    .trim()
    .toUpperCase();
  if (ref) return `R:${ref}`;
  const desc = String(item?.description || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (desc) return `D:${desc}`;
  return null;
}

/**
 * Regroupe les lignes identiques au sein d'un tableau d'items BP.
 * Les quantités sont sommées. Les lignes sans clé (ni ref ni description)
 * sont conservées telles quelles.
 *
 * Chaque entrée résultante porte deux champs supplémentaires :
 *   - `_groupedCount` : nombre de lignes sources fusionnées (≥1)
 *   - `_groupedIds`   : ids sources fusionnés (ordre d'apparition)
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function groupBpItemsByDesignation(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const map = new Map();
  const out = [];
  for (const item of items) {
    const key = groupingKey(item);
    const qty = Number(item?.quantity);
    const safeQty = Number.isFinite(qty) ? qty : 0;
    if (!key) {
      out.push({ ...item, _groupedCount: 1, _groupedIds: [item?.id].filter((x) => x != null) });
      continue;
    }
    const existing = map.get(key);
    if (!existing) {
      const entry = {
        ...item,
        quantity: safeQty,
        _groupedCount: 1,
        _groupedIds: [item?.id].filter((x) => x != null),
      };
      map.set(key, entry);
      out.push(entry);
      continue;
    }
    existing.quantity = Number(existing.quantity || 0) + safeQty;
    existing._groupedCount += 1;
    if (item?.id != null) existing._groupedIds.push(item.id);
    // Conserver une description si la première était vide
    if (!existing.description && item?.description) existing.description = item.description;
    // Promouvoir matchStatus si l'existant n'est pas lié et que celui-ci l'est
    const isMatched = (s) => s === 'matched' || s === 'manual';
    if (!isMatched(existing.matchStatus) && isMatched(item?.matchStatus)) {
      existing.matchStatus = item.matchStatus;
      existing.equipment_id = item.equipment_id ?? existing.equipment_id;
      existing.catalogReference = item.catalogReference ?? existing.catalogReference;
      existing.catalogName = item.catalogName ?? existing.catalogName;
    }
    // Idem pour articles : promouvoir liaison fournisseur/stock si présente
    if (!existing.supplierArticleId && item?.supplierArticleId) {
      existing.supplierArticleId = item.supplierArticleId;
      existing.supplierArticleRef = item.supplierArticleRef ?? existing.supplierArticleRef;
      existing.supplierArticleName = item.supplierArticleName ?? existing.supplierArticleName;
    }
    if (!existing.stockItemId && item?.stockItemId) {
      existing.stockItemId = item.stockItemId;
      existing.stockItemRef = item.stockItemRef ?? existing.stockItemRef;
      existing.stockItemName = item.stockItemName ?? existing.stockItemName;
    }
  }
  return out;
}

/**
 * Variante : regroupe un objet { sectionName: items[] } section par section.
 */
export function groupBpItemsBySectionMap(sectionMap) {
  if (!sectionMap || typeof sectionMap !== 'object') return {};
  const out = {};
  for (const [section, items] of Object.entries(sectionMap)) {
    out[section] = groupBpItemsByDesignation(items);
  }
  return out;
}
