// ============================================================
// MODULE E-SHOPS — Produits externes multi-fournisseurs — eM@g
// Routes REST : external_products, external_product_suppliers, compare
// Aucune API externe. Saisie manuelle. Calcul port + franco côté serveur.
// ============================================================

import PDFDocument from 'pdfkit';

import db from './database.js';
import logger from './logger.js';
import validate from './middleware/validate.js';
import {
  eshopProductCompareParamsSchema,
  eshopProductIdParamsSchema,
  eshopProductListQuerySchema,
  eshopProductSupplierCreateSchema,
  eshopProductSupplierIdParamsSchema,
  eshopProductSupplierUpdateSchema,
  eshopProductUpsertSchema,
  eshopQuotePdfSchema,
} from './schemas/eshop.js';

// ─── Calcul du port pour un fournisseur de produit ───────────────────────────
// Règles (par ordre de priorité) :
//   1. Si shipping_free_threshold défini ET price_ht >= seuil → port = 0 (franco)
//   2. Si shipping_flat_rate défini → port = flat_rate
//   3. Sinon → port = 0 (inconnu, traité comme offert)
function calcShipping(priceHt, flatRate, freeThreshold) {
  const qty1Price = priceHt ?? 0;
  if (freeThreshold != null && qty1Price >= freeThreshold) return 0;
  if (flatRate != null) return flatRate;
  return 0;
}

// ─── Formater un lien fournisseur avec ses infos de port résolues ─────────────
function resolveSupplierEntry(entry) {
  // Shipping policy : priorité champs propres → fallback sur suppliers table
  const flatRate =
    entry.shipping_flat_rate != null ? entry.shipping_flat_rate : entry.sup_shipping_flat_rate;
  const freeThreshold =
    entry.shipping_free_threshold != null
      ? entry.shipping_free_threshold
      : entry.sup_shipping_free_threshold;

  const priceHt = entry.price_ht ?? 0;
  const shipping = calcShipping(priceHt, flatRate, freeThreshold);
  const isFranco = freeThreshold != null && priceHt >= freeThreshold;
  const totalHt = priceHt + shipping;

  return {
    id: entry.id,
    product_id: entry.product_id,
    supplier_id: entry.supplier_id,
    supplier_name: entry.supplier_name,
    supplier_ref: entry.supplier_ref,
    price_ht: priceHt,
    external_url: entry.external_url,
    shipping_policy: entry.shipping_policy,
    shipping_flat_rate: flatRate,
    shipping_free_threshold: freeThreshold,
    shipping: shipping,
    is_franco: isFranco,
    total_ht: totalHt,
    notes: entry.notes,
  };
}

