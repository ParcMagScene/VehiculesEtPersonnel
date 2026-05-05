#!/usr/bin/env node
/**
 * migrate-drivers.mjs — Migration des conducteurs orphelins vers persons
 *
 * Usage : node scripts/migrate-drivers.mjs [--dry-run]
 *
 * Ce script :
 *   1. Identifie les drivers sans person liée (orphelins)
 *   2. Crée une person pour chacun (split name → first_name/last_name)
 *   3. Met à NULL persons.driver_id pour tous
 *
 * À exécuter AVANT de supprimer la table drivers.
 * Pré-requis : backup de la base de données.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Charger better-sqlite3 depuis le projet
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '..', 'apps', 'api', 'data', 'reservations.db');

const isDryRun = process.argv.includes('--dry-run');

console.log(`\n═══════════════════════════════════════════`);
console.log(`  Migration Drivers → Persons`);
console.log(`  Base : ${DB_PATH}`);
console.log(`  Mode : ${isDryRun ? '🟡 DRY-RUN (aucune modification)' : '🔴 LIVE (modifications effectives)'}`);
console.log(`═══════════════════════════════════════════\n`);

let db;
try {
  db = new Database(DB_PATH, { readonly: isDryRun });
} catch (err) {
  console.error(`❌ Impossible d'ouvrir la base : ${err.message}`);
  process.exit(1);
}

db.pragma('foreign_keys = ON');

// ─── 1. Vérifier les drivers orphelins ───────────────────────────────────────
const orphanDrivers = db.prepare(`
  SELECT d.id, d.name, d.phone, d.license_number
  FROM drivers d
  LEFT JOIN persons p ON p.driver_id = d.id
  WHERE p.id IS NULL
  ORDER BY d.id
`).all();

const allDrivers = db.prepare('SELECT COUNT(*) as n FROM drivers').get();
const linkedPersons = db.prepare('SELECT COUNT(*) as n FROM persons WHERE driver_id IS NOT NULL').get();

console.log(`📊 Statistiques :`);
console.log(`   Drivers total       : ${allDrivers.n}`);
console.log(`   Persons avec driver_id : ${linkedPersons.n}`);
console.log(`   Drivers orphelins   : ${orphanDrivers.length}`);

if (orphanDrivers.length === 0) {
  console.log('\n✅ Aucun driver orphelin — aucune person à créer.');
} else {
  console.log(`\n👤 Drivers orphelins à migrer :`);
  orphanDrivers.forEach((d) => {
    console.log(`   [${d.id}] "${d.name}" — tél: ${d.phone || '—'} — permis: ${d.license_number || '—'}`);
  });

  if (!isDryRun) {
    const insertPerson = db.prepare(`
      INSERT INTO persons (first_name, last_name, phone, license_types, type, status)
      VALUES (?, ?, ?, ?, 'permanent', 'active')
    `);

    const migrate = db.transaction(() => {
      let created = 0;
      for (const driver of orphanDrivers) {
        const nameParts = (driver.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Inconnu';
        const lastName = nameParts.slice(1).join(' ') || driver.name || 'Conducteur';
        const licenseTypes = JSON.stringify(
          driver.license_number ? [driver.license_number] : []
        );

        const result = insertPerson.run(
          firstName,
          lastName,
          driver.phone || null,
          licenseTypes,
        );
        console.log(`   ✅ Créé person [${result.lastInsertRowid}] : ${firstName} ${lastName}`);
        created++;
      }
      return created;
    });

    const count = migrate();
    console.log(`\n✅ ${count} person(s) créée(s) depuis les drivers orphelins.`);
  } else {
    console.log('\n🟡 DRY-RUN : aucune insertion effectuée.');
  }
}

// ─── 2. Vérification finale ───────────────────────────────────────────────────
console.log('\n─── Prochaines étapes manuelles ────────────────────────────────────────');
console.log('1. Vérifier que les persons créées sont correctes dans l\'interface admin');
console.log('2. Supprimer les routes /api/drivers dans apps/api/routes.js');
console.log('3. Exécuter la migration DB : DROP TABLE drivers + DROP COLUMN driver_id');
console.log('4. (Optionnel) Supprimer le store IndexedDB "drivers" (incrémenter DB_VERSION)');
console.log('────────────────────────────────────────────────────────────────────────\n');

db.close();
