#!/usr/bin/env node
/**
 * scripts/personnel-v2-drivers-audit.mjs
 *
 * Ticket : T-P1-03 (Personnel v2 - Unification identites).
 *
 * Audit dry-run **strictement read-only** de la coexistence
 * `drivers` <-> `persons`. Detecte :
 *   1. Drivers orphelins (aucune ligne `persons.driver_id` -> drivers.id
 *      correspondante).
 *   2. Persons rattachees a un driver via `driver_id` (potentiel double
 *      d'identite qui pourrait etre unifie).
 *   3. Total counts + ratio.
 *
 * Sortie stdout : JSON structure.
 * Exit codes :
 *   0 : aucun driver orphelin (safe pour un sunset destructif).
 *   1 : drivers orphelins detectes (decision utilisateur requise
 *       avant sunset).
 *   2 : environnement invalide (table absente).
 *
 * Aucun --apply implemente : la migration destructive (DROP TABLE
 * drivers + DROP COLUMN persons.driver_id) reste bloquee jusqu'a
 * decision utilisateur explicite (analogue P0-DECISION-2).
 *
 * Usage :
 *   node scripts/personnel-v2-drivers-audit.mjs
 *   DB_PATH=/tmp/vehicules-copy.db node scripts/personnel-v2-drivers-audit.mjs
 */

import process from 'node:process';

import db from '../apps/api/database.js';

function tableExists(name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

function main() {
  const report = {
    ticket: 'T-P1-03',
    mode: 'audit-dry-run',
    generated_at: new Date().toISOString(),
  };

  if (!tableExists('drivers')) {
    report.error = 'table drivers absente (deja supprimee ?)';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }
  if (!tableExists('persons')) {
    report.error = 'table persons absente';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }

  const driversCount = db.prepare('SELECT COUNT(*) AS n FROM drivers').get().n;
  const personsCount = db.prepare('SELECT COUNT(*) AS n FROM persons').get().n;
  const personsWithDriverId = db
    .prepare('SELECT COUNT(*) AS n FROM persons WHERE driver_id IS NOT NULL')
    .get().n;

  const orphanDrivers = db
    .prepare(
      `SELECT d.id, d.name, d.phone, d.license_number
       FROM drivers d
       LEFT JOIN persons p ON p.driver_id = d.id
       WHERE p.id IS NULL
       ORDER BY d.id`,
    )
    .all();

  const linkedPersons = db
    .prepare(
      `SELECT p.id, p.first_name, p.last_name, p.driver_id
       FROM persons p
       WHERE p.driver_id IS NOT NULL
       ORDER BY p.id`,
    )
    .all();

  report.counts = {
    drivers_total: driversCount,
    persons_total: personsCount,
    persons_with_driver_id: personsWithDriverId,
    drivers_orphelins: orphanDrivers.length,
  };
  report.orphan_drivers = orphanDrivers;
  report.linked_persons_sample = linkedPersons.slice(0, 20);
  report.linked_persons_total = linkedPersons.length;

  if (orphanDrivers.length === 0) {
    report.verdict = 'OK — aucun driver orphelin, sunset destructif safe';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(0);
  }
  report.verdict = `${orphanDrivers.length} driver(s) orphelin(s) — creer les persons manquantes avant sunset (T-P1-03b)`;
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  db.close();
  process.exit(1);
}

main();
