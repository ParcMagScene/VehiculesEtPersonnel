import db from './database.js';
import logger from './logger.js';
import { listCache, cacheMiddleware, invalidateEntity } from './cache.js';
import { validate, affaireSchema } from './schemas/imports.js';

export function setupAffairesRoutes(app, authenticateToken, requireAdmin) {

// GET /api/affaires — Liste des affaires enrichies (DB + auto-détection depuis réservations) [PERF] Cache 30s
app.get('/api/affaires', authenticateToken, cacheMiddleware(listCache, () => 'affaires', 30_000), (req, res) => {
  try {
    // 1. Affaires explicitement enregistrées en DB
    const dbAffaires = db.prepare('SELECT * FROM affaires ORDER BY date_debut DESC LIMIT 5000').all();

    // [PERF Phase 4] Compteurs en batch — 3 requêtes au lieu de 3×N
    const resCounts = {};
    db.prepare(`
      SELECT affaire, COUNT(*) as res_count, COUNT(DISTINCT vehicle_id) as veh_count
      FROM reservations WHERE affaire IS NOT NULL AND affaire != ''
      GROUP BY affaire
    `).all().forEach(r => { resCounts[r.affaire] = r; });

    const persCounts = {};
    db.prepare(`
      SELECT aff, COUNT(DISTINCT person_id) as pers_count FROM (
        SELECT UPPER(m.affaire) as aff, ma.person_id
        FROM missions m JOIN mission_assignments ma ON ma.mission_id = m.id
        WHERE m.affaire IS NOT NULL AND m.affaire != ''
        UNION
        SELECT UPPER(r.affaire) as aff, ma.person_id
        FROM reservations r
        JOIN missions m ON m.reservation_id = r.id
        JOIN mission_assignments ma ON ma.mission_id = m.id
        WHERE r.affaire IS NOT NULL AND r.affaire != ''
      ) GROUP BY aff
    `).all().forEach(r => { persCounts[r.aff] = r.pers_count; });

    // Comptage BL/BP importés par affaire
    const blCounts = {};
    db.prepare(`
      SELECT affaire_id, COUNT(*) as bl_count
      FROM bl_imports WHERE status != 'rejected'
      GROUP BY affaire_id
    `).all().forEach(r => { blCounts[r.affaire_id] = r.bl_count; });

    // Comptage commandes par affaire
    const orderCounts = {};
    db.prepare(`
      SELECT affaire_id, COUNT(*) as order_count
      FROM orders WHERE affaire_id IS NOT NULL AND affaire_id != ''
      GROUP BY affaire_id
    `).all().forEach(r => { orderCounts[r.affaire_id] = r.order_count; });

    const enriched = dbAffaires.map(a => {
      const rc = resCounts[a.numero_affaire];
      return {
        id: a.id,
        numeroAffaire: a.numero_affaire,
        nom: a.nom || '',
        type: a.type,
        client: a.client,
        interlocuteur: a.interlocuteur,
        tel: a.tel,
        fax: a.fax,
        dateDebut: a.date_debut,
        dateFin: a.date_fin,
        devis: a.devis,
        adresseLivraison: a.adresse_livraison,
        titre: a.titre,
        description: a.description,
        googleEventId: a.google_event_id,
        eventName: a.event_name,
        reservationCount: rc?.res_count || 0,
        vehicleCount: rc?.veh_count || 0,
        personnelCount: persCounts[a.numero_affaire?.toUpperCase()] || 0,
        blImportCount: blCounts[a.numero_affaire] || 0,
        orderCount: orderCounts[a.numero_affaire] || 0,
        createdBy: a.created_by,
        createdAt: a.created_at,
        modifiedBy: a.modified_by,
        modifiedAt: a.modified_at,
        source: 'db',
      };
    });

    // 2. Affaires auto-détectées depuis les réservations (celles qui n'ont pas d'entrée en DB)
    const knownNums = new Set(dbAffaires.map(a => a.numero_affaire));
    const reservationAffaires = db.prepare(`
      SELECT affaire,
             MIN(start_date) as date_debut,
             MAX(end_date) as date_fin,
             GROUP_CONCAT(DISTINCT client_name) as clients,
             GROUP_CONCAT(DISTINCT prestation_name) as prestations,
             GROUP_CONCAT(DISTINCT google_event_id) as google_event_ids,
             COUNT(*) as reservation_count,
             COUNT(DISTINCT vehicle_id) as vehicle_count
      FROM reservations
      WHERE affaire IS NOT NULL AND affaire != ''
      GROUP BY affaire
    `).all();

    for (const ra of reservationAffaires) {
      if (knownNums.has(ra.affaire)) continue;
      const clientList = (ra.clients || '').split(',').filter(c => c.trim());
      const client = clientList[0] || '';
      const prestationList = (ra.prestations || '').split(',').filter(p => p.trim());
      const titre = prestationList[0] || '';

      enriched.push({
        id: null,
        numeroAffaire: ra.affaire,
        nom: '',
        type: 'Prestation',
        client: client,
        interlocuteur: '',
        tel: '',
        fax: '',
        dateDebut: ra.date_debut,
        dateFin: ra.date_fin,
        devis: '',
        adresseLivraison: '',
        titre: titre,
        description: '',
        googleEventId: (ra.google_event_ids || '').split(',')[0] || '',
        eventName: titre,
        reservationCount: ra.reservation_count,
        vehicleCount: ra.vehicle_count,
        personnelCount: persCounts[ra.affaire?.toUpperCase()] || 0,
        blImportCount: blCounts[ra.affaire] || 0,
        orderCount: orderCounts[ra.affaire] || 0,
        createdBy: null,
        createdAt: null,
        modifiedBy: null,
        modifiedAt: null,
        source: 'auto',
      });
    }

    // Trier par date_debut DESC
    enriched.sort((a, b) => (b.dateDebut || '').localeCompare(a.dateDebut || ''));

    res.json(enriched);
  } catch (error) {
    logger.error('Erreur GET /api/affaires:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// GET /api/affaires/personnel-counts — Compter le personnel affecté par affaire (toutes les affaires)
app.get('/api/affaires/personnel-counts', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT UPPER(m.affaire) as affaire, COUNT(DISTINCT ma.person_id) as count
      FROM missions m
      JOIN mission_assignments ma ON ma.mission_id = m.id
      WHERE m.affaire IS NOT NULL AND m.affaire != ''
      GROUP BY UPPER(m.affaire)
    `).all();
    const counts = {};
    for (const r of rows) {
      counts[r.affaire] = r.count;
    }
    res.json(counts);
  } catch (error) {
    logger.error('Erreur GET /api/affaires/personnel-counts:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires — Créer ou mettre à jour une affaire (upsert par numero_affaire)
app.post('/api/affaires', authenticateToken, validate(affaireSchema), (req, res) => {
  try {
    const a = req.body;

    // Vérifier si l'affaire existe déjà
    const existing = db.prepare('SELECT id FROM affaires WHERE numero_affaire = ?').get(a.numero_affaire);

    if (existing) {
      // Mise à jour
      db.prepare(`
        UPDATE affaires SET
          nom = ?, type = ?, client = ?, interlocuteur = ?, tel = ?, fax = ?,
          date_debut = ?, date_fin = ?, devis = ?, adresse_livraison = ?,
          titre = ?, description = ?, google_event_id = ?, event_name = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE numero_affaire = ?
      `).run(
        a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
        a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
        a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
        req.user.id, a.numero_affaire
      );
      const updated = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?').get(a.numero_affaire);
      res.json({ ...updated, id: updated.id });
    } else {
      // Création
      const result = db.prepare(`
        INSERT INTO affaires (numero_affaire, nom, type, client, interlocuteur, tel, fax,
          date_debut, date_fin, devis, adresse_livraison, titre, description,
          google_event_id, event_name, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        a.numero_affaire, a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
        a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
        a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
        req.user.id, req.user.id
      );
      const created = db.prepare('SELECT * FROM affaires WHERE id = ?').get(result.lastInsertRowid);
      invalidateEntity('affaires');
      listCache.invalidatePattern(/^planning-affaires/);
      res.status(201).json(created);
    }
  } catch (error) {
    logger.error('Erreur POST /api/affaires:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// PUT /api/affaires/:id — Mettre à jour une affaire par ID
app.put('/api/affaires/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const a = req.body;

    db.prepare(`
      UPDATE affaires SET
        numero_affaire = ?, nom = ?, type = ?, client = ?, interlocuteur = ?, tel = ?, fax = ?,
        date_debut = ?, date_fin = ?, devis = ?, adresse_livraison = ?,
        titre = ?, description = ?, google_event_id = ?, event_name = ?,
        modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      a.numero_affaire || '', a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
      a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
      a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
      req.user.id, id
    );
    const updated = db.prepare('SELECT * FROM affaires WHERE id = ?').get(id);
    if (!updated) return res.status(404).json({ success: false, error: 'Affaire non trouvée' });
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json(updated);
  } catch (error) {
    logger.error('Erreur PUT /api/affaires:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// DELETE /api/affaires/:id
app.delete('/api/affaires/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM affaires WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Affaire non trouvée' });
    db.prepare('DELETE FROM affaires WHERE id = ?').run(id);
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur DELETE /api/affaires:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// ═══ Liaisons entre affaires (Tournée ↔ affaires individuelles) ═══

// GET /api/affaires/:id/links — Récupérer les affaires liées
app.get('/api/affaires/:id/links', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    // Affaires dont cette affaire est le parent
    const children = db.prepare(`
      SELECT a.*, al.id as link_id, 'child' as link_direction
      FROM affaire_links al
      JOIN affaires a ON a.id = al.child_affaire_id
      WHERE al.parent_affaire_id = ?
      ORDER BY a.date_debut
    `).all(id);
    // Affaires dont cette affaire est un enfant
    const parents = db.prepare(`
      SELECT a.*, al.id as link_id, 'parent' as link_direction
      FROM affaire_links al
      JOIN affaires a ON a.id = al.parent_affaire_id
      WHERE al.child_affaire_id = ?
      ORDER BY a.date_debut
    `).all(id);
    res.json({ children, parents, total: children.length + parents.length });
  } catch (error) {
    logger.error('Erreur GET /api/affaires/:id/links:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires/:id/links — Lier une affaire à une autre
app.post('/api/affaires/:id/links', authenticateToken, (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const { childAffaireId } = req.body;
    if (!childAffaireId) return res.status(400).json({ success: false, error: 'childAffaireId requis' });
    if (parentId === childAffaireId) return res.status(400).json({ success: false, error: 'Impossible de lier une affaire à elle-même' });

    const parent = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(parentId);
    const child = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(childAffaireId);
    if (!parent) return res.status(404).json({ success: false, error: 'Affaire parent non trouvée' });
    if (!child) return res.status(404).json({ success: false, error: 'Affaire enfant non trouvée' });

    const existing = db.prepare('SELECT id FROM affaire_links WHERE parent_affaire_id = ? AND child_affaire_id = ?').get(parentId, childAffaireId);
    if (existing) return res.json({ success: true, message: 'Lien déjà existant', linkId: existing.id });

    const result = db.prepare('INSERT INTO affaire_links (parent_affaire_id, child_affaire_id) VALUES (?, ?)').run(parentId, childAffaireId);
    logger.info(`🔗 Affaire ${parent.numero_affaire} liée → ${child.numero_affaire}`);
    res.json({ success: true, linkId: result.lastInsertRowid });
  } catch (error) {
    logger.error('Erreur POST /api/affaires/:id/links:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// DELETE /api/affaires/:id/links/:linkId — Supprimer un lien entre affaires
app.delete('/api/affaires/:id/links/:linkId', authenticateToken, (req, res) => {
  try {
    const { linkId } = req.params;
    db.prepare('DELETE FROM affaire_links WHERE id = ?').run(linkId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur DELETE affaire link:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires/sync-google-events — Détection auto : lier/créer affaires depuis événements Google
app.post('/api/affaires/sync-google-events', authenticateToken, (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ created: 0, linked: 0, results: [] });
    }

    const results = [];
    const affaireRegex = /\baf\s*(\d{3,})\b/i;

    const findAffaire = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?');
    const findByGoogleEvent = db.prepare('SELECT * FROM affaires WHERE google_event_id = ?');
    const insertAffaire = db.prepare(`
      INSERT INTO affaires (numero_affaire, nom, type, client, titre, description,
        date_debut, date_fin, adresse_livraison, google_event_id, event_name,
        created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const linkAffaire = db.prepare(`
      UPDATE affaires SET google_event_id = ?, event_name = ?,
        modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE numero_affaire = ? AND (google_event_id IS NULL OR google_event_id = '')
    `);

    let created = 0;
    let linked = 0;

    for (const evt of events) {
      const title = evt.summary || evt.title || '';
      const match = title.match(affaireRegex);
      if (!match) continue;

      const affaireNum = `AF${match[1]}`;
      const googleEventId = evt.id || '';
      if (!googleEventId) continue;

      // Vérifier si cet événement Google est déjà lié à une affaire
      const alreadyLinked = findByGoogleEvent.get(googleEventId);
      if (alreadyLinked) continue; // Déjà traité

      // Extraire les informations de l'événement
      const eventName = title;
      const dateStart = evt.start?.date || (evt.start?.dateTime || '').slice(0, 10) || '';
      const dateEnd = evt.end?.date || (evt.end?.dateTime || '').slice(0, 10) || '';
      const location = evt.location || '';
      const description = evt.description || '';

      // Vérifier si l'affaire existe dans la base
      const existing = findAffaire.get(affaireNum);

      if (existing) {
        // L'affaire existe → la lier à l'événement Google (si pas déjà liée)
        const changes = linkAffaire.run(googleEventId, eventName, req.user.id, affaireNum);
        if (changes.changes > 0) {
          linked++;
          results.push({ affaire: affaireNum, action: 'linked', googleEventId });
          logger.info(`🔗 Affaire ${affaireNum} liée à l'événement Google "${eventName}"`);
        }
      } else {
        // L'affaire n'existe pas → la créer
        // Tenter de détecter le type depuis le titre
        let type = 'Prestation';
        const titleLower = title.toLowerCase();
        if (/tourn[eé]e/i.test(titleLower)) type = 'Tournée';
        else if (titleLower.includes('location') || titleLower.includes('loc ')) type = 'Location';
        else if (titleLower.includes('vente') || titleLower.includes('achat')) type = 'Vente';
        else if (titleLower.includes('install')) type = 'Installation';

        // Tenter d'extraire le client (texte après le N° d'affaire, avant un séparateur)
        let client = '';
        const afterAffaire = title.slice(match.index + match[0].length).trim();
        const clientMatch = afterAffaire.match(/^[\s\-–—:]+\s*(.+?)(?:\s*[\-–—|\/]|$)/);
        if (clientMatch) {
          client = clientMatch[1].trim();
        } else if (afterAffaire && afterAffaire.length > 0 && afterAffaire.length < 60) {
          client = afterAffaire.replace(/^[\s\-–—:]+/, '').trim();
        }

        insertAffaire.run(
          affaireNum, eventName || client || '', type, client, eventName, description,
          dateStart, dateEnd, location,
          googleEventId, eventName,
          req.user.id, req.user.id
        );
        created++;
        results.push({ affaire: affaireNum, action: 'created', googleEventId, client, type });
        logger.info(`✨ Affaire ${affaireNum} créée automatiquement depuis l'événement Google "${eventName}"`);
      }
    }

    res.json({ created, linked, results });
  } catch (error) {
    logger.error('Erreur POST /api/affaires/sync-google-events:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur interne' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/affaires/:id/bp/annotate — Données pour annotation BP
// Agrège : BP items, réservations, personnel, tâches, notes
// ═══════════════════════════════════════════════════════════════
app.post('/api/affaires/:id/bp/annotate', authenticateToken, (req, res) => {
  try {
    const affaireId = req.params.id; // numero_affaire (ex: "AF32361")
    const { blImportId } = req.body;

    // 1. Affaire (+ google_event_id pour lien réservations)
    const affaire = db.prepare(`
      SELECT numero_affaire, nom, type, client, date_debut, date_fin, adresse_livraison, google_event_id
      FROM affaires WHERE numero_affaire = ?
    `).get(affaireId);
    if (!affaire) return res.status(404).json({ success: false, error: 'Affaire introuvable' });

    // 2. BP Items (groupés par section)
    let bpQuery = `
      SELECT bp.*, ec.name as catalog_name, ec.reference as catalog_reference
      FROM bp_items bp
      LEFT JOIN equipment_catalog ec ON bp.equipment_catalog_id = ec.id
      WHERE bp.bl_import_id IN (
        SELECT id FROM bl_imports WHERE affaire_id = ?
      )
    `;
    const bpParams = [affaireId];
    if (blImportId) {
      bpQuery = `
        SELECT bp.*, ec.name as catalog_name, ec.reference as catalog_reference
        FROM bp_items bp
        LEFT JOIN equipment_catalog ec ON bp.equipment_catalog_id = ec.id
        WHERE bp.bl_import_id = ?
      `;
      bpParams[0] = blImportId;
    }
    const bpItems = db.prepare(bpQuery + ' ORDER BY bp.id').all(...bpParams);

    // 3. Réservations liées (par champ affaire OU par google_event_id)
    const googleEventId = affaire.google_event_id || null;
    const reservations = db.prepare(`
      SELECT r.id, r.start_date, r.end_date, r.start_period, r.end_period,
             r.client_name, r.location_name, r.driver_name,
             v.name as vehicle_name, v.type as vehicle_type
      FROM reservations r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.affaire = ?
         OR (? IS NOT NULL AND (r.google_event_id = ? OR r.linked_event_ids LIKE '%' || ? || '%'))
      ORDER BY r.start_date
    `).all(affaireId, googleEventId, googleEventId, googleEventId);
    logger.info(`[BP] Réservations pour ${affaireId}: googleEventId=${googleEventId}, trouvées=${reservations.length}`);

    // Collecter les IDs de réservations liées
    const resaIds = reservations.map(r => String(r.id));

    // 4. Tâches (task_assignments — le vrai modèle du module planification)
    let tasks = db.prepare(`
      SELECT ta.id, ta.title, ta.status, ta.date as start_date, ta.period, ta.section, ta.notes,
             p.first_name as person_first_name, p.last_name as person_last_name
      FROM task_assignments ta
      LEFT JOIN persons p ON ta.person_id = p.id
      WHERE ta.affaire_num = ? AND ta.deleted_at IS NULL
      ORDER BY ta.date ASC
    `).all(affaireId);

    // Ajouter les tâches liées via reservation_id
    if (resaIds.length > 0) {
      const placeholders = resaIds.map(() => '?').join(',');
      const tasksByResa = db.prepare(`
        SELECT ta.id, ta.title, ta.status, ta.date as start_date, ta.period, ta.section, ta.notes,
               p.first_name as person_first_name, p.last_name as person_last_name
        FROM task_assignments ta
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.reservation_id IN (${placeholders}) AND ta.deleted_at IS NULL
        ORDER BY ta.date ASC
      `).all(...resaIds);
      const existingIds = new Set(tasks.map(t => t.id));
      tasks = [...tasks, ...tasksByResa.filter(t => !existingIds.has(t.id))];
    }

    // Ajouter les display events comme tâches (événements planifiés pour cette affaire)
    const displayEvents = db.prepare(`
      SELECT id, type as title, category, date as start_date, period, comment as notes,
             status, assigned_person_id
      FROM dynamic_display_events
      WHERE affaire_id = ? AND status != 'done'
      ORDER BY date ASC
    `).all(affaireId);
    for (const ev of displayEvents) {
      if (!tasks.some(t => t.id === ev.id)) {
        const label = `${ev.title}${ev.category ? ' (' + ev.category + ')' : ''}`;
        tasks.push({ ...ev, title: label });
      }
    }

    // 5. Personnel affecté (planning_assignments + personnes des tâches + chauffeurs réservations)
    const personnelDirect = db.prepare(`
      SELECT p.id, p.last_name, p.first_name, p.type as poste
      FROM planning_assignments pa
      JOIN persons p ON pa.person_id = p.id
      WHERE (pa.entity_type = 'affaire' AND pa.entity_id = ?)
    `).all(affaireId);

    // Personnel des display events (assigned_person_id)
    const eventPersonIds = displayEvents.map(e => e.assigned_person_id).filter(Boolean);
    let personnelEvents = [];
    if (eventPersonIds.length > 0) {
      const placeholders = eventPersonIds.map(() => '?').join(',');
      personnelEvents = db.prepare(`
        SELECT DISTINCT p.id, p.last_name, p.first_name, p.type as poste
        FROM persons p WHERE p.id IN (${placeholders})
      `).all(...eventPersonIds);
    }

    // Personnel des task_assignments (person_id)
    const taskPersonIds = tasks.map(t => t.person_id).filter(Boolean);
    let personnelTasks = [];
    if (taskPersonIds.length > 0) {
      const placeholders = [...new Set(taskPersonIds)].map(() => '?').join(',');
      personnelTasks = db.prepare(`
        SELECT DISTINCT p.id, p.last_name, p.first_name, p.type as poste
        FROM persons p WHERE p.id IN (${placeholders})
      `).all(...new Set(taskPersonIds));
    }

    // Chauffeurs des réservations (driver_name → chercher dans persons)
    const driverNames = [...new Set(reservations.map(r => r.driver_name).filter(Boolean))];
    let personnelDrivers = [];
    if (driverNames.length > 0) {
      const placeholders = driverNames.map(() => '?').join(',');
      personnelDrivers = db.prepare(`
        SELECT DISTINCT p.id, p.last_name, p.first_name, p.type as poste
        FROM persons p
        WHERE (p.first_name || ' ' || p.last_name) IN (${placeholders})
           OR (p.last_name || ' ' || p.first_name) IN (${placeholders})
      `).all(...driverNames, ...driverNames);
    }

    // Dédupliquer par person id
    const seenIds = new Set();
    const personnel = [];
    for (const list of [personnelDirect, personnelEvents, personnelTasks, personnelDrivers]) {
      for (const p of list) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          personnel.push(p);
        }
      }
    }

    // 6. BL Import metadata
    let blImport = null;
    if (blImportId) {
      blImport = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(blImportId);
      if (blImport?.parsed_data) {
        try { blImport.parsed_data = JSON.parse(blImport.parsed_data); } catch {}
      }
    }

    res.json({
      affaire,
      bpItems,
      reservations,
      personnel,
      tasks,
      blImport,
    });
    logger.info(`BP annotate ${affaireId}: ${reservations.length} resa, ${tasks.length} tasks, ${personnel.length} perso, googleEventId=${googleEventId}`);
  } catch (error) {
    logger.error('Erreur POST /api/affaires/:id/bp/annotate:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

} // end setupAffairesRoutes
