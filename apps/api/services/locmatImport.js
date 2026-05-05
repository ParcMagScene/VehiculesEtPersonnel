// ═══════════════════════════════════════════════════════════════
// services/locmatImport.js
// Logique pure (sans dépendance Express ou DB) : normalisation des lignes
// Locmat (Locations.csv + Serialise.csv) et calcul du diff vs base.
// Testable unitairement.
// ═══════════════════════════════════════════════════════════════

/**
 * Champs attendus dans Locations.csv (export Locmat — clés tolérantes
 * aux accents/casse/séparateurs ; on lit ce qu'on trouve).
 */
const LOC_FIELDS = {
  code: ['Code libre générique', 'Code Libre', 'Code Article', 'Code', 'Référence', 'Reference'],
  name: ['Désignation', 'Designation', 'Nom', 'Libellé', 'Libelle'],
  description: ['Description', 'Commentaire', 'Notes'],
  category: ['Catégorie', 'Categorie', 'Famille', 'Type'],
  // ⚠️ Export Locmat : la colonne "Mag Scène" contient en fait la quantité stock
  quantity: [
    'Mag Scène',
    'Mag Scene',
    'Mag-Scene',
    'MAG SCENE',
    'Quantité',
    'Quantite',
    'Qté',
    'Qte',
    'Stock',
  ],
  price: ['Tarif 1 HT', 'Tarif', 'Tarif unitaire', 'Prix unitaire', 'Prix'],
  price2: ['Tarif 2 HT'],
  value: ['Valeur', 'Valeur stock'],
  barcode: ['Code à Barres', 'Code-barres', 'Code Barre', 'CodeBarre', 'Barcode', 'EAN'],
  location: ['Emplacement', 'Lieu', 'Location'],
  isSerialized: ['O', 'Sérialisé', 'Serialise', 'Sérialisée', 'Serialisable'],
};

const SER_FIELDS = {
  code: ['Code libre générique', 'Code Libre', 'Code Article', 'Code', 'Référence'],
  serial: [
    'Numéro de série',
    'Numéro de Série',
    'Numero de Serie',
    'N° de série',
    'Serial',
    'NumSerie',
  ],
  name: ['Nom', 'Désignation', 'Designation'],
  brand: ['Marque', 'Brand'],
};

function normalizeKey(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Construit un index { normKey -> rawKey } pour une ligne */
function indexRow(row) {
  const idx = {};
  for (const k of Object.keys(row)) idx[normalizeKey(k)] = k;
  return idx;
}

/** Cherche la 1ère valeur trouvée parmi un tableau d'alias */
function pick(row, aliases) {
  const idx = indexRow(row);
  for (const alias of aliases) {
    const k = idx[normalizeKey(alias)];
    if (k != null && row[k] !== '' && row[k] != null) return row[k];
  }
  return null;
}

function toNumber(v) {
  if (v == null || v === '') return 0;
  const s = String(v)
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v) {
  if (v === true || v === 1) return true;
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'vrai', 'oui', 'yes', 'x'].includes(s);
}

/**
 * Normalise une ligne Locations.csv vers un objet stable.
 * @returns {{ code, name, description, category, quantity, price, value,
 *            barcode, location, isMagScene, isSerialized } | null}
 */
export function normalizeLocationRow(row) {
  const code = String(pick(row, LOC_FIELDS.code) || '').trim();
  const name = String(pick(row, LOC_FIELDS.name) || '').trim();
  if (!code && !name) return null; // ligne vide
  return {
    code,
    name,
    description: String(pick(row, LOC_FIELDS.description) || '').trim() || null,
    category: String(pick(row, LOC_FIELDS.category) || '').trim() || null,
    quantity: Math.max(0, Math.round(toNumber(pick(row, LOC_FIELDS.quantity)))),
    price: Math.max(0, toNumber(pick(row, LOC_FIELDS.price))),
    value: Math.max(0, toNumber(pick(row, LOC_FIELDS.value))),
    barcode: String(pick(row, LOC_FIELDS.barcode) || '').trim() || null,
    location: String(pick(row, LOC_FIELDS.location) || '').trim() || null,
    isSerialized: toBool(pick(row, LOC_FIELDS.isSerialized)),
  };
}

/**
 * Normalise une ligne Serialise.csv.
 * @returns {{ code, serial, name } | null}
 */
export function normalizeSerialRow(row) {
  const code = String(pick(row, SER_FIELDS.code) || '').trim();
  const serial = String(pick(row, SER_FIELDS.serial) || '').trim();
  if (!serial) return null;
  return {
    code,
    serial,
    name: String(pick(row, SER_FIELDS.name) || '').trim() || null,
  };
}

