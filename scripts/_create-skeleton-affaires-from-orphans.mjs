#!/usr/bin/env node
/**
 * Crée des affaires squelettes à partir des bl_imports orphelins dont le filename
 * matche AFxxxxx mais dont l'affaire n'existe PAS encore dans la table `affaires`.
 *
 * Stratégie :
 *   1. SELECT bl_imports orphelins (affaire_id IS NULL ou '') + filename matchant AF.
 *   2. Groupe par AF (un même AF peut avoir plusieurs BPs).
 *   3. Pour chaque AF inconnu : créé une affaire minimale à partir du parsed_data
 *      du BP le plus complet (champs fournis par le parser).
 *   4. UPDATE bl_imports.affaire_id = AFxxxxx pour tous les BPs de ce groupe.
 *
 * Dry-run par défaut. --apply pour exécuter. Backup auto avant --apply.
 *
 * À LANCER APRÈS _repair-bl-imports-orphans.mjs (qui rattache les AF déjà existants).
 *
 * Usage :
 *   node scripts/_create-skeleton-affaires-from-orphans.mjs            # dry-run
 *   node scripts/_create-skeleton-affaires-from-orphans.mjs --apply    # exécute
 *   node scripts/_create-skeleton-affaires-from-orphans.mjs --db=apps/api/vehicules-dev.db --apply
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const NO_BACKUP = args.includes('--no-backup');
const dbArg = args.find((a) => a.startsWith('--db='));
const DB_PATH = path.resolve(
  repoRoot,
  dbArg ? dbArg.slice('--db='.length) : 'apps/api/vehicules.db',
);

function extractAFFromFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const m = filename.match(/AF[-_\s]?(\d{4,6})/i);
  return m ? `AF${m[1]}` : null;
}

// Normalise une date "dd/mm/yyyy" → "yyyy-mm-dd". Sinon renvoie la valeur telle quelle.
function normalizeDate(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function pickBest(items) {
  // BP "le plus complet" = celui dont parsed_data a le plus de champs non-vides.
  let best = items[0];
  let bestScore = -1;
  for (const it of items) {
    const pd = it._pd || {};
    let score = 0;
    for (const k of [
      'client',
      'interlocuteur',
      'tel',
      'fax',
      'date',
      'dateDebut',
      'dateFin',
      'devis',
      'adresse',
      'nomAffaire',
      'objet',
      'type',
    ]) {
      if (pd[k]) score++;
    }
    if ((pd.sections || []).length > 0) score += 2;
    if ((pd.items || []).length > 0) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

// ─── Sanity ──────────────────────────────────────────────────────────────
if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB introuvable : ${DB_PATH}`);
  process.exit(2);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Création affaires squelettes depuis bl_imports orphelins');
console.log(`  DB    : ${DB_PATH}`);
console.log(`  Mode  : ${APPLY ? 'APPLY (écriture)' : 'DRY-RUN (lecture seule)'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (APPLY && !NO_BACKUP) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(repoRoot, 'backups', 'db');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${path.basename(DB_PATH, '.db')}.pre-create-skeletons.${stamp}.db`,
  );
  try {
    execSync(`sqlite3 "${DB_PATH}" ".backup '${backupPath}'"`, { stdio: 'pipe' });
  } catch (_) {
    fs.copyFileSync(DB_PATH, backupPath);
  }
  console.log(`✓ Backup créé : ${path.relative(repoRoot, backupPath)}`);
  console.log('');
}

const db = new Database(DB_PATH, { readonly: !APPLY });

// 1. Lire les orphelins restants
const orphans = db
  .prepare(
    `SELECT id, filename, parsed_data, doc_type, affaire_type, created_by, created_at
     FROM bl_imports
     WHERE affaire_id IS NULL OR TRIM(COALESCE(affaire_id, '')) = ''`,
  )
  .all();

// 2. Grouper par AF (filtré sur filename matchable)
const groups = new Map();
let unmatched = 0;
for (const row of orphans) {
  const af = extractAFFromFilename(row.filename);
  if (!af) {
    unmatched++;
    continue;
  }
  try {
    row._pd = row.parsed_data ? JSON.parse(row.parsed_data) : {};
  } catch {
    row._pd = {};
  }
  if (!groups.has(af)) groups.set(af, []);
  groups.get(af).push(row);
}

// 3. Filtrer ceux dont l'affaire existe déjà (cas de race avec script 1)
const existsStmt = db.prepare('SELECT 1 FROM affaires WHERE numero_affaire = ? LIMIT 1');
const candidates = [];
let alreadyExist = 0;
for (const [af, rows] of groups) {
  if (existsStmt.get(af)) {
    alreadyExist += rows.length;
    continue;
  }
  candidates.push({ af, rows });
}

console.log(`Orphelins lus              : ${orphans.length}`);
console.log(`  filename sans AF         : ${unmatched}`);
console.log(`  AF déjà existant en DB   : ${alreadyExist} (à traiter par script 1)`);
console.log(`Affaires à créer           : ${candidates.length} (groupes AF distincts)`);
console.log(
  `BPs concernés              : ${candidates.reduce((s, c) => s + c.rows.length, 0)}`,
);
console.log('');

if (candidates.length === 0) {
  console.log('Rien à créer.');
  db.close();
  process.exit(0);
}

// Aperçu
console.log('Aperçu :');
for (const { af, rows } of candidates.slice(0, 30)) {
  const best = pickBest(rows);
  const pd = best._pd || {};
  console.log(
    `  ${af} ← ${rows.length} BP(s) | client="${pd.client || '?'}" | type="${pd.type || best.affaire_type || 'Prestation'}" | date="${pd.date || pd.dateDebut || '?'}"`,
  );
}
if (candidates.length > 30) console.log(`  ... +${candidates.length - 30} autres`);
console.log('');

// 4. Exécution
const insertAffaire = db.prepare(
  `INSERT INTO affaires (
     numero_affaire, type, client, interlocuteur, tel, fax,
     date_debut, date_fin, devis, adresse_livraison, titre, description,
     created_by, modified_by, status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const updateBL = db.prepare('UPDATE bl_imports SET affaire_id = ? WHERE id = ?');

let createdCount = 0;
let blUpdated = 0;
const errors = [];

const apply = db.transaction(() => {
  for (const { af, rows } of candidates) {
    const best = pickBest(rows);
    const pd = best._pd || {};
    const today = new Date().toISOString().slice(0, 10);

    // Type : pd.type → affaire_type → mapping depuis docType → Prestation
    let type = pd.type || best.affaire_type || null;
    if (!type) {
      if (best.doc_type === 'bl_vente') type = 'Vente';
      else type = 'Prestation';
    }

    // Dates
    let dateDebut = normalizeDate(pd.dateDebut) || normalizeDate(pd.date) || null;
    let dateFin = normalizeDate(pd.dateFin) || null;
    // Affiner depuis sections si dispo
    if (Array.isArray(pd.sections)) {
      for (const sec of pd.sections) {
        const dD = normalizeDate(sec.dateDebut);
        if (dD && (!dateDebut || dD < dateDebut)) dateDebut = dD;
        const dF = normalizeDate(sec.dateFin);
        if (dF && (!dateFin || dF > dateFin)) dateFin = dF;
      }
    }

    const titre = pd.nomAffaire || pd.objet || '';
    const description = `Affaire créée automatiquement depuis ${rows.length} BP orphelin(s) — script _create-skeleton-affaires-from-orphans (${new Date().toISOString().slice(0, 10)})`;

    try {
      if (APPLY) {
        insertAffaire.run(
          af,
          type,
          pd.client || '',
          pd.interlocuteur || '',
          pd.tel || '',
          pd.fax || '',
          dateDebut || today,
          dateFin || '',
          pd.devis || '',
          pd.adresse || '',
          titre,
          description,
          best.created_by || null,
          best.created_by || null,
          'brouillon',
        );
        for (const r of rows) {
          updateBL.run(af, r.id);
          blUpdated++;
        }
      }
      createdCount++;
    } catch (e) {
      errors.push({ af, error: e.message });
    }
  }
});

apply();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Résumé :');
console.log(`  Affaires ${APPLY ? 'créées' : 'à créer'} : ${createdCount}`);
if (APPLY) console.log(`  BPs rattachés        : ${blUpdated}`);
if (errors.length > 0) {
  console.log(`  Erreurs              : ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`    - ${e.af} : ${e.error}`);
}
if (!APPLY) {
  console.log('  (dry-run — relancer avec --apply)');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

db.close();
process.exit(errors.length > 0 ? 1 : 0);