export function setupEshopRoutes(app, authenticateToken, requireAdmin) {
  // ───────────────────────────────────────────────────────────
  // PRODUITS EXTERNES
  // ───────────────────────────────────────────────────────────

  // GET /api/external-products — Liste avec filtres optionnels
  app.get(
    '/api/external-products',
    authenticateToken,
    validate({ query: eshopProductListQuerySchema }),
    (req, res) => {
      try {
        const { search, category, limit, offset } = req.query;
        let query = `
        SELECT ep.*,
          COUNT(eps.id) AS supplier_count,
          MIN(eps.price_ht) AS min_price_ht
        FROM external_products ep
        LEFT JOIN external_product_suppliers eps ON eps.product_id = ep.id
        WHERE 1=1
      `;
        const params = [];
        if (search) {
          query += ' AND (ep.name LIKE ? OR ep.description LIKE ? OR ep.category LIKE ?)';
          const s = `%${search}%`;
          params.push(s, s, s);
        }
        if (category) {
          query += ' AND ep.category = ?';
          params.push(category);
        }
        query += ' GROUP BY ep.id ORDER BY ep.name ASC';

        // Count
        const countQ = `SELECT COUNT(*) as total FROM external_products ep WHERE 1=1${
          search ? ' AND (ep.name LIKE ? OR ep.description LIKE ? OR ep.category LIKE ?)' : ''
        }${category ? ' AND ep.category = ?' : ''}`;
        const countParams = [];
        if (search) {
          const s = `%${search}%`;
          countParams.push(s, s, s);
        }
        if (category) countParams.push(category);
        const { total } = db.prepare(countQ).get(...countParams);

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const products = db.prepare(query).all(...params);

        // Récupérer les catégories disponibles
        const categories = db
          .prepare(
            "SELECT DISTINCT category FROM external_products WHERE category IS NOT NULL AND category != '' ORDER BY category",
          )
          .all()
          .map((r) => r.category);

        res.json({ products, total, categories });
      } catch (error) {
        logger.error('GET /api/external-products:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // GET /api/external-products/:id — Fiche détaillée avec tous ses fournisseurs
  app.get(
    '/api/external-products/:id',
    authenticateToken,
    validate({ params: eshopProductIdParamsSchema }),
    (req, res) => {
      try {
        const product = db
          .prepare('SELECT * FROM external_products WHERE id = ?')
          .get(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Produit introuvable' });

        const suppliersRaw = db
          .prepare(
            `SELECT eps.*,
            s.shipping_flat_rate AS sup_shipping_flat_rate,
            s.shipping_free_threshold AS sup_shipping_free_threshold
           FROM external_product_suppliers eps
           LEFT JOIN suppliers s ON s.id = eps.supplier_id
           WHERE eps.product_id = ?
           ORDER BY eps.supplier_name`,
          )
          .all(req.params.id);

        const suppliers = suppliersRaw.map(resolveSupplierEntry);
        res.json({ ...product, suppliers });
      } catch (error) {
        logger.error('GET /api/external-products/:id:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // POST /api/external-products — Créer un produit
  app.post(
    '/api/external-products',
    authenticateToken,
    validate({ body: eshopProductUpsertSchema }),
    (req, res) => {
      try {
        const { name, description, category, image_url, notes } = req.body;
        const result = db
          .prepare(
            `INSERT INTO external_products (name, description, category, image_url, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            name.trim(),
            description || null,
            category || null,
            image_url || null,
            notes || null,
            req.user?.id || null,
          );
        const product = db
          .prepare('SELECT * FROM external_products WHERE id = ?')
          .get(result.lastInsertRowid);
        res.status(201).json(product);
      } catch (error) {
        logger.error('POST /api/external-products:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/external-products/:id — Modifier un produit
  app.put(
    '/api/external-products/:id',
    authenticateToken,
    validate({ params: eshopProductIdParamsSchema, body: eshopProductUpsertSchema }),
    (req, res) => {
      try {
        const { name, description, category, image_url, notes } = req.body;
        const update = db
          .prepare(
            `UPDATE external_products
         SET name = ?, description = ?, category = ?, image_url = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
          )
          .run(
            name.trim(),
            description || null,
            category || null,
            image_url || null,
            notes || null,
            req.params.id,
          );
        if (update.changes === 0)
          return res.status(404).json({ success: false, error: 'Produit introuvable' });
        const product = db
          .prepare('SELECT * FROM external_products WHERE id = ?')
          .get(req.params.id);
        res.json(product);
      } catch (error) {
        logger.error('PUT /api/external-products/:id:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/external-products/:id
  app.delete(
    '/api/external-products/:id',
    authenticateToken,
    requireAdmin,
    validate({ params: eshopProductIdParamsSchema }),
    (req, res) => {
      try {
        const result = db.prepare('DELETE FROM external_products WHERE id = ?').run(req.params.id);
        if (result.changes === 0)
          return res.status(404).json({ success: false, error: 'Produit introuvable' });
        res.json({ success: true });
      } catch (error) {
        logger.error('DELETE /api/external-products/:id:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ───────────────────────────────────────────────────────────
  // FOURNISSEURS PAR PRODUIT
  // ───────────────────────────────────────────────────────────

  // POST /api/external-product-suppliers — Ajouter un fournisseur à un produit
  app.post(
    '/api/external-product-suppliers',
    authenticateToken,
    validate({ body: eshopProductSupplierCreateSchema }),
    (req, res) => {
      try {
        const {
          product_id,
          supplier_id,
          supplier_name,
          supplier_ref,
          price_ht,
          external_url,
          shipping_policy,
          shipping_flat_rate,
          shipping_free_threshold,
          notes,
        } = req.body;
        const result = db
          .prepare(
            `INSERT INTO external_product_suppliers
            (product_id, supplier_id, supplier_name, supplier_ref, price_ht,
             external_url, shipping_policy, shipping_flat_rate, shipping_free_threshold, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            Number(product_id),
            supplier_id ? Number(supplier_id) : null,
            supplier_name.trim(),
            supplier_ref || null,
            price_ht != null ? Number(price_ht) : null,
            external_url || null,
            shipping_policy || 'flat',
            shipping_flat_rate != null ? Number(shipping_flat_rate) : null,
            shipping_free_threshold != null ? Number(shipping_free_threshold) : null,
            notes || null,
          );

        const row = db
          .prepare(
            `SELECT eps.*, s.shipping_flat_rate AS sup_shipping_flat_rate,
              s.shipping_free_threshold AS sup_shipping_free_threshold
           FROM external_product_suppliers eps
           LEFT JOIN suppliers s ON s.id = eps.supplier_id
           WHERE eps.id = ?`,
          )
          .get(result.lastInsertRowid);
        res.status(201).json(resolveSupplierEntry(row));
      } catch (error) {
        logger.error('POST /api/external-product-suppliers:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/external-product-suppliers/:id — Modifier
  app.put(
    '/api/external-product-suppliers/:id',
    authenticateToken,
    validate({
      params: eshopProductSupplierIdParamsSchema,
      body: eshopProductSupplierUpdateSchema,
    }),
    (req, res) => {
      try {
        const {
          supplier_id,
          supplier_name,
          supplier_ref,
          price_ht,
          external_url,
          shipping_policy,
          shipping_flat_rate,
          shipping_free_threshold,
          notes,
        } = req.body;
        const update = db
          .prepare(
            `UPDATE external_product_suppliers
         SET supplier_id = ?, supplier_name = ?, supplier_ref = ?, price_ht = ?,
             external_url = ?, shipping_policy = ?, shipping_flat_rate = ?,
             shipping_free_threshold = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
          )
          .run(
            supplier_id ? Number(supplier_id) : null,
            supplier_name.trim(),
            supplier_ref || null,
            price_ht != null ? Number(price_ht) : null,
            external_url || null,
            shipping_policy || 'flat',
            shipping_flat_rate != null ? Number(shipping_flat_rate) : null,
            shipping_free_threshold != null ? Number(shipping_free_threshold) : null,
            notes || null,
            req.params.id,
          );
        if (update.changes === 0)
          return res.status(404).json({ success: false, error: 'Entrée introuvable' });

        const row = db
          .prepare(
            `SELECT eps.*, s.shipping_flat_rate AS sup_shipping_flat_rate,
              s.shipping_free_threshold AS sup_shipping_free_threshold
           FROM external_product_suppliers eps
           LEFT JOIN suppliers s ON s.id = eps.supplier_id
           WHERE eps.id = ?`,
          )
          .get(req.params.id);
        res.json(resolveSupplierEntry(row));
      } catch (error) {
        logger.error('PUT /api/external-product-suppliers/:id:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/external-product-suppliers/:id
  app.delete(
    '/api/external-product-suppliers/:id',
    authenticateToken,
    validate({ params: eshopProductSupplierIdParamsSchema }),
    (req, res) => {
      try {
        const result = db
          .prepare('DELETE FROM external_product_suppliers WHERE id = ?')
          .run(req.params.id);
        if (result.changes === 0)
          return res.status(404).json({ success: false, error: 'Entrée introuvable' });
        res.json({ success: true });
      } catch (error) {
        logger.error('DELETE /api/external-product-suppliers/:id:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ───────────────────────────────────────────────────────────
  // COMPARAISON PRIX + PORT
  // ───────────────────────────────────────────────────────────

  // GET /api/external-products/:id/compare
  // Renvoie la liste des fournisseurs triée par total_ht croissant
  // avec indication du fournisseur le plus avantageux
  app.get(
    '/api/external-products/:id/compare',
    authenticateToken,
    validate({ params: eshopProductCompareParamsSchema }),
    (req, res) => {
      try {
        const product = db
          .prepare('SELECT * FROM external_products WHERE id = ?')
          .get(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Produit introuvable' });

        const raw = db
          .prepare(
            `SELECT eps.*,
            s.shipping_flat_rate AS sup_shipping_flat_rate,
            s.shipping_free_threshold AS sup_shipping_free_threshold,
            s.website AS supplier_website
           FROM external_product_suppliers eps
           LEFT JOIN suppliers s ON s.id = eps.supplier_id
           WHERE eps.product_id = ?`,
          )
          .all(req.params.id);

        const entries = raw.map(resolveSupplierEntry).sort((a, b) => a.total_ht - b.total_ht);

        // Identifier le meilleur (plus bas total, en ignorant les prix = 0)
        const withPrice = entries.filter((e) => e.price_ht > 0);
        const bestId = withPrice.length > 0 ? withPrice[0].id : null;

        res.json({
          product,
          entries: entries.map((e) => ({ ...e, is_best: e.id === bestId })),
          best_id: bestId,
        });
      } catch (error) {
        logger.error('GET /api/external-products/:id/compare:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ───────────────────────────────────────────────────────────
  // GÉNÉRATION PDF DEVIS INTERNE
  // ───────────────────────────────────────────────────────────

  // POST /api/external-products/quote-pdf
  // Body: { title, items: [{ product_name, supplier_name, supplier_ref, price_ht, shipping, total_ht, external_url, qty }] }
  app.post(
    '/api/external-products/quote-pdf',
    authenticateToken,
    validate({ body: eshopQuotePdfSchema }),
    async (req, res) => {
      try {
        const { title = 'Devis interne e-shops', items = [] } = req.body;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="devis-eshop-${Date.now()}.pdf"`,
        );

        const BLUE = '#1a56db';
        const GRAY = '#6b7280';
        const LIGHT = '#f3f4f6';
        const BLACK = '#111827';

        // En-tête
        doc
          .fontSize(18)
          .fillColor(BLUE)
          .text('eM@g — ' + title, { align: 'left' });
        doc
          .fontSize(9)
          .fillColor(GRAY)
          .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'left' });
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(BLUE).lineWidth(1).stroke();
        doc.moveDown(0.5);

        if (items.length === 0) {
          doc.fontSize(10).fillColor(GRAY).text('Aucun article dans ce devis.');
        } else {
          // Colonnes : Produit | Fournisseur | Réf | Qté | PU HT | Port | Total HT
          const COL = [40, 180, 280, 345, 375, 430, 490];
          const HEADERS = ['Produit', 'Fournisseur', 'Réf', 'Qté', 'PU HT', 'Port', 'Total HT'];

          // En-tête tableau
          doc.rect(40, doc.y, 515, 16).fill(BLUE);
          doc.fontSize(8).fillColor('#ffffff');
          HEADERS.forEach((h, i) => doc.text(h, COL[i], doc.y - 14, { width: 55 }));
          doc.moveDown(0.3);

          let totalGlobal = 0;
          let rowY = doc.y;
          items.forEach((item, idx) => {
            const bg = idx % 2 === 0 ? LIGHT : '#ffffff';
            const rowH = 18;
            doc.rect(40, rowY, 515, rowH).fill(bg);
            doc
              .fontSize(8)
              .fillColor(BLACK)
              .text(item.product_name || '—', COL[0], rowY + 4, { width: 135, ellipsis: true })
              .text(item.supplier_name || '—', COL[1], rowY + 4, { width: 95, ellipsis: true })
              .text(item.supplier_ref || '—', COL[2], rowY + 4, { width: 60, ellipsis: true })
              .text(String(item.qty ?? 1), COL[3], rowY + 4, { width: 25, align: 'right' })
              .text(
                item.price_ht != null ? item.price_ht.toFixed(2) + ' €' : '—',
                COL[4],
                rowY + 4,
                {
                  width: 50,
                  align: 'right',
                },
              )
              .text(
                item.shipping != null ? item.shipping.toFixed(2) + ' €' : '—',
                COL[5],
                rowY + 4,
                {
                  width: 50,
                  align: 'right',
                },
              )
              .text(
                item.total_ht != null ? item.total_ht.toFixed(2) + ' €' : '—',
                COL[6],
                rowY + 4,
                {
                  width: 60,
                  align: 'right',
                },
              );
            if (item.external_url) {
              doc
                .fontSize(7)
                .fillColor(BLUE)
                .text('↗ ' + item.external_url, COL[0], rowY + 12, {
                  width: 250,
                  ellipsis: true,
                  link: item.external_url,
                });
            }
            totalGlobal += (item.total_ht ?? 0) * (item.qty ?? 1);
            rowY += rowH + (item.external_url ? 8 : 0);
            doc.y = rowY;
          });

          // Total
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor(BLACK).text(`Total HT estimé : `, { continued: true });
          doc.fillColor(BLUE).text(`${totalGlobal.toFixed(2)} €`);
          doc
            .fontSize(7)
            .fillColor(GRAY)
            .text('* Prix indicatifs. Frais de port calculés selon politiques fournisseurs.');
        }

        doc.end();
        await new Promise((resolve) => doc.on('end', resolve));
        res.end(Buffer.concat(buffers));
      } catch (error) {
        logger.error('POST /api/external-products/quote-pdf:', error);
        if (!res.headersSent)
          res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    },
  );
}
