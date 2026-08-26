// migrations/affaires-v2-schema-v1.js — T-P0-08
//
// Ticket : EXECUTION_PLAN_EMAG_3_0.md T-P0-08 (P0 Affaires v2 — FK
// strictes, autorisé par P0-DECISION-2 du 2026-07-10).
//
// Cette migration est **strictement additive** et idempotente :
//   1. Materialise dans `affaires` toutes les affaires implicites
//      (numero_affaire reference dans les tables filles mais absent de
//      `affaires`). INSERT OR IGNORE — jamais d'UPDATE.
//   2. Ajoute une colonne `affaire_ref_id INTEGER` (nullable) sur
//      chaque table fille reliant `affaires.id` par lookup sur
//      `numero_affaire`. Le nom `affaire_ref_id` evite toute
//      collision avec les colonnes TEXT `affaire` / `affaire_id`
//      existantes (celles-ci restent inchangees pendant la phase de
//      coexistence stricte, cf T-P0-09 pour le sunset TEXT).
//   3. Backfill `affaire_ref_id` a partir de la colonne TEXT
//      correspondante (UPDATE avec sous-requete de lookup).
//   4. Cree la table `affaire_history` (audit trail modifications sur
//      la table `affaires`).
//
// Idempotence : chaque etape ne s'execute que si l'element a creer
// n'existe pas deja. Un rejeu propre laisse la DB identique.
//
// Aucune modification de l'API v1. Le namespace v2 `/api/v2/affaires`
// sera livre en T-P0-09.
//
// Voir docs/05-Specs/AFFAIRES_V2.md.

import logger from '../logger.js';

/**
 * Verifie qu'une table existe.
 * @param {import('better-sqlite3').Database} db
 * @param {string} name
 */
function tableExists(db, name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

/**
 * Verifie qu'une colonne existe.
 * @param {import('better-sqlite3').Database} db
 * @param {string} table
 * @param {string} column
 */
function columnExists(db, table, column) {
  try {
    return db.pragma(`table_info(${table})`).some((c) => c.name === column);
  } catch {
    return false;
  }
}

/**
 * Ajoute une colonne INTEGER `affaire_ref_id` sur une table fille si
 * absente. Cree egalement l'index correspondant. Retourne `true` si
 * une nouvelle colonne a effectivement ete ajoutee.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} table
 * @returns {boolean}
 */
function ensureAffaireRefColumn(db, table) {
  if (!tableExists(db, table)) return false;
  if (columnExists(db, table, 'affaire_ref_id')) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN affaire_ref_id INTEGER`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_affaire_ref_id ON ${table}(affaire_ref_id)`);
  return true;
}

/**
 * Backfill `affaire_ref_id` depuis la colonne TEXT existante par
 * lookup dans `affaires.numero_affaire`. Ne met a jour que les lignes
 * ou `affaire_ref_id IS NULL` (idempotent).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} table
 * @param {string} textColumn - Colonne TEXT source (`affaire` ou `affaire_id`).
 * @returns {number} Nombre de lignes mises a jour.
 */
function backfillAffaireRef(db, table, textColumn) {
  if (!tableExists(db, table)) return 0;
  if (!columnExists(db, table, textColumn)) return 0;
  if (!columnExists(db, table, 'affaire_ref_id')) return 0;
  const result = db
    .prepare(
      `UPDATE ${table}
       SET affaire_ref_id = (
         SELECT a.id FROM affaires a WHERE a.numero_affaire = ${table}.${textColumn}
       )
       WHERE affaire_ref_id IS NULL
         AND ${textColumn} IS NOT NULL
         AND ${textColumn} <> ''`,
    )
    .run();
  return result.changes ?? 0;
}

/**
 * Materialise dans `affaires` toutes les affaires implicites
 * distinctes referencees par les tables filles connues. INSERT OR
 * IGNORE — aucune ecriture destructive. Retourne la liste des
 * numeros nouvellement inseres.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string[]} numero_affaire nouvellement inseres.
 */
