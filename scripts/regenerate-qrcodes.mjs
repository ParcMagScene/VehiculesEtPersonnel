#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  regenerate-qrcodes.mjs                                               ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║  Régénère la colonne `equipment.qrcode` pour TOUS les équipements    ║
// ║  ayant un UID. Nouveau format :                                       ║
// ║    • Payload = URL absolue vers la fiche mobile                       ║
// ║      ex: http://magsav.duckdns.org:4173/#/mobile/equipment/EMAG-S00001║
// ║    • Encodage : ECC niveau H (~30%)                                   ║
// ║    • Logo Mag Scène centré (PNG embarqué)                             ║
// ║    • Format DB : data URL SVG base64                                  ║
// ║                                                                        ║
// ║  Usage :                                                              ║
// ║    node scripts/regenerate-qrcodes.mjs           # avec API_BASE_URL  ║
// ║    BASE_URL=https://m.magscene.fr node scripts/regenerate-qrcodes.mjs ║
// ║    node scripts/regenerate-qrcodes.mjs --dry-run                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import 'dotenv/config';

import db from '../apps/api/database.js';
import {
  buildEquipmentQrPayload,
  generateQrDataUrl,
} from '../apps/api/services/qrcodeGenerator.js';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || args.has('-n');
const BASE = process.env.BASE_URL || process.env.API_BASE_URL || 'http://magsav.duckdns.org:4173';

console.log('╔══════════════════════════════════════════════════════════════════════');
console.log('║  Régénération des QR codes équipement');
console.log('╠══════════════════════════════════════════════════════════════════════');
console.log(`║  Base URL : ${BASE}`);
console.log(`║  Mode     : ${DRY_RUN ? 'DRY-RUN (aucune écriture)' : 'PRODUCTION (UPDATE en DB)'}`);
console.log('╚══════════════════════════════════════════════════════════════════════');

const rows = db
  .prepare("SELECT id, uid, name FROM equipment WHERE uid IS NOT NULL AND uid != '' ORDER BY id")
  .all();

console.log(`\n→ ${rows.length} équipement(s) avec UID à traiter.\n`);

if (rows.length === 0) {
  console.log('Aucun équipement à mettre à jour.');
  process.exit(0);
}

const updateStmt = db.prepare('UPDATE equipment SET qrcode = ? WHERE id = ?');
const tx = db.transaction((items) => {
  for (const { id, qr } of items) updateStmt.run(qr, id);
});

let ok = 0;
let failed = 0;
const batch = [];
const t0 = Date.now();

for (const eq of rows) {
  try {
    const payload = buildEquipmentQrPayload(eq.uid, BASE);
    const qr = generateQrDataUrl(payload);
    batch.push({ id: eq.id, qr });
    ok++;
    if (ok % 100 === 0) process.stdout.write(`  ${ok}/${rows.length}\r`);
  } catch (e) {
    failed++;
    console.error(`  ✗ #${eq.id} ${eq.uid} : ${e.message}`);
  }
}

if (!DRY_RUN && batch.length > 0) {
  tx(batch);
}

const dt = ((Date.now() - t0) / 1000).toFixed(2);
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log(`  ✅ Régénérés : ${ok}`);
console.log(`  ✗  Échecs    : ${failed}`);
console.log(`  ⏱  Durée     : ${dt}s`);
console.log(`  💾 ${DRY_RUN ? 'Aucune écriture (dry-run)' : 'Écriture DB effectuée'}`);
console.log('──────────────────────────────────────────────────────────────────────');

process.exit(failed > 0 ? 1 : 0);
