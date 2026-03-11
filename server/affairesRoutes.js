import db from './database.js';
import logger from './logger.js';
import { listCache, cacheMiddleware, invalidateEntity } from './cache.js';

export function setupAffairesRoutes(app, authenticateToken, requireAdmin) {

// GET /api/affaires — Liste des affaires enrichies (DB + auto-détection depuis réservations) [PERF] Cache 30s
app.get('/api/affaires', authenticateToken, cacheMiddleware(listCache, () => 'affaires', 30_000), (req, res) => {
  try {
    // 1. Affaires explicitement enregistrées en DB
    const dbAffaires = db.prepare('SELECT * FROM affaires ORDER BY date_debut DESC').all();

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
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires — Créer ou mettre à jour une affaire (upsert par numero_affaire)
app.post('/api/affaires', authenticateToken, (req, res) => {
  try {
    const a = req.body;
    if (!a.numero_affaire) {
      return res.status(400).json({ error: 'Le numéro d\'affaire est requis' });
    }

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
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    if (!updated) return res.status(404).json({ error: 'Affaire non trouvée' });
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json(updated);
  } catch (error) {
    logger.error('Erreur PUT /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// DELETE /api/affaires/:id
app.delete('/api/affaires/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM affaires WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Affaire non trouvée' });
    db.prepare('DELETE FROM affaires WHERE id = ?').run(id);
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur DELETE /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires/:id/links — Lier une affaire à une autre
app.post('/api/affaires/:id/links', authenticateToken, (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const { childAffaireId } = req.body;
    if (!childAffaireId) return res.status(400).json({ error: 'childAffaireId requis' });
    if (parentId === childAffaireId) return res.status(400).json({ error: 'Impossible de lier une affaire à elle-même' });

    const parent = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(parentId);
    const child = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(childAffaireId);
    if (!parent) return res.status(404).json({ error: 'Affaire parent non trouvée' });
    if (!child) return res.status(404).json({ error: 'Affaire enfant non trouvée' });

    const existing = db.prepare('SELECT id FROM affaire_links WHERE parent_affaire_id = ? AND child_affaire_id = ?').get(parentId, childAffaireId);
    if (existing) return res.json({ success: true, message: 'Lien déjà existant', linkId: existing.id });

    const result = db.prepare('INSERT INTO affaire_links (parent_affaire_id, child_affaire_id) VALUES (?, ?)').run(parentId, childAffaireId);
    logger.info(`🔗 Affaire ${parent.numero_affaire} liée → ${child.numero_affaire}`);
    res.json({ success: true, linkId: result.lastInsertRowid });
  } catch (error) {
    logger.error('Erreur POST /api/affaires/:id/links:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

} // end setupAffairesRoutes
