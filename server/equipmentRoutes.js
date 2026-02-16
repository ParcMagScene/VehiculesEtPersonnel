// ============================================================
// MODULE PARC MATÉRIEL + SAV — eM@g
// Routes REST : equipment, categories, assignments, SAV tickets
// ============================================================

import db, { addToHistory } from './database.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ============ CATÉGORIES ============

export function setupEquipmentCategoriesRoutes(app, authenticateToken, requireAdmin) {
  
  // GET /api/equipment-categories
  app.get('/api/equipment-categories', authenticateToken, (req, res) => {
    try {
      const categories = db.prepare('SELECT * FROM equipment_categories ORDER BY level, name').all();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/equipment-categories/tree — hiérarchie complète
  app.get('/api/equipment-categories/tree', authenticateToken, (req, res) => {
    try {
      const all = db.prepare('SELECT * FROM equipment_categories ORDER BY name').all();
      const families = all.filter(c => c.level === 'family');
      const subfamilies = all.filter(c => c.level === 'subfamily');
      const categories = all.filter(c => c.level === 'category');
      
      const tree = families.map(f => ({
        ...f,
        children: subfamilies.filter(sf => sf.parent_id === f.id).map(sf => ({
          ...sf,
          children: categories.filter(cat => cat.parent_id === sf.id)
        }))
      }));
      res.json(tree);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/equipment-categories (admin)
  app.post('/api/equipment-categories', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, icon, color, description, parent_id, level } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom requis' });
      
      const result = db.prepare(
        'INSERT INTO equipment_categories (name, icon, color, description, parent_id, level) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(name, icon || '📦', color || '#6366f1', description || null, parent_id || null, level || 'category');
      
      res.json({ id: result.lastInsertRowid, name, icon, color, description, parent_id, level });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/equipment-categories/:id (admin)
  app.put('/api/equipment-categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, icon, color, description, parent_id, level } = req.body;
      db.prepare(
        'UPDATE equipment_categories SET name = ?, icon = ?, color = ?, description = ?, parent_id = ?, level = ? WHERE id = ?'
      ).run(name, icon, color, description, parent_id || null, level || 'category', req.params.id);
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
      
      // Enrichir avec le dernier assignment actif — requête unique au lieu de N+1
      const activeAssignments = db.prepare(`
        SELECT ea.*, p.first_name, p.last_name
        FROM equipment_assignments ea
        LEFT JOIN persons p ON ea.assigned_to = p.id
        WHERE ea.status = 'active'
        ORDER BY ea.start_date DESC
      `).all();
      
      const assignMap = {};
      for (const a of activeAssignments) {
        if (!assignMap[a.equipment_id]) assignMap[a.equipment_id] = a;
      }
      
      for (const eq of equipment) {
        eq.currentAssignment = assignMap[eq.id] || null;
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
      const { name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, brand, stock_quantity } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom requis' });
      
      const result = db.prepare(`
        INSERT INTO equipment (name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, brand, stock_quantity, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, reference, serial_number, category_id, status || 'available', location, purchase_date, purchase_price, warranty_end, notes, photo, brand, stock_quantity || 1, req.user.id);
      
      // Générer l'UID unique basé sur l'ID
      const uid = 'EMAG-' + String(result.lastInsertRowid).padStart(5, '0');
      db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(uid, result.lastInsertRowid);
      
      addToHistory('equipment', result.lastInsertRowid, 'create', { name, reference, serial_number }, req.user.id, req.user.name);
      
      const created = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/equipment/:id
  app.put('/api/equipment/:id', authenticateToken, (req, res) => {
    try {
      const { name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, brand, stock_quantity } = req.body;
      
      db.prepare(`
        UPDATE equipment SET name = ?, reference = ?, serial_number = ?, category_id = ?, status = ?, location = ?, purchase_date = ?, purchase_price = ?, warranty_end = ?, notes = ?, photo = ?, brand = ?, stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, reference, serial_number, category_id, status, location, purchase_date, purchase_price, warranty_end, notes, photo, brand, stock_quantity, req.params.id);
      
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

  // POST /api/equipment/import-csv — Import CSV Locmat
  app.post('/api/equipment/import-csv', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { data, mode } = req.body;
      // data = tableau d'objets [{code_libre, nom, famille, sous_famille, categorie, zone, stock, marque, numero_serie}, ...]
      // mode = 'preview' | 'import'
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'Données CSV vides' });
      }

      // Récupérer les catégories existantes
      const existingCats = db.prepare('SELECT * FROM equipment_categories').all();
      
      // Collecter les familles, sous-familles, catégories uniques du CSV
      const familiesSet = new Map();
      const subfamiliesSet = new Map();
      const categoriesSet = new Map();
      
      for (const row of data) {
        if (row.famille && row.famille.trim()) {
          familiesSet.set(row.famille.trim().toUpperCase(), row.famille.trim());
        }
        if (row.sous_famille && row.sous_famille.trim()) {
          const key = `${(row.famille || '').trim().toUpperCase()}||${row.sous_famille.trim()}`;
          subfamiliesSet.set(key, { name: row.sous_famille.trim(), family: (row.famille || '').trim() });
        }
        if (row.categorie && row.categorie.trim()) {
          const key = `${(row.famille || '').trim().toUpperCase()}||${(row.sous_famille || '').trim()}||${row.categorie.trim()}`;
          categoriesSet.set(key, { name: row.categorie.trim(), family: (row.famille || '').trim(), subfamily: (row.sous_famille || '').trim() });
        }
      }

      // Icons par famille
      const FAMILY_ICONS = {
        'SONORISATION': '🔊', 'ECLAIRAGE': '💡', 'STRUCTURE': '🏗️', 'AUDIOVISUEL': '🎥',
        'DISTRIBUTION ELECTRIQUE': '⚡', 'BACKLINE': '🎸', 'INFORMATIQUE': '💻',
        'RIDEAU-MACHINERIE': '🎭',
      };
      const FAMILY_COLORS = {
        'SONORISATION': '#3b82f6', 'ECLAIRAGE': '#f59e0b', 'STRUCTURE': '#ef4444', 'AUDIOVISUEL': '#8b5cf6',
        'DISTRIBUTION ELECTRIQUE': '#f97316', 'BACKLINE': '#10b981', 'INFORMATIQUE': '#06b6d4',
        'RIDEAU-MACHINERIE': '#ec4899',
      };
      
      if (mode === 'preview') {
        // Mode aperçu : retourner les stats sans rien insérer
        return res.json({
          totalRows: data.length,
          families: [...familiesSet.values()],
          subfamilies: [...subfamiliesSet.values()].map(v => v.name),
          categories: [...categoriesSet.values()].map(v => v.name),
          existingEquipmentCount: db.prepare('SELECT COUNT(*) as c FROM equipment').get().c,
          sample: data.slice(0, 10),
        });
      }

      // Mode import réel
      const insertFamily = db.prepare('INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, NULL)');
      const insertSubfamily = db.prepare('INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, ?)');
      const insertCategory = db.prepare('INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, ?)');
      const findCat = db.prepare('SELECT id FROM equipment_categories WHERE name = ? AND level = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))');
      const insertEquip = db.prepare(`
        INSERT INTO equipment (name, reference, serial_number, category_id, brand, stock_quantity, location, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?)
      `);

      let created = 0, skipped = 0, familiesCreated = 0, subfamiliesCreated = 0, categoriesCreated = 0;

      const importAll = db.transaction(() => {
        // Phase 1 : Créer les familles
        const familyIdMap = {};
        for (const [key, name] of familiesSet) {
          let existing = findCat.get(name, 'family', null, null);
          if (!existing) {
            // Vérifier aussi par nom case-insensitive
            existing = db.prepare('SELECT id FROM equipment_categories WHERE UPPER(name) = ? AND level = ?').get(key, 'family');
          }
          if (existing) {
            familyIdMap[key] = existing.id;
          } else {
            const icon = FAMILY_ICONS[key] || '📦';
            const color = FAMILY_COLORS[key] || '#6366f1';
            const result = insertFamily.run(name, icon, color, 'family');
            familyIdMap[key] = result.lastInsertRowid;
            familiesCreated++;
          }
        }

        // Phase 2 : Créer les sous-familles
        const subfamilyIdMap = {};
        for (const [key, { name, family }] of subfamiliesSet) {
          const familyKey = family.toUpperCase();
          const parentId = familyIdMap[familyKey] || null;
          let existing = findCat.get(name, 'subfamily', parentId, parentId);
          if (existing) {
            subfamilyIdMap[key] = existing.id;
          } else {
            const result = insertSubfamily.run(name, '📁', '#64748b', 'subfamily', parentId);
            subfamilyIdMap[key] = result.lastInsertRowid;
            subfamiliesCreated++;
          }
        }

        // Phase 3 : Créer les catégories
        const categoryIdMap = {};
        for (const [key, { name, family, subfamily }] of categoriesSet) {
          const sfKey = `${family.toUpperCase()}||${subfamily}`;
          const parentId = subfamilyIdMap[sfKey] || null;
          let existing = findCat.get(name, 'category', parentId, parentId);
          if (existing) {
            categoryIdMap[key] = existing.id;
          } else {
            const result = insertCategory.run(name, '📦', '#94a3b8', 'category', parentId);
            categoryIdMap[key] = result.lastInsertRowid;
            categoriesCreated++;
          }
        }

        // Phase 4 : Insérer les équipements
        for (const row of data) {
          const nom = (row.nom || '').trim();
          if (!nom) { skipped++; continue; }

          // Trouver la catégorie
          const catKey = `${(row.famille || '').trim().toUpperCase()}||${(row.sous_famille || '').trim()}||${(row.categorie || '').trim()}`;
          const categoryId = categoryIdMap[catKey] || null;

          const reference = (row.code_libre || '').trim() || null;
          const serialNumber = (row.numero_serie || '').trim() || null;
          const brand = (row.marque || '').trim() || null;
          const stock = parseInt(row.stock) || 1;
          const zone = (row.zone || '').trim() || null;

          insertEquip.run(nom, reference, serialNumber, categoryId, brand, stock, zone, req.user.id);
          created++;
        }
      });

      importAll();

      addToHistory('equipment', null, 'import_csv', { created, skipped, familiesCreated, subfamiliesCreated, categoriesCreated }, req.user.id, req.user.name);
      
      res.json({
        success: true,
        created,
        skipped,
        familiesCreated,
        subfamiliesCreated,
        categoriesCreated,
        message: `Import terminé : ${created} équipement(s) créé(s), ${skipped} ignoré(s), ${familiesCreated} famille(s), ${subfamiliesCreated} sous-famille(s), ${categoriesCreated} catégorie(s) créée(s)`,
      });
    } catch (error) {
      console.error('Erreur import CSV:', error);
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

export function setupSavTicketsRoutes(app, authenticateToken, requireAdmin, requireEquipmentMaintenanceAccess) {

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

  // GET /api/sav-tickets/report — Rapport maintenance matériel (journalier/hebdo/mensuel)
  // Query params: start (YYYY-MM-DD), end (YYYY-MM-DD), type ('entries'|'exits'|'all')
  app.get('/api/sav-tickets/report', authenticateToken, (req, res) => {
    try {
      const { start, end, type } = req.query;
      if (!start || !end) return res.status(400).json({ error: 'Paramètres start et end requis' });

      let sql = `
        SELECT st.id, st.title, st.description, st.cost, st.status, st.type as ticket_type,
               st.created_at, st.resolved_at, st.updated_at,
               e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number,
               u.name as reported_by_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN users u ON st.reported_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (type === 'entries') {
        sql += ' AND DATE(st.created_at) >= ? AND DATE(st.created_at) <= ?';
        params.push(start, end);
      } else if (type === 'exits') {
        sql += ' AND st.resolved_at IS NOT NULL AND DATE(st.resolved_at) >= ? AND DATE(st.resolved_at) <= ?';
        params.push(start, end);
      } else {
        // 'all' : entrées OU sorties dans la période
        sql += ' AND (DATE(st.created_at) BETWEEN ? AND ? OR (st.resolved_at IS NOT NULL AND DATE(st.resolved_at) BETWEEN ? AND ?))';
        params.push(start, end, start, end);
      }
      sql += ' ORDER BY st.created_at DESC';

      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper : recalcule le statut d'un équipement en fonction de ses tickets SAV et assignments
  const refreshEquipmentStatus = (equipmentId) => {
    if (!equipmentId) return;
    const activeTickets = db.prepare(
      "SELECT COUNT(*) as c FROM sav_tickets WHERE equipment_id = ? AND status IN ('open', 'in_progress', 'waiting_parts')"
    ).get(equipmentId);
    if (activeTickets.c > 0) {
      db.prepare("UPDATE equipment SET status = 'maintenance', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(equipmentId);
    } else {
      const hasAssignment = db.prepare(
        "SELECT COUNT(*) as c FROM equipment_assignments WHERE equipment_id = ? AND status = 'active'"
      ).get(equipmentId);
      const newStatus = hasAssignment.c > 0 ? 'in_use' : 'available';
      db.prepare('UPDATE equipment SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, equipmentId);
    }
  };

  // POST /api/sav-tickets
  app.post('/api/sav-tickets', authenticateToken, requireEquipmentMaintenanceAccess, (req, res) => {
    try {
      const { equipment_id, assigned_to, type, priority, title, description } = req.body;
      if (!equipment_id || !title) return res.status(400).json({ error: 'Équipement et titre requis' });
      
      const result = db.prepare(`
        INSERT INTO sav_tickets (equipment_id, reported_by, assigned_to, type, priority, status, title, description)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
      `).run(equipment_id, req.user.id, assigned_to, type || 'panne', priority || 'medium', title, description);
      
      // Mettre l'équipement en maintenance
      refreshEquipmentStatus(equipment_id);
      
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/sav-tickets/:id
  app.put('/api/sav-tickets/:id', authenticateToken, requireEquipmentMaintenanceAccess, (req, res) => {
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
      
      // Recalculer le statut de l'équipement (maintenance ↔ available/in_use)
      refreshEquipmentStatus(oldTicket.equipment_id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/sav-tickets/:id
  app.delete('/api/sav-tickets/:id', authenticateToken, requireEquipmentMaintenanceAccess, (req, res) => {
    try {
      const ticket = db.prepare('SELECT equipment_id FROM sav_tickets WHERE id = ?').get(req.params.id);
      db.prepare('DELETE FROM sav_tickets WHERE id = ?').run(req.params.id);
      // Recalculer le statut de l'équipement après suppression
      if (ticket) refreshEquipmentStatus(ticket.equipment_id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sav-tickets/import-csv — Import CSV Interventions Locmat
  app.post('/api/sav-tickets/import-csv', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { data, mode, manualLinks } = req.body;
      // data = [{intervention, code_article, nom_article, numero_de_serie, debut, fin, cout, a}, ...]
      // manualLinks = { rowIndex: equipmentId, ... } — liens manuels optionnels
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'Données CSV vides' });
      }

      // Helper pour parser les dates au format "dd/MM/yyyy AM|PM"
      const parseDate = (str) => {
        if (!str || !str.trim()) return null;
        const match = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
        return null;
      };

      // Mapper le statut CSV → SAV
      const mapStatus = (csvStatus) => {
        if (!csvStatus) return 'open';
        const s = csvStatus.trim().toLowerCase();
        if (s.includes('termin')) return 'closed';
        if (s.includes('en cours')) return 'in_progress';
        return 'open';
      };

      // Parser le coût (format européen)
      const parseCost = (str) => {
        if (!str || !str.trim()) return 0;
        const val = parseFloat(str.trim().replace(',', '.').replace(/[^0-9.]/g, ''));
        return isNaN(val) ? 0 : val;
      };

      // Nettoyer un N° série pour matching souple
      const cleanSerial = (s) => {
        if (!s) return '';
        return s.trim()
          .replace(/\s*-\s*[A-Z]\d+$/i, '') // retirer suffixes comme "- V12"
          .replace(/^\*/, '')                 // retirer * en début
          .replace(/\s+/g, '')               // retirer espaces
          .toUpperCase();
      };

      // Préparer les index de lookup
      const allEquipment = db.prepare('SELECT id, reference, name, serial_number FROM equipment').all();
      
      // Index exact par reference
      const equipByRef = {};
      for (const eq of allEquipment) {
        if (eq.reference) equipByRef[eq.reference.trim().toUpperCase()] = eq;
      }
      
      // Index par serial nettoyé (peut avoir plusieurs équipements)
      const equipBySerial = {};
      for (const eq of allEquipment) {
        if (eq.serial_number) {
          const clean = cleanSerial(eq.serial_number);
          if (clean) {
            if (!equipBySerial[clean]) equipBySerial[clean] = [];
            equipBySerial[clean].push(eq);
          }
        }
      }

      // Matching intelligent : code_article → reference, puis serial nettoyé
      const findEquipment = (row, rowIndex) => {
        // 1. Lien manuel prioritaire
        if (manualLinks && manualLinks[rowIndex] !== undefined) {
          return manualLinks[rowIndex]; // peut être null si explicitement "aucun"
        }
        
        // 2. Match par code article (reference)
        const code = (row.code_article || '').trim().toUpperCase();
        if (code && equipByRef[code]) {
          // Si on a aussi un serial, vérifier qu'il y en a un qui matche
          const csvSerial = cleanSerial(row.numero_de_serie);
          if (csvSerial) {
            // Chercher parmi les équipements avec cette reference celui qui a le bon serial
            const candidates = allEquipment.filter(e => 
              e.reference && e.reference.trim().toUpperCase() === code && 
              cleanSerial(e.serial_number) === csvSerial
            );
            if (candidates.length > 0) return candidates[0].id;
          }
          // Sinon retourner le premier avec ce code
          return equipByRef[code].id;
        }
        
        // 3. Match par N° série nettoyé
        const csvSerial = cleanSerial(row.numero_de_serie);
        if (csvSerial && equipBySerial[csvSerial]) {
          return equipBySerial[csvSerial][0].id;
        }
        
        return null;
      };

      // Analyser les données
      let matched = 0, unmatched = 0;
      const unmatchedItems = [];
      const processed = data.map((row, idx) => {
        const equipmentId = findEquipment(row, idx);

        if (equipmentId) {
          matched++;
        } else {
          unmatched++;
          unmatchedItems.push({
            index: idx,
            intervention: row.intervention,
            code: row.code_article,
            nom: row.nom_article,
            serial: row.numero_de_serie,
            debut: row.debut,
            fin: row.fin,
            cout: row.cout,
            statut: row.a,
          });
        }

        return {
          ...row,
          _equipmentId: equipmentId,
          _status: mapStatus(row.a),
          _cost: parseCost(row.cout),
          _startDate: parseDate(row.debut),
          _endDate: parseDate(row.fin),
        };
      });

      if (mode === 'preview') {
        const statusCounts = {};
        for (const row of processed) {
          statusCounts[row._status] = (statusCounts[row._status] || 0) + 1;
        }
        const totalCost = processed.reduce((sum, r) => sum + r._cost, 0);

        // Retourner aussi la liste complète des équipements pour le sélecteur de lien manuel
        const equipmentList = allEquipment.map(e => ({ id: e.id, name: e.name, reference: e.reference, serial_number: e.serial_number }));

        return res.json({
          totalRows: data.length,
          matched,
          unmatched,
          unmatchedItems, // liste complète pour UI
          statusCounts,
          totalCost,
          existingTickets: db.prepare('SELECT COUNT(*) as c FROM sav_tickets').get().c,
          equipmentList,
          sample: processed.slice(0, 10).map(r => ({
            intervention: r.intervention,
            code_article: r.code_article,
            nom_article: r.nom_article,
            serial: r.numero_de_serie,
            status: r._status,
            cost: r._cost,
            startDate: r._startDate,
            endDate: r._endDate,
            matched: !!r._equipmentId,
          })),
        });
      }

      // Mode import réel — importer TOUT (liées et non liées)
      const insertTicket = db.prepare(`
        INSERT INTO sav_tickets (equipment_id, type, priority, status, title, description, cost, import_code, import_serial, import_name, created_at, resolved_at, updated_at)
        VALUES (?, 'reparation', 'medium', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      let created = 0, createdLinked = 0, createdUnlinked = 0;

      const importAll = db.transaction(() => {
        for (const row of processed) {
          const title = `${(row.intervention || '').trim()} — ${(row.nom_article || '').trim()}`;
          const description = [
            row.code_article ? `Code article: ${row.code_article}` : '',
            row.numero_de_serie ? `N° série: ${row.numero_de_serie}` : '',
          ].filter(Boolean).join('\n') || null;

          const resolvedAt = row._endDate || null;

          insertTicket.run(
            row._equipmentId || null,
            row._status,
            title,
            description,
            row._cost != null ? row._cost : null,
            (row.code_article || '').trim() || null,
            (row.numero_de_serie || '').trim() || null,
            (row.nom_article || '').trim() || null,
            row._startDate || row._endDate || new Date().toISOString().split('T')[0],
            resolvedAt
          );
          created++;
          if (row._equipmentId) createdLinked++; else createdUnlinked++;
        }
      });

      importAll();

      // Mettre en maintenance les équipements qui ont des tickets actifs
      const activeEquipIds = [...new Set(
        processed.filter(r => r._equipmentId && r._status !== 'closed' && r._status !== 'resolved')
                 .map(r => r._equipmentId)
      )];
      for (const eqId of activeEquipIds) {
        refreshEquipmentStatus(eqId);
      }

      addToHistory('sav_tickets', null, 'import_csv', { created, createdLinked, createdUnlinked, total: data.length }, req.user.id, req.user.name);

      res.json({
        success: true,
        created,
        createdLinked,
        createdUnlinked,
        total: data.length,
        message: `Import terminé : ${createdLinked} intervention(s) liée(s), ${createdUnlinked} non liée(s) à traiter`,
      });
    } catch (error) {
      console.error('Erreur import CSV interventions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/sav-tickets/unlinked — Tickets SAV importés non liés à un équipement
  app.get('/api/sav-tickets/unlinked', authenticateToken, (req, res) => {
    try {
      const tickets = db.prepare(`
        SELECT id, title, description, status, cost, import_code, import_serial, import_name, created_at, resolved_at
        FROM sav_tickets WHERE equipment_id IS NULL
        ORDER BY created_at DESC
      `).all();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/sav-tickets/:id/link — Lier manuellement un ticket à un équipement
  app.put('/api/sav-tickets/:id/link', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { equipment_id } = req.body;
      if (!equipment_id) return res.status(400).json({ error: 'equipment_id requis' });
      
      const ticket = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
      
      db.prepare('UPDATE sav_tickets SET equipment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(equipment_id, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ═══ LISTES FAVORIS / SURVEILLANCE ═══
export function setupEquipmentListsRoutes(app, authenticateToken) {

  // GET /api/equipment-lists — Listes de l'utilisateur courant
  app.get('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const lists = db.prepare(`
        SELECT el.*, e.name as equipment_name, e.reference, e.uid, e.serial_number, e.brand, e.status,
               ec.name as category_name, ec.icon as category_icon, ec.color as category_color
        FROM equipment_lists el
        JOIN equipment e ON el.equipment_id = e.id
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        WHERE el.user_id = ?
        ORDER BY el.list_type, el.created_at DESC
      `).all(req.user.id);
      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/equipment-lists — Ajouter à une liste
  app.post('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const { equipment_id, list_type } = req.body;
      if (!equipment_id || !list_type) return res.status(400).json({ error: 'equipment_id et list_type requis' });
      if (!['favorite', 'watch'].includes(list_type)) return res.status(400).json({ error: 'list_type doit être favorite ou watch' });
      
      db.prepare('INSERT OR IGNORE INTO equipment_lists (equipment_id, user_id, list_type) VALUES (?, ?, ?)').run(equipment_id, req.user.id, list_type);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/equipment-lists — Retirer d'une liste
  app.delete('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const { equipment_id, list_type } = req.body;
      if (!equipment_id || !list_type) return res.status(400).json({ error: 'equipment_id et list_type requis' });
      
      db.prepare('DELETE FROM equipment_lists WHERE equipment_id = ? AND user_id = ? AND list_type = ?').run(equipment_id, req.user.id, list_type);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/equipment/by-uid/:uid — Lookup par UID (pour QR codes)
  app.get('/api/equipment/by-uid/:uid', authenticateToken, (req, res) => {
    try {
      const eq = db.prepare(`
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        WHERE e.uid = ?
      `).get(req.params.uid);
      
      if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
      
      eq.assignments = db.prepare(`
        SELECT ea.*, p.first_name, p.last_name
        FROM equipment_assignments ea LEFT JOIN persons p ON ea.assigned_to = p.id
        WHERE ea.equipment_id = ? ORDER BY ea.start_date DESC
      `).all(eq.id);
      
      eq.savTickets = db.prepare(`
        SELECT st.*, u.name as reported_by_name, p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st LEFT JOIN users u ON st.reported_by = u.id LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE st.equipment_id = ? ORDER BY st.created_at DESC
      `).all(eq.id);
      
      res.json(eq);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/equipment-photos — Liste des photos/logos disponibles
  app.get('/api/equipment-photos', authenticateToken, (req, res) => {
    try {
      const photosDir = join(process.cwd(), '..', 'public', 'Photos', 'Matériel');
      const logosDir = join(process.cwd(), '..', 'public', 'Logos');
      
      let photos = [];
      let logos = [];
      
      try {
        photos = readdirSync(photosDir).filter(f => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f));
      } catch (e) { /* dossier inexistant */ }
      
      try {
        logos = readdirSync(logosDir).filter(f => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f));
      } catch (e) { /* dossier inexistant */ }
      
      res.json({ photos, logos });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
