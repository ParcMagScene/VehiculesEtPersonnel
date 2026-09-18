#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'apps', 'api', 'vehicules.db');
const LOC_PATH = path.join(ROOT, 'public', 'Location.csv');
const SER_PATH = path.join(ROOT, 'public', 'Serialises.csv');
const APPLY = process.argv.includes('--apply');
const ARCHIVE_DB_ONLY = process.argv.includes('--archive-db-only');

function normalizeRef(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  s = s.replace(/\u00A0/g, ' ');
  s = s.normalize('NFKD');
  s = s.replace(/[\u0300-\u036f]/g, '');
  s = s.toUpperCase();
  s = s.replace(/&/g, 'AND');
  s = s.replace(/[•–—]/g, ' ');
  s = s.replace(/"/g, '');
  s = s.replace(/'/g, '');
  s = s.replace(/,/g, '');
  s = s.replace(/\./g, '');
  s = s.replace(/\//g, '');
  s = s.replace(/\(/g, '').replace(/\)/g, '');
  s = s.replace(/\[/g, '').replace(/\]/g, '');
  s = s.replace(/\{/g, '').replace(/\}/g, '');
  s = s.replace(/\s+/g, '');
  s = s.replace(/[^A-Z0-9-]/g, '');
  s = s.replace(/--+/g, '-');
  return s.replace(/^-+|-+$/g, '');
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function loadCsvRefs(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { refs: new Map(), rows: 0 };

  const header = parseCsvLine(lines[0]);
  const refIndexes = [];
  for (const key of ['Code Libre', 'Code libre', 'Code libre générique', 'Code', 'Code Article', 'Reference', 'Référence']) {
    const idx = header.findIndex((h) => String(h || '').trim().toLowerCase() === key.toLowerCase());
    if (idx >= 0) refIndexes.push(idx);
  }
  if (refIndexes.length === 0) return { refs: new Map(), rows: 0 };

  const refs = new Map();
  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const raw = refIndexes
      .map((idx) => row[idx] || '')
      .find((v) => String(v).trim() !== '');
    if (!raw) continue;
    const key = normalizeRef(raw);
    if (!key) continue;
    if (!refs.has(key)) refs.set(key, raw.trim());
  }
  return { refs, rows: refs.size };
}

const csvLocations = loadCsvRefs(LOC_PATH);
const csvSerials = loadCsvRefs(SER_PATH);
const csvCanon = new Map([...csvLocations.refs, ...csvSerials.refs]);

const db = new Database(DB_PATH);
const rows = db.prepare(
  "SELECT id, reference FROM equipment WHERE reference IS NOT NULL AND reference != '' ORDER BY id",
).all();

const toNormalize = [];
const dbOnly = [];
for (const row of rows) {
  const norm = normalizeRef(row.reference);
  if (!norm) continue;
  if (csvCanon.has(norm)) {
    const canonical = csvCanon.get(norm);
    if (String(row.reference).trim() !== canonical) {
      toNormalize.push({ id: row.id, old: String(row.reference).trim(), next: canonical });
    }
  } else {
    dbOnly.push({ id: row.id, ref: String(row.reference).trim(), norm });
  }
}

const summary = {
  csvRefs: csvCanon.size,
  dbRows: rows.length,
  toNormalize: toNormalize.length,
  dbOnly: dbOnly.length,
  dbOnlyRefs: [...new Set(dbOnly.map((r) => r.norm))],
};

console.log('=== NORMALIZE LOCMAT DB REFS ===');
console.log('DB path:', DB_PATH);
console.log('CSV canonical refs:', summary.csvRefs);
console.log('DB rows with non-empty reference:', summary.dbRows);
console.log('References to normalize:', summary.toNormalize);
console.log('DB-only normalised refs:', summary.dbOnly);
console.log('DB-only normalized values:', summary.dbOnlyRefs);

if (toNormalize.length > 0) {
  console.log('\nWill normalize:');
  for (const row of toNormalize.slice(0, 40)) {
    console.log(`  #${row.id}: ${row.old} -> ${row.next}`);
  }
}

if (dbOnly.length > 0) {
  console.log('\nDB-only references:');
  for (const row of dbOnly.slice(0, 40)) {
    console.log(`  #${row.id}: ${row.ref} -> ${row.norm}`);
  }
}

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to update the DB.');
  db.close();
  process.exit(0);
}

const backupPath = `${DB_PATH}.backup-normalize-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log('\nBackup created:', backupPath);

const tx = db.transaction(() => {
  for (const row of toNormalize) {
    db.prepare('UPDATE equipment SET reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.next, row.id);
  }
  if (ARCHIVE_DB_ONLY) {
    for (const row of dbOnly) {
      db.prepare('UPDATE equipment SET status = ?, archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('removed', row.id);
    }
  }
});

tx();
console.log('\nApplied changes:', toNormalize.length, 'reference normalizations');
if (ARCHIVE_DB_ONLY) console.log('Archived DB-only rows:', dbOnly.length);
db.close();