/**
 * Compare des données CSV normalisées avec un snapshot DB.
 *
 * @param {object} args
 * @param {Array} args.locations Lignes normalisées de Locations.csv
 * @param {Array} args.serials   Lignes normalisées de Serialise.csv
 * @param {Map<string,object>} args.dbItemsByCode    equipment existants indexés par reference (UPPER) ;
 *                                                  doit inclure le champ `is_serialized` (0/1) pour
 *                                                  détecter une activation externe via Locmat.
 * @param {Map<string,Set<string>>} args.dbSerialsByItemId  serial actifs par equipment.id
 * @param {Map<string,number>}      [args.dbSerialOwnerBySerial]  index inverse serial actif → equipment.id
 *                                                                (utilisé pour détecter les collisions
 *                                                                cross-équipement)
 * @returns Diff complet { newProducts, updatedProducts, quantityChanges, serializationChanges,
 *                         newSerials, removedSerials, missingProducts, duplicates, collisions, errors }
 */
export function diffWithDatabase({
  locations,
  serials,
  dbItemsByCode,
  dbSerialsByItemId,
  dbSerialOwnerBySerial,
}) {
  const newProducts = [];
  const updatedProducts = [];
  const quantityChanges = [];
  const serializationChanges = []; // équipements existants à passer en is_serialized=1
  const newSerials = [];
  const removedSerials = [];
  const missingProducts = []; // références présentes en DB mais absentes des CSV (suppressions)
  const duplicates = { locations: [], serials: [] }; // doublons détectés dans les CSV
  const collisions = []; // serial sur plusieurs codes / déjà attribué ailleurs en DB
  const errors = [];

  // index utile : code -> serials du CSV (dé-doublonnés)
  const serialsByCode = new Map();
  // index inverse pour détecter qu'un même serial apparaît sous plusieurs codes
  const serialOwnerInCsv = new Map(); // serial -> Set<code>
  const seenSerialPerCode = new Map(); // code -> Set<serial> déjà vus (anti-doublon)
  for (const s of serials) {
    if (!s.code) {
      errors.push({ scope: 'serials', message: `Serial "${s.serial}" sans code de référence` });
      continue;
    }
    const key = s.code.toUpperCase();

    // doublon strict : même (code, serial) présent plusieurs fois dans Serialise.csv
    if (!seenSerialPerCode.has(key)) seenSerialPerCode.set(key, new Set());
    if (seenSerialPerCode.get(key).has(s.serial)) {
      duplicates.serials.push({ code: s.code, serial: s.serial, scope: 'csv' });
      continue; // on ignore les occurrences suivantes
    }
    seenSerialPerCode.get(key).add(s.serial);

    // collision intra-CSV : même serial sous codes différents
    if (!serialOwnerInCsv.has(s.serial)) serialOwnerInCsv.set(s.serial, new Set());
    serialOwnerInCsv.get(s.serial).add(key);

    if (!serialsByCode.has(key)) serialsByCode.set(key, []);
    serialsByCode.get(key).push(s);
  }

  // Émet les collisions intra-CSV (un serial porté par >1 code dans Serialise.csv)
  for (const [serial, codes] of serialOwnerInCsv.entries()) {
    if (codes.size > 1) {
      collisions.push({
        scope: 'csv-cross-code',
        serial,
        codes: [...codes],
      });
    }
  }

  // ─── 1. Locations.csv ───
  const seenCodes = new Set();
  for (const loc of locations) {
    if (!loc.code) {
      errors.push({ scope: 'locations', message: `Ligne sans code (nom="${loc.name}")` });
      continue;
    }
    const key = loc.code.toUpperCase();
    if (seenCodes.has(key)) {
      duplicates.locations.push({ code: loc.code, name: loc.name });
      errors.push({ scope: 'locations', message: `Code dupliqué dans le CSV: ${loc.code}` });
      continue;
    }
    seenCodes.add(key);

    const existing = dbItemsByCode.get(key);
    if (!existing) {
      newProducts.push(loc);
      continue;
    }

    // comparaison champ à champ
    // ⚠️ On ne compare QUE les champs réellement persistés par confirm() :
    //    name, description (→ notes), unit_price (→ purchase_price), location.
    //    Les colonnes `barcode` et `sell_price` n'existent pas dans la table
    //    `equipment` ; les inclure générerait des "différences" éternelles.
    const diffs = {};
    if (loc.name && loc.name !== existing.name) diffs.name = { from: existing.name, to: loc.name };
    if (loc.description != null && loc.description !== (existing.description || null))
      diffs.description = { from: existing.description, to: loc.description };
    if (loc.price > 0 && Math.abs(loc.price - (existing.unit_price || 0)) > 0.001)
      diffs.unit_price = { from: existing.unit_price, to: loc.price };
    if (loc.location && loc.location !== (existing.location || null))
      diffs.location = { from: existing.location, to: loc.location };

    if (Object.keys(diffs).length > 0) {
      updatedProducts.push({ id: existing.id, code: loc.code, name: loc.name, diffs });
    }

    // changements quantité (séparé pour traçabilité movement)
    const dbQty = Math.round(Number(existing.quantity) || 0);
    if (loc.quantity !== dbQty) {
      quantityChanges.push({
        id: existing.id,
        code: loc.code,
        name: loc.name || existing.name,
        from: dbQty,
        to: loc.quantity,
        delta: loc.quantity - dbQty,
      });
    }
  }

  // ─── 2. Serialise.csv ───
  for (const [code, csvSerials] of serialsByCode.entries()) {
    const existing = dbItemsByCode.get(code);
    const csvSet = new Set(csvSerials.map((s) => s.serial));

    if (!existing) {
      // Référence inconnue : créer le produit + tous les serials nouveaux
      const isAlreadyInNew = newProducts.some((p) => p.code.toUpperCase() === code);
      if (!isAlreadyInNew) {
        newProducts.push({
          code: csvSerials[0].code,
          name: csvSerials[0].name || csvSerials[0].code,
          description: null,
          category: null,
          quantity: csvSet.size,
          price: 0,
          value: 0,
          barcode: null,
          location: null,
          isSerialized: true,
          fromSerialiseOnly: true,
        });
      }
      for (const s of csvSerials) {
        // Collision DB sur ref nouvelle : serial déjà actif ailleurs
        const ownerId = dbSerialOwnerBySerial?.get(s.serial);
        if (ownerId) {
          collisions.push({
            scope: 'db-cross-equipment',
            serial: s.serial,
            csvCode: s.code,
            csvEquipmentId: null, // produit pas encore créé
            dbEquipmentId: ownerId,
          });
          continue;
        }
        newSerials.push({ code: s.code, serial: s.serial, productExisting: false });
      }
      continue;
    }

    const dbSet = dbSerialsByItemId.get(existing.id) || new Set();
    // nouveaux : dans CSV mais pas en DB
    for (const s of csvSerials) {
      if (!dbSet.has(s.serial)) {
        // collision DB : ce serial est déjà actif sur un AUTRE équipement
        const ownerId = dbSerialOwnerBySerial?.get(s.serial);
        if (ownerId && ownerId !== existing.id) {
          collisions.push({
            scope: 'db-cross-equipment',
            serial: s.serial,
            csvCode: s.code,
            csvEquipmentId: existing.id,
            dbEquipmentId: ownerId,
          });
          continue; // on n'ajoute pas un newSerial qui violerait l'unicité partielle
        }
        newSerials.push({
          equipmentId: existing.id,
          code: s.code,
          serial: s.serial,
          productExisting: true,
        });
      }
    }
    // supprimés : dans DB mais plus dans CSV
    for (const dbSer of dbSet) {
      if (!csvSet.has(dbSer)) {
        removedSerials.push({
          equipmentId: existing.id,
          code,
          serial: dbSer,
        });
      }
    }

    // ⚠️ Cas sérialisation externe : l'équipement n'était pas marqué sérialisé
    // dans eMag, mais Locmat fournit des numéros de série pour cette réf.
    // → On planifie l'activation `is_serialized = 1` ET on aligne la quantité
    //   sur le nombre de serials actifs après import (= csvSet.size).
    const wasSerialized = Number(existing.is_serialized) === 1;
    if (!wasSerialized && csvSet.size > 0) {
      const targetQty = csvSet.size;
      serializationChanges.push({
        id: existing.id,
        code: csvSerials[0].code,
        name: existing.name,
        from: false,
        to: true,
        serialCount: targetQty,
      });

      // Override / insert quantityChange pour aligner stock_quantity = nb serials actifs
      const dbQty = Math.round(Number(existing.quantity) || 0);
      const idx = quantityChanges.findIndex((q) => q.id === existing.id);
      if (idx >= 0) {
        quantityChanges[idx] = {
          ...quantityChanges[idx],
          to: targetQty,
          delta: targetQty - quantityChanges[idx].from,
          reason: 'serialization-sync',
        };
      } else if (dbQty !== targetQty) {
        quantityChanges.push({
          id: existing.id,
          code: csvSerials[0].code,
          name: existing.name,
          from: dbQty,
          to: targetQty,
          delta: targetQty - dbQty,
          reason: 'serialization-sync',
        });
      }
    }
  }

  // ─── 3. Suppressions : refs présentes en DB mais absentes des deux CSV ───
  // (signalement seulement, pas d'écriture côté serveur sans confirmation)
  const csvCodes = new Set([...seenCodes, ...serialsByCode.keys()]);
  for (const [dbCode, dbItem] of dbItemsByCode.entries()) {
    if (!csvCodes.has(dbCode)) {
      missingProducts.push({
        id: dbItem.id,
        code: dbItem.reference || dbCode,
        name: dbItem.name || null,
        quantity: Math.round(Number(dbItem.quantity) || 0),
      });
    }
  }

  return {
    newProducts,
    updatedProducts,
    quantityChanges,
    serializationChanges,
    newSerials,
    removedSerials,
    missingProducts,
    duplicates,
    collisions,
    errors,
  };
}