function materializeImplicitAffaires(db) {
  if (!tableExists(db, 'affaires')) return [];

  const sources = [
    { table: 'reservations', column: 'affaire' },
    { table: 'missions', column: 'affaire' },
    { table: 'orders', column: 'affaire_id' },
    { table: 'bl_imports', column: 'affaire_id' },
    { table: 'dynamic_display_events', column: 'affaire_id' },
    { table: 'equipment_assignments', column: 'affaire_id' },
  ];

  const implicits = new Map(); // numero_affaire -> { client, date_debut, date_fin, nom }

  for (const src of sources) {
    if (!tableExists(db, src.table) || !columnExists(db, src.table, src.column)) continue;
    const rows = db
      .prepare(
        `SELECT DISTINCT src.${src.column} AS numero_affaire
         FROM ${src.table} src
         LEFT JOIN affaires a ON a.numero_affaire = src.${src.column}
         WHERE src.${src.column} IS NOT NULL
           AND src.${src.column} <> ''
           AND a.id IS NULL`,
      )
      .all();
    for (const row of rows) {
      if (!implicits.has(row.numero_affaire)) {
        implicits.set(row.numero_affaire, {
          numero_affaire: row.numero_affaire,
          client: null,
          date_debut: null,
          date_fin: null,
          nom: null,
        });
      }
    }
  }

  if (implicits.size === 0) return [];

  // Enrichir le payload depuis reservations si possible (source la plus
  // riche en donnees metier).
  if (tableExists(db, 'reservations') && columnExists(db, 'reservations', 'affaire')) {
    const enrich = db.prepare(
      `SELECT MIN(client_name) AS client,
              MIN(start_date) AS date_debut,
              MAX(end_date) AS date_fin,
              MIN(prestation_name) AS prestation
       FROM reservations WHERE affaire = ?`,
    );
    for (const entry of implicits.values()) {
      const row = enrich.get(entry.numero_affaire);
      if (row) {
        entry.client = row.client || null;
        entry.date_debut = row.date_debut || null;
        entry.date_fin = row.date_fin || null;
        entry.nom = row.prestation || null;
      }
    }
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO affaires
       (numero_affaire, type, client, date_debut, date_fin, nom, created_by, created_at)
     VALUES (?, 'Prestation', ?, ?, ?, ?, NULL, datetime('now'))`,
  );

  const inserted = [];
  const tx = db.transaction((entries) => {
    for (const e of entries) {
      const res = insert.run(e.numero_affaire, e.client, e.date_debut, e.date_fin, e.nom);
      if (res.changes > 0) inserted.push(e.numero_affaire);
    }
  });
  tx(Array.from(implicits.values()));
  return inserted;
}

/**
 * Verifie que la table `affaire_history` existe (creee par la
 * migration L6 anterieure, cf `services/affaireHistory.js`). Le
 * service v2 (`services/affaires/history.js`) reutilise cette table
 * en discriminant les entrees v2 via `event_type='field_change'` +
 * `source='v2_api'`. Aucune modification de schema n'est necessaire.
 *
 * [HOTFIX 2026-07-10] : la version initiale de T-P0-08 tentait de
 * creer une table concurrente au schema field-based, ce qui produisait
 * un warning `no such column: changed_at` sur les bases existantes.
 * Corrige : detection simple sans creation ni ALTER.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean} `true` si la table est presente et exploitable.
 */
function ensureAffaireHistoryTable(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='affaire_history'")
    .get();
  return Boolean(row);
}

/**
 * Point d'entree principal de la migration. Idempotent.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function runAffairesV2SchemaMigration(db) {
  if (!tableExists(db, 'affaires')) {
    logger.warn('  ⚠️ Affaires v2: table affaires absente, migration ignoree');
    return;
  }

  // 1. Materialisation des affaires implicites
  try {
    const inserted = materializeImplicitAffaires(db);
    if (inserted.length > 0) {
      logger.info(
        `  ✅ Affaires v2: ${inserted.length} affaire(s) implicite(s) materialisee(s) — ${inserted.join(', ')}`,
      );
    } else {
      logger.info('  ✅ Affaires v2: aucune affaire implicite a materialiser');
    }
  } catch (err) {
    logger.error(`  ❌ Affaires v2: materialisation echouee — ${err.message}`);
  }

  // 2. Ajout des colonnes `affaire_ref_id` sur les tables filles
  const targets = [
    { table: 'reservations', textColumn: 'affaire' },
    { table: 'missions', textColumn: 'affaire' },
    { table: 'orders', textColumn: 'affaire_id' },
    { table: 'bl_imports', textColumn: 'affaire_id' },
    { table: 'dynamic_display_events', textColumn: 'affaire_id' },
    { table: 'equipment_assignments', textColumn: 'affaire_id' },
  ];

  const added = [];
  for (const t of targets) {
    try {
      if (ensureAffaireRefColumn(db, t.table)) added.push(t.table);
    } catch (err) {
      logger.warn(`  ⚠️ Affaires v2: colonne affaire_ref_id sur ${t.table} — ${err.message}`);
    }
  }
  if (added.length > 0) {
    logger.info(`  ✅ Affaires v2: colonne affaire_ref_id ajoutee sur ${added.join(', ')}`);
  }

  // 3. Backfill depuis les colonnes TEXT
  const backfillTotals = [];
  for (const t of targets) {
    try {
      const changes = backfillAffaireRef(db, t.table, t.textColumn);
      if (changes > 0) backfillTotals.push(`${t.table}:${changes}`);
    } catch (err) {
      logger.warn(`  ⚠️ Affaires v2: backfill ${t.table} — ${err.message}`);
    }
  }
  if (backfillTotals.length > 0) {
    logger.info(`  ✅ Affaires v2: backfill affaire_ref_id — ${backfillTotals.join(', ')}`);
  }

  // 4. Table `affaire_history` : existe deja depuis L6 (event-based).
  //    Le service v2 (`services/affaires/history.js`) reutilise cette
  //    table via `event_type='field_change'` + `source='v2_api'`.
  try {
    const exists = ensureAffaireHistoryTable(db);
    if (exists) {
      logger.info('  ✅ Affaires v2: table affaire_history OK (schema legacy L6 reutilise)');
    } else {
      logger.warn(
        "  ⚠️ Affaires v2: table affaire_history absente — le PATCH v2 audite ne pourra pas ecrire tant que la migration L6 n'aura pas cree la table",
      );
    }
  } catch (err) {
    logger.warn(`  ⚠️ Affaires v2: verification affaire_history — ${err.message}`);
  }
}
