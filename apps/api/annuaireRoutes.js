import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { annuaireRefCache, cacheMiddleware, invalidateOnSuccess } from './cache.js';
import db, { addToHistory } from './database.js';
import logger from './logger.js';
import {
  clientSchema,
  contactSchema,
  contactsImportSchema,
  supplierSchema,
  validate,
} from './schemas/imports.js';
import { numericIdSchema } from './schemas/paramsSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// Helpers : validation, normalisation
// ═══════════════════════════════════════════════════════════════

/** Normalise un numéro de téléphone français (supprime espaces/points/tirets, ajoute 0 initial) */
function normalizePhone(phone) {
  if (!phone) return phone;
  let cleaned = phone.replace(/[\s.\-()]/g, '');
  // Si 9 chiffres sans le 0 initial (ex: 612345678)
  if (/^\d{9}$/.test(cleaned)) cleaned = '0' + cleaned;
  // Si format international +33
  if (/^\+33\d{9}$/.test(cleaned)) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

/** Valide un numéro SIRET (14 chiffres, algorithme de Luhn) */
function validateSiret(siret) {
  if (!siret) return { valid: true };
  const cleaned = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned))
    return { valid: false, error: 'Le SIRET doit contenir 14 chiffres' };
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'SIRET invalide (clé de contrôle incorrecte)' };
  return { valid: true, cleaned };
}

/** Valide un numéro TVA intracommunautaire français */
function validateTvaIntra(tva) {
  if (!tva) return { valid: true };
  const cleaned = tva.replace(/\s/g, '').toUpperCase();
  if (!/^FR\d{11}$/.test(cleaned))
    return {
      valid: false,
      error: 'TVA intra. doit être au format FRXXXXXXXXXXX (FR + 11 chiffres)',
    };
  return { valid: true, cleaned };
}

/** Applique la normalisation téléphone + validation SIRET/TVA sur un body entité */
function sanitizeEntityBody(body) {
  const errors = [];
  if (body.phone) body.phone = normalizePhone(body.phone);
  if (body.phone2) body.phone2 = normalizePhone(body.phone2);
  if (body.siret) {
    const v = validateSiret(body.siret);
    if (!v.valid) errors.push(v.error);
    else if (v.cleaned) body.siret = v.cleaned;
  }
  if (body.tva_intra) {
    const v = validateTvaIntra(body.tva_intra);
    if (!v.valid) errors.push(v.error);
    else if (v.cleaned) body.tva_intra = v.cleaned;
  }
  return errors;
}

