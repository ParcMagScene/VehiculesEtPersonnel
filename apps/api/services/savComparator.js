/**
 * SAV Comparator — module métier de synchronisation eM@g ↔ LocMat
 *
 * Responsabilités :
 *  - Parser un export CSV LocMat (séparateur `;`).
 *  - Comparer les lignes du CSV avec l'état courant des tickets eM@g.
 *  - Classer chaque ligne dans :
 *      • newTickets       : ticket inexistant côté eM@g, à créer
 *      • updatedTickets   : ticket existant, statut/date à mettre à jour
 *      • closedTickets    : tickets actifs eM@g absents du CSV → à clôturer
 *      • collisions       : modif eM@g postérieure à l'import → décision manuelle
 *      • duplicates       : lignes CSV doublonnées (même SN/UID + date entrée ±48h)
 *      • errors           : lignes invalides (pas de match équipement, date illisible)
 *
 * Toutes les fonctions sont pures (pas d'écriture DB) sauf `applyConfirm()` qui
 * exécute la transaction d'écriture après validation utilisateur.
 *
 * STATUTS INTERNES (stockés en base, lower-case) :
 *   open | in_progress | waiting_parts | resolved | closed | sortie_sav
 *
 * LABELS UI (FR, MAJUSCULE) :
 *   OUVERT | EN_COURS | ATTENTE_PIECE | RESOLU | CLOTURE | SORTIE_SAV
 */

import logger from '../logger.js';

// ────────────────────────────────────────────────────────────────────────────
// Constantes statuts
// ────────────────────────────────────────────────────────────────────────────

export const SAV_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_PARTS: 'waiting_parts',
  RESOLVED: 'resolved',
  SORTIE_SAV: 'sortie_sav',
  CLOSED: 'closed',
});

export const SAV_STATUS_VALUES = Object.values(SAV_STATUS);

export const SAV_STATUS_LABELS = Object.freeze({
  open: 'OUVERT',
  in_progress: 'EN_COURS',
  waiting_parts: 'ATTENTE_PIECE',
  resolved: 'RESOLU',
  sortie_sav: 'SORTIE_SAV',
  closed: 'CLOTURE',
});

const ACTIVE_STATUSES = new Set(['open', 'in_progress', 'waiting_parts']);

/** Statut LocMat texte → statut interne. */
export function mapLocmatStatus(rawText) {
  const t = (rawText || '').trim().toLowerCase();
  if (!t) return SAV_STATUS.IN_PROGRESS;
  if (t.includes('en cours')) return SAV_STATUS.IN_PROGRESS;
  if (t.includes('attente') || t.includes('pièce') || t.includes('piece')) {
    return SAV_STATUS.WAITING_PARTS;
  }
  if (
    t.includes('résolu') ||
    t.includes('resolu') ||
    t.includes('réparé') ||
    t.includes('repare')
  ) {
    return SAV_STATUS.RESOLVED;
  }
  if (t.includes('sortie') || t.includes('sorti')) return SAV_STATUS.SORTIE_SAV;
  if (t.includes('clôtur') || t.includes('clotur') || t.includes('fermé') || t.includes('ferme')) {
    return SAV_STATUS.CLOSED;
  }
  return SAV_STATUS.IN_PROGRESS;
}

// ────────────────────────────────────────────────────────────────────────────
// Parser CSV LocMat
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse une date FR LocMat « 05/11/2025 AM » ou « 05/11/2025 PM » → ISO `YYYY-MM-DDTHH:mm:ss`.
 * AM = 09:00, PM = 14:00 (convention métier interne, valeurs informatives).
 * Retourne null si la date est vide ou illisible.
 */
export function parseFrenchDate(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Accepte « DD/MM/YYYY [AM|PM] » et « DD/MM/YYYY HH:mm »
  const re = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(AM|PM|\d{1,2}:\d{2}))?$/i;
  const m = s.match(re);
  if (!m) return null;
  const day = String(m[1]).padStart(2, '0');
  const month = String(m[2]).padStart(2, '0');
  const year = m[3];
  let time = '09:00:00';
  if (m[4]) {
    const suffix = m[4].toUpperCase();
    if (suffix === 'AM') time = '09:00:00';
    else if (suffix === 'PM') time = '14:00:00';
    else time = `${suffix}:00`;
  }
  return `${year}-${month}-${day}T${time}`;
}

