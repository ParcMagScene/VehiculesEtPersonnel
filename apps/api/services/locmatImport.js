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

// Format Locmat des SN : `<core> - <mag>` ou `<mag> - <core>` où mag = 1 LETTRE + 2 CHIFFRES
// strict (ex: T01, V12, E09). Séparateur strict ` - ` (au moins un espace de chaque côté).
// Ex : `T01 -  2400953513` (TETRA2), `0788770045   - V12` (VIPER).
// Cf. apps/api/services/magNumber.js pour la source de vérité.
import { parseMagSerial } from './magNumber.js';

/**
 * Parse un SN Locmat brut. Extrait un éventuel numéro MAG (T01, V12, E09...).
 * Délègue à parseMagSerial (module partagé).
 * @param {string} rawSerial
 * @returns {{ coreSerial: string, magNumber: string|null }}
 */
export function parseLocmatSerial(rawSerial) {
  return parseMagSerial(rawSerial);
}

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
  const rawSerial = String(pick(row, SER_FIELDS.serial) || '').trim();
  if (!rawSerial) return null;
  const { coreSerial, magNumber } = parseLocmatSerial(rawSerial);
  return {
    code,
    serial: coreSerial,
    rawSerial,
    magNumber,
    name: String(pick(row, SER_FIELDS.name) || '').trim() || null,
  };
}

/**
 * Compare des données CSV normalisées avec un snapshot DB (Modèle A pur :
 * 1 ligne `equipment` = 1 unité physique, pas de table `equipment_serials`).
 *
 * @param {object} args
 * @param {Array} args.locations Lignes normalisées de Locations.csv
 * @param {Array} args.serials   Lignes normalisées de Serialise.csv
 * @param {Map<string,object>} args.dbCatalogByCode  Représentant equipment par reference (UPPER) :
 *                                                  { id, name, description, unit_price, location, quantity }
 * @param {Map<string,Set<string>>} args.dbSerialsByCode  serials existants (equipment.serial_number) par refUpper
 * @param {Map<string,string>}      [args.dbOwnerCodeBySerial]  index inverse serial → refUpper (collision cross-ref)
 * @param {Map<string,{magNumber:string|null, equipmentId:number}>} [args.dbMagBySerial]
 *        Index serial → numéro mag actuel + id, pour détecter les mises à jour de N° MAG.
 * @param {Map<string,number[]>} [args.dbAllActiveIdsByCode] Index refUpper → liste des id
 *        de toutes les lignes equipment actives pour cette référence (catalogue + unités).
 *        Utilisé pour soft-delete en masse les missingProducts.
 * @returns Diff { newProducts, updatedProducts, quantityChanges, newSerials, serialUpdates,
 *                 removedSerials, missingProducts, duplicates, collisions, errors,
 *                 legacyCatalogToDelete }
 */
