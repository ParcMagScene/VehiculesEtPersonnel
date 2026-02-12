// ============================================================
// MODULE PLANNING PERSONNEL — MagLog 1.0
// Routes REST : persons, skills, availabilities, missions, assignments
// ============================================================

import db, { addToHistory } from './database.js';

// ============ PERSONS (PERSONNEL) ============

export function setupPersonsRoutes(app, authenticateToken, requireAdmin) {

  // GET /api/persons — Liste tout le personnel (avec compétences)
  app.get('/api/persons', authenticateToken, (req, res) => {
    try {
      const persons = db.prepare('SELECT * FROM persons ORDER BY last_name, first_name').all();

      // Enrichir avec les compétences
      const skillsStmt = db.prepare(`
        SELECT ps.skill_id, ps.level, s.name, s.category
        FROM person_skills ps
        JOIN skills s ON s.id = ps.skill_id
        WHERE ps.person_id = ?
      `);

      const enriched = persons.map(p => ({
        ...p,
        skills: skillsStmt.all(p.id),
      }));

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/persons/:id — Détail d'une personne (compétences + dispos + affectations)
  app.get('/api/persons/:id', authenticateToken, (req, res) => {
    try {
      const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
      if (!person) return res.status(404).json({ error: 'Personne non trouvée' });

      person.skills = db.prepare(`
        SELECT ps.skill_id, ps.level, s.name, s.category
        FROM person_skills ps
        JOIN skills s ON s.id = ps.skill_id
        WHERE ps.person_id = ?
      `).all(person.id);

      person.availabilities = db.prepare(
        'SELECT * FROM availabilities WHERE person_id = ? ORDER BY start_date',
      ).all(person.id);

      person.assignments = db.prepare(`
        SELECT ma.*, m.title as mission_title, m.start_date as mission_start_date,
               m.end_date as mission_end_date, m.location_name as mission_location,
               m.status as mission_status
        FROM mission_assignments ma
        JOIN missions m ON m.id = ma.mission_id
        WHERE ma.person_id = ?
        ORDER BY m.start_date
      `).all(person.id);

      res.json(person);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/persons — Créer une personne
  app.post('/api/persons', authenticateToken, (req, res) => {
    try {
      const p = req.body;
      if (!p.first_name || !p.last_name) {
        return res.status(400).json({ error: 'first_name et last_name sont requis' });
      }

      const stmt = db.prepare(`
        INSERT INTO persons (first_name, last_name, email, phone, type, status,
          user_id, driver_id, license_types, certifications, contract_type, default_positions, notes, photo,
          created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        p.first_name, p.last_name, p.email || null, p.phone || null,
        p.type || 'permanent', p.status || 'active',
        p.user_id || null, p.driver_id || null,
        JSON.stringify(p.license_types || []),
        JSON.stringify(p.certifications || []),
        p.contract_type || null,
        p.default_positions || '[]',
        p.notes || null, p.photo || null,
        req.user.id, req.user.id,
      );

      // Ajouter les compétences si fournies
      if (p.skills && p.skills.length > 0) {
        const skillStmt = db.prepare(
          'INSERT OR IGNORE INTO person_skills (person_id, skill_id, level) VALUES (?, ?, ?)',
        );
        for (const skill of p.skills) {
          skillStmt.run(result.lastInsertRowid, skill.skill_id || skill.id, skill.level || 'intermédiaire');
        }
      }

      addToHistory('person', result.lastInsertRowid, 'created', p, req.user.id, req.user.name);

      // Renvoyer l'objet complet
      const created = db.prepare('SELECT * FROM persons WHERE id = ?').get(result.lastInsertRowid);
      created.skills = db.prepare(`
        SELECT ps.skill_id, ps.level, s.name, s.category
        FROM person_skills ps JOIN skills s ON s.id = ps.skill_id
        WHERE ps.person_id = ?
      `).all(created.id);

      res.json(created);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/persons/:id — Modifier une personne
  app.put('/api/persons/:id', authenticateToken, (req, res) => {
    try {
      const p = req.body;
      const existing = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Personne non trouvée' });

      const stmt = db.prepare(`
        UPDATE persons SET
          first_name = ?, last_name = ?, email = ?, phone = ?,
          type = ?, status = ?, user_id = ?, driver_id = ?,
          license_types = ?, certifications = ?, contract_type = ?,
          default_positions = ?,
          notes = ?, photo = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        p.first_name || existing.first_name,
        p.last_name || existing.last_name,
        p.email ?? existing.email,
        p.phone ?? existing.phone,
        p.type || existing.type,
        p.status || existing.status,
        p.user_id ?? existing.user_id,
        p.driver_id ?? existing.driver_id,
        p.license_types ? JSON.stringify(p.license_types) : existing.license_types,
        p.certifications ? JSON.stringify(p.certifications) : existing.certifications,
        p.contract_type ?? existing.contract_type,
        p.default_positions !== undefined ? p.default_positions : (existing.default_positions || '[]'),
        p.notes ?? existing.notes,
        p.photo ?? existing.photo,
        req.user.id,
        req.params.id,
      );

      // Mettre à jour les compétences si fournies
      if (p.skills !== undefined) {
        db.prepare('DELETE FROM person_skills WHERE person_id = ?').run(req.params.id);
        if (p.skills && p.skills.length > 0) {
          const skillStmt = db.prepare(
            'INSERT OR IGNORE INTO person_skills (person_id, skill_id, level) VALUES (?, ?, ?)',
          );
          for (const skill of p.skills) {
            skillStmt.run(req.params.id, skill.skill_id || skill.id, skill.level || 'intermédiaire');
          }
        }
      }

      addToHistory('person', req.params.id, 'updated', p, req.user.id, req.user.name);

      // Renvoyer l'objet complet
      const updated = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
      updated.skills = db.prepare(`
        SELECT ps.skill_id, ps.level, s.name, s.category
        FROM person_skills ps JOIN skills s ON s.id = ps.skill_id
        WHERE ps.person_id = ?
      `).all(updated.id);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/persons/:id — Supprimer une personne (admin)
  app.delete('/api/persons/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Personne non trouvée' });

      db.prepare('DELETE FROM persons WHERE id = ?').run(req.params.id);
      addToHistory('person', req.params.id, 'deleted', null, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ SKILLS (COMPÉTENCES) ============

export function setupSkillsRoutes(app, authenticateToken, requireAdmin) {

  // GET /api/skills — Liste toutes les compétences
  app.get('/api/skills', authenticateToken, (req, res) => {
    try {
      const skills = db.prepare('SELECT * FROM skills ORDER BY category, name').all();
      res.json(skills);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/skills — Créer une compétence (admin)
  app.post('/api/skills', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, category, description } = req.body;
      if (!name) return res.status(400).json({ error: 'name est requis' });

      const result = db.prepare(
        'INSERT INTO skills (name, category, description) VALUES (?, ?, ?)',
      ).run(name, category || 'autre', description || null);

      const created = db.prepare('SELECT * FROM skills WHERE id = ?').get(result.lastInsertRowid);
      res.json(created);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Cette compétence existe déjà' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/skills/:id — Modifier une compétence (admin)
  app.put('/api/skills/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, category, description } = req.body;

      db.prepare(`
        UPDATE skills SET name = ?, category = ?, description = ? WHERE id = ?
      `).run(name, category, description || null, req.params.id);

      const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Compétence non trouvée' });

      res.json(updated);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Ce nom de compétence existe déjà' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/skills/:id — Supprimer une compétence (admin)
  app.delete('/api/skills/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Compétence non trouvée' });

      db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ POSITIONS (POSTES) ============

  // GET /api/positions — Liste des postes
  app.get('/api/positions', authenticateToken, (req, res) => {
    try {
      const positions = db.prepare('SELECT * FROM positions ORDER BY category, name').all();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/positions — Créer un poste (admin)
  app.post('/api/positions', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, category, is_common } = req.body;
      if (!name) return res.status(400).json({ error: 'name est requis' });

      const result = db.prepare(
        'INSERT INTO positions (name, category, is_common) VALUES (?, ?, ?)'
      ).run(name, category || 'autre', is_common ? 1 : 0);

      const created = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
      res.json(created);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Ce poste existe déjà' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/positions/:id — Modifier un poste (admin)
  app.put('/api/positions/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, category, is_common } = req.body;

      db.prepare(`
        UPDATE positions SET name = ?, category = ?, is_common = ? WHERE id = ?
      `).run(name, category, is_common ? 1 : 0, req.params.id);

      const updated = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Poste non trouvé' });

      res.json(updated);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Ce nom de poste existe déjà' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/positions/:id — Supprimer un poste (admin)
  app.delete('/api/positions/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Poste non trouvé' });

      db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ AVAILABILITIES (DISPONIBILITÉS) ============

export function setupAvailabilitiesRoutes(app, authenticateToken) {

  // GET /api/availabilities — Toutes les dispos (filtre optionnel par person_id et plage)
  app.get('/api/availabilities', authenticateToken, (req, res) => {
    try {
      const { person_id, start_date, end_date } = req.query;
      let sql = 'SELECT a.*, p.first_name, p.last_name FROM availabilities a JOIN persons p ON p.id = a.person_id';
      const params = [];
      const conditions = [];

      if (person_id) {
        conditions.push('a.person_id = ?');
        params.push(person_id);
      }
      if (start_date && end_date) {
        // Chevauchement : dispo qui croise la plage demandée
        conditions.push('a.start_date <= ? AND a.end_date >= ?');
        params.push(end_date, start_date);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY a.start_date';

      const availabilities = db.prepare(sql).all(...params);
      res.json(availabilities);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/availabilities — Créer une dispo/indispo
  app.post('/api/availabilities', authenticateToken, (req, res) => {
    try {
      const a = req.body;
      if (!a.person_id || !a.start_date || !a.end_date) {
        return res.status(400).json({ error: 'person_id, start_date et end_date sont requis' });
      }

      // Vérifier que la personne existe
      const person = db.prepare('SELECT id FROM persons WHERE id = ?').get(a.person_id);
      if (!person) return res.status(404).json({ error: 'Personne non trouvée' });

      const result = db.prepare(`
        INSERT INTO availabilities (person_id, start_date, end_date, start_period, end_period,
          type, reason, source, is_recurring, recurrence_rule, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        a.person_id, a.start_date, a.end_date,
        a.start_period || 'AM', a.end_period || 'PM',
        a.type || 'unavailable', a.reason || null,
        a.source || 'admin', a.is_recurring ? 1 : 0,
        a.recurrence_rule ? JSON.stringify(a.recurrence_rule) : null,
        req.user.id,
      );

      const created = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(result.lastInsertRowid);
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/availabilities/:id — Modifier une dispo
  app.put('/api/availabilities/:id', authenticateToken, (req, res) => {
    try {
      const a = req.body;
      const existing = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Disponibilité non trouvée' });

      db.prepare(`
        UPDATE availabilities SET
          start_date = ?, end_date = ?, start_period = ?, end_period = ?,
          type = ?, reason = ?, source = ?,
          is_recurring = ?, recurrence_rule = ?
        WHERE id = ?
      `).run(
        a.start_date || existing.start_date,
        a.end_date || existing.end_date,
        a.start_period || existing.start_period,
        a.end_period || existing.end_period,
        a.type || existing.type,
        a.reason ?? existing.reason,
        a.source || existing.source,
        a.is_recurring !== undefined ? (a.is_recurring ? 1 : 0) : existing.is_recurring,
        a.recurrence_rule ? JSON.stringify(a.recurrence_rule) : existing.recurrence_rule,
        req.params.id,
      );

      const updated = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/availabilities/:id — Supprimer une dispo
  app.delete('/api/availabilities/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Disponibilité non trouvée' });

      db.prepare('DELETE FROM availabilities WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ MISSIONS ============

export function setupMissionsRoutes(app, authenticateToken, requireAdmin) {

  // GET /api/missions — Toutes les missions (filtre optionnel par plage de dates/statut)
  app.get('/api/missions', authenticateToken, (req, res) => {
    try {
      const { start_date, end_date, status, reservation_id } = req.query;
      let sql = 'SELECT * FROM missions';
      const params = [];
      const conditions = [];

      if (start_date && end_date) {
        conditions.push('start_date <= ? AND end_date >= ?');
        params.push(end_date, start_date);
      }
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      if (reservation_id) {
        conditions.push('reservation_id = ?');
        params.push(reservation_id);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY start_date, start_time';

      const missions = db.prepare(sql).all(...params);

      // Enrichir avec les affectations
      const assignStmt = db.prepare(`
        SELECT ma.*, p.first_name, p.last_name, p.phone, p.email, p.photo,
               p.type as person_type, p.contract_type, p.default_positions, p.status as person_status
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        WHERE ma.mission_id = ?
      `);

      const skillsStmt = db.prepare(`
        SELECT s.name FROM person_skills ps
        JOIN skills s ON s.id = ps.skill_id
        WHERE ps.person_id = ?
        ORDER BY s.name
      `);

      const enriched = missions.map(m => {
        const assignments = assignStmt.all(m.id).map(a => ({
          ...a,
          skills: skillsStmt.all(a.person_id).map(s => s.name),
        }));
        return { ...m, assignments };
      });

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/missions/:id — Détail d'une mission
  app.get('/api/missions/:id', authenticateToken, (req, res) => {
    try {
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
      if (!mission) return res.status(404).json({ error: 'Mission non trouvée' });

      mission.assignments = db.prepare(`
        SELECT ma.*, p.first_name, p.last_name, p.phone, p.type as person_type
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        WHERE ma.mission_id = ?
      `).all(mission.id);

      // Personnes disponibles pour cette mission (pas déjà affectées, actives, pas en indisponibilité)
      mission.available_persons = db.prepare(`
        SELECT p.*, 
          (SELECT COUNT(*) FROM mission_assignments ma2
           JOIN missions m2 ON m2.id = ma2.mission_id
           WHERE ma2.person_id = p.id
             AND ma2.status IN ('proposed', 'option', 'confirmed')
             AND m2.start_date <= ? AND m2.end_date >= ?
          ) as conflict_count
        FROM persons p
        WHERE p.status = 'active'
          AND p.id NOT IN (SELECT person_id FROM mission_assignments WHERE mission_id = ?)
        ORDER BY p.last_name, p.first_name
      `).all(mission.end_date, mission.start_date, mission.id);

      res.json(mission);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/missions — Créer une mission
  app.post('/api/missions', authenticateToken, (req, res) => {
    try {
      const m = req.body;
      if (!m.title || !m.start_date || !m.end_date) {
        return res.status(400).json({ error: 'title, start_date et end_date sont requis' });
      }

      // Vérifier la réservation liée si fournie
      if (m.reservation_id) {
        const reservation = db.prepare('SELECT id FROM reservations WHERE id = ?').get(m.reservation_id);
        if (!reservation) return res.status(400).json({ error: 'Réservation non trouvée' });
      }

      const result = db.prepare(`
        INSERT INTO missions (title, reservation_id, affaire, client_name, location_name,
          start_date, end_date, start_time, end_time, position,
          required_skills, vehicle_id, status, notes, day_states,
          created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        m.title, m.reservation_id || null,
        m.affaire || null,
        m.client_name || null, m.location_name || null,
        m.start_date, m.end_date,
        m.start_time || null, m.end_time || null,
        m.position || null, m.required_skills || m.required_skill_id || null,
        m.vehicle_id || null, m.status || 'draft',
        m.notes || null, m.day_states || null,
        req.user.id, req.user.id,
      );

      addToHistory('mission', result.lastInsertRowid, 'created', m, req.user.id, req.user.name);

      const created = db.prepare('SELECT * FROM missions WHERE id = ?').get(result.lastInsertRowid);
      created.assignments = [];
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/missions/:id — Modifier une mission
  app.put('/api/missions/:id', authenticateToken, (req, res) => {
    try {
      const m = req.body;
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Mission non trouvée' });

      db.prepare(`
        UPDATE missions SET
          title = ?, reservation_id = ?, affaire = ?, client_name = ?, location_name = ?,
          start_date = ?, end_date = ?, start_time = ?, end_time = ?,
          position = ?, required_skills = ?, vehicle_id = ?,
          status = ?, notes = ?, day_states = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        m.title || existing.title,
        m.reservation_id !== undefined ? m.reservation_id : existing.reservation_id,
        m.affaire !== undefined ? m.affaire : existing.affaire,
        m.client_name ?? existing.client_name,
        m.location_name ?? existing.location_name,
        m.start_date || existing.start_date,
        m.end_date || existing.end_date,
        m.start_time ?? existing.start_time,
        m.end_time ?? existing.end_time,
        m.position ?? existing.position,
        m.required_skills !== undefined ? m.required_skills : (m.required_skill_id !== undefined ? m.required_skill_id : existing.required_skills),
        m.vehicle_id !== undefined ? m.vehicle_id : existing.vehicle_id,
        m.status || existing.status,
        m.notes ?? existing.notes,
        m.day_states !== undefined ? m.day_states : existing.day_states,
        req.user.id,
        req.params.id,
      );

      addToHistory('mission', req.params.id, 'updated', m, req.user.id, req.user.name);

      const updated = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
      updated.assignments = db.prepare(`
        SELECT ma.*, p.first_name, p.last_name
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        WHERE ma.mission_id = ?
      `).all(updated.id);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/missions/:id — Supprimer une mission (admin)
  app.delete('/api/missions/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Mission non trouvée' });

      db.prepare('DELETE FROM missions WHERE id = ?').run(req.params.id);
      addToHistory('mission', req.params.id, 'deleted', null, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ ASSIGNMENTS (AFFECTATIONS) ============

export function setupAssignmentsRoutes(app, authenticateToken) {

  // GET /api/assignments — Toutes les affectations (filtre optionnel)
  app.get('/api/assignments', authenticateToken, (req, res) => {
    try {
      const { person_id, mission_id, status } = req.query;
      let sql = `
        SELECT ma.*,
          p.first_name, p.last_name, p.phone, p.type as person_type,
          m.title as mission_title, m.start_date as mission_start_date,
          m.end_date as mission_end_date, m.location_name as mission_location,
          m.status as mission_status, m.position as mission_position
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        JOIN missions m ON m.id = ma.mission_id
      `;
      const params = [];
      const conditions = [];

      if (person_id) {
        conditions.push('ma.person_id = ?');
        params.push(person_id);
      }
      if (mission_id) {
        conditions.push('ma.mission_id = ?');
        params.push(mission_id);
      }
      if (status) {
        conditions.push('ma.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY m.start_date, p.last_name';

      const assignments = db.prepare(sql).all(...params);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/assignments — Créer une affectation
  app.post('/api/assignments', authenticateToken, (req, res) => {
    try {
      const a = req.body;
      if (!a.mission_id || !a.person_id) {
        return res.status(400).json({ error: 'mission_id et person_id sont requis' });
      }

      // Vérifier que la mission existe
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(a.mission_id);
      if (!mission) return res.status(404).json({ error: 'Mission non trouvée' });

      // Vérifier que la personne existe et est active
      const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(a.person_id);
      if (!person) return res.status(404).json({ error: 'Personne non trouvée' });
      if (person.status !== 'active') {
        return res.status(400).json({ error: 'Cette personne est inactive' });
      }

      // Vérifier les conflits de planning (autre affectation confirmée en même temps)
      const conflicts = db.prepare(`
        SELECT ma.id, m.title, m.start_date, m.end_date
        FROM mission_assignments ma
        JOIN missions m ON m.id = ma.mission_id
        WHERE ma.person_id = ?
          AND ma.status IN ('confirmed', 'option')
          AND m.start_date <= ? AND m.end_date >= ?
      `).all(a.person_id, mission.end_date, mission.start_date);

      // Vérifier les indisponibilités
      const unavailabilities = db.prepare(`
        SELECT id, start_date, end_date, reason
        FROM availabilities
        WHERE person_id = ? AND type = 'unavailable'
          AND start_date <= ? AND end_date >= ?
      `).all(a.person_id, mission.end_date, mission.start_date);

      const result = db.prepare(`
        INSERT INTO mission_assignments (mission_id, person_id, status, position, comment,
          created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        a.mission_id, a.person_id,
        a.status || 'proposed',
        a.position || mission.position || null,
        a.comment || null,
        req.user.id, req.user.id,
      );

      addToHistory('assignment', result.lastInsertRowid, 'created', a, req.user.id, req.user.name);

      const created = db.prepare(`
        SELECT ma.*, p.first_name, p.last_name, p.phone, p.type as person_type
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        WHERE ma.id = ?
      `).get(result.lastInsertRowid);

      // Inclure les warnings (conflits / indispos) dans la réponse
      res.json({
        ...created,
        warnings: {
          conflicts: conflicts.length > 0 ? conflicts : null,
          unavailabilities: unavailabilities.length > 0 ? unavailabilities : null,
        },
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Cette personne est déjà affectée à cette mission' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/assignments/:id — Modifier une affectation (statut, commentaire)
  app.put('/api/assignments/:id', authenticateToken, (req, res) => {
    try {
      const a = req.body;
      const existing = db.prepare('SELECT * FROM mission_assignments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Affectation non trouvée' });

      // Si statut change vers confirmed/refused, enregistrer responded_at
      const respondedAt = ['confirmed', 'refused'].includes(a.status) && existing.status !== a.status
        ? new Date().toISOString()
        : existing.responded_at;

      db.prepare(`
        UPDATE mission_assignments SET
          person_id = ?, status = ?, position = ?, comment = ?,
          responded_at = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        a.person_id || existing.person_id,
        a.status || existing.status,
        a.position ?? existing.position,
        a.comment ?? existing.comment,
        respondedAt,
        req.user.id,
        req.params.id,
      );

      addToHistory('assignment', req.params.id, 'updated', {
        old_status: existing.status,
        new_status: a.status || existing.status,
        ...a,
      }, req.user.id, req.user.name);

      // Si toutes les affectations de la mission sont confirmées, passer la mission en 'staffed'
      if (a.status === 'confirmed') {
        const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(existing.mission_id);
        if (mission && mission.status === 'open') {
          const pending = db.prepare(`
            SELECT COUNT(*) as c FROM mission_assignments
            WHERE mission_id = ? AND status NOT IN ('confirmed', 'refused', 'cancelled')
          `).get(existing.mission_id);
          if (pending.c === 0) {
            db.prepare("UPDATE missions SET status = 'staffed', modified_at = CURRENT_TIMESTAMP WHERE id = ?")
              .run(existing.mission_id);
          }
        }
      }

      const updated = db.prepare(`
        SELECT ma.*, p.first_name, p.last_name, p.phone, p.type as person_type
        FROM mission_assignments ma
        JOIN persons p ON p.id = ma.person_id
        WHERE ma.id = ?
      `).get(req.params.id);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/assignments/:id — Supprimer une affectation
  app.delete('/api/assignments/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM mission_assignments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Affectation non trouvée' });

      db.prepare('DELETE FROM mission_assignments WHERE id = ?').run(req.params.id);
      addToHistory('assignment', req.params.id, 'deleted', null, req.user.id, req.user.name);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/personnel/planning — Planning global du personnel (vue calendrier)
  app.get('/api/personnel/planning', authenticateToken, (req, res) => {
    try {
      const { start_date, end_date, person_id, skill_id } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date et end_date sont requis' });
      }

      // Récupérer les missions + affectations dans la plage
      let missionsSql = `
        SELECT m.*,
          (SELECT GROUP_CONCAT(
            json_object(
              'id', ma.id, 'person_id', ma.person_id,
              'first_name', p.first_name, 'last_name', p.last_name,
              'status', ma.status, 'position', ma.position
            )
          ) FROM mission_assignments ma
          JOIN persons p ON p.id = ma.person_id
          WHERE ma.mission_id = m.id) as assignments_json
        FROM missions m
        WHERE m.start_date <= ? AND m.end_date >= ?
      `;
      const mParams = [end_date, start_date];

      if (person_id) {
        missionsSql += ` AND m.id IN (SELECT mission_id FROM mission_assignments WHERE person_id = ?)`;
        mParams.push(person_id);
      }
      if (skill_id) {
        missionsSql += ` AND (m.required_skills LIKE ? OR m.required_skill_id = ?)`;
        mParams.push(`%${skill_id}%`, skill_id);
      }
      missionsSql += ' ORDER BY m.start_date, m.start_time';

      const missions = db.prepare(missionsSql).all(...mParams);

      // Parser le JSON d'affectations
      const parsedMissions = missions.map(m => ({
        ...m,
        assignments: m.assignments_json
          ? m.assignments_json.split(',{').map((s, i) => {
              try { return JSON.parse(i > 0 ? '{' + s : s); } catch { return null; }
            }).filter(Boolean)
          : [],
      }));
      // Supprimer le champ temporaire
      parsedMissions.forEach(m => delete m.assignments_json);

      // Récupérer les indisponibilités dans la plage
      let availSql = `
        SELECT a.*, p.first_name, p.last_name
        FROM availabilities a
        JOIN persons p ON p.id = a.person_id
        WHERE a.start_date <= ? AND a.end_date >= ?
      `;
      const aParams = [end_date, start_date];

      if (person_id) {
        availSql += ' AND a.person_id = ?';
        aParams.push(person_id);
      }

      const availabilities = db.prepare(availSql).all(...aParams);

      res.json({
        missions: parsedMissions,
        availabilities,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
