import db, { addToHistory } from './database.js';
import logger from './logger.js';
import { stockImportSchema, validate } from './schemas/imports.js';

// ═══════════════════════════════════════════════════════════════
// Catégories Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockCategoriesRoutes(app, authenticateToken, requireAdmin) {
  // Liste des catégories
  app.get('/api/stock/categories', authenticateToken, (req, res) => {
    try {
      const categories = db
        .prepare(
          `
        SELECT sc.*, 
          (SELECT COUNT(*) FROM stock_items WHERE category_id = sc.id) as item_count,
          pc.name as parent_name
        FROM stock_categories sc
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        ORDER BY sc.name ASC
      `,
        )
        .all();
      res.json(categories);
    } catch (error) {
      logger.error('Erreur liste catégories stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer une catégorie
  app.post('/api/stock/categories', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, description, parent_id, color, icon } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      const result = db
        .prepare(
          'INSERT INTO stock_categories (name, description, parent_id, color, icon) VALUES (?, ?, ?, ?, ?)',
        )
        .run(name, description || null, parent_id || null, color || '#6366f1', icon || '📦');

      const category = db
        .prepare('SELECT * FROM stock_categories WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(category);
    } catch (error) {
      logger.error('Erreur création catégorie stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier une catégorie
  app.put('/api/stock/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, description, parent_id, color, icon } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      db.prepare(
        'UPDATE stock_categories SET name = ?, description = ?, parent_id = ?, color = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(
        name,
        description || null,
        parent_id || null,
        color || '#6366f1',
        icon || '📦',
        req.params.id,
      );

      const category = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
      if (!category)
        return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
      res.json(category);
    } catch (error) {
      logger.error('Erreur modification catégorie stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une catégorie
  app.delete('/api/stock/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const itemCount = db
        .prepare('SELECT COUNT(*) as count FROM stock_items WHERE category_id = ?')
        .get(req.params.id);
      if (itemCount.count > 0) {
        return res.status(400).json({
          success: false,
          error: `Impossible de supprimer : ${itemCount.count} article(s) dans cette catégorie`,
        });
      }
      const childCount = db
        .prepare('SELECT COUNT(*) as count FROM stock_categories WHERE parent_id = ?')
        .get(req.params.id);
      if (childCount.count > 0) {
        return res.status(400).json({
          success: false,
          error: `Impossible de supprimer : ${childCount.count} sous-catégorie(s) liée(s)`,
        });
      }
      db.prepare('DELETE FROM stock_categories WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur suppression catégorie stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
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
      const { search, category_id, low_stock, active_only, supplier_id, stock_type } = req.query;
      let query = `
        SELECT si.*, 
          COALESCE(sc.name, pc.name) as category_name,
          COALESCE(sc.color, pc.color) as category_color,
          COALESCE(sc.icon, pc.icon) as category_icon,
          s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE 1=1
      `;
      const params = [];

      if (stock_type) {
        query += ' AND si.stock_type = ?';
        params.push(stock_type);
      }
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
      logger.error('Erreur liste articles stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Détail d'un article
  app.get('/api/stock/items/:id', authenticateToken, (req, res) => {
    try {
      const item = db
        .prepare(
          `
        SELECT si.*, 
          COALESCE(sc.name, pc.name) as category_name, COALESCE(sc.color, pc.color) as category_color,
          s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `,
        )
        .get(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'Article non trouvé' });
      res.json(item);
    } catch (error) {
      logger.error('Erreur détail article stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer un article
  app.post('/api/stock/items', authenticateToken, requireAdmin, (req, res) => {
    try {
      const {
        reference,
        name,
        description,
        category_id,
        unit,
        unit_price,
        sell_price,
        quantity,
        min_quantity,
        location,
        supplier_id,
        notes,
        photo,
        stock_type,
        location_depot,
        location_zone,
        location_floor,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      // Auto-generate reference if not provided
      const prefix = stock_type === 'sav' ? 'SAV' : 'STK';
      let ref = reference;
      if (!ref) {
        const last = db
          .prepare(
            'SELECT reference FROM stock_items WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1',
          )
          .get(`${prefix}-%`);
        const num = last ? parseInt(last.reference.replace(`${prefix}-`, ''), 10) + 1 : 1;
        ref = `${prefix}-${String(num).padStart(5, '0')}`;
      }

      const result = db
        .prepare(
          `
        INSERT INTO stock_items (reference, name, description, category_id, unit, unit_price, sell_price, quantity, min_quantity, location, supplier_id, notes, photo, stock_type, location_depot, location_zone, location_floor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          ref,
          name,
          description || null,
          category_id || null,
          unit || 'u',
          unit_price || 0,
          sell_price || 0,
          quantity || 0,
          min_quantity || 0,
          location || null,
          supplier_id || null,
          notes || null,
          photo || null,
          stock_type || 'vente',
          location_depot || '',
          location_zone || '',
          location_floor || '',
        );

      // Log initial movement if quantity > 0
      if (quantity > 0) {
        db.prepare(
          `
          INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
          VALUES (?, 'in', ?, 0, ?, 'Stock initial', ?, ?)
        `,
        ).run(result.lastInsertRowid, quantity, quantity, req.user.id, req.user.name);
      }

      addToHistory(
        'stock_item',
        result.lastInsertRowid,
        'create',
        { name, reference: ref, quantity },
        req.user.id,
        req.user.name,
      );

      const item = db
        .prepare(
          `
        SELECT si.*, COALESCE(sc.name, pc.name) as category_name, COALESCE(sc.color, pc.color) as category_color, s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `,
        )
        .get(result.lastInsertRowid);

      res.status(201).json(item);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ success: false, error: 'Cette référence existe déjà' });
      }
      logger.error('Erreur création article stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier un article
  app.put('/api/stock/items/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const {
        reference,
        name,
        description,
        category_id,
        unit,
        unit_price,
        sell_price,
        quantity,
        min_quantity,
        location,
        supplier_id,
        notes,
        photo,
        is_active,
        stock_type,
        location_depot,
        location_zone,
        location_floor,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });

      const existing = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Article non trouvé' });

      // If quantity changed, create a movement record
      const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
      if (newQty !== existing.quantity) {
        const diff = newQty - existing.quantity;
        db.prepare(
          `
          INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
          VALUES (?, ?, ?, ?, ?, 'Ajustement manuel', ?, ?)
        `,
        ).run(
          req.params.id,
          diff > 0 ? 'in' : 'adjustment',
          Math.abs(diff),
          existing.quantity,
          newQty,
          req.user.id,
          req.user.name,
        );
      }

      db.prepare(
        `
        UPDATE stock_items SET reference = ?, name = ?, description = ?, category_id = ?, unit = ?, 
          unit_price = ?, sell_price = ?, quantity = ?, min_quantity = ?, location = ?, 
          supplier_id = ?, notes = ?, photo = ?, is_active = ?, 
          stock_type = ?, location_depot = ?, location_zone = ?, location_floor = ?,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      ).run(
        reference || existing.reference,
        name,
        description || null,
        category_id || null,
        unit || 'u',
        unit_price || 0,
        sell_price || 0,
        newQty,
        min_quantity ?? existing.min_quantity,
        location || null,
        supplier_id || null,
        notes || null,
        photo || existing.photo,
        is_active !== undefined ? is_active : 1,
        stock_type || existing.stock_type || 'vente',
        location_depot !== undefined ? location_depot || '' : existing.location_depot || '',
        location_zone !== undefined ? location_zone || '' : existing.location_zone || '',
        location_floor !== undefined ? location_floor || '' : existing.location_floor || '',
        req.params.id,
      );

      addToHistory(
        'stock_item',
        req.params.id,
        'update',
        { name, quantity: newQty },
        req.user.id,
        req.user.name,
      );

      const item = db
        .prepare(
          `
        SELECT si.*, COALESCE(sc.name, pc.name) as category_name, COALESCE(sc.color, pc.color) as category_color, s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ?
      `,
        )
        .get(req.params.id);
      res.json(item);
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(400).json({ success: false, error: 'Cette référence existe déjà' });
      }
      logger.error('Erreur modification article stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un article
  app.delete('/api/stock/items/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'Article non trouvé' });

      addToHistory(
        'stock_item',
        req.params.id,
        'delete',
        { name: item.name, reference: item.reference },
        req.user.id,
        req.user.name,
      );
      db.prepare('DELETE FROM stock_items WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur suppression article stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Mouvements de Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockMovementsRoutes(app, authenticateToken, requireAdmin) {
  // Créer un mouvement (entrée, sortie, ajustement, retour)
  app.post('/api/stock/movements', authenticateToken, requireAdmin, (req, res) => {
    try {
      const {
        stock_item_id,
        type,
        quantity,
        reason,
        reference,
        linked_entity_type,
        linked_entity_id,
      } = req.body;
      if (!stock_item_id || !type || !quantity) {
        return res
          .status(400)
          .json({ success: false, error: 'Article, type et quantité sont requis' });
      }
      if (!['in', 'out', 'adjustment', 'return'].includes(type)) {
        return res
          .status(400)
          .json({ success: false, error: 'Type invalide (in, out, adjustment, return)' });
      }

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(stock_item_id);
      if (!item) return res.status(404).json({ success: false, error: 'Article non trouvé' });

      const qty = Math.abs(Number(quantity));
      let newQuantity;

      if (type === 'in' || type === 'return') {
        newQuantity = item.quantity + qty;
      } else if (type === 'out') {
        if (qty > item.quantity) {
          return res
            .status(400)
            .json({ success: false, error: `Stock insuffisant (disponible: ${item.quantity})` });
        }
        newQuantity = item.quantity - qty;
      } else {
        // adjustment — quantity est la nouvelle valeur absolue
        newQuantity = qty;
      }

      const movResult = db
        .prepare(
          `
        INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, reference, linked_entity_type, linked_entity_id, user_id, user_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          stock_item_id,
          type,
          qty,
          item.quantity,
          newQuantity,
          reason || null,
          reference || null,
          linked_entity_type || null,
          linked_entity_id || null,
          req.user.id,
          req.user.name,
        );

      // Update item quantity
      db.prepare(
        'UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(newQuantity, stock_item_id);

      const movement = db
        .prepare('SELECT * FROM stock_movements WHERE id = ?')
        .get(movResult.lastInsertRowid);
      res.status(201).json({ ...movement, item_name: item.name, item_reference: item.reference });
    } catch (error) {
      logger.error('Erreur mouvement stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
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
      const total = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM stock_movements sm WHERE 1=1
        ${stock_item_id ? 'AND sm.stock_item_id = ?' : ''}
        ${type ? 'AND sm.type = ?' : ''}
      `,
        )
        .get(...params.slice(0, (stock_item_id ? 1 : 0) + (type ? 1 : 0)));

      res.json({ movements, total: total.count });
    } catch (error) {
      logger.error('Erreur historique mouvements stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Import Stock (CSV / inventaire)
// ═══════════════════════════════════════════════════════════════

// Mapping des catégories inventaire PDF → stock_categories (nom exact ou partiel)
const INVENTORY_CATEGORY_MAP = {
  son: 'Sonorisation',
  sonorisation: 'Sonorisation',
  câbles: 'Câbles & Connectique',
  cables: 'Câbles & Connectique',
  connecteurs: 'Câbles & Connectique',
  dicjonteur: 'Distribution Électrique',
  disjoncteur: 'Distribution Électrique',
  elec: 'Distribution Électrique',
  electrique: 'Distribution Électrique',
  lampes: 'Éclairage',
  éclairage: 'Éclairage',
  eclairage: 'Éclairage',
  filtres: 'Éclairage',
  structure: 'Structure',
  gaffer: 'Consommables',
  'gaffer & adhésifs': 'Consommables',
  adhésifs: 'Consommables',
  mousse: 'Consommables',
  'mousse & protection': 'Consommables',
  batteries: 'Consommables',
  piles: 'Consommables',
  'consommables divers': 'Consommables',
  consommables: 'Consommables',
  électronique: 'Électronique',
  electronique: 'Électronique',
  mécanique: 'Outillage & EPI',
  mecanique: 'Outillage & EPI',
  outillage: 'Outillage & EPI',
  epi: 'Outillage & EPI',
  audiovisuel: 'Audiovisuel',
  vidéo: 'Audiovisuel',
  backline: 'Backline',
  rideau: 'Rideau-Machinerie',
  machinerie: 'Rideau-Machinerie',
  rideaux: 'Rideau-Machinerie',
  informatique: 'Informatique',
  accroche: 'Accroche',
  élingues: 'Accroche',
  elingues: 'Accroche',
  motorisation: 'Motorisation',
  moteurs: 'Motorisation',
  mobilier: 'Mobilier',
  'sans catégorie': 'Divers',
  'sans categorie': 'Divers',
  divers: 'Divers',
};

// Sub-category mapping (more precise)
const INVENTORY_SUBCATEGORY_MAP = {
  son: 'Accessoires son',
  câbles: 'Câbles audio',
  cables: 'Câbles audio',
  connecteurs: 'Connecteurs',
  dicjonteur: 'Disjoncteurs',
  disjoncteur: 'Disjoncteurs',
  elec: 'Fiches & Prises',
  lampes: 'Lampes',
  filtres: 'Filtres & Gélatines',
  structure: 'Pièces structure',
  'gaffer & adhésifs': 'Gaffer & Adhésifs',
  gaffer: 'Gaffer & Adhésifs',
  'mousse & protection': 'Mousse & Protection',
  mousse: 'Mousse & Protection',
  batteries: 'Piles & Batteries',
  piles: 'Piles & Batteries',
  'consommables divers': 'Consommables divers',
  consommables: 'Consommables divers',
  électronique: 'Pièces détachées',
  electronique: 'Pièces détachées',
  mécanique: 'Pièces mécaniques',
  mecanique: 'Pièces mécaniques',
  epi: 'Équipements de protection',
  rideau: 'Rideaux',
  machinerie: 'Machinerie',
  rideaux: 'Rideaux',
  accroche: 'Élingues & Accessoires',
  élingues: 'Élingues',
  elingues: 'Élingues',
  motorisation: 'Moteurs',
  moteurs: 'Moteurs',
  mobilier: 'Mobilier scénique',
  informatique: 'Informatique',
  'sans catégorie': 'Sans catégorie',
  'sans categorie': 'Sans catégorie',
};

export function setupStockImportRoutes(app, authenticateToken, requireAdmin) {
  // Mapping categories endpoint
  app.get('/api/stock/import/category-map', authenticateToken, (req, res) => {
    try {
      const categories = db
        .prepare(
          `
        SELECT sc.id, sc.name, sc.parent_id, pc.name as parent_name
        FROM stock_categories sc
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        ORDER BY sc.parent_id NULLS FIRST, sc.name ASC
      `,
        )
        .all();
      res.json({ categories, inventoryMap: INVENTORY_CATEGORY_MAP });
    } catch (error) {
      logger.error('Erreur category-map:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Import en masse
  // [AUDIT FIX I5] Validation Zod mandatory
  app.post(
    '/api/stock/import',
    authenticateToken,
    requireAdmin,
    validate(stockImportSchema),
    (req, res) => {
      try {
        const { items, mode = 'upsert' } = req.body;

        // Build category lookup: name (lowercase) → id
        const allCats = db.prepare('SELECT id, name, parent_id FROM stock_categories').all();
        const catByName = {};
        for (const c of allCats) {
          catByName[c.name.toLowerCase()] = c.id;
        }

        // Resolve category for an item
        function resolveCategoryId(catName) {
          if (!catName) return null;
          const lower = catName.toLowerCase().trim();
          // Direct match by name
          if (catByName[lower]) return catByName[lower];
          // Subcategory map
          const subName = INVENTORY_SUBCATEGORY_MAP[lower];
          if (subName && catByName[subName.toLowerCase()]) return catByName[subName.toLowerCase()];
          // Root category map → try a subcategory, fallback to root
          const rootName = INVENTORY_CATEGORY_MAP[lower];
          if (rootName && catByName[rootName.toLowerCase()])
            return catByName[rootName.toLowerCase()];
          return null;
        }

        // Get next ref number
        const lastRef = db
          .prepare(
            "SELECT reference FROM stock_items WHERE reference LIKE 'STK-%' ORDER BY reference DESC LIMIT 1",
          )
          .get();
        let nextNum = lastRef ? parseInt(lastRef.reference.replace('STK-', ''), 10) + 1 : 1;

        const insertStmt = db.prepare(`
        INSERT INTO stock_items (reference, name, description, category_id, unit, unit_price, sell_price, quantity, min_quantity, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
        const updateStmt = db.prepare(`
        UPDATE stock_items SET name = ?, description = ?, category_id = COALESCE(?, category_id),
          unit_price = CASE WHEN ? > 0 THEN ? ELSE unit_price END,
          sell_price = CASE WHEN ? > 0 THEN ? ELSE sell_price END,
          quantity = ?, location = COALESCE(?, location),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
        const movementStmt = db.prepare(`
        INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
        VALUES (?, 'in', ?, 0, ?, 'Import inventaire', ?, ?)
      `);
        const movementUpdateStmt = db.prepare(`
        INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
        VALUES (?, 'adjustment', ?, ?, ?, 'Mise à jour inventaire', ?, ?)
      `);

        let inserted = 0,
          updated = 0,
          skipped = 0,
          errors = [];

        const run = db.transaction(() => {
          for (const item of items) {
            try {
              const name = (item.name || '').trim();
              if (!name) {
                skipped++;
                continue;
              }

              const ref = (item.reference || '').trim();
              const desc = (item.description || '').trim() || null;
              const catId =
                item.category_id || resolveCategoryId(item.category_name || item.category);
              const qty = Math.max(0, Math.round(Number(item.quantity) || 0));
              const unitPrice = Math.max(0, Number(item.unit_price || item.value || 0));
              const sellPrice = Math.max(0, Number(item.sell_price || 0));
              const location = (item.location || item.emplacement || '').trim() || null;

              // Try to find existing by reference
              let existing = null;
              if (ref) {
                existing = db
                  .prepare('SELECT id, quantity FROM stock_items WHERE reference = ?')
                  .get(ref);
              }
              if (!existing && name) {
                existing = db
                  .prepare('SELECT id, quantity FROM stock_items WHERE LOWER(name) = LOWER(?)')
                  .get(name);
              }

              if (existing && mode === 'upsert') {
                updateStmt.run(
                  name,
                  desc,
                  catId,
                  unitPrice,
                  unitPrice,
                  sellPrice,
                  sellPrice,
                  qty,
                  location,
                  existing.id,
                );
                if (qty !== existing.quantity) {
                  movementUpdateStmt.run(
                    existing.id,
                    Math.abs(qty - existing.quantity),
                    existing.quantity,
                    qty,
                    req.user.id,
                    req.user.name,
                  );
                }
                updated++;
              } else if (!existing) {
                const finalRef = ref || `STK-${String(nextNum++).padStart(5, '0')}`;
                insertStmt.run(
                  finalRef,
                  name,
                  desc,
                  catId,
                  'u',
                  unitPrice,
                  sellPrice,
                  qty,
                  0,
                  location,
                  null,
                );
                const newId = db.prepare('SELECT last_insert_rowid() as id').get().id;
                if (qty > 0) {
                  movementStmt.run(newId, qty, qty, req.user.id, req.user.name);
                }
                inserted++;
              } else {
                skipped++;
              }
            } catch (e) {
              errors.push(`${item.reference || item.name}: ${e.message}`);
              skipped++;
            }
          }
        });

        run();

        addToHistory(
          'stock_import',
          null,
          'import',
          { inserted, updated, skipped, total: items.length },
          req.user.id,
          req.user.name,
        );
        logger.info(
          `Import stock: ${inserted} insérés, ${updated} mis à jour, ${skipped} ignorés (total: ${items.length})`,
        );

        res.json({ inserted, updated, skipped, errors: errors.slice(0, 20), total: items.length });
      } catch (error) {
        logger.error('Erreur import stock:', error);
        // [AUDIT FIX H1] Ne pas exposer error.message au client
        res.status(500).json({ success: false, error: "Erreur lors de l'import du stock" });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// Statistiques Stock
// ═══════════════════════════════════════════════════════════════
export function setupStockStatsRoutes(app, authenticateToken) {
  app.get('/api/stock/stats', authenticateToken, (req, res) => {
    try {
      const { stock_type } = req.query;
      const typeFilter = stock_type ? ' AND stock_type = ?' : '';
      const typeParams = stock_type ? [stock_type] : [];

      const totalItems = db
        .prepare(`SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1${typeFilter}`)
        .get(...typeParams).count;
      const totalValue = db
        .prepare(
          `SELECT COALESCE(SUM(quantity * unit_price), 0) as value FROM stock_items WHERE is_active = 1${typeFilter}`,
        )
        .get(...typeParams).value;
      const lowStockCount = db
        .prepare(
          `SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1 AND quantity <= min_quantity AND min_quantity > 0${typeFilter}`,
        )
        .get(...typeParams).count;
      const outOfStockCount = db
        .prepare(
          `SELECT COUNT(*) as count FROM stock_items WHERE is_active = 1 AND quantity = 0${typeFilter}`,
        )
        .get(...typeParams).count;
      const categoryCount = db
        .prepare('SELECT COUNT(*) as count FROM stock_categories')
        .get().count;

      const recentMovements = db
        .prepare(
          `
        SELECT sm.type, COUNT(*) as count, SUM(sm.quantity) as total_qty
        FROM stock_movements sm
        ${stock_type ? 'JOIN stock_items si2 ON sm.stock_item_id = si2.id' : ''}
        WHERE sm.created_at >= date('now', '-30 days')
        ${stock_type ? 'AND si2.stock_type = ?' : ''}
        GROUP BY sm.type
      `,
        )
        .all(...typeParams);

      const topMovedItems = db
        .prepare(
          `
        SELECT si.id, si.name, si.reference, COUNT(sm.id) as movement_count
        FROM stock_movements sm
        JOIN stock_items si ON sm.stock_item_id = si.id
        WHERE sm.created_at >= date('now', '-30 days')
        ${stock_type ? 'AND si.stock_type = ?' : ''}
        GROUP BY si.id
        ORDER BY movement_count DESC
        LIMIT 5
      `,
        )
        .all(...typeParams);

      const lowStockItems = db
        .prepare(
          `
        SELECT si.id, si.name, si.reference, si.quantity, si.min_quantity, si.unit,
          sc.name as category_name, sc.color as category_color
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        WHERE si.is_active = 1 AND si.quantity <= si.min_quantity AND si.min_quantity > 0
        ${stock_type ? 'AND si.stock_type = ?' : ''}
        ORDER BY (si.quantity * 1.0 / si.min_quantity) ASC
        LIMIT 10
      `,
        )
        .all(...typeParams);

      res.json({
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
        categoryCount,
        recentMovements,
        topMovedItems,
        lowStockItems,
      });
    } catch (error) {
      logger.error('Erreur stats stock:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