export function diffWithDatabase({
  locations,
  serials,
  dbCatalogByCode,
  dbSerialsByCode,
  dbOwnerCodeBySerial,
  dbMagBySerial,
  dbAllActiveIdsByCode,
  // back-compat : tolère l'ancien nom dbItemsByCode
  dbItemsByCode,
}) {
  if (!dbCatalogByCode && dbItemsByCode) dbCatalogByCode = dbItemsByCode;
  if (!dbSerialsByCode) dbSerialsByCode = new Map();
  if (!dbOwnerCodeBySerial) dbOwnerCodeBySerial = new Map();
  if (!dbMagBySerial) dbMagBySerial = new Map();
  if (!dbAllActiveIdsByCode) dbAllActiveIdsByCode = new Map();

  const newProducts = [];
  const updatedProducts = [];
  const quantityChanges = [];
  const newSerials = [];
  const serialUpdates = []; // { code, serial, magNumber, fromMag, equipmentId }
  const removedSerials = [];
  const missingProducts = []; // références DB absentes des CSV (signalement)
  const legacyCatalogToDelete = []; // lignes catalogue à supprimer (modele A pur)
  const duplicates = { locations: [], serials: [] };
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

    const existing = dbCatalogByCode.get(key);
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

  // ─── 2. Serialise.csv (Modèle A : 1 ligne equipment par numéro de série) ───
  for (const [code, csvSerials] of serialsByCode.entries()) {
    const existing = dbCatalogByCode.get(code);
    const csvSet = new Set(csvSerials.map((s) => s.serial));

    if (!existing) {
      // Référence inconnue : signaler comme nouveau produit (1 entrée newProducts
      // pour permettre au confirm() de créer les unités sérialisées via newSerials).
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
        const ownerCode = dbOwnerCodeBySerial.get(s.serial);
        if (ownerCode) {
          collisions.push({
            scope: 'db-cross-ref',
            serial: s.serial,
            csvCode: s.code,
            dbCode: ownerCode,
          });
          continue;
        }
        newSerials.push({
          code: s.code,
          serial: s.serial,
          magNumber: s.magNumber || null,
          productExisting: false,
        });
      }
      continue;
    }

    const dbSet = dbSerialsByCode.get(code) || new Set();
    // nouveaux : dans CSV mais pas en DB ; existants : maj du numéro MAG si différent
    for (const s of csvSerials) {
      if (dbSet.has(s.serial)) {
        const dbInfo = dbMagBySerial.get(s.serial);
        const currentMag = dbInfo?.magNumber || null;
        const dbRawSerial = dbInfo?.rawSerial || null;
        // On émet un serialUpdate dans deux cas :
        //  1) Le N° MAG diffère entre CSV et DB.
        //  2) Le serial_number stocké est "sale" (legacy "MAG - SN") :
        //     on profite du passage pour le normaliser au coreSerial.
        const magDiffers = !!s.magNumber && s.magNumber !== currentMag;
        const serialNeedsNormalization = dbRawSerial && dbRawSerial !== s.serial;
        if (magDiffers || serialNeedsNormalization) {
          serialUpdates.push({
            code,
            serial: s.serial,
            magNumber: s.magNumber || currentMag || null,
            fromMag: currentMag,
            fromSerial: dbRawSerial,
            equipmentId: dbInfo?.equipmentId || null,
          });
        }
        continue;
      }
      const ownerCode = dbOwnerCodeBySerial.get(s.serial);
      if (ownerCode && ownerCode !== code) {
        collisions.push({
          scope: 'db-cross-ref',
          serial: s.serial,
          csvCode: s.code,
          dbCode: ownerCode,
        });
        continue;
      }
      newSerials.push({
        code: s.code,
        serial: s.serial,
        magNumber: s.magNumber || null,
        productExisting: true,
      });
    }
    // supprimés : dans DB mais plus dans CSV
    for (const dbSer of dbSet) {
      if (!csvSet.has(dbSer)) {
        const dbInfo = dbMagBySerial.get(dbSer);
        removedSerials.push({
          code,
          serial: dbSer,
          equipmentId: dbInfo?.equipmentId || null,
        });
      }
    }

    // Modèle A pur : si une ligne catalogue (sans serial_number) existe pour un
    // code qui a des unités sérialisées dans le CSV, elle doit être supprimée.
    const catalog = dbCatalogByCode.get(code);
    if (catalog && (!catalog.serial_number || catalog.serial_number === '')) {
      legacyCatalogToDelete.push({
        equipmentId: catalog.id,
        code: catalog.reference || code,
        name: catalog.name || null,
        quantity: Math.round(Number(catalog.quantity) || 0),
      });
    }
  }

  // ─── 3. Suppressions : refs présentes en DB mais absentes des deux CSV ───
  // On enrichit chaque entrée avec `equipmentIds` = toutes les lignes actives
  // de cette référence (catalogue + unités sérialisées), pour permettre au
  // confirm() de les soft-delete en masse si l'utilisateur le demande.
  const csvCodes = new Set([...seenCodes, ...serialsByCode.keys()]);
  for (const [dbCode, dbItem] of dbCatalogByCode.entries()) {
    if (!csvCodes.has(dbCode)) {
      const ids = dbAllActiveIdsByCode.get(dbCode) || [dbItem.id].filter(Boolean);
      missingProducts.push({
        id: dbItem.id,
        code: dbItem.reference || dbCode,
        name: dbItem.name || null,
        quantity: Math.round(Number(dbItem.quantity) || 0),
        equipmentIds: ids,
        unitsCount: ids.length,
      });
    }
  }

  return {
    newProducts,
    updatedProducts,
    quantityChanges,
    newSerials,
    serialUpdates,
    removedSerials,
    missingProducts,
    legacyCatalogToDelete,
    duplicates,
    collisions,
    errors,
  };
}