/**
 * Parse contenu CSV LocMat brut (string). Détecte le séparateur (`;` ou `,`).
 * Tolère BOM, lignes vides, en-têtes variants.
 *
 * Format attendu :
 *   Code Libre;Code Article;Nom Article;Numéro de série;Début;Fin;Coût;A
 *
 * Retourne `{ rows: Array<NormalizedRow>, errors: Array<{line, message}> }`.
 */
export function parseLocmatCsv(content) {
  if (!content || typeof content !== 'string') {
    return { rows: [], errors: [{ line: 0, message: 'Contenu CSV vide ou invalide' }] };
  }
  // Strip BOM + normalise newlines
  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'CSV vide' }] };
  }

  // Détection du séparateur : compte ; vs , dans la 1ère ligne
  const headerLine = lines[0];
  const sep =
    (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length ? ';' : ',';

  const splitLine = (line) => {
    // Parser CSV minimal supportant les guillemets
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === sep) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  // Mapping headers : tolérant
  const headers = splitLine(headerLine).map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim());
  const findCol = (...candidates) => {
    for (const cand of candidates) {
      const idx = headers.findIndex((h) => h === cand || h.includes(cand));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colCodeLibre = findCol('code libre', 'intervention', 'code_libre');
  const colCodeArticle = findCol('code article', 'code_article', 'code');
  const colNomArticle = findCol('nom article', 'nom_article', 'designation', 'désignation', 'nom');
  const colSerial = findCol(
    'numéro de série',
    'numero de serie',
    'numero_de_serie',
    'série',
    'serie',
    'sn',
  );
  const colDebut = findCol('début', 'debut', 'date début', 'entrée', 'entree');
  const colFin = findCol('fin', 'date fin', 'sortie');
  const colCout = findCol('coût', 'cout', 'prix', 'montant');
  const colStatut = findCol('a', 'statut', 'status', 'état', 'etat');

  const errors = [];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const cells = splitLine(raw);
    const get = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : '');

    const codeLibre = get(colCodeLibre);
    const codeArticle = get(colCodeArticle);
    const nomArticle = get(colNomArticle);
    const serialRaw = get(colSerial);
    const debutRaw = get(colDebut);
    const finRaw = get(colFin);
    const coutRaw = get(colCout).replace(/\s/g, '').replace(',', '.');
    const statutRaw = get(colStatut);

    // Ignore lignes vides « ;;;;;;; »
    if (!codeLibre && !codeArticle && !nomArticle && !serialRaw && !debutRaw) continue;

    const opened_at = parseFrenchDate(debutRaw);
    const closed_at = parseFrenchDate(finRaw);
    if (debutRaw && !opened_at) {
      errors.push({ line: i + 1, message: `Date « Début » illisible: "${debutRaw}"` });
    }
    if (finRaw && !closed_at) {
      errors.push({ line: i + 1, message: `Date « Fin » illisible: "${finRaw}"` });
    }

    // Décodage SN : "EMAG-XXXXX" → uid ; sinon SN brut
    let uid = null;
    let serial = null;
    const s = (serialRaw || '').trim();
    if (s) {
      const uidMatch = s.match(/^EMAG-(\d+)$/i);
      if (uidMatch) uid = `EMAG-${uidMatch[1].padStart(5, '0')}`;
      else serial = s;
    }

    // Statut déduit : si Fin présente → CLOTURE, sinon mapping texte (En cours, …)
    let status;
    if (closed_at) status = SAV_STATUS.CLOSED;
    else status = mapLocmatStatus(statutRaw);

    const cost = coutRaw && !Number.isNaN(parseFloat(coutRaw)) ? parseFloat(coutRaw) : null;

    rows.push({
      lineNumber: i + 1,
      locmat_code: codeLibre || null,
      code_article: codeArticle || null,
      nom_article: nomArticle || null,
      serial_number: serial,
      uid,
      opened_at,
      closed_at,
      cost,
      status,
      raw_status: statutRaw || null,
    });
  }

  return { rows, errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Comparateur
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cherche un équipement dans `equipmentList` à partir d'un SN ou UID.
 * Priorité : SN exact → UID exact.
 */
function findEquipment(equipmentList, { serial_number, uid }) {
  if (serial_number) {
    const s = serial_number.toUpperCase();
    const eq = equipmentList.find((e) => (e.serial_number || '').toUpperCase() === s);
    if (eq) return { equipment: eq, matchedBy: 'serial' };
  }
  if (uid) {
    const u = uid.toUpperCase();
    const eq = equipmentList.find((e) => (e.uid || '').toUpperCase() === u);
    if (eq) return { equipment: eq, matchedBy: 'uid' };
  }
  return { equipment: null, matchedBy: null };
}

/**
 * Cherche un ticket existant dans `existingTickets`.
 * Priorité : locmat_code → SN → UID.
 */
function findExistingTicket(existingTickets, row) {
  if (row.locmat_code) {
    const t = existingTickets.find((x) => x.locmat_code === row.locmat_code);
    if (t) return { ticket: t, matchedBy: 'locmat_code' };
  }
  if (row.serial_number) {
    const s = row.serial_number.toUpperCase();
    const candidates = existingTickets.filter(
      (x) => (x.serial_number || '').toUpperCase() === s && ACTIVE_STATUSES.has(x.status),
    );
    if (candidates.length === 1) return { ticket: candidates[0], matchedBy: 'serial' };
  }
  if (row.uid) {
    const u = row.uid.toUpperCase();
    const candidates = existingTickets.filter(
      (x) => (x.uid || '').toUpperCase() === u && ACTIVE_STATUSES.has(x.status),
    );
    if (candidates.length === 1) return { ticket: candidates[0], matchedBy: 'uid' };
  }
  return { ticket: null, matchedBy: null };
}

/**
 * Détecte les doublons internes au CSV : même SN/UID + opened_at dans une fenêtre ±48h.
 * Marque toutes les lignes concernées sauf la première.
 */
function detectInternalDuplicates(rows) {
  const dupIndices = new Set();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const sameId =
        (a.serial_number && a.serial_number === b.serial_number) ||
        (a.uid && a.uid === b.uid) ||
        (a.locmat_code && a.locmat_code === b.locmat_code);
      if (!sameId) continue;
      if (a.opened_at && b.opened_at) {
        const diff = Math.abs(new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
        if (diff <= 48 * 3600 * 1000) dupIndices.add(j);
      } else {
        dupIndices.add(j);
      }
    }
  }
  return dupIndices;
}

