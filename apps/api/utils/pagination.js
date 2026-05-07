/**
 * ═══════════════════════════════════════════════════════════════
 * [S2-2] Pagination — helper standardisé
 * ═══════════════════════════════════════════════════════════════
 *
 * Stratégie : opt-in rétro-compat strict.
 *  - Si la requête NE contient PAS `?page=` ni `?limit=` → comportement legacy
 *    (le handler renvoie le tableau brut comme avant).
 *  - Si l'un des deux est présent → mode paginé : on plafonne, on coupe,
 *    et on renvoie `{ data: [...], pagination: {...} }`.
 *
 * Ainsi le frontend existant continue de fonctionner sans modif. Les nouveaux
 * appels (ou clients adaptés) peuvent utiliser ?page=&limit= explicitement.
 *
 * Helpers :
 *   parsePagination(req)       -> { paginated, page, limit, offset, sort }
 *   paginate(res, items, p)    -> renvoie soit array legacy, soit {data,pagination}
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Parse les paramètres de pagination depuis req.query.
 *
 * @param {{query?: Record<string, any>}} req
 * @returns {{
 *   paginated: boolean,
 *   page: number,
 *   limit: number,
 *   offset: number,
 *   sort: {column: string, dir: 'asc'|'desc'}|null
 * }}
 */
function parsePagination(req) {
  const q = (req && req.query) || {};
  const hasPage = q.page !== undefined && q.page !== '';
  const hasLimit = q.limit !== undefined && q.limit !== '';
  const paginated = hasPage || hasLimit;

  let page = Number.parseInt(q.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = Number.parseInt(q.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  // sort=col:asc | col:desc | col (asc par défaut)
  let sort = null;
  if (typeof q.sort === 'string' && q.sort.length > 0) {
    const [col, dirRaw] = q.sort.split(':');
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(col || '')) {
      const dir = (dirRaw || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
      sort = { column: col, dir };
    }
  }

  return {
    paginated,
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
  };
}

/**
 * Construit la réponse paginée à partir d'un tableau complet (slice côté Node).
 * Quand `total` n'est pas fourni, `items.length` est utilisé.
 *
 * @param {Array} items
 * @param {ReturnType<typeof parsePagination>} p
 * @param {{total?: number}} [opts]
 * @returns {{data: Array, pagination: {page:number, limit:number, total:number, totalPages:number}}}
 */
function buildPaginatedPayload(items, p, opts = {}) {
  const total = typeof opts.total === 'number' ? opts.total : items.length;
  const slice =
    typeof opts.total === 'number'
      ? items // déjà tronqué côté SQL
      : items.slice(p.offset, p.offset + p.limit);
  return {
    data: slice,
    pagination: {
      page: p.page,
      limit: p.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / p.limit)),
    },
  };
}

/**
 * Sucre : envoie la bonne forme selon `paginated`.
 *
 * @param {import('express').Response} res
 * @param {Array} items
 * @param {ReturnType<typeof parsePagination>} p
 * @param {{total?: number}} [opts]
 */
function sendPaginated(res, items, p, opts) {
  if (!p.paginated) return res.json(items);
  return res.json(buildPaginatedPayload(items, p, opts));
}

export { buildPaginatedPayload, DEFAULT_LIMIT, MAX_LIMIT, parsePagination, sendPaginated };
