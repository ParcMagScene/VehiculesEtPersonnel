// ============================================================
// MODULE PARC MATÉRIEL + SAV — eM@g
// Routes REST : equipment, categories, assignments, SAV tickets
// ============================================================

import db, { addToHistory } from './database.js';

// ============ CATÉGORIES ============

export function setupEquipmentCategoriesRoutes(app, authenticateToken, requireAdmin) {
  
  // GET /api/equipment-categories
  app.get('/api/equipment-categories', authenticateToken, (req, res) => {
    try {
      const categories = db.prepare('SELECT * FROM equipment_categories ORDER BY name').all();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/equipment-categories (admin)
  app.post('/api/equipment-categories', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, icon, color, description } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom requis' });
      
      const result = db.prepare(
        'INSERT INTO equipment_categories (name, icon, color, description) VALUES (?, ?, ?, ?)'
      ).run(name, icon || '📦', color || '#6366f1', description || null);
      
      res.json({ id: result.lastInsertRowid, name, icon, color, description });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/equipment-categories/:id (admin)
  app.put('/api/equipment-categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, icon, color, description } = req.body;
      db.prepare(
        'UPDATE equipment_categories SET name = ?, icon = ?, color = ?, description = ? WHERE id = ?'
      ).run(name, icon, color, description, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/equipment-categories/:id (admin)
  app.delete('/api/equipment-categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérifier qu'aucun équipement n'utilise cette catégorie
      const count = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE category_id = ?').get(req.params.id);
      if (count.c > 0) {
        return res.status(400).json({ error: `${count.c} équipement(s) utilisent cette catégorie` });
      }
      db.prepare('DELETE FROM equipment_categories WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ ÉQUIPEMENTS ============

export function setupEquipmentRoutes(app, authenticateToken, requireAdmin) {

  // GET /api/equipment
  app.get('/api/equipment', authenticateToken, (req, res) => {
    try {
      const { status, category_id, search } = req.query;
      let sql = `
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color,
               u.name as created_by_name
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE 1=1
      `;
      const params = [];
      
      if (status) { sql += ' AND e.status = ?'; params.push(status); }
      if (category_id) { sql += ' AND e.category_id = ?'; params.push(category_id); }
      if (search) {
        sql += ' AND (e.name LIKE ? OR e.reference LIKE ? OR e.serial_number LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      
      sql += ' ORDER BY e.name';
      const equipment = db.prepare(sql).all(...params);
      
      // Enrichir avec le dernier assignment actif
      const assignStmt = db.prepare(`
        SELECT ea.*, p.first_name, p.last_name
        FROM equipment_assignments ea
        LEFT JOIN persons p ON ea.assigned_to = p.id
        WHERE ea.equipment_id = ? AND ea.status = 'active'
        ORDER BY ea.start_date DESC LIMIT 1
      `);
      
      for (const eq of equipment) {
        const assignment = assignStmt.get(eq.id);
        eq.currentAssignment = assignment || null;
      }
      
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/equipment/:id
  app.get('/api/equipment/:id', authenticateToken, (req, res) => {
    try {
      const eq = db.prepare(`
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        WHERE e.id = ?
      `).get(req.params.id);
      
      if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
      
      // Historique des assignments
      eq.assignments = db.prepare(`
        SELECT ea.*, p.first_name, p.last_name, u.name as assigned_by_name
        FROM equipment_assignments ea
        LEFT JOIN persons p ON ea.assigned_to = p.id
        LEFT JOIN users u ON ea.assigned_by = u.id
        WHERE ea.equipment_id = ?
        ORDER BY ea.start_date DESC
      `).all(req.params.id);
      
      // Tickets SAV
      eq.savTickets = db.prepare(`
        SELECT st.*, u.name as reported_by_name, p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st
        LEFT JOIN users u ON st.reported_by = u.id
        LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE st.equipment_id = ?
        ORDER BY st.created_at DESC
      `).all(req.params.id);
      
      res.json(eq);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/equipment
  app.post('/api/equipment', authenticateToken, (req, res) => {
    try {
      const { name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom requis' });
      
      const result = db.prepare(`
        INSERT INTO equipment (name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, reference, serial_number, category_id, status || 'available', location, purchase_date, purchase_price, warranty_end, notes, photo, req.user.id);
      
      addToHistory('equipment', result.lastInsertRowid, 'create', { name, reference, serial_number }, req.user.id, req.user.name);
      
      res.json({ id: result.lastInsertRowid, ...req.body });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/equipment/:id
  app.put('/api/equipment/:id', authenticateToken, (req, res) => {
    try {
      const { name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo } = req.body;
      
      db.prepare(`
        UPDATE equipment SET name = ?, reference = ?, serial_number = ?, category_id = ?, status = ?, location = ?, purchase_date = ?, purchase_price = ?, warranty_end = ?, notes = ?, photo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, req.params.id);
      
      addToHistory('equipment', req.params.id, 'update', req.body, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/equipment/:id (admin)
  app.delete('/api/equipment/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Supprimer les assignments et tickets associés
      db.prepare('DELETE FROM equipment_assignments WHERE equipment_id = ?').run(req.params.id);
      db.prepare('DELETE FROM sav_tickets WHERE equipment_id = ?').run(req.params.id);
      db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
      
      addToHistory('equipment', req.params.id, 'delete', {}, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ ASSIGNMENTS ============

export function setupEquipmentAssignmentsRoutes(app, authenticateToken) {

  // GET /api/equipment-assignments
  app.get('/api/equipment-assignments', authenticateToken, (req, res) => {
    try {
      const { equipment_id, person_id, status } = req.query;
      let sql = `
        SELECT ea.*, e.name as equipment_name, e.reference, 
               p.first_name, p.last_name, u.name as assigned_by_name
        FROM equipment_assignments ea
        LEFT JOIN equipment e ON ea.equipment_id = e.id
        LEFT JOIN persons p ON ea.assigned_to = p.id
        LEFT JOIN users u ON ea.assigned_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (equipment_id) { sql += ' AND ea.equipment_id = ?'; params.push(equipment_id); }
      if (person_id) { sql += ' AND ea.assigned_to = ?'; params.push(person_id); }
      if (status) { sql += ' AND ea.status = ?'; params.push(status); }
      sql += ' ORDER BY ea.start_date DESC';
      
      res.json(db.prepare(sql).all(...params));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/equipment-assignments
  app.post('/api/equipment-assignments', authenticateToken, (req, res) => {
    try {
      const { equipment_id, assigned_to, start_date, end_date, affaire_id, notes } = req.body;
      if (!equipment_id || !start_date) return res.status(400).json({ error: 'Équipement et date de début requis' });
      
      const result = db.prepare(`
        INSERT INTO equipment_assignments (equipment_id, assigned_to, assigned_by, start_date, end_date, affaire_id, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(equipment_id, assigned_to, req.user.id, start_date, end_date, affaire_id, notes);
      
      // Mettre à jour le statut de l'équipement
      db.prepare("UPDATE equipment SET status = 'in_use', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(equipment_id);
      
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/equipment-assignments/:id/return
  app.put('/api/equipment-assignments/:id/return', authenticateToken, (req, res) => {
    try {
      const assignment = db.prepare('SELECT * FROM equipment_assignments WHERE id = ?').get(req.params.id);
      if (!assignment) return res.status(404).json({ error: 'Assignation non trouvée' });
      
      const returnDate = new Date().toISOString().slice(0, 10);
      db.prepare("UPDATE equipment_assignments SET status = 'returned', end_date = ? WHERE id = ?").run(returnDate, req.params.id);
      
      // Vérifier s'il y a d'autres assignments actifs
      const otherActive = db.prepare("SELECT COUNT(*) as c FROM equipment_assignments WHERE equipment_id = ? AND status = 'active' AND id != ?").get(assignment.equipment_id, req.params.id);
      if (otherActive.c === 0) {
        db.prepare("UPDATE equipment SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(assignment.equipment_id);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ TICKETS SAV ============

export function setupSavTicketsRoutes(app, authenticateToken) {

  // GET /api/sav-tickets
  app.get('/api/sav-tickets', authenticateToken, (req, res) => {
    try {
      const { equipment_id, status, priority } = req.query;
      let sql = `
        SELECT st.*, e.name as equipment_name, e.reference as equipment_reference,
               ec.icon as category_icon, ec.color as category_color,
               u.name as reported_by_name,
               p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        LEFT JOIN users u ON st.reported_by = u.id
        LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE 1=1
      `;
      const params = [];
      if (equipment_id) { sql += ' AND st.equipment_id = ?'; params.push(equipment_id); }
      if (status) { sql += ' AND st.status = ?'; params.push(status); }
      if (priority) { sql += ' AND st.priority = ?'; params.push(priority); }
      sql += ' ORDER BY st.created_at DESC';
      
      res.json(db.prepare(sql).all(...params));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/sav-tickets/stats
  app.get('/api/sav-tickets/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        open: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'open'").get().c,
        in_progress: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'in_progress'").get().c,
        waiting_parts: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'waiting_parts'").get().c,
        resolved: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'resolved'").get().c,
        closed: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'closed'").get().c,
        total_cost: db.prepare("SELECT COALESCE(SUM(cost), 0) as total FROM sav_tickets WHERE cost IS NOT NULL").get().total,
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sav-tickets
  app.post('/api/sav-tickets', authenticateToken, (req, res) => {
    try {
      const { equipment_id, assigned_to, type, priority, title, description } = req.body;
      if (!equipment_id || !title) return res.status(400).json({ error: 'Équipement et titre requis' });
      
      const result = db.prepare(`
        INSERT INTO sav_tickets (equipment_id, reported_by, assigned_to, type, priority, status, title, description)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
      `).run(equipment_id, req.user.id, assigned_to, type || 'panne', priority || 'medium', title, description);
      
      // Si c'est une panne, mettre l'équipement en maintenance
      if (type === 'panne') {
        db.prepare("UPDATE equipment SET status = 'maintenance', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(equipment_id);
      }
      
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/sav-tickets/:id
  app.put('/api/sav-tickets/:id', authenticateToken, (req, res) => {
    try {
      const { assigned_to, type, priority, status, title, description, resolution, cost } = req.body;
      
      const oldTicket = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
      if (!oldTicket) return res.status(404).json({ error: 'Ticket non trouvé' });
      
      const resolvedAt = (status === 'resolved' || status === 'closed') && oldTicket.status !== 'resolved' && oldTicket.status !== 'closed'
        ? new Date().toISOString()
        : oldTicket.resolved_at;
      
      db.prepare(`
        UPDATE sav_tickets SET assigned_to = ?, type = ?, priority = ?, status = ?, title = ?, description = ?, resolution = ?, cost = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(assigned_to, type, priority, status, title, description, resolution, cost, resolvedAt, req.params.id);
      
      // Si résolu/fermé et que c'était une panne, remettre l'équipement disponible
      if ((status === 'resolved' || status === 'closed') && oldTicket.type === 'panne') {
        const otherOpen = db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE equipment_id = ? AND status IN ('open', 'in_progress', 'waiting_parts') AND id != ?").get(oldTicket.equipment_id, req.params.id);
        if (otherOpen.c === 0) {
          // Vérifier s'il y a un assignment actif
          const hasAssignment = db.prepare("SELECT COUNT(*) as c FROM equipment_assignments WHERE equipment_id = ? AND status = 'active'").get(oldTicket.equipment_id);
          const newStatus = hasAssignment.c > 0 ? 'in_use' : 'available';
          db.prepare('UPDATE equipment SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, oldTicket.equipment_id);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/sav-tickets/:id
  app.delete('/api/sav-tickets/:id', authenticateToken, (req, res) => {
    try {
      db.prepare('DELETE FROM sav_tickets WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