/**
 * Compare les lignes parsées avec les tickets existants en base.
 *
 * @param {Object}   params
 * @param {Array}    params.rows               Lignes normalisées (sortie de parseLocmatCsv)
 * @param {Array}    params.existingTickets    Tickets actifs OU récents (last 90 days) avec
 *                                              { id, equipment_id, locmat_code, serial_number,
 *                                                uid, status, last_modified_source,
 *                                                last_modified_at, opened_at, closed_at }
 * @param {Array}    params.equipmentList      [{ id, name, reference, serial_number, uid }]
 * @param {Date}     params.importedAt         Date du début de l'import (pour résolution collisions)
 *
 * @returns {{
 *   newTickets: Array, updatedTickets: Array, closedTickets: Array,
 *   collisions: Array, duplicates: Array, errors: Array,
 *   summary: { total, new, updated, closed, collisions, duplicates, errors }
 * }}
 */
export function comparePreview({ rows, existingTickets, equipmentList, importedAt }) {
  const result = {
    newTickets: [],
    updatedTickets: [],
    closedTickets: [],
    collisions: [],
    duplicates: [],
    errors: [],
  };

  const dupIndices = detectInternalDuplicates(rows);
  const csvLocmatCodes = new Set();
  const csvActiveSignatures = new Set(); // pour matcher closedTickets

  rows.forEach((row, idx) => {
    if (dupIndices.has(idx)) {
      result.duplicates.push({ ...row, reason: 'Doublon interne CSV (SN/UID identique ±48h)' });
      return;
    }

    const { equipment, matchedBy: equipMatch } = findEquipment(equipmentList, row);
    const enriched = {
      ...row,
      equipment_id: equipment ? equipment.id : null,
      equipment_name: equipment ? equipment.name : null,
      equipment_reference: equipment ? equipment.reference : null,
      equipment_match: equipMatch,
    };

    if (row.locmat_code) csvLocmatCodes.add(row.locmat_code);
    const sig = `${row.serial_number || ''}|${row.uid || ''}`;
    if (sig !== '|') csvActiveSignatures.add(sig);

    const { ticket: existing, matchedBy: ticketMatch } = findExistingTicket(existingTickets, row);

    if (!existing) {
      result.newTickets.push({ ...enriched, ticket_match: null });
      return;
    }

    enriched.existing_ticket_id = existing.id;
    enriched.existing_status = existing.status;
    enriched.ticket_match = ticketMatch;

    // Détection collision : modif eM@g postérieure à un précédent import
    const sourceIsEmag = (existing.last_modified_source || 'emag') === 'emag';
    const lastMod = existing.last_modified_at ? new Date(existing.last_modified_at).getTime() : 0;
    const importTs = importedAt ? new Date(importedAt).getTime() : Date.now();
    const statusDiffers = existing.status !== row.status;
    const closedAtDiffers = (existing.closed_at || null) !== (row.closed_at || null);

    if ((statusDiffers || closedAtDiffers) && sourceIsEmag && lastMod > 0 && lastMod < importTs) {
      // Modif eM@g antérieure → on peut écraser : updated
      result.updatedTickets.push(enriched);
    } else if ((statusDiffers || closedAtDiffers) && sourceIsEmag && lastMod >= importTs) {
      // Modif eM@g postérieure → COLLISION
      result.collisions.push({
        ...enriched,
        emag_status: existing.status,
        locmat_status: row.status,
        emag_last_modified_at: existing.last_modified_at,
      });
    } else if (statusDiffers || closedAtDiffers) {
      // Source LocMat ou aucune modif eM@g → simple update
      result.updatedTickets.push(enriched);
    }
    // sinon : aucun changement, on ignore silencieusement
  });

  // Tickets eM@g ACTIFS absents du CSV → propositions de clôture
  for (const t of existingTickets) {
    if (!ACTIVE_STATUSES.has(t.status)) continue;
    const presentByCode = t.locmat_code && csvLocmatCodes.has(t.locmat_code);
    const presentBySig = csvActiveSignatures.has(`${t.serial_number || ''}|${t.uid || ''}`);
    if (!presentByCode && !presentBySig) {
      result.closedTickets.push({
        ticket_id: t.id,
        equipment_id: t.equipment_id,
        locmat_code: t.locmat_code,
        serial_number: t.serial_number,
        uid: t.uid,
        current_status: t.status,
        proposed_status: SAV_STATUS.CLOSED,
        reason: 'Absent du CSV LocMat — proposition de clôture',
      });
    }
  }

  result.summary = {
    total: rows.length,
    new: result.newTickets.length,
    updated: result.updatedTickets.length,
    closed: result.closedTickets.length,
    collisions: result.collisions.length,
    duplicates: result.duplicates.length,
    errors: result.errors.length,
  };

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Application des décisions (transaction)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Applique les décisions issues du preview en transaction unique.
 *
 * @param {Object}   params
 * @param {Object}   params.db          better-sqlite3 instance
 * @param {Object}   params.preview     Sortie de comparePreview()
 * @param {Object}   params.decisions   { acceptNew:bool, acceptUpdates:bool,
 *                                        acceptClosures:bool, collisionResolutions: {ticketId: 'keep_emag'|'force_locmat'} }
 * @param {string}   params.filename
 * @param {number}   params.userId
 * @returns {{ importId:number, counts:object }}
 */
export function applyConfirm({ db, preview, decisions, filename, userId }) {
  const counts = {
    created: 0,
    updated: 0,
    closed: 0,
    collisions_resolved: 0,
    skipped: 0,
  };

  const insertImport = db.prepare(`
    INSERT INTO sav_imports (
      imported_by, filename, rows_total, rows_new, rows_updated, rows_closed,
      rows_collisions, rows_duplicates, rows_errors, summary, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTicket = db.prepare(`
    INSERT INTO sav_tickets (
      equipment_id, type, priority, status, title, description,
      locmat_code, serial_number, uid, opened_at, closed_at, cost,
      import_code, import_serial, import_name,
      last_modified_source, last_modified_at, resolved_at
    ) VALUES (?, 'panne', 'medium', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locmat', CURRENT_TIMESTAMP, ?)
  `);

  const updateTicket = db.prepare(`
    UPDATE sav_tickets
       SET status = ?, closed_at = ?, cost = COALESCE(?, cost),
           last_modified_source = 'locmat', last_modified_at = CURRENT_TIMESTAMP,
           resolved_at = CASE WHEN ? IN ('resolved','closed','sortie_sav') AND resolved_at IS NULL
                              THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `);

  const insertHistory = db.prepare(`
    INSERT INTO sav_ticket_history (ticket_id, field, old_value, new_value, source, user_id, import_id)
    VALUES (?, ?, ?, ?, 'locmat', ?, ?)
  `);

  const txn = db.transaction(() => {
    // 1. Insert import row (placeholder, on update les compteurs à la fin)
    const importInfo = insertImport.run(
      userId || null,
      filename || null,
      preview.summary.total,
      preview.summary.new,
      preview.summary.updated,
      preview.summary.closed,
      preview.summary.collisions,
      preview.summary.duplicates,
      preview.summary.errors,
      JSON.stringify(preview.summary),
      JSON.stringify({
        newTickets: preview.newTickets,
        updatedTickets: preview.updatedTickets,
        closedTickets: preview.closedTickets,
        collisions: preview.collisions,
        duplicates: preview.duplicates,
        errors: preview.errors,
      }),
    );
    const importId = Number(importInfo.lastInsertRowid);

    // 2. Création des nouveaux tickets
    if (decisions.acceptNew !== false) {
      for (const row of preview.newTickets) {
        const title = `${row.locmat_code || 'SAV'} — ${row.nom_article || row.code_article || 'Sans nom'}`;
        const desc = `Importé depuis LocMat le ${new Date().toISOString()}\nCode article: ${row.code_article || '-'}\nNom: ${row.nom_article || '-'}`;
        const info = insertTicket.run(
          row.equipment_id || null,
          row.status,
          title,
          desc,
          row.locmat_code,
          row.serial_number,
          row.uid,
          row.opened_at,
          row.closed_at,
          row.cost,
          row.code_article,
          row.serial_number || row.uid,
          row.nom_article,
          row.closed_at,
        );
        insertHistory.run(
          Number(info.lastInsertRowid),
          'created',
          null,
          row.status,
          userId || null,
          importId,
        );
        counts.created++;
      }
    } else {
      counts.skipped += preview.newTickets.length;
    }

    // 3. Mise à jour des tickets modifiés
    if (decisions.acceptUpdates !== false) {
      for (const row of preview.updatedTickets) {
        const oldStatus = row.existing_status;
        updateTicket.run(row.status, row.closed_at, row.cost, row.status, row.existing_ticket_id);
        if (oldStatus !== row.status) {
          insertHistory.run(
            row.existing_ticket_id,
            'status',
            oldStatus,
            row.status,
            userId || null,
            importId,
          );
        }
        counts.updated++;
      }
    } else {
      counts.skipped += preview.updatedTickets.length;
    }

    // 4. Clôtures automatiques
    if (decisions.acceptClosures !== false) {
      for (const row of preview.closedTickets) {
        updateTicket.run(
          SAV_STATUS.CLOSED,
          new Date().toISOString(),
          null,
          SAV_STATUS.CLOSED,
          row.ticket_id,
        );
        insertHistory.run(
          row.ticket_id,
          'status',
          row.current_status,
          SAV_STATUS.CLOSED,
          userId || null,
          importId,
        );
        counts.closed++;
      }
    } else {
      counts.skipped += preview.closedTickets.length;
    }

    // 5. Résolution des collisions
    const resolutions = decisions.collisionResolutions || {};
    for (const row of preview.collisions) {
      const resolution = resolutions[row.existing_ticket_id];
      if (resolution === 'force_locmat') {
        updateTicket.run(row.status, row.closed_at, row.cost, row.status, row.existing_ticket_id);
        insertHistory.run(
          row.existing_ticket_id,
          'status_collision_resolved',
          row.emag_status,
          row.status,
          userId || null,
          importId,
        );
        counts.collisions_resolved++;
      } else {
        // 'keep_emag' ou non résolu : on ignore mais on trace
        insertHistory.run(
          row.existing_ticket_id,
          'status_collision_ignored',
          row.emag_status,
          row.locmat_status,
          userId || null,
          importId,
        );
        counts.skipped++;
      }
    }

    return importId;
  });

  try {
    const importId = txn();
    return { importId, counts };
  } catch (e) {
    logger.error('SAV applyConfirm transaction error:', e);
    throw e;
  }
}
