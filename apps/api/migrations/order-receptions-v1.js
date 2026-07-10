// apps/api/migrations/order-receptions-v1.js
//
// Ticket : T-P1-10 (Commandes v2 - reception partielle detaillee).
//
// Cree la table `order_receptions` : trace de chaque reception
// (partielle ou totale) d'une commande, avec ventilation par
// ligne. Additive, idempotente.

import logger from '../logger.js';

export function runOrderReceptionsMigration(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS order_receptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      received_qty REAL NOT NULL,
      received_at DATETIME NOT NULL DEFAULT (datetime('now')),
      received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_order_receptions_order ON order_receptions(order_id)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_order_receptions_item ON order_receptions(order_item_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_order_receptions_received_at ON order_receptions(received_at)',
    );
    logger.info('  ✅ Orders v2: table order_receptions OK');
  } catch (err) {
    logger.warn(`  ⚠️ Orders v2: order_receptions — ${err.message}`);
  }
}
