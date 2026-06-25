#!/usr/bin/env node
import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const dbPath = resolve(process.env.DB_PATH || 'apps/api/vehicules.db');
const db = new Database(dbPath, { readonly: true });

db.pragma('foreign_keys = ON');

const checks = [
  {
    key: 'integrity_check',
    sql: "SELECT CASE WHEN (SELECT integrity_check FROM pragma_integrity_check) = 'ok' THEN 0 ELSE 1 END AS issues",
  },
  {
    key: 'foreign_key_check',
    sql: 'SELECT COUNT(*) AS issues FROM pragma_foreign_key_check',
  },
  {
    key: 'orphans_annuaire_contact_entity_links',
    sql: `SELECT COUNT(*) AS issues FROM v_db_audit_annuaire_contact_entity_links_orphans`,
  },
  {
    key: 'orphans_task_assignments_reservation',
    sql: `SELECT COUNT(*) AS issues FROM v_db_audit_task_assignments_reservation_orphans`,
  },
  {
    key: 'orphans_bp_items_stock',
    sql: `SELECT COUNT(*) AS issues FROM v_db_audit_bp_items_stock_orphans`,
  },
];

let hasIssue = false;
console.log(`DB audit post-migration on ${dbPath}`);

for (const check of checks) {
  try {
    const row = db.prepare(check.sql).get();
    const issues = Number(row?.issues || 0);
    const status = issues === 0 ? 'OK' : 'FAIL';
    console.log(`${status} | ${check.key} | issues=${issues}`);
    if (issues !== 0) hasIssue = true;
  } catch (error) {
    console.log(`FAIL | ${check.key} | error=${error.message}`);
    hasIssue = true;
  }
}

db.close();
process.exit(hasIssue ? 1 : 0);
