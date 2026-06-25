/**
 * 0005_parse_legacy_location_text.mjs — [PERF Phase 4.L2]
 *
 * Migration one-shot du parser texte "location" → champs structurés
 * (location_depot, location_zone, location_floor).
 *
 * Avant : code identique dans database.js (`runMigrations`) tournait à chaque
 *   boot PM2 et faisait un `SELECT COUNT(*) ... WHERE location_depot IS NULL`
 *   → ~197ms full scan equipment, juste pour retomber sur 0 à migrer.
 *
 * Les routes equipmentRoutes.js (INSERT/UPDATE) écrivent désormais les
 * champs structurés directement → plus besoin de re-parser au boot.
 *
 * Si jamais de nouvelles lignes legacy apparaissent, relancer manuellement :
 *   node scripts/migrate.mjs  (ne re-tournera pas tant que _migrations garde
 *   cette migration appliquée ; pour rejouer il faudrait `DELETE FROM
 *   _migrations WHERE name = '0005_parse_legacy_location_text.mjs'`).
 */

const DEPOT1_RDC = new Set([
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4',
  'C', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  'D1', 'D2', 'D3', 'D4',
  'QUAI1', 'QUAI2', 'QUAI3',
  'BUREAUX', 'ENTREE',
  'I1', 'I2', 'I3',
]);

const DEPOT1_MEZZ = new Set([
  'E1', 'E2', 'E3',
  'F', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8',
  'G', 'G1', 'G2', 'G3',
  'H', 'H1', 'H2', 'H3',
  'CUISINE', 'LOCAL_GELAT', 'CHAMBRE', 'SALLE_REU', 'ARC_INFO',
]);

const DEPOT2_RDC = new Set([
  'J', 'J1', 'J2', 'J3', 'J4', 'J5',
  'K', 'K1', 'K2', 'K3', 'K4',
  'L', 'L1', 'L2',
  'N', 'QUAI1', 'QUAI2', 'TOURNEES', 'WC',
]);

const DEPOT2_MEZZ = new Set(['M', 'M1']);

export default function up(db) {
  const items = db
    .prepare(
      "SELECT id, location FROM equipment WHERE location IS NOT NULL AND location != '' AND (location_depot IS NULL OR location_depot = '')",
    )
    .all();

  if (items.length === 0) {
    return; // rien à faire (cas normal post-déploiement initial)
  }

  const updateStmt = db.prepare(
    'UPDATE equipment SET location_depot = ?, location_zone = ?, location_floor = ? WHERE id = ?',
  );

  let migrated = 0;
  for (const item of items) {
    const match = item.location.match(/^Entrepôt\s+(\d+)\s*:\s*(.+)$/i);
    if (match) {
      const depot = match[1];
      let zone = match[2].trim();
      let floor = null;
      if (depot === '1') {
        if (DEPOT1_RDC.has(zone)) floor = 'RDC';
        else if (DEPOT1_MEZZ.has(zone)) floor = 'MEZZ';
      } else if (depot === '2') {
        if (zone === 'M') zone = 'M1';
        if (DEPOT2_RDC.has(zone)) floor = 'RDC';
        else if (DEPOT2_MEZZ.has(zone)) floor = 'MEZZ';
      }
      updateStmt.run(depot, zone, floor, item.id);
      migrated++;
    } else if (
      /^[A-Z]\d?$/i.test(item.location) &&
      item.location !== 'Hors stock' &&
      item.location !== 'Hors-Stock'
    ) {
      const zone = item.location.trim();
      if (DEPOT1_RDC.has(zone) || DEPOT1_MEZZ.has(zone)) {
        const floor = DEPOT1_RDC.has(zone) ? 'RDC' : 'MEZZ';
        updateStmt.run('1', zone, floor, item.id);
        migrated++;
      } else if (DEPOT2_RDC.has(zone) || DEPOT2_MEZZ.has(zone)) {
        const floor = DEPOT2_RDC.has(zone) ? 'RDC' : 'MEZZ';
        updateStmt.run('2', zone, floor, item.id);
        migrated++;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`   📦 ${migrated}/${items.length} équipements legacy migrés`);
}
