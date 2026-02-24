import db, { addToHistory } from './database.js';

// ═══════════════════════════════════════════════════════════════
// Catégories Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockCategoriesRoutes(app, authenticateToken, requireAdmin) {
  // Liste des catégories
  app.get('/api/stock/categories', authenticateToken, (req, res) => {
    try {
      const categories = db.prepare(`
        SELECT sc.*, 
          (SELECT COUNT(*) FROM stock_items WHERE category_id = sc.id) as item_count,
          pc.name as parent_name
        FROM stock_categories sc
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        ORDER BY sc.name ASC
      `).all();
      res.json(categories);
    } catch (error) {
      console.error('Erreur liste catégories stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Créer une catégorie
  app.post('/api/stock/categories', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, description, parent_id, color, icon } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

      const result = db.prepare(
        'INSERT INTO stock_categories (name, description, parent_id, color, icon) VALUES (?, ?, ?, ?, ?)'
      ).run(name, description || null, parent_id || null, color || '#6366f1', icon || '📦');

      const category = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(category);
    } catch (error) {
      console.error('Erreur création catégorie stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Modifier une catégorie
  app.put('/api/stock/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, description, parent_id, color, icon } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

      db.prepare(
        'UPDATE stock_categories SET name = ?, description = ?, parent_id = ?, color = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name, description || null, parent_id || null, color || '#6366f1', icon || '📦', req.params.id);

      const category = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
      if (!category) return res.status(404).json({ error: 'Catégorie non trouvée' });
      res.json(category);
    } catch (error) {
      console.error('Erreur modification catégorie stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une catégorie
  app.delete('/api/stock/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const itemCount = db.prepare('SELECT COUNT(*) as count FROM stock_items WHERE category_id = ?').get(req.params.id);
      if (itemCount.count > 0) {
        return res.status(400).json({ error: `Impossible de supprimer : ${itemCount.count} article(s) dans cette catégorie` });
      }
      const childCount = db.prepare('SELECT COUNT(*) as count FROM stock_categories WHERE parent_id = ?').get(req.params.id);
      if (childCount.count > 0) {
        return res.status(400).json({ error: `Impossible de supprimer : ${childCount.count} sous-catégorie(s) liée(s)` });
      }
      db.prepare('DELETE FROM stock_categories WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Erreur suppression catégorie stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Articles Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockItemsRoutes(app, authenticateToken, requireAdmin) {
  // Liste des articles avec filtres
  app.get('/api/stock/items', authenticateToken, (req, res) => {
    try {
      const { search, category_id, low_stock, active_only, supplier_id } = req.query;
      let query = `
        SELECT si.*, 
          sc.name as category_name, sc.color as category_color, sc.icon as category_icon,
          s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (si.name LIKE ? OR si.reference LIKE ? OR si.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (category_id) {
        query += ' AND si.category_id = ?';
        params.push(category_id);
      }
      if (low_stock === 'true') {
        query += ' AND si.quantity <= si.min_quantity AND si.min_quantity > 0';
      }
      if (active_only !== 'false') {
        query += ' AND si.is_active = 1';
      }
      if (supplier_id) {
        query += ' AND si.supplier_id = ?';
        params.push(supplier_id);
      }

      query += ' ORDER BY si.name ASC';
      const items = db.prepare(query).all(...params);
      res.json(items);
    } catch (error) {
      console.error('Erreur liste articles stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Détail d'un article
  app.get('/api/stock/items/:id', authenticateToken, (req, res) => {
    try {
      const item = db.prepare(`
        SELECT si.*, 
          sc.name as category_name, sc.color as category_color,
          s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `).get(req.params.id);
      if (!item) return res.status(404).json({ error: 'Article non trouvé' });
      res.json(item);
    } catch (error) {
      console.error('Erreur détail article stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Créer un article
  app.post('/api/stock/items', authenticateToken, (req, res) => {
    try {
      const { reference, name, description, category_id, unit, unit_price, sell_price, quantity, min_quantity, location, supplier_id, notes, photo } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

      // Auto-generate reference if not provided
      let ref = reference;
      if (!ref) {
        const last = db.prepare("SELECT reference FROM stock_items WHERE reference LIKE 'STK-%' ORDER BY id DESC LIMIT 1").get();
        const num = last ? parseInt(last.reference.replace('STK-', ''), 10) + 1 : 1;
        ref = `STK-${String(num).padStart(5, '0')}`;
      }

      const result = db.prepare(`
        INSERT INTO stock_items (reference, name, description, category_id, unit, unit_price, sell_price, quantity, min_quantity, location, supplier_id, notes, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ref, name, description || null, category_id || null,
        unit || 'u', unit_price || 0, sell_price || 0,
        quantity || 0, min_quantity || 0, location || null,
        supplier_id || null, notes || null, photo || null
      );

      // Log initial movement if quantity > 0
      if (quantity > 0) {
        db.prepare(`
          INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
          VALUES (?, 'in', ?, 0, ?, 'Stock initial', ?, ?)
        `).run(result.lastInsertRowid, quantity, quantity, req.user.id, req.user.name);
      }

      addToHistory('stock_item', result.lastInsertRowid, 'create', { name, reference: ref, quantity }, req.user.id, req.user.name);

      const item = db.prepare(`
        SELECT si.*, sc.name as category_name, sc.color as category_color, s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `).get(result.lastInsertRowid);

      res.status(201).json(item);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'Cette référence existe déjà' });
      }
      console.error('Erreur création article stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Modifier un article
  app.put('/api/stock/items/:id', authenticateToken, (req, res) => {
    try {
      const { reference, name, description, category_id, unit, unit_price, sell_price, quantity, min_quantity, location, supplier_id, notes, photo, is_active } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

      const existing = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Article non trouvé' });

      // If quantity changed, create a movement record
      const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
      if (newQty !== existing.quantity) {
        const diff = newQty - existing.quantity;
        db.prepare(`
          INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
          VALUES (?, ?, ?, ?, ?, 'Ajustement manuel', ?, ?)
        `).run(
          req.params.id,
          diff > 0 ? 'in' : 'adjustment',
          Math.abs(diff),
          existing.quantity,
          newQty,
          req.user.id,
          req.user.name
        );
      }

      db.prepare(`
        UPDATE stock_items SET reference = ?, name = ?, description = ?, category_id = ?, unit = ?, 
          unit_price = ?, sell_price = ?, quantity = ?, min_quantity = ?, location = ?, 
          supplier_id = ?, notes = ?, photo = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(
        reference || existing.reference, name, description || null, category_id || null,
        unit || 'u', unit_price || 0, sell_price || 0,
        newQty, min_quantity ?? existing.min_quantity, location || null,
        supplier_id || null, notes || null, photo || existing.photo,
        is_active !== undefined ? is_active : 1,
        req.params.id
      );

      addToHistory('stock_item', req.params.id, 'update', { name, quantity: newQty }, req.user.id, req.user.name);

      const item = db.prepare(`
        SELECT si.*, sc.name as category_name, sc.color as category_color, s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `).get(req.params.id);
      res.json(item);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'Cette référence existe déjà' });
      }
      console.error('Erreur modification article stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un article
  app.delete('/api/stock/items/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ error: 'Article non trouvé' });

      addToHistory('stock_item', req.params.id, 'delete', { name: item.name, reference: item.reference }, req.user.id, req.user.name);
      db.prepare('DELETE FROM stock_items WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Erreur suppression article stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Mouvements de Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockMovementsRoutes(app, authenticateToken) {
  // Créer un mouvement (entrée, sortie, ajustement, retour)
  app.post('/api/stock/movements', authenticateToken, (req, res) => {
    try {
      const { stock_item_id, type, quantity, reason, reference, linked_entity_type, linked_entity_id } = req.body;
      if (!stock_item_id || !type || !quantity) {
        return res.status(400).json({ error: 'Article, type et quantité sont requis' });
      }
      if (!['in', 'out', 'adjustment', 'return'].includes(type)) {
        return res.status(400).json({ error: 'Type invalide (in, out, adjustment, return)' });
      }

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(stock_item_id);
      if (!item) return res.status(404).json({ error: 'Article non trouvé' });

      const qty = Math.abs(Number(quantity));
      let newQuantity;

      if (type === 'in' || type === 'return') {
        newQuantity = item.quantity + qty;
      } else if (type === 'out') {
        if (qty > item.quantity) {
          return res.status(400).json({ error: `Stock insuffisant (disponible: ${item.quantity})` });
        }
        newQuantity = item.quantity - qty;
      } else {
        // adjustment — quantity est la nouvelle valeur absolue
        newQuantity = qty;
      }

      const movResult = db.prepare(`
        INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, reference, linked_entity_type, linked_entity_id, user_id, user_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stock_item_id, type, qty, item.quantity, newQuantity,
        reason || null, reference || null,
        linked_entity_type || null, linked_entity_id || null,
        req.user.id, req.user.name
      );

      // Update item quantity
      db.prepare('UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, stock_item_id);

      const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(movResult.lastInsertRowid);
      res.status(201).json({ ...movement, item_name: item.name, item_reference: item.reference });
    } catch (error) {
      console.error('Erreur mouvement stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Historique des mouvements
  app.get('/api/stock/movements', authenticateToken, (req, res) => {
    try {
      const { stock_item_id, type, limit = 100, offset = 0, date_from, date_to } = req.query;
      let query = `
        SELECT sm.*, si.name as item_name, si.reference as item_reference, si.unit as item_unit
        FROM stock_movements sm
        JOIN stock_items si ON sm.stock_item_id = si.id
        WHERE 1=1
      `;
      const params = [];

      if (stock_item_id) {
        query += ' AND sm.stock_item_id = ?';
        params.push(stock_item_id);
      }
      if (type) {
        query += ' AND sm.type = ?';
        params.push(type);
      }
      if (date_from) {
        query += ' AND sm.created_at >= ?';
        params.push(date_from);
      }
      if (date_to) {
        query += ' AND sm.created_at <= ?';
        params.push(date_to + ' 23:59:59');
      }

      query += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const movements = db.prepare(query).all(...params);
      const total = db.prepare(`
        SELECT COUNT(*) as count FROM stock_movements sm WHERE 1=1
        ${stock_item_id ? 'AND sm.stock_item_id = ?' : ''}
        ${type ? 'AND sm.type = ?' : ''}
      `).get(...params.slice(0, (stock_item_id ? 1 : 0) + (type ? 1 : 0)));

      res.json({ movements, total: total.count });
    } catch (error) {
      console.error('Erreur historique mouvements stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Statistiques Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockStatsRoutes(app, authenticateToken) {
  app.get('/api/stock/stats', authenticateToken, (req, res) => {
    try {
      const totalItems = db.prepare('SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1').get().count;
      const totalValue = db.prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) as value FROM stock_items WHERE is_active = 1').get().value;
      const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1 AND quantity <= min_quantity AND min_quantity > 0').get().count;
      const outOfStockCount = db.prepare('SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1 AND quantity = 0').get().count;
      const categoryCount = db.prepare('SELECT COUNT(*) as count FROM stock_categories').get().count;

      const recentMovements = db.prepare(`
        SELECT sm.type, COUNT(*) as count, SUM(sm.quantity) as total_qty
        FROM stock_movements sm
        WHERE sm.created_at >= date('now', '-30 days')
        GROUP BY sm.type
      `).all();

      const topMovedItems = db.prepare(`
        SELECT si.id, si.name, si.reference, COUNT(sm.id) as movement_count
        FROM stock_movements sm
        JOIN stock_items si ON sm.stock_item_id = si.id
        WHERE sm.created_at >= date('now', '-30 days')
        GROUP BY si.id
        ORDER BY movement_count DESC
        LIMIT 5
      `).all();

      const lowStockItems = db.prepare(`
        SELECT si.id, si.name, si.reference, si.quantity, si.min_quantity, si.unit,
          sc.name as category_name, sc.color as category_color
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        WHERE si.is_active = 1 AND si.quantity <= si.min_quantity AND si.min_quantity > 0
        ORDER BY (si.quantity * 1.0 / si.min_quantity) ASC
        LIMIT 10
      `).all();

      res.json({
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
        categoryCount,
        recentMovements,
        topMovedItems,
        lowStockItems
      });
    } catch (error) {
      console.error('Erreur stats stock:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}
