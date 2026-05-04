// Base DAO — helpers communs pour better-sqlite3
// Convention :
//   - les méthodes sont synchrones (better-sqlite3 ne fait pas d'async)
//   - on retourne `null` quand un enregistrement n'existe pas (pas d'exception)
//   - les écritures retournent { id } pour insert, { changes } pour update/delete
//   - les filtres sont composés en {colonne: valeur} et joints par AND
//
// Usage attendu (cf. dao/reservations.dao.js) :
//   class ReservationsDao extends BaseDao { constructor() { super('reservations'); } }
//   export const reservationsDao = new ReservationsDao();

import db from '../database.js';
import { AppError } from '../middleware/errorHandler.js';

// Identifiants SQL autorisés (table/colonne)
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdent(name, kind = 'identifier') {
  if (typeof name !== 'string' || !SAFE_IDENT.test(name)) {
    throw new AppError(`Nom de ${kind} invalide: ${name}`, 500, 'DAO_INVALID_IDENT');
  }
  return name;
}

function buildWhere(filters) {
  if (!filters || typeof filters !== 'object') return { sql: '', params: [] };
  const keys = Object.keys(filters).filter((k) => filters[k] !== undefined);
  if (keys.length === 0) return { sql: '', params: [] };
  const clauses = [];
  const params = [];
  for (const key of keys) {
    assertIdent(key, 'colonne');
    const val = filters[key];
    if (val === null) {
      clauses.push(`${key} IS NULL`);
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        // IN () invalide en SQL → forcer faux
        clauses.push('1 = 0');
      } else {
        clauses.push(`${key} IN (${val.map(() => '?').join(', ')})`);
        params.push(...val);
      }
    } else {
      clauses.push(`${key} = ?`);
      params.push(val);
    }
  }
  return { sql: ` WHERE ${clauses.join(' AND ')}`, params };
}

function buildOrderBy(orderBy) {
  if (!orderBy) return '';
  // accepte 'col' ou 'col DESC' ou ['col1','col2 DESC']
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts = items.map((item) => {
    const [col, dirRaw] = String(item).trim().split(/\s+/);
    assertIdent(col, 'colonne');
    const dir = (dirRaw || 'ASC').toUpperCase();
    if (dir !== 'ASC' && dir !== 'DESC') {
      throw new AppError(`Direction de tri invalide: ${dirRaw}`, 500, 'DAO_INVALID_ORDER');
    }
    return `${col} ${dir}`;
  });
  return ` ORDER BY ${parts.join(', ')}`;
}

export class BaseDao {
  constructor(tableName, { primaryKey = 'id', softDeleteColumn = null } = {}) {
    this.table = assertIdent(tableName, 'table');
    this.pk = assertIdent(primaryKey, 'colonne');
    this.softDeleteColumn = softDeleteColumn ? assertIdent(softDeleteColumn, 'colonne') : null;
  }

  /** Trouver un enregistrement par sa PK. Retourne null si non trouvé. */
  findById(id, { columns = '*' } = {}) {
    const sql = `SELECT ${columns} FROM ${this.table} WHERE ${this.pk} = ?`;
    return db.prepare(sql).get(id) ?? null;
  }

  /** Trouver le premier enregistrement matchant les filtres. */
  findOne(filters = {}, { columns = '*', orderBy = null } = {}) {
    const { sql: where, params } = buildWhere(filters);
    const sql = `SELECT ${columns} FROM ${this.table}${where}${buildOrderBy(orderBy)} LIMIT 1`;
    return db.prepare(sql).get(...params) ?? null;
  }

  /** Liste tous les enregistrements matchant les filtres. */
  findAll(filters = {}, { columns = '*', orderBy = null, limit = null, offset = 0 } = {}) {
    const { sql: where, params } = buildWhere(filters);
    let sql = `SELECT ${columns} FROM ${this.table}${where}${buildOrderBy(orderBy)}`;
    if (limit != null) {
      sql += ` LIMIT ? OFFSET ?`;
      return db.prepare(sql).all(...params, Number(limit), Number(offset) || 0);
    }
    return db.prepare(sql).all(...params);
  }

  /** Pagination : retourne { data, total, limit, offset, hasMore }. */
  paginate(filters = {}, { columns = '*', orderBy = null, limit = 50, offset = 0 } = {}) {
    const { sql: where, params } = buildWhere(filters);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM ${this.table}${where}`).get(...params).n;
    const data = this.findAll(filters, { columns, orderBy, limit, offset });
    return {
      data,
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: offset + data.length < total,
    };
  }

  /** Compte les enregistrements matchant les filtres. */
  count(filters = {}) {
    const { sql: where, params } = buildWhere(filters);
    return db.prepare(`SELECT COUNT(*) AS n FROM ${this.table}${where}`).get(...params).n;
  }

  /** Insère et retourne { id }. */
  insert(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new AppError('Payload insert invalide', 500, 'DAO_INVALID_PAYLOAD');
    }
    const cols = Object.keys(payload).filter((k) => payload[k] !== undefined);
    if (cols.length === 0) {
      throw new AppError('Aucune colonne à insérer', 400, 'DAO_EMPTY_INSERT');
    }
    cols.forEach((c) => assertIdent(c, 'colonne'));
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((c) => payload[c]);
    const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`;
    const info = db.prepare(sql).run(...values);
    return { id: info.lastInsertRowid };
  }

  /** Met à jour par PK et retourne { changes }. */
  update(id, patch) {
    if (!patch || typeof patch !== 'object') {
      throw new AppError('Payload update invalide', 500, 'DAO_INVALID_PAYLOAD');
    }
    const cols = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== this.pk);
    if (cols.length === 0) return { changes: 0 };
    cols.forEach((c) => assertIdent(c, 'colonne'));
    const setSql = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => patch[c]);
    const sql = `UPDATE ${this.table} SET ${setSql} WHERE ${this.pk} = ?`;
    const info = db.prepare(sql).run(...values, id);
    return { changes: info.changes };
  }

  /** Supprime par PK (hard delete). */
  delete(id) {
    const info = db.prepare(`DELETE FROM ${this.table} WHERE ${this.pk} = ?`).run(id);
    return { changes: info.changes };
  }

  /** Soft delete si `softDeleteColumn` est configuré, sinon hard delete. */
  softDelete(id, { value = 0 } = {}) {
    if (!this.softDeleteColumn) return this.delete(id);
    const info = db
      .prepare(`UPDATE ${this.table} SET ${this.softDeleteColumn} = ? WHERE ${this.pk} = ?`)
      .run(value, id);
    return { changes: info.changes };
  }

  /** Exécute un callback dans une transaction better-sqlite3. */
  transaction(fn) {
    return db.transaction(fn)();
  }

  /** Accès brut au handle DB pour requêtes spécifiques. */
  get db() {
    return db;
  }
}

export default BaseDao;
