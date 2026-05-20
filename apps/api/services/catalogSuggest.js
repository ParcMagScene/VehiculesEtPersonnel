// ═══════════════════════════════════════════════════════════
// Chantier L9 — 3.3 : Recherche catalogue (autocomplete)
// Helpers purs ESM, testables sans DB.
// ═══════════════════════════════════════════════════════════
//
// Le frontend appelle GET /api/supplier-articles/suggest?q=... pour alimenter
// un input d'autocomplete. Le endpoint pré-filtre via LIKE en SQL (rapide
// sur quelques milliers d'articles) puis délègue le tri/scoring à ces
// helpers pour rester déterministe et testable.
//
// Stratégie de scoring (du plus pertinent au moins pertinent) :
//   100 — supplier_ref exactement = query (insensible casse)
//    90 — supplier_ref préfixe par query
//    70 — designation préfixe par query
//    60 — un mot de designation préfixe par query
//    40 — designation contient query
//    20 — brand/model contient query
// Bonus :
//    +5 si tous les tokens de la query matchent designation
//    +3 si supplier_id correspond au filtre prioritaire (appliqué côté SQL)
//
// Les ex æquo sont départagés par longueur de désignation (plus court = plus
// pertinent) puis par id croissant pour stabilité.
// ═══════════════════════════════════════════════════════════

/**
 * Normalise une chaîne pour comparaison : NFKD, sans diacritiques, minuscules,
 * espaces collapsés, trim.
 */
function norm(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse une requête utilisateur en tokens + variantes utiles côté SQL.
 *
 * @param {string} raw
 * @returns {{
 *   raw: string,
 *   normalized: string,
 *   tokens: string[],
 *   like: string,       // pattern global %normalized%
 *   prefix: string,     // pattern préfixe normalized%
 *   isEmpty: boolean,
 * }}
 */
export function parseSuggestQuery(raw) {
  const normalized = norm(raw);
  const tokens = normalized ? normalized.split(' ').filter(Boolean) : [];
  return {
    raw: raw == null ? '' : String(raw),
    normalized,
    tokens,
    like: normalized ? `%${normalized}%` : '',
    prefix: normalized ? `${normalized}%` : '',
    isEmpty: tokens.length === 0,
  };
}

/**
 * Calcule un score pour un article candidat selon la stratégie documentée.
 *
 * @param {object} article  Champs attendus : id, supplier_ref, designation, brand, model, supplier_id
 * @param {ReturnType<typeof parseSuggestQuery>} query
 * @param {{ preferSupplierId?: number|string|null }} [opts]
 * @returns {number} score (0 si aucun match)
 */
export function scoreSuggestion(article, query, opts = {}) {
  if (!article || !query || query.isEmpty) return 0;
  const q = query.normalized;
  const ref = norm(article.supplier_ref);
  const des = norm(article.designation);
  const brand = norm(article.brand);
  const model = norm(article.model);

  let score = 0;

  if (ref) {
    if (ref === q) score = Math.max(score, 100);
    else if (ref.startsWith(q)) score = Math.max(score, 90);
    else if (ref.includes(q)) score = Math.max(score, 50);
  }

  if (des) {
    if (des.startsWith(q)) {
      score = Math.max(score, 70);
    } else {
      const words = des.split(' ');
      if (words.some((w) => w.startsWith(q))) {
        score = Math.max(score, 60);
      } else if (des.includes(q)) {
        score = Math.max(score, 40);
      }
    }
  }

  if (score === 0) {
    if ((brand && brand.includes(q)) || (model && model.includes(q))) {
      score = Math.max(score, 20);
    }
  }

  if (score > 0 && query.tokens.length > 1) {
    const allInDes = query.tokens.every((t) => des.includes(t));
    if (allInDes) score += 5;
  }

  if (
    score > 0 &&
    opts.preferSupplierId != null &&
    String(article.supplier_id) === String(opts.preferSupplierId)
  ) {
    score += 3;
  }

  return score;
}

/**
 * Trie une liste de candidats par pertinence (score décroissant) et tronque
 * au `limit` demandé. Les articles à score 0 sont écartés.
 *
 * @param {object[]} articles
 * @param {ReturnType<typeof parseSuggestQuery>} query
 * @param {{ limit?: number, preferSupplierId?: number|string|null }} [opts]
 */
export function rankSuggestions(articles, query, opts = {}) {
  const rawLim = Number(opts.limit);
  const limit = Number.isFinite(rawLim) ? Math.max(1, Math.min(rawLim, 50)) : 10;
  if (!Array.isArray(articles) || !query || query.isEmpty) return [];
  const scored = [];
  for (const a of articles) {
    const s = scoreSuggestion(a, query, opts);
    if (s > 0) scored.push({ article: a, score: s });
  }
  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    const lenX = (x.article.designation || '').length;
    const lenY = (y.article.designation || '').length;
    if (lenX !== lenY) return lenX - lenY;
    return (x.article.id || 0) - (y.article.id || 0);
  });
  return scored.slice(0, limit).map(({ article, score }) => ({ ...article, _score: score }));
}