// ═══════════════════════════════════════════════════════════════
// Helper : pagination + recherche générique
// ═══════════════════════════════════════════════════════════════
function buildSearchQuery(baseTable, searchFields, req) {
  const { search, page = 1, limit = 50, sort = 'name', order = 'ASC', ...filters } = req.query;
  const params = [];
  const conditions = [];

  if (search) {
    const searchConditions = searchFields.map((f) => `${f} LIKE ?`);
    conditions.push(`(${searchConditions.join(' OR ')})`);
    searchFields.forEach(() => params.push(`%${search}%`));
  }

  // Generic filters — whitelist pour éviter l'injection SQL via les clés de query
  const allowedFilters = [
    'type',
    'activity_sector',
    'is_active',
    'client_id',
    'supplier_id',
    'prestataire_id',
    'legal_structure',
    'country',
  ];
  for (const [key, value] of Object.entries(filters)) {
    if (allowedFilters.includes(key) && value !== undefined && value !== '') {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const allowedSorts = [
    'name',
    'code_libre',
    'city',
    'created_at',
    'modified_at',
    'postal_code',
    'last_name',
  ];
  const sortCol = allowedSorts.includes(sort) ? sort : 'name';
  const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  return { where, params, sortCol, sortOrder, limit: parseInt(limit), offset };
}

const ENTITY_TABLE_BY_TYPE = {
  client: 'clients',
  supplier: 'suppliers',
  prestataire: 'prestataires',
};

function normalizeEntityName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(st|ste)\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeEntityLink(aType, aId, bType, bId) {
  const a = { type: aType, id: Number(aId) };
  const b = { type: bType, id: Number(bId) };
  if (a.type < b.type || (a.type === b.type && a.id < b.id)) return [a, b];
  return [b, a];
}

function extractEmailParts(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  const at = e.indexOf('@');
  if (at <= 0 || at >= e.length - 1) return null;
  return {
    local: e.slice(0, at).replace(/[^a-z0-9]/g, ''),
    domain: e.slice(at + 1).replace(/^www\./, ''),
  };
}

function extractDomain(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw.includes('@')) return raw.split('@')[1]?.replace(/^www\./, '') || null;
  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function syncPrimaryContactEntityLinks(
  contactId,
  { client_id, supplier_id, prestataire_id },
  userId,
) {
  const rows = [
    ['client', client_id || null],
    ['supplier', supplier_id || null],
    ['prestataire', prestataire_id || null],
  ];

  for (const [entityType, entityId] of rows) {
    // Remplacer le lien "primaire" de ce type par la valeur courante (sans toucher les liens auto).
    db.prepare(
      `DELETE FROM annuaire_contact_entity_links
       WHERE contact_id = ? AND entity_type = ? AND source IN ('legacy_column', 'manual_primary')`,
    ).run(contactId, entityType);

    if (!entityId) continue;
    db.prepare(
      `INSERT OR IGNORE INTO annuaire_contact_entity_links
       (contact_id, entity_type, entity_id, confidence, source, created_by, modified_by)
       VALUES (?, ?, ?, 1.0, 'manual_primary', ?, ?)`,
    ).run(contactId, entityType, entityId, userId || null, userId || null);
  }
}

// ═══════════════════════════════════════════════════════════════
// CLIENTS (enrichi)
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireClientsRoutes(app, authenticateToken, requireAdmin) {
  // GET /api/annuaire/clients — Liste paginée avec recherche
  app.get('/api/annuaire/clients', authenticateToken, (req, res) => {
    try {
      const searchFields = ['name', 'code_libre', 'email', 'phone', 'city', 'postal_code', 'siret'];
      const { where, params, sortCol, sortOrder, limit, offset } = buildSearchQuery(
        'clients',
        searchFields,
        req,
      );

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM clients${where}`).get(...params);
      const rows = db
        .prepare(
          `SELECT c.*, 
          (SELECT COUNT(*) FROM annuaire_contacts WHERE client_id = c.id) as contact_count
         FROM clients c${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);

      res.json({ data: rows, total: countRow.total, page: Math.floor(offset / limit) + 1, limit });
    } catch (error) {
      logger.error('Annuaire clients GET:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /api/annuaire/clients/:id — Détail
  app.get('/api/annuaire/clients/:id', authenticateToken, (req, res) => {
    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!client) return res.status(404).json({ success: false, error: 'Client non trouvé' });
      client.contacts = db
        .prepare(
          'SELECT * FROM annuaire_contacts WHERE client_id = ? ORDER BY is_primary DESC, last_name ASC',
        )
        .all(req.params.id);
      res.json(client);
    } catch (error) {
      logger.error('Annuaire client detail:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/annuaire/clients — Créer
  app.post('/api/annuaire/clients', authenticateToken, validate(clientSchema), (req, res) => {
    try {
      const {
        name,
        code_libre,
        email,
        address,
        postal_code,
        city,
        country,
        type,
        legal_structure,
        website,
        activity_sector,
        service_types,
        notes,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      // Validation et normalisation
      const validationErrors = sanitizeEntityBody(req.body);
      if (validationErrors.length > 0)
        return res.status(400).json({ success: false, error: validationErrors.join('. ') });

      const result = db
        .prepare(
          `
        INSERT INTO clients (name, code_libre, email, phone, phone2, address, postal_code, city, country,
          type, legal_structure, siret, tva_intra, website, activity_sector, service_types, notes, 
          location_id, is_active, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
        )
        .run(
          name,
          code_libre || null,
          email || null,
          req.body.phone || null,
          req.body.phone2 || null,
          address || null,
          postal_code || null,
          city || null,
          country || 'France',
          type || 'client',
          legal_structure || null,
          req.body.siret || null,
          req.body.tva_intra || null,
          website || null,
          activity_sector || null,
          service_types ? JSON.stringify(service_types) : null,
          notes || null,
          req.body.location_id || null,
          req.user.id,
          req.user.id,
        );

      addToHistory(
        'client',
        result.lastInsertRowid,
        'created',
        req.body,
        req.user.id,
        req.user.name,
      );
      const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(created);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed: clients.code_libre')) {
        return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
      }
      logger.error('Annuaire client create:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /api/annuaire/clients/:id — Modifier
  app.put(
    '/api/annuaire/clients/:id',
    authenticateToken,
    validate(numericIdSchema),
    validate(clientSchema),
    (req, res) => {
      try {
        // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
        const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Client non trouvé' });

        const {
          name,
          code_libre,
          email,
          address,
          postal_code,
          city,
          country,
          type,
          legal_structure,
          website,
          activity_sector,
          service_types,
          notes,
          is_active,
        } = req.body;

        // Validation et normalisation
        const validationErrors = sanitizeEntityBody(req.body);
        if (validationErrors.length > 0)
          return res.status(400).json({ success: false, error: validationErrors.join('. ') });

        db.prepare(
          `
        UPDATE clients SET name = ?, code_libre = ?, email = ?, phone = ?, phone2 = ?,
          address = ?, postal_code = ?, city = ?, country = ?,
          type = ?, legal_structure = ?, siret = ?, tva_intra = ?, website = ?,
          activity_sector = ?, service_types = ?, notes = ?, location_id = ?, is_active = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        ).run(
          name,
          code_libre || null,
          email || null,
          req.body.phone || null,
          req.body.phone2 || null,
          address || null,
          postal_code || null,
          city || null,
          country || 'France',
          type || 'client',
          legal_structure || null,
          req.body.siret || null,
          req.body.tva_intra || null,
          website || null,
          activity_sector || null,
          service_types ? JSON.stringify(service_types) : null,
          notes || null,
          req.body.location_id || null,
          is_active !== undefined ? is_active : 1,
          req.user.id,
          req.params.id,
        );

        addToHistory('client', req.params.id, 'updated', req.body, req.user.id, req.user.name);
        const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
        res.json(updated);
      } catch (error) {
        if (error.message?.includes('UNIQUE constraint failed: clients.code_libre')) {
          return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
        }
        logger.error('Annuaire client update:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // DELETE /api/annuaire/clients/:id
  app.delete(
    '/api/annuaire/clients/:id',
    authenticateToken,
    requireAdmin,
    validate(numericIdSchema),
    (req, res) => {
      try {
        // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
        const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Client non trouvé' });

        // Check for linked contacts
        const contactCount = db
          .prepare('SELECT COUNT(*) as c FROM annuaire_contacts WHERE client_id = ?')
          .get(req.params.id);
        if (contactCount.c > 0) {
          // Soft delete
          db.prepare(
            'UPDATE clients SET is_active = 0, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?',
          ).run(req.user.id, req.params.id);
        } else {
          db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
        }
        addToHistory('client', req.params.id, 'deleted', null, req.user.id, req.user.name);
        res.json({ success: true });
      } catch (error) {
        logger.error('Annuaire client delete:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// FOURNISSEURS (enrichi)
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireSuppliersRoutes(app, authenticateToken, requireAdmin) {
  app.get('/api/annuaire/suppliers', authenticateToken, (req, res) => {
    try {
      const searchFields = [
        'name',
        'code_libre',
        'contact_name',
        'email',
        'phone',
        'city',
        'postal_code',
      ];
      const { where, params, sortCol, sortOrder, limit, offset } = buildSearchQuery(
        'suppliers',
        searchFields,
        req,
      );

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM suppliers${where}`).get(...params);
      const rows = db
        .prepare(
          `SELECT s.*,
          (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id) as order_count,
          (SELECT COUNT(*) FROM annuaire_contacts WHERE supplier_id = s.id) as contact_count
         FROM suppliers s${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);

      res.json({ data: rows, total: countRow.total, page: Math.floor(offset / limit) + 1, limit });
    } catch (error) {
      logger.error('Annuaire suppliers GET:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.get('/api/annuaire/suppliers/:id', authenticateToken, (req, res) => {
    try {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
      if (!supplier)
        return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
      supplier.contacts = db
        .prepare(
          'SELECT * FROM annuaire_contacts WHERE supplier_id = ? ORDER BY is_primary DESC, last_name ASC',
        )
        .all(req.params.id);
      supplier.orders = db
        .prepare(
          'SELECT id, reference, status, order_date, total_ttc FROM orders WHERE supplier_id = ? ORDER BY order_date DESC LIMIT 10',
        )
        .all(req.params.id);
      res.json(supplier);
    } catch (error) {
      logger.error('Annuaire supplier detail:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.post('/api/annuaire/suppliers', authenticateToken, validate(supplierSchema), (req, res) => {
    try {
      const {
        name,
        code_libre,
        contact_name,
        email,
        address,
        postal_code,
        city,
        country,
        type,
        legal_structure,
        website,
        activity_sector,
        service_types,
        notes,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      // Validation et normalisation
      const validationErrors = sanitizeEntityBody(req.body);
      if (validationErrors.length > 0)
        return res.status(400).json({ success: false, error: validationErrors.join('. ') });

      const result = db
        .prepare(
          `
        INSERT INTO suppliers (name, code_libre, contact_name, email, phone, phone2, address, postal_code, city, country,
          type, legal_structure, siret, tva_intra, website, activity_sector, service_types, notes,
          location_id, is_active, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
        )
        .run(
          name,
          code_libre || null,
          contact_name || null,
          email || null,
          req.body.phone || null,
          req.body.phone2 || null,
          address || null,
          postal_code || null,
          city || null,
          country || 'France',
          type || 'fournisseur',
          legal_structure || null,
          req.body.siret || null,
          req.body.tva_intra || null,
          website || null,
          activity_sector || null,
          service_types ? JSON.stringify(service_types) : null,
          notes || null,
          req.body.location_id || null,
          req.user.id,
          req.user.id,
        );

      addToHistory(
        'supplier',
        result.lastInsertRowid,
        'created',
        req.body,
        req.user.id,
        req.user.name,
      );
      const created = db
        .prepare('SELECT * FROM suppliers WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(created);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed: suppliers.code_libre')) {
        return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
      }
      logger.error('Annuaire supplier create:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.put(
    '/api/annuaire/suppliers/:id',
    authenticateToken,
    validate(numericIdSchema),
    validate(supplierSchema),
    (req, res) => {
      try {
        // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
        const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });

        const {
          name,
          code_libre,
          contact_name,
          email,
          address,
          postal_code,
          city,
          country,
          type,
          legal_structure,
          website,
          activity_sector,
          service_types,
          notes,
          is_active,
        } = req.body;

        // Validation et normalisation
        const validationErrors = sanitizeEntityBody(req.body);
        if (validationErrors.length > 0)
          return res.status(400).json({ success: false, error: validationErrors.join('. ') });

        db.prepare(
          `
        UPDATE suppliers SET name = ?, code_libre = ?, contact_name = ?, email = ?, phone = ?, phone2 = ?,
          address = ?, postal_code = ?, city = ?, country = ?,
          type = ?, legal_structure = ?, siret = ?, tva_intra = ?, website = ?,
          activity_sector = ?, service_types = ?, notes = ?, location_id = ?, is_active = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        ).run(
          name,
          code_libre || null,
          contact_name || null,
          email || null,
          req.body.phone || null,
          req.body.phone2 || null,
          address || null,
          postal_code || null,
          city || null,
          country || 'France',
          type || 'fournisseur',
          legal_structure || null,
          req.body.siret || null,
          req.body.tva_intra || null,
          website || null,
          activity_sector || null,
          service_types ? JSON.stringify(service_types) : null,
          notes || null,
          req.body.location_id || null,
          is_active !== undefined ? is_active : 1,
          req.user.id,
          req.params.id,
        );

        addToHistory('supplier', req.params.id, 'updated', req.body, req.user.id, req.user.name);
        const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        res.json(updated);
      } catch (error) {
        if (error.message?.includes('UNIQUE constraint failed: suppliers.code_libre')) {
          return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
        }
        logger.error('Annuaire supplier update:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  app.delete(
    '/api/annuaire/suppliers/:id',
    authenticateToken,
    requireAdmin,
    validate(numericIdSchema),
    (req, res) => {
      try {
        // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
        const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });

        const orderCount = db
          .prepare('SELECT COUNT(*) as c FROM orders WHERE supplier_id = ?')
          .get(req.params.id);
        const contactCount = db
          .prepare('SELECT COUNT(*) as c FROM annuaire_contacts WHERE supplier_id = ?')
          .get(req.params.id);
        if (orderCount.c > 0 || contactCount.c > 0) {
          db.prepare(
            'UPDATE suppliers SET is_active = 0, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?',
          ).run(req.user.id, req.params.id);
        } else {
          db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
        }
        addToHistory('supplier', req.params.id, 'deleted', null, req.user.id, req.user.name);
        res.json({ success: true });
      } catch (error) {
        logger.error('Annuaire supplier delete:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// PRESTATAIRES
// ═══════════════════════════════════════════════════════════════
export function setupAnnuairePrestatairesRoutes(app, authenticateToken, requireAdmin) {
  app.get('/api/annuaire/prestataires', authenticateToken, (req, res) => {
    try {
      const searchFields = [
        'name',
        'code_libre',
        'email',
        'phone',
        'city',
        'postal_code',
        'activity_sector',
      ];
      const { where, params, sortCol, sortOrder, limit, offset } = buildSearchQuery(
        'prestataires',
        searchFields,
        req,
      );

      const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM prestataires${where}`)
        .get(...params);
      const rows = db
        .prepare(
          `SELECT p.*,
          (SELECT COUNT(*) FROM annuaire_contacts WHERE prestataire_id = p.id) as contact_count
         FROM prestataires p${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);

      res.json({ data: rows, total: countRow.total, page: Math.floor(offset / limit) + 1, limit });
    } catch (error) {
      logger.error('Annuaire prestataires GET:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.get('/api/annuaire/prestataires/:id', authenticateToken, (req, res) => {
    try {
      const p = db.prepare('SELECT * FROM prestataires WHERE id = ?').get(req.params.id);
      if (!p) return res.status(404).json({ success: false, error: 'Prestataire non trouvé' });
      p.contacts = db
        .prepare(
          'SELECT * FROM annuaire_contacts WHERE prestataire_id = ? ORDER BY is_primary DESC, last_name ASC',
        )
        .all(req.params.id);
      res.json(p);
    } catch (error) {
      logger.error('Annuaire prestataire detail:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.post('/api/annuaire/prestataires', authenticateToken, (req, res) => {
    try {
      const {
        name,
        code_libre,
        email,
        address,
        postal_code,
        city,
        country,
        legal_structure,
        website,
        activity_sector,
        service_types,
        notes,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      // Validation et normalisation
      const validationErrors = sanitizeEntityBody(req.body);
      if (validationErrors.length > 0)
        return res.status(400).json({ success: false, error: validationErrors.join('. ') });

      const result = db
        .prepare(
          `
        INSERT INTO prestataires (name, code_libre, email, phone, phone2, address, postal_code, city, country,
          legal_structure, siret, tva_intra, website, activity_sector, service_types, notes,
          location_id, is_active, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
        )
        .run(
          name,
          code_libre || null,
          email || null,
          req.body.phone || null,
          req.body.phone2 || null,
          address || null,
          postal_code || null,
          city || null,
          country || 'France',
          legal_structure || null,
          req.body.siret || null,
          req.body.tva_intra || null,
          website || null,
          activity_sector || null,
          service_types ? JSON.stringify(service_types) : null,
          notes || null,
          req.body.location_id || null,
          req.user.id,
          req.user.id,
        );

      addToHistory(
        'prestataire',
        result.lastInsertRowid,
        'created',
        req.body,
        req.user.id,
        req.user.name,
      );
      const created = db
        .prepare('SELECT * FROM prestataires WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(created);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed: prestataires.code_libre')) {
        return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
      }
      logger.error('Annuaire prestataire create:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.put('/api/annuaire/prestataires/:id', authenticateToken, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const existing = db.prepare('SELECT id FROM prestataires WHERE id = ?').get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Prestataire non trouvé' });

      const {
        name,
        code_libre,
        email,
        address,
        postal_code,
        city,
        country,
        legal_structure,
        website,
        activity_sector,
        service_types,
        notes,
        is_active,
      } = req.body;

      // Validation et normalisation
      const validationErrors = sanitizeEntityBody(req.body);
      if (validationErrors.length > 0)
        return res.status(400).json({ success: false, error: validationErrors.join('. ') });

      db.prepare(
        `
        UPDATE prestataires SET name = ?, code_libre = ?, email = ?, phone = ?, phone2 = ?,
          address = ?, postal_code = ?, city = ?, country = ?,
          legal_structure = ?, siret = ?, tva_intra = ?, website = ?,
          activity_sector = ?, service_types = ?, notes = ?, location_id = ?, is_active = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(
        name,
        code_libre || null,
        email || null,
        req.body.phone || null,
        req.body.phone2 || null,
        address || null,
        postal_code || null,
        city || null,
        country || 'France',
        legal_structure || null,
        req.body.siret || null,
        req.body.tva_intra || null,
        website || null,
        activity_sector || null,
        service_types ? JSON.stringify(service_types) : null,
        notes || null,
        req.body.location_id || null,
        is_active !== undefined ? is_active : 1,
        req.user.id,
        req.params.id,
      );

      addToHistory('prestataire', req.params.id, 'updated', req.body, req.user.id, req.user.name);
      const updated = db.prepare('SELECT * FROM prestataires WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed: prestataires.code_libre')) {
        return res.status(409).json({ success: false, error: 'Ce code libre existe déjà' });
      }
      logger.error('Annuaire prestataire update:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.delete('/api/annuaire/prestataires/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const existing = db.prepare('SELECT id FROM prestataires WHERE id = ?').get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Prestataire non trouvé' });

      const contactCount = db
        .prepare('SELECT COUNT(*) as c FROM annuaire_contacts WHERE prestataire_id = ?')
        .get(req.params.id);
      if (contactCount.c > 0) {
        db.prepare(
          'UPDATE prestataires SET is_active = 0, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(req.user.id, req.params.id);
      } else {
        db.prepare('DELETE FROM prestataires WHERE id = ?').run(req.params.id);
      }
      addToHistory('prestataire', req.params.id, 'deleted', null, req.user.id, req.user.name);
      res.json({ success: true });
    } catch (error) {
      logger.error('Annuaire prestataire delete:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireContactsRoutes(app, authenticateToken, requireAdmin) {
  app.get('/api/annuaire/contacts', authenticateToken, (req, res) => {
    try {
      const { search, client_id, supplier_id, prestataire_id, page = 1, limit = 50 } = req.query;
      const conditions = [];
      const params = [];

      if (search) {
        conditions.push(
          '(c.last_name LIKE ? OR c.first_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.job_title LIKE ?)',
        );
        for (let i = 0; i < 5; i++) params.push(`%${search}%`);
      }
      if (client_id) {
        conditions.push('c.client_id = ?');
        params.push(client_id);
      }
      if (supplier_id) {
        conditions.push('c.supplier_id = ?');
        params.push(supplier_id);
      }
      if (prestataire_id) {
        conditions.push('c.prestataire_id = ?');
        params.push(prestataire_id);
      }

      const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
      const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

      const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM annuaire_contacts c${where}`)
        .get(...params);
      const rows = db
        .prepare(
          `
        SELECT c.*,
          COALESCE(cl.name, '') as client_name,
          COALESCE(s.name, '') as supplier_name,
          COALESCE(p.name, '') as prestataire_name
        FROM annuaire_contacts c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN suppliers s ON c.supplier_id = s.id
        LEFT JOIN prestataires p ON c.prestataire_id = p.id
        ${where}
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT ? OFFSET ?
      `,
        )
        .all(...params, parseInt(limit), offset);

      res.json({
        data: rows,
        total: countRow.total,
        page: Math.floor(offset / parseInt(limit)) + 1,
        limit: parseInt(limit),
      });
    } catch (error) {
      logger.error('Annuaire contacts GET:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.post('/api/annuaire/contacts', authenticateToken, validate(contactSchema), (req, res) => {
    try {
      const {
        client_id,
        supplier_id,
        prestataire_id,
        first_name,
        last_name,
        job_title,
        category,
        email,
        phone,
        phone2,
        is_primary,
        notes,
      } = req.body;
      if (!last_name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      const result = db
        .prepare(
          `
        INSERT INTO annuaire_contacts (client_id, supplier_id, prestataire_id, first_name, last_name,
          job_title, category, email, phone, phone2, is_primary, notes, is_active, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
        )
        .run(
          client_id || null,
          supplier_id || null,
          prestataire_id || null,
          first_name || null,
          last_name,
          job_title || null,
          category || null,
          email || null,
          phone || null,
          phone2 || null,
          is_primary ? 1 : 0,
          notes || null,
          req.user.id,
          req.user.id,
        );

      const created = db
        .prepare('SELECT * FROM annuaire_contacts WHERE id = ?')
        .get(result.lastInsertRowid);

      syncPrimaryContactEntityLinks(
        result.lastInsertRowid,
        {
          client_id: client_id || null,
          supplier_id: supplier_id || null,
          prestataire_id: prestataire_id || null,
        },
        req.user.id,
      );

      res.status(201).json(created);
    } catch (error) {
      logger.error('Annuaire contact create:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.put('/api/annuaire/contacts/:id', authenticateToken, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const existing = db
        .prepare('SELECT id FROM annuaire_contacts WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Contact non trouvé' });

      const {
        client_id,
        supplier_id,
        prestataire_id,
        first_name,
        last_name,
        job_title,
        category,
        email,
        phone,
        phone2,
        is_primary,
        notes,
        is_active,
      } = req.body;

      db.prepare(
        `
        UPDATE annuaire_contacts SET client_id = ?, supplier_id = ?, prestataire_id = ?,
          first_name = ?, last_name = ?, job_title = ?, category = ?,
          email = ?, phone = ?, phone2 = ?, is_primary = ?, notes = ?, is_active = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(
        client_id || null,
        supplier_id || null,
        prestataire_id || null,
        first_name || null,
        last_name,
        job_title || null,
        category || null,
        email || null,
        phone || null,
        phone2 || null,
        is_primary ? 1 : 0,
        notes || null,
        is_active !== undefined ? is_active : 1,
        req.user.id,
        req.params.id,
      );

      syncPrimaryContactEntityLinks(
        Number(req.params.id),
        {
          client_id: client_id || null,
          supplier_id: supplier_id || null,
          prestataire_id: prestataire_id || null,
        },
        req.user.id,
      );

      const updated = db.prepare('SELECT * FROM annuaire_contacts WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('Annuaire contact update:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  app.delete(
    '/api/annuaire/contacts/:id',
    authenticateToken,
    requireAdmin,
    validate(numericIdSchema),
    (req, res) => {
      try {
        // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
        const result = db.prepare('DELETE FROM annuaire_contacts WHERE id = ?').run(req.params.id);
        if (result.changes === 0)
          return res.status(404).json({ success: false, error: 'Contact non trouvé' });
        res.json({ success: true });
      } catch (error) {
        logger.error('Annuaire contact delete:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// LOOKUP TABLES (Référentiels)
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireLookupsRoutes(app, authenticateToken, requireAdmin) {
  // S1-06 — Whitelist défensive figée. Toute interpolation `${table}` dans
  // ce module DOIT provenir de cette map. Object.freeze garantit qu'on ne
  // peut pas étendre la liste à l'exécution (protection régression future).
  const lookupTables = Object.freeze({
    'legal-structures': 'annuaire_legal_structures',
    'service-types': 'annuaire_service_types',
    'activity-sectors': 'annuaire_activity_sectors',
    'contact-categories': 'annuaire_contact_categories',
  });
  const ALLOWED_REF_TABLES = Object.freeze(new Set(Object.values(lookupTables)));
  // Garde-fou : appelé avant chaque prepare(`... ${table} ...`)
  function assertRefTable(t) {
    if (!ALLOWED_REF_TABLES.has(t)) {
      throw new Error(`Annuaire: table non autoris\u00e9e: ${t}`);
    }
  }

  // GET all items from a lookup table
  for (const [slug, table] of Object.entries(lookupTables)) {
    app.get(`/api/annuaire/ref/${slug}`, authenticateToken, (req, res) => {
      try {
        assertRefTable(table);
        const { active_only } = req.query;
        let query = `SELECT * FROM ${table}`;
        if (active_only === '1' || active_only === 'true') query += ' WHERE is_active = 1';
        query += ' ORDER BY sort_order ASC, name ASC';
        res.json(db.prepare(query).all());
      } catch (error) {
        logger.error(`Annuaire ref ${slug}:`, error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    });

    // POST — add item
    app.post(
      `/api/annuaire/ref/${slug}`,
      authenticateToken,
      requireAdmin,
      invalidateOnSuccess(annuaireRefCache),
      (req, res) => {
        try {
          assertRefTable(table);
          const { code, name, sort_order } = req.body;
          if (!code || !name)
            return res.status(400).json({ success: false, error: 'Code et nom requis' });
          const result = db
            .prepare(`INSERT INTO ${table} (code, name, sort_order) VALUES (?, ?, ?)`)
            .run(code, name, sort_order || 0);
          res
            .status(201)
            .json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid));
        } catch (error) {
          if (error.message?.includes('UNIQUE constraint'))
            return res.status(409).json({ success: false, error: 'Ce code existe déjà' });
          logger.error(`Annuaire ref ${slug} create:`, error);
          res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      },
    );

    // PUT — update item
    app.put(
      `/api/annuaire/ref/${slug}/:id`,
      authenticateToken,
      requireAdmin,
      invalidateOnSuccess(annuaireRefCache),
      (req, res) => {
        try {
          assertRefTable(table);
          const { code, name, sort_order, is_active } = req.body;
          db.prepare(
            `UPDATE ${table} SET code = ?, name = ?, sort_order = ?, is_active = ? WHERE id = ?`,
          ).run(
            code,
            name,
            sort_order || 0,
            is_active !== undefined ? is_active : 1,
            req.params.id,
          );
          res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id));
        } catch (error) {
          logger.error(`Annuaire ref ${slug} update:`, error);
          res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      },
    );

    // DELETE
    app.delete(
      `/api/annuaire/ref/${slug}/:id`,
      authenticateToken,
      requireAdmin,
      invalidateOnSuccess(annuaireRefCache),
      (req, res) => {
        try {
          assertRefTable(table);
          db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
          res.json({ success: true });
        } catch (error) {
          logger.error(`Annuaire ref ${slug} delete:`, error);
          res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      },
    );
  }

  // GET all lookups at once (for form dropdowns)
  // [S2-3] Cache 10 min — invalidé sur mutations ref/*
  app.get(
    '/api/annuaire/ref/all',
    authenticateToken,
    cacheMiddleware(annuaireRefCache, () => 'all'),
    (req, res) => {
      try {
        const result = {};
        for (const [slug, table] of Object.entries(lookupTables)) {
          assertRefTable(table);
          result[slug.replace(/-/g, '_')] = db
            .prepare(`SELECT * FROM ${table} WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`)
            .all();
        }
        res.json(result);
      } catch (error) {
        logger.error('Annuaire ref all:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// RECHERCHE GLOBALE ANNUAIRE
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireSearchRoutes(app, authenticateToken) {
  app.get('/api/annuaire/search', authenticateToken, (req, res) => {
    try {
      const { q, limit = 20 } = req.query;
      if (!q || q.length < 2)
        return res.json({ clients: [], suppliers: [], prestataires: [], contacts: [] });

      const pattern = `%${q}%`;
      const lim = Math.min(parseInt(limit), 50);

      const clients = db
        .prepare(
          `SELECT id, name, code_libre, phone, email, city, 'client' as entity_type FROM clients
         WHERE name LIKE ? OR code_libre LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(pattern, pattern, pattern, pattern, pattern, lim);

      const suppliers = db
        .prepare(
          `SELECT id, name, code_libre, phone, email, city, 'supplier' as entity_type FROM suppliers
         WHERE name LIKE ? OR code_libre LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(pattern, pattern, pattern, pattern, pattern, lim);

      const prestataires = db
        .prepare(
          `SELECT id, name, code_libre, phone, email, city, 'prestataire' as entity_type FROM prestataires
         WHERE name LIKE ? OR code_libre LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(pattern, pattern, pattern, pattern, pattern, lim);

      const contacts = db
        .prepare(
          `SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.job_title,
           COALESCE(cl.name, s.name, p.name, '') as entity_name,
           CASE WHEN c.client_id IS NOT NULL THEN 'client'
                WHEN c.supplier_id IS NOT NULL THEN 'supplier'
                ELSE 'prestataire' END as parent_type,
           'contact' as entity_type
         FROM annuaire_contacts c
         LEFT JOIN clients cl ON c.client_id = cl.id
         LEFT JOIN suppliers s ON c.supplier_id = s.id
         LEFT JOIN prestataires p ON c.prestataire_id = p.id
         WHERE c.last_name LIKE ? OR c.first_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
         ORDER BY c.last_name LIMIT ?`,
        )
        .all(pattern, pattern, pattern, pattern, lim);

      res.json({ clients, suppliers, prestataires, contacts });
    } catch (error) {
      logger.error('Annuaire search:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// IMPORT CSV
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireImportRoutes(app, authenticateToken, requireAdmin) {
  // POST /api/annuaire/import/clients-csv — Import Clients Locmat
  app.post('/api/annuaire/import/clients-csv', authenticateToken, requireAdmin, (req, res) => {
    try {
      const csvPath = path.join(__dirname, '..', '..', 'public', 'imports', 'Clients Locmat.csv');
      if (!fs.existsSync(csvPath))
        return res.status(404).json({ success: false, error: 'Fichier CSV introuvable' });

      const raw = fs.readFileSync(csvPath, 'utf-8');
      const lines = raw.split(/\r?\n/).filter((l) => l.trim());
      // Skip line 0 (title "liste Clients Mag") and line 1 (header)
      const dataLines = lines.slice(2);

      let imported = 0,
        skipped = 0,
        errors = 0;
      const insertOrUpdate = db.prepare(`
        INSERT INTO clients (code_libre, name, postal_code, city, phone, notes, is_active, type)
        VALUES (?, ?, ?, ?, ?, ?, 1, 'client')
        ON CONFLICT(code_libre) DO UPDATE SET
          name = excluded.name,
          postal_code = excluded.postal_code,
          city = excluded.city,
          phone = COALESCE(excluded.phone, clients.phone),
          notes = COALESCE(excluded.notes, clients.notes)
      `);

      const importTransaction = db.transaction(() => {
        for (const line of dataLines) {
          try {
            const parts = line.split(';').map((p) => p.trim());
            const [codeFree, name, cp, ville, tel, commentaire] = parts;
            if (!codeFree || !name) {
              skipped++;
              continue;
            }

            // Normaliser téléphone
            let phone = (tel || '').replace(/[^0-9+]/g, '');
            if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
            if (phone.length < 9) phone = null;

            insertOrUpdate.run(
              codeFree,
              name,
              cp || null,
              ville || null,
              phone,
              commentaire || null,
            );
            imported++;
          } catch (_e) {
            errors++;
          }
        }
      });

      importTransaction();
      logger.info(
        `Import clients CSV: ${imported} importés, ${skipped} ignorés, ${errors} erreurs`,
      );
      res.json({ success: true, imported, skipped, errors, total: dataLines.length });
    } catch (error) {
      logger.error('Import clients CSV:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/annuaire/import/suppliers-csv — Import Fournisseurs Locmat (format cassé)
  app.post('/api/annuaire/import/suppliers-csv', authenticateToken, requireAdmin, (req, res) => {
    try {
      const csvPath = path.join(
        __dirname,
        '..',
        '..',
        'public',
        'imports',
        'Fournisseurs Locmat.csv',
      );
      if (!fs.existsSync(csvPath))
        return res.status(404).json({ success: false, error: 'Fichier CSV introuvable' });

      const raw = fs.readFileSync(csvPath, 'utf-8');
      const lines = raw
        .replace(/\r/g, '')
        .split('\n')
        .filter((l) => l.trim());
      // Skip header line
      const dataLines = lines.slice(1);

      let imported = 0,
        skipped = 0,
        errors = 0;

      const insertOrUpdate = db.prepare(`
        INSERT INTO suppliers (code_libre, name, postal_code, city, phone, is_active, type)
        VALUES (?, ?, ?, ?, ?, 1, 'fournisseur')
        ON CONFLICT(code_libre) DO UPDATE SET
          name = excluded.name,
          postal_code = COALESCE(excluded.postal_code, suppliers.postal_code),
          city = COALESCE(excluded.city, suppliers.city),
          phone = COALESCE(excluded.phone, suppliers.phone)
      `);

      const importTransaction = db.transaction(() => {
        for (const line of dataLines) {
          try {
            // Remove quotes and split
            const parts = line.split(';').map((p) => p.replace(/^"|"$/g, '').trim());
            const code = parts[0];
            if (!code) {
              skipped++;
              continue;
            }

            // Get non-empty values after code
            const values = parts.slice(1).filter((v) => v !== '');
            if (values.length === 0) {
              skipped++;
              continue;
            }

            // Intelligent parsing: find postal code (5 digits), phone (10 digits or 2-digit groups)
            let name = '';
            let postalCode = null;
            let city = '';
            let phone = null;

            let phase = 'name'; // name -> postal -> city -> phone

            for (let i = 0; i < values.length; i++) {
              const val = values[i];

              if (phase === 'name') {
                // Check if this is a 5-digit postal code
                if (/^\d{5}$/.test(val)) {
                  postalCode = val;
                  phase = 'city';
                  continue;
                }
                // Check if this looks like the start of a phone (10 digits)
                if (/^0\d{9}$/.test(val)) {
                  phone = val;
                  phase = 'done';
                  continue;
                }
                // Check if this is a 2-digit number that could be phone start
                if (
                  /^0[1-9]$/.test(val) &&
                  i + 3 < values.length &&
                  values.slice(i, i + 5).every((v) => /^\d{2}$/.test(v))
                ) {
                  phone = values.slice(i, i + 5).join('');
                  phase = 'done';
                  break;
                }
                // Otherwise it's part of the name
                name += (name ? ' ' : '') + val;
              } else if (phase === 'city') {
                // Check for 10-digit phone
                if (/^0\d{9}$/.test(val)) {
                  phone = val;
                  phase = 'done';
                  continue;
                }
                // Check for 2-digit phone start
                if (/^0[1-9]$/.test(val)) {
                  // Collect consecutive 2-digit numbers
                  const phoneDigits = [];
                  let j = i;
                  while (j < values.length && /^\d{2,3}$/.test(values[j])) {
                    phoneDigits.push(values[j]);
                    j++;
                  }
                  const candidate = phoneDigits.join('');
                  if (candidate.length >= 10 && candidate.startsWith('0')) {
                    phone = candidate.substring(0, 10);
                    phase = 'done';
                    break;
                  }
                }
                // Otherwise it's part of city
                city += (city ? ' ' : '') + val.replace(/-/g, '-');
              }
            }

            if (!name) {
              skipped++;
              continue;
            }

            // Normalize phone
            if (phone) {
              phone = phone.replace(/[^0-9]/g, '');
              if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
              if (phone.length !== 10) phone = null;
            }

            insertOrUpdate.run(code, name, postalCode, city || null, phone);
            imported++;
          } catch (_e) {
            errors++;
          }
        }
      });

      importTransaction();
      logger.info(
        `Import fournisseurs CSV: ${imported} importés, ${skipped} ignorés, ${errors} erreurs`,
      );
      res.json({ success: true, imported, skipped, errors, total: dataLines.length });
    } catch (error) {
      logger.error('Import fournisseurs CSV:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/annuaire/import/contacts-csv — Import contacts depuis données CSV uploadées ───
  // [AUDIT FIX I2] Validation Zod mandatory
  app.post(
    '/api/annuaire/import/contacts-csv',
    authenticateToken,
    requireAdmin,
    validate(contactsImportSchema),
    (req, res) => {
      try {
        const { data, mode = 'import' } = req.body;

        /**
         * Parse un nom "NOM Prénom" en { lastName, firstName }.
         * Gère : "DUPONT Jean-Marie", "Aline", "YES HIGH TECH Sylvie", "wagogne sarah"
         */
        function parseName(raw) {
          if (!raw) return { lastName: '', firstName: '' };
          const trimmed = raw.trim();
          if (!trimmed) return { lastName: '', firstName: '' };

          const parts = trimmed.split(/\s+/);
          if (parts.length === 1) {
            // Nom seul → on le met en last_name
            return { lastName: parts[0].toUpperCase(), firstName: '' };
          }

          // Détecter la frontière : les mots tout en majuscules sont le nom de famille
          let lastNameParts = [];
          let firstNameParts = [];
          let foundFirstName = false;

          for (const part of parts) {
            if (!foundFirstName && part === part.toUpperCase() && /[A-ZÀ-Ü]/.test(part)) {
              // Mot en majuscules → nom de famille
              lastNameParts.push(part);
            } else {
              foundFirstName = true;
              firstNameParts.push(part);
            }
          }

          // Si tout est en majuscules ou tout en minuscules, fallback : dernier mot = prénom
          if (firstNameParts.length === 0 && lastNameParts.length > 1) {
            const last = lastNameParts.pop();
            firstNameParts = [last.charAt(0).toUpperCase() + last.slice(1).toLowerCase()];
          }
          // Si aucun mot n'est en majuscules (tout en minuscules), fallback : premier mot = nom, reste = prénom
          if (lastNameParts.length === 0 && firstNameParts.length > 1) {
            lastNameParts = [firstNameParts.shift().toUpperCase()];
          }

          return {
            lastName: lastNameParts.join(' ') || trimmed.toUpperCase(),
            firstName: firstNameParts.join(' '),
          };
        }

        /** Parse une ligne CSV en objet contact */
        function parseContactRow(row) {
          const codeFree = (row.codeFree || row.code_libre || '').trim();
          const { lastName, firstName } = parseName(row.name || row.nom_prenom || '');
          let phone = normalizePhone(row.phone || row.telephone || '');
          let mobile = normalizePhone(row.mobile || row.portable || '');
          const email = (row.email || '').trim().toLowerCase() || null;

          // Téléphones trop courts → null
          if (phone && phone.replace(/[^0-9]/g, '').length < 9) phone = null;
          if (mobile && mobile.replace(/[^0-9]/g, '').length < 9) mobile = null;

          return { codeFree, lastName, firstName, phone, mobile, email };
        }

        // Mode preview : renvoyer un aperçu des 30 premières lignes parsées
        if (mode === 'preview') {
          const preview = data.slice(0, 30).map((row) => {
            const p = parseContactRow(row);
            return {
              code_libre: p.codeFree,
              last_name: p.lastName,
              first_name: p.firstName,
              phone: p.phone,
              phone2: p.mobile,
              email: p.email,
            };
          });
          return res.json({ preview, totalRows: data.length });
        }

        // Mode import
        let imported = 0,
          updated = 0,
          skipped = 0,
          errors = 0;

        // Vérifier si la colonne code_libre existe
        const hasCL = db
          .pragma('table_info(annuaire_contacts)')
          .some((c) => c.name === 'code_libre');

        const insertStmt = hasCL
          ? db.prepare(`
            INSERT INTO annuaire_contacts (code_libre, first_name, last_name, phone, phone2, email, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
            ON CONFLICT(code_libre) DO UPDATE SET
              first_name = COALESCE(NULLIF(excluded.first_name, ''), annuaire_contacts.first_name),
              last_name = excluded.last_name,
              phone = COALESCE(excluded.phone, annuaire_contacts.phone),
              phone2 = COALESCE(excluded.phone2, annuaire_contacts.phone2),
              email = COALESCE(excluded.email, annuaire_contacts.email),
              modified_at = datetime('now')
          `)
          : db.prepare(`
            INSERT INTO annuaire_contacts (first_name, last_name, phone, phone2, email, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
          `);

        // Essayer de rattacher les contacts C-xxx à un client existant
        const findClient = db.prepare('SELECT id FROM clients WHERE code_libre = ? LIMIT 1');
        const findExisting = db.prepare(
          'SELECT id FROM annuaire_contacts WHERE code_libre = ? LIMIT 1',
        );

        const importTransaction = db.transaction(() => {
          for (const row of data) {
            try {
              const p = parseContactRow(row);
              if (!p.lastName && !p.firstName) {
                skipped++;
                continue;
              }
              if (!p.lastName) {
                p.lastName = p.firstName;
                p.firstName = '';
              }

              // Optionnel : rattacher à un client si le code commence par C
              let clientId = null;
              if (p.codeFree && p.codeFree.startsWith('C')) {
                const client = findClient.get(p.codeFree);
                if (client) clientId = client.id;
              }

              if (hasCL && p.codeFree) {
                // Vérifier AVANT l'upsert si le contact existe déjà
                const alreadyExists = !!findExisting.get(p.codeFree);
                const info = insertStmt.run(
                  p.codeFree,
                  p.firstName || null,
                  p.lastName,
                  p.phone || null,
                  p.mobile || null,
                  p.email || null,
                );
                if (info.changes > 0) {
                  if (alreadyExists) {
                    updated++;
                  } else {
                    imported++;
                  }
                  // Rattacher au client si trouvé
                  if (clientId) {
                    db.prepare(
                      'UPDATE annuaire_contacts SET client_id = ? WHERE code_libre = ?',
                    ).run(clientId, p.codeFree);
                  }
                }
              } else {
                insertStmt.run(
                  p.firstName || null,
                  p.lastName,
                  p.phone || null,
                  p.mobile || null,
                  p.email || null,
                );
                imported++;
              }
            } catch (_e) {
              errors++;
            }
          }
        });

        importTransaction();
        logger.info(
          `Import contacts CSV: ${imported} créés, ${updated} mis à jour, ${skipped} ignorés, ${errors} erreurs`,
        );
        res.json({ success: true, imported, updated, skipped, errors, total: data.length });
      } catch (error) {
        logger.error('Import contacts CSV:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // GET /api/annuaire/stats — Statistiques globales
  app.get('/api/annuaire/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        clients: db
          .prepare(
            'SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM clients',
          )
          .get(),
        suppliers: db
          .prepare(
            'SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM suppliers',
          )
          .get(),
        prestataires: db
          .prepare(
            'SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM prestataires',
          )
          .get(),
        contacts: db.prepare('SELECT COUNT(*) as total FROM annuaire_contacts').get(),
        locations: db.prepare('SELECT COUNT(*) as total FROM locations').get(),
      };
      res.json(stats);
    } catch (error) {
      logger.error('Annuaire stats:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// MATCHING LIEUX ↔ ENTITÉS
// ═══════════════════════════════════════════════════════════════
export function setupAnnuaireMatchingRoutes(app, authenticateToken, requireAdmin) {
  /**
   * GET /api/annuaire/matching-locations
   * Compare clients / fournisseurs / prestataires avec les lieux
   * et renvoie les correspondances possibles (nom ou ville identiques).
   */
  app.get('/api/annuaire/matching-locations', authenticateToken, (req, res) => {
    try {
      const locations = db.prepare('SELECT id, name, address, type FROM locations').all();
      if (!locations.length) return res.json({ matches: [] });

      const entities = [
        ...db
          .prepare('SELECT id, name, address, city, location_id FROM clients WHERE is_active = 1')
          .all()
          .map((e) => ({ ...e, entity_type: 'client' })),
        ...db
          .prepare('SELECT id, name, address, city, location_id FROM suppliers WHERE is_active = 1')
          .all()
          .map((e) => ({ ...e, entity_type: 'supplier' })),
        ...db
          .prepare(
            'SELECT id, name, address, city, location_id FROM prestataires WHERE is_active = 1',
          )
          .all()
          .map((e) => ({ ...e, entity_type: 'prestataire' })),
      ];

      const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

      const matches = [];
      for (const entity of entities) {
        // Skip entities already linked
        if (entity.location_id) continue;

        const eName = normalize(entity.name);
        const eAddr = normalize(entity.address);
        const eCity = normalize(entity.city);

        for (const loc of locations) {
          const lName = normalize(loc.name);
          const lAddr = normalize(loc.address);

          // Match criteria: name includes or address+city overlap
          const nameMatch = eName && lName && (eName.includes(lName) || lName.includes(eName));
          const addrMatch = eAddr && lAddr && (eAddr.includes(lAddr) || lAddr.includes(eAddr));
          const cityInAddr = eCity && lAddr && lAddr.includes(normalize(eCity));

          if (nameMatch || addrMatch || (eCity && cityInAddr && eAddr)) {
            matches.push({
              entity_type: entity.entity_type,
              entity_id: entity.id,
              entity_name: entity.name,
              entity_address: entity.address,
              entity_city: entity.city,
              location_id: loc.id,
              location_name: loc.name,
              location_address: loc.address,
              match_reason: nameMatch ? 'name' : addrMatch ? 'address' : 'city',
            });
          }
        }
      }

      res.json({ matches });
    } catch (error) {
      logger.error('Annuaire matching-locations:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/annuaire/bulk-link-locations
   * Body: { links: [{ entity_type, entity_id, location_id }] }
   */
  app.post('/api/annuaire/bulk-link-locations', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { links } = req.body;
      if (!Array.isArray(links) || links.length === 0) {
        return res.status(400).json({ success: false, error: 'Le tableau links est requis' });
      }

      const allowedTypes = ['client', 'supplier', 'prestataire'];
      const tableMap = { client: 'clients', supplier: 'suppliers', prestataire: 'prestataires' };
      let linked = 0;

      const updateTx = db.transaction(() => {
        for (const { entity_type, entity_id, location_id } of links) {
          if (!allowedTypes.includes(entity_type)) continue;
          const table = tableMap[entity_type];
          // Validate location exists
          const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(location_id);
          if (!loc) continue;

          db.prepare(
            `UPDATE ${table} SET location_id = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?`,
          ).run(location_id, req.user.id, entity_id);
          addToHistory(
            entity_type,
            entity_id,
            'linked_location',
            { location_id },
            req.user.id,
            req.user.name,
          );
          linked++;
        }
      });
      updateTx();

      res.json({ success: true, linked });
    } catch (error) {
      logger.error('Annuaire bulk-link-locations:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * GET /api/annuaire/matching-entities
   * Propose des liaisons client/fournisseur/prestataire basées sur le nom normalisé.
   */
  app.get('/api/annuaire/matching-entities', authenticateToken, (req, res) => {
    try {
      const activeEntities = [
        ...db
          .prepare('SELECT id, name, city, code_libre FROM clients WHERE is_active = 1')
          .all()
          .map((e) => ({ ...e, entity_type: 'client' })),
        ...db
          .prepare('SELECT id, name, city, code_libre FROM suppliers WHERE is_active = 1')
          .all()
          .map((e) => ({ ...e, entity_type: 'supplier' })),
        ...db
          .prepare('SELECT id, name, city, code_libre FROM prestataires WHERE is_active = 1')
          .all()
          .map((e) => ({ ...e, entity_type: 'prestataire' })),
      ];

      const existingLinks = db
        .prepare(
          `SELECT entity_a_type, entity_a_id, entity_b_type, entity_b_id, status
             FROM annuaire_entity_links
            WHERE status != 'rejected'`,
        )
        .all();
      const existingKey = new Set(
        existingLinks.map(
          (l) => `${l.entity_a_type}:${l.entity_a_id}|${l.entity_b_type}:${l.entity_b_id}`,
        ),
      );

      const byName = new Map();
      for (const entity of activeEntities) {
        const normalized = normalizeEntityName(entity.name);
        if (!normalized || normalized.length < 3) continue;
        if (!byName.has(normalized)) byName.set(normalized, []);
        byName.get(normalized).push({ ...entity, normalized_name: normalized });
      }

      const matches = [];
      for (const [normalizedName, group] of byName.entries()) {
        if (group.length < 2) continue;

        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            if (a.entity_type === b.entity_type) continue;

            const [left, right] = canonicalizeEntityLink(a.entity_type, a.id, b.entity_type, b.id);
            const key = `${left.type}:${left.id}|${right.type}:${right.id}`;
            if (existingKey.has(key)) continue;

            const cityMatch =
              String(a.city || '')
                .trim()
                .toLowerCase() &&
              String(a.city || '')
                .trim()
                .toLowerCase() ===
                String(b.city || '')
                  .trim()
                  .toLowerCase();

            matches.push({
              entity_a_type: left.type,
              entity_a_id: left.id,
              entity_a_name: left.id === a.id ? a.name : b.name,
              entity_a_city: left.id === a.id ? a.city : b.city,
              entity_b_type: right.type,
              entity_b_id: right.id,
              entity_b_name: right.id === b.id ? b.name : a.name,
              entity_b_city: right.id === b.id ? b.city : a.city,
              normalized_name: normalizedName,
              match_reason: cityMatch ? 'exact_name_and_city' : 'exact_name',
              confidence: cityMatch ? 1 : 0.86,
            });
          }
        }
      }

      matches.sort(
        (x, y) => y.confidence - x.confidence || x.normalized_name.localeCompare(y.normalized_name),
      );
      res.json({ matches });
    } catch (error) {
      logger.error('Annuaire matching-entities:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * GET /api/annuaire/entity-links
   * Liste les liaisons existantes (confirmées / suggérées).
   */
  app.get('/api/annuaire/entity-links', authenticateToken, (req, res) => {
    try {
      const status = req.query.status || null;
      const rows = status
        ? db
            .prepare(
              `SELECT * FROM annuaire_entity_links
               WHERE status = ?
               ORDER BY created_at DESC, id DESC`,
            )
            .all(status)
        : db
            .prepare(
              `SELECT * FROM annuaire_entity_links
               ORDER BY created_at DESC, id DESC`,
            )
            .all();

      const detailStmts = {
        client: db.prepare('SELECT id, name, city, code_libre FROM clients WHERE id = ?'),
        supplier: db.prepare('SELECT id, name, city, code_libre FROM suppliers WHERE id = ?'),
        prestataire: db.prepare('SELECT id, name, city, code_libre FROM prestataires WHERE id = ?'),
      };

      const links = rows.map((row) => {
        const a = detailStmts[row.entity_a_type]?.get(row.entity_a_id) || null;
        const b = detailStmts[row.entity_b_type]?.get(row.entity_b_id) || null;
        return {
          ...row,
          entity_a_name: a?.name || null,
          entity_a_city: a?.city || null,
          entity_a_code_libre: a?.code_libre || null,
          entity_b_name: b?.name || null,
          entity_b_city: b?.city || null,
          entity_b_code_libre: b?.code_libre || null,
        };
      });

      res.json({ links });
    } catch (error) {
      logger.error('Annuaire entity-links GET:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/annuaire/entity-links
   * Body: { entity_a_type, entity_a_id, entity_b_type, entity_b_id, relation_type?, confidence?, notes?, status? }
   */
  app.post('/api/annuaire/entity-links', authenticateToken, requireAdmin, (req, res) => {
    try {
      const {
        entity_a_type,
        entity_a_id,
        entity_b_type,
        entity_b_id,
        relation_type,
        confidence,
        notes,
        status,
      } = req.body || {};

      if (!ENTITY_TABLE_BY_TYPE[entity_a_type] || !ENTITY_TABLE_BY_TYPE[entity_b_type]) {
        return res.status(400).json({ success: false, error: 'Type entité invalide' });
      }
      if (Number(entity_a_id) === Number(entity_b_id) && entity_a_type === entity_b_type) {
        return res
          .status(400)
          .json({ success: false, error: 'Impossible de lier une entité à elle-même' });
      }

      const [left, right] = canonicalizeEntityLink(
        entity_a_type,
        entity_a_id,
        entity_b_type,
        entity_b_id,
      );

      const leftExists = db
        .prepare(`SELECT id FROM ${ENTITY_TABLE_BY_TYPE[left.type]} WHERE id = ?`)
        .get(left.id);
      const rightExists = db
        .prepare(`SELECT id FROM ${ENTITY_TABLE_BY_TYPE[right.type]} WHERE id = ?`)
        .get(right.id);
      if (!leftExists || !rightExists) {
        return res.status(404).json({ success: false, error: 'Une des entités est introuvable' });
      }

      db.prepare(
        `INSERT INTO annuaire_entity_links (
          entity_a_type, entity_a_id, entity_b_type, entity_b_id,
          relation_type, status, confidence, notes, created_by, modified_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_a_type, entity_a_id, entity_b_type, entity_b_id)
        DO UPDATE SET
          relation_type = excluded.relation_type,
          status = excluded.status,
          confidence = excluded.confidence,
          notes = excluded.notes,
          modified_by = excluded.modified_by,
          modified_at = CURRENT_TIMESTAMP`,
      ).run(
        left.type,
        left.id,
        right.type,
        right.id,
        relation_type || 'same_organization',
        status || 'confirmed',
        Number.isFinite(Number(confidence)) ? Number(confidence) : 1,
        notes || null,
        req.user.id,
        req.user.id,
      );

      addToHistory(
        'annuaire_entity_link',
        `${left.type}:${left.id}|${right.type}:${right.id}`,
        'linked_entities',
        { left, right, relation_type: relation_type || 'same_organization' },
        req.user.id,
        req.user.name,
      );

      const saved = db
        .prepare(
          `SELECT * FROM annuaire_entity_links
           WHERE entity_a_type = ? AND entity_a_id = ? AND entity_b_type = ? AND entity_b_id = ?`,
        )
        .get(left.type, left.id, right.type, right.id);

      res.status(201).json({ success: true, link: saved });
    } catch (error) {
      logger.error('Annuaire entity-links POST:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/annuaire/bulk-link-entities
   * Body: { links: [{ entity_a_type, entity_a_id, entity_b_type, entity_b_id, relation_type?, confidence? }] }
   */
  app.post('/api/annuaire/bulk-link-entities', authenticateToken, requireAdmin, (req, res) => {
    try {
      const links = Array.isArray(req.body?.links) ? req.body.links : [];
      if (!links.length) {
        return res.status(400).json({ success: false, error: 'Le tableau links est requis' });
      }

      let linked = 0;
      const tx = db.transaction(() => {
        for (const link of links) {
          const {
            entity_a_type,
            entity_a_id,
            entity_b_type,
            entity_b_id,
            relation_type,
            confidence,
          } = link || {};
          if (!ENTITY_TABLE_BY_TYPE[entity_a_type] || !ENTITY_TABLE_BY_TYPE[entity_b_type])
            continue;
          if (entity_a_type === entity_b_type && Number(entity_a_id) === Number(entity_b_id))
            continue;

          const [left, right] = canonicalizeEntityLink(
            entity_a_type,
            entity_a_id,
            entity_b_type,
            entity_b_id,
          );

          db.prepare(
            `INSERT INTO annuaire_entity_links (
              entity_a_type, entity_a_id, entity_b_type, entity_b_id,
              relation_type, status, confidence, created_by, modified_by
            ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
            ON CONFLICT(entity_a_type, entity_a_id, entity_b_type, entity_b_id)
            DO UPDATE SET
              relation_type = excluded.relation_type,
              status = 'confirmed',
              confidence = excluded.confidence,
              modified_by = excluded.modified_by,
              modified_at = CURRENT_TIMESTAMP`,
          ).run(
            left.type,
            left.id,
            right.type,
            right.id,
            relation_type || 'same_organization',
            Number.isFinite(Number(confidence)) ? Number(confidence) : 1,
            req.user.id,
            req.user.id,
          );
          linked++;
        }
      });
      tx();

      res.json({ success: true, linked });
    } catch (error) {
      logger.error('Annuaire bulk-link-entities:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * GET /api/annuaire/matching-contact-entities
   * Suggestions de rattachement contact -> client/supplier/prestataire via email (domaine + local-part).
   */
  app.get('/api/annuaire/matching-contact-entities', authenticateToken, (req, res) => {
    try {
      const contacts = db
        .prepare(
          `SELECT id, first_name, last_name, email, client_id, supplier_id, prestataire_id
           FROM annuaire_contacts
           WHERE is_active = 1 AND email LIKE '%@%'`,
        )
        .all();

      const entitiesByType = {
        client: db
          .prepare('SELECT id, name, email, website FROM clients WHERE is_active = 1')
          .all(),
        supplier: db
          .prepare('SELECT id, name, email, website FROM suppliers WHERE is_active = 1')
          .all(),
        prestataire: db
          .prepare('SELECT id, name, email, website FROM prestataires WHERE is_active = 1')
          .all(),
      };

      const prepared = Object.fromEntries(
        Object.entries(entitiesByType).map(([type, rows]) => [
          type,
          rows.map((row) => {
            const domains = new Set();
            const d1 = extractDomain(row.email);
            const d2 = extractDomain(row.website);
            if (d1) domains.add(d1);
            if (d2) domains.add(d2);
            return {
              ...row,
              domains,
              slug: normalizeEntityName(row.name).replace(/\s+/g, ''),
            };
          }),
        ]),
      );

      const matches = [];
      for (const contact of contacts) {
        const emailParts = extractEmailParts(contact.email);
        if (!emailParts) continue;
        const domainNormalized = emailParts.domain.replace(/[^a-z0-9]/g, '');

        for (const [entityType, idField] of [
          ['client', 'client_id'],
          ['supplier', 'supplier_id'],
          ['prestataire', 'prestataire_id'],
        ]) {
          if (contact[idField]) continue;

          const candidates = prepared[entityType]
            .map((entity) => {
              let score = 0;
              if (entity.domains.has(emailParts.domain)) score += 10;
              if (entity.slug && entity.slug.length >= 5) {
                if (domainNormalized.includes(entity.slug)) score += 6;
                if (emailParts.local.includes(entity.slug)) score += 4;
              }
              return { entity, score };
            })
            .filter((x) => x.score >= 6)
            .sort((a, b) => b.score - a.score || a.entity.id - b.entity.id);

          if (!candidates.length) continue;
          if (candidates.length > 1 && candidates[0].score === candidates[1].score) continue;

          const best = candidates[0];
          matches.push({
            contact_id: contact.id,
            contact_name:
              [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
              contact.last_name ||
              'Contact',
            contact_email: contact.email,
            entity_type: entityType,
            entity_id: best.entity.id,
            entity_name: best.entity.name,
            match_reason: best.score >= 10 ? 'email_domain_exact' : 'email_name_pattern',
            confidence: best.score >= 10 ? 1 : 0.86,
          });
        }
      }

      res.json({ matches });
    } catch (error) {
      logger.error('Annuaire matching-contact-entities:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/annuaire/bulk-link-contact-entities
   * Body: { links: [{ contact_id, entity_type, entity_id, confidence?, notes? }] }
   */
  app.post(
    '/api/annuaire/bulk-link-contact-entities',
    authenticateToken,
    requireAdmin,
    (req, res) => {
      try {
        const links = Array.isArray(req.body?.links) ? req.body.links : [];
        if (!links.length) {
          return res.status(400).json({ success: false, error: 'Le tableau links est requis' });
        }

        let linked = 0;
        const tx = db.transaction(() => {
          for (const link of links) {
            const { contact_id, entity_type, entity_id, confidence, notes } = link || {};
            if (!contact_id || !ENTITY_TABLE_BY_TYPE[entity_type] || !entity_id) continue;

            const contact = db
              .prepare('SELECT id FROM annuaire_contacts WHERE id = ?')
              .get(contact_id);
            if (!contact) continue;
            const entity = db
              .prepare(`SELECT id FROM ${ENTITY_TABLE_BY_TYPE[entity_type]} WHERE id = ?`)
              .get(entity_id);
            if (!entity) continue;

            db.prepare(
              `INSERT INTO annuaire_contact_entity_links
             (contact_id, entity_type, entity_id, confidence, source, notes, created_by, modified_by)
             VALUES (?, ?, ?, ?, 'auto_email', ?, ?, ?)
             ON CONFLICT(contact_id, entity_type, entity_id)
             DO UPDATE SET
               confidence = excluded.confidence,
               notes = excluded.notes,
               modified_by = excluded.modified_by,
               modified_at = CURRENT_TIMESTAMP`,
            ).run(
              contact_id,
              entity_type,
              entity_id,
              Number.isFinite(Number(confidence)) ? Number(confidence) : 1,
              notes || null,
              req.user.id,
              req.user.id,
            );

            const legacyField = `${entity_type}_id`;
            const current = db
              .prepare(
                `SELECT client_id, supplier_id, prestataire_id FROM annuaire_contacts WHERE id = ?`,
              )
              .get(contact_id);
            if (current && !current[legacyField]) {
              db.prepare(
                `UPDATE annuaire_contacts SET ${legacyField} = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?`,
              ).run(entity_id, contact_id);
            }
            linked++;
          }
        });
        tx();

        res.json({ success: true, linked });
      } catch (error) {
        logger.error('Annuaire bulk-link-contact-entities:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // DELETE /api/annuaire/entity-links/:id
  app.delete('/api/annuaire/entity-links/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const deleted = db
        .prepare('DELETE FROM annuaire_entity_links WHERE id = ?')
        .run(req.params.id);
      if (!deleted.changes) {
        return res.status(404).json({ success: false, error: 'Liaison introuvable' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Annuaire entity-links DELETE:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
