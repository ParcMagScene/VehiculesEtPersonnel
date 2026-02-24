#!/usr/bin/env node
// ============================================================
// sync_inventory_to_catalog.js
// Synchronisation inventaire (CSV/XLSX) → equipment_catalog
// Auto-liaison avec flight-cases selon règles de nommage
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ───
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'server', 'vehicules.db');
const IMPORT_DIR = join(__dirname, '..', 'public', 'imports');

// Règles de mapping flight-case automatique
const FLIGHTCASE_RULES = [
  { pattern: /console/i, fcCategory: 'Consoles' },
  { pattern: /ampli/i, fcCategory: 'Amplification' },
  { pattern: /micro/i, fcCategory: 'Microphonie' },
  { pattern: /projecteur|lyres?|wash|spot/i, fcCategory: 'Lumière' },
  { pattern: /câble|cable|multi/i, fcCategory: 'Câbles' },
  { pattern: /écran|screen|vidéo/i, fcCategory: 'Vidéo' },
];

// ─── Helpers ───
function generateId() {
  return crypto.randomUUID();
}

function parseCSV(content, delimiter = ',') {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Détecter le délimiteur
  const headerLine = lines[0];
  if (headerLine.includes(';') && !headerLine.includes(',')) {
    delimiter = ';';
  }

  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"/, '').replace(/"$/, ''));
    const row = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || '';
    });
    rows.push(row);
  }

  return rows;
}

function normalizeReference(ref) {
  if (!ref) return null;
  return ref.toString().trim().toUpperCase().replace(/\s+/g, '-');
}

// ─── Mapping colonnes (flexible) ───
function mapRow(row) {
  // Essayer différents noms de colonnes courants
  const name = row['Désignation'] || row['Name'] || row['Nom'] || row['Description'] || row['designation'] || '';
  const reference = row['Référence'] || row['Reference'] || row['Ref'] || row['Code'] || row['reference'] || '';
  const family = row['Famille'] || row['Family'] || row['Type'] || row['famille'] || '';
  const subfamily = row['Sous-famille'] || row['SubFamily'] || row['sous_famille'] || '';
  const category = row['Catégorie'] || row['Category'] || row['categorie'] || '';
  const weight = parseFloat(row['Poids'] || row['Weight'] || row['poids'] || '0') || null;

  // Localisation dépôt
  const location_zone = row['Zone'] || row['zone'] || row['Location Zone'] || '';
  const location_code = row['Code'] || row['code'] || row['Location Code'] || row['Emplacement'] || '';
  const location_floor = row['Étage'] || row['Etage'] || row['Floor'] || row['etage'] || '';

  // Dimensions
  let dimensions = null;
  const w = parseFloat(row['Largeur'] || row['Width'] || row['L'] || '0');
  const h = parseFloat(row['Hauteur'] || row['Height'] || row['H'] || '0');
  const d = parseFloat(row['Profondeur'] || row['Depth'] || row['P'] || '0');
  if (w && h && d) {
    dimensions = { w, h, d };
  }

  return {
    reference: normalizeReference(reference),
    name: name.trim(),
    family: family.trim() || null,
    subfamily: subfamily.trim() || null,
    category: category.trim() || null,
    weight,
    dimensions,
    location_zone: location_zone.trim() || null,
    location_code: location_code.trim() || null,
    location_floor: location_floor.trim() || null,
  };
}

