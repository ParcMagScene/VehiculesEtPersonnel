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

function loadCsv(path, mode) {
  const text = fs.readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = fields[i] ?? '';
    rows.push(obj);
  }
  return rows;
}

const locRows = loadCsv(LOC_PATH, 'loc');
const serRows = loadCsv(SER_PATH, 'ser');

const locRefs = new Map();
const serialsByRef = new Map();
for (const row of locRows) {
  const raw = row['Code Libre'] || row['Code libre'] || row['Code'] || row['Référence'] || row['Reference'] || '';
  const key = normalizeRef(raw);
  if (!key) continue;
  locRefs.set(key, true);
}
for (const row of serRows) {
  const rawCode = row['Code libre générique'] || row['Code libre'] || row['Code'] || row['Référence'] || row['Reference'] || '';
  const serial = String(row['Numéro de série'] || row['Numero de Serie'] || row['Serial'] || '').trim();
  const key = normalizeRef(rawCode);
  if (!key) continue;
  if (!serialsByRef.has(key)) serialsByRef.set(key, new Set());
  if (serial) serialsByRef.get(key).add(serial.trim());
  locRefs.set(key, true);
}

const db = new Database(DB_PATH);
const allRows = db.prepare(`SELECT id, reference, serial_number, status FROM equipment WHERE reference IS NOT NULL AND reference != '' ORDER BY id`).all();
const toRemove = [];
const keep = [];

for (const row of allRows) {
  const ref = String(row.reference || '').trim();
  const refNorm = normalizeRef(ref);
  if (!refNorm) continue;

  const serial = String(row.serial_number || '').trim();

  if (!locRefs.has(refNorm)) {
    toRemove.push({ id: row.id, ref, serial, reason: 'db-only-ref' });
    continue;
  }

  if (serial) {
    const allowedSerials = serialsByRef.get(refNorm) || new Set();
    if (allowedSerials.size > 0 && !allowedSerials.has(serial)) {
      toRemove.push({ id: row.id, ref, serial, reason: 'unexpected-serial' });
      continue;
    }
    if (allowedSerials.size === 0) {
      toRemove.push({ id: row.id, ref, serial, reason: 'serial-without-csv' });
      continue;
    }
    keep.push(row.id);
    continue;
  }

  if ((serialsByRef.get(refNorm) || new Set()).size > 0) {
    toRemove.push({ id: row.id, ref, serial, reason: 'legacy-catalog-row' });
    continue;
  }

  keep.push(row.id);
}

console.log('=== LOCMAT DB RECONCILE ===');
console.log('DB_PATH:', DB_PATH);
console.log('CSV refs:', locRefs.size);
console.log('DB rows with reference:', allRows.length);
console.log('Rows to remove:', toRemove.length);
console.log('Rows kept:', keep.length);
console.log('Sample removes:');
for (const item of toRemove.slice(0, 25)) {
  console.log(`  #${item.id} ${item.ref} | serial=${item.serial || '<blank>'} | ${item.reason}`);
}

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to soft-delete flagged rows.');
  db.close();
  process.exit(0);
}

const backupPath = `${DB_PATH}.backup-reconcile-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log('\nBackup created:', backupPath);

const tx = db.transaction(() => {
  const stmt = db.prepare(`UPDATE equipment SET status = 'removed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  for (const item of toRemove) stmt.run(item.id);
});

tx();
console.log('\nApplied soft-delete for', toRemove.length, 'rows.');
db.close();