// ─── Main sync function ───
function syncInventoryToCatalog(filePath) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📦 Synchronisation Inventaire → Catalogue eM@g');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  if (!existsSync(filePath)) {
    console.error(`❌ Fichier introuvable: ${filePath}`);
    process.exit(1);
  }

  if (!existsSync(DB_PATH)) {
    console.error(`❌ Base de données introuvable: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const ext = extname(filePath).toLowerCase();
  let rows;

  if (ext === '.csv') {
    const content = readFileSync(filePath, 'utf-8');
    rows = parseCSV(content);
  } else if (ext === '.xlsx' || ext === '.xls') {
    // Dynamically import xlsx if available
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (e) {
      console.error('❌ Module "xlsx" non disponible. Installez-le: npm install xlsx');
      process.exit(1);
    }
  } else {
    console.error(`❌ Format non supporté: ${ext} (CSV ou XLSX attendu)`);
    process.exit(1);
  }

  console.log(`📁 Fichier: ${filePath}`);
  console.log(`📊 Lignes trouvées: ${rows.length}`);
  console.log('');

  // Charger les flight-cases existants pour l'auto-linking
  const flightcases = db.prepare('SELECT * FROM flightcases').all();

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0, fcLinked: 0 };

  const insertStmt = db.prepare(`
    INSERT INTO equipment_catalog (id, reference, name, family, subfamily, category, dimensions, weight, default_flightcase_id, location_zone, location_code, location_floor, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE equipment_catalog SET name = ?, family = ?, subfamily = ?, category = ?, dimensions = ?, weight = ?, default_flightcase_id = COALESCE(?, default_flightcase_id), location_zone = COALESCE(?, location_zone), location_code = COALESCE(?, location_code), location_floor = COALESCE(?, location_floor), updated_at = ?
    WHERE reference = ?
  `);

  const findByRef = db.prepare('SELECT * FROM equipment_catalog WHERE reference = ?');

  const syncTransaction = db.transaction(() => {
    for (const row of rows) {
      const mapped = mapRow(row);

      if (!mapped.name) {
        stats.skipped++;
        continue;
      }

      try {
        // Auto-link flight-case
        let fcId = null;
        for (const rule of FLIGHTCASE_RULES) {
          if (rule.pattern.test(mapped.name) || rule.pattern.test(mapped.family || '') || rule.pattern.test(mapped.category || '')) {
            const matchingFC = flightcases.find(fc => fc.category === rule.fcCategory);
            if (matchingFC) {
              fcId = matchingFC.id;
              stats.fcLinked++;
              break;
            }
          }
        }

        const existing = mapped.reference ? findByRef.get(mapped.reference) : null;
        const now = new Date().toISOString();
        const dims = mapped.dimensions ? JSON.stringify(mapped.dimensions) : null;

        if (existing) {
          // Update
          updateStmt.run(
            mapped.name, mapped.family, mapped.subfamily, mapped.category,
            dims, mapped.weight, fcId,
            mapped.location_zone, mapped.location_code, mapped.location_floor,
            now, mapped.reference
          );
          stats.updated++;
        } else {
          // Create
          const id = generateId();
          const ref = mapped.reference || `AUTO-${id.slice(0, 8).toUpperCase()}`;
          insertStmt.run(
            id, ref, mapped.name, mapped.family, mapped.subfamily, mapped.category,
            dims, mapped.weight, fcId,
            mapped.location_zone, mapped.location_code, mapped.location_floor,
            now, now
          );
          stats.created++;
        }
      } catch (e) {
        console.error(`  ⚠️ Erreur ligne "${mapped.name}": ${e.message}`);
        stats.errors++;
      }
    }
  });

  syncTransaction();
  db.close();

  console.log('─────────────────────────────────────────');
  console.log(`  ✅ Créés    : ${stats.created}`);
  console.log(`  🔄 Mis à jour : ${stats.updated}`);
  console.log(`  ⏭️  Ignorés   : ${stats.skipped}`);
  console.log(`  🔗 FC liés    : ${stats.fcLinked}`);
  console.log(`  ❌ Erreurs    : ${stats.errors}`);
  console.log('─────────────────────────────────────────');
  console.log('');
}

// ─── CLI Entry Point ───
const args = process.argv.slice(2);
if (args.length === 0) {
  // Chercher automatiquement les fichiers d'import
  console.log('Usage: node sync_inventory_to_catalog.js <fichier.csv|xlsx>');
  console.log('');
  console.log('Fichiers disponibles dans public/imports/:');
  if (existsSync(IMPORT_DIR)) {
    const files = readdirSync(IMPORT_DIR);
    files.forEach(f => console.log(`  - ${f}`));
  }
} else {
  const filePath = args[0].startsWith('/') ? args[0] : join(process.cwd(), args[0]);
  syncInventoryToCatalog(filePath);
}
