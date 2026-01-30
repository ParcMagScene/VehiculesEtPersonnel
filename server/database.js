import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Créer/ouvrir la base de données
const db = new Database(join(__dirname, 'vehicules.db'));

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Créer les tables
function initializeDatabase() {
  // Table des utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des véhicules
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      registration TEXT,
      brand TEXT,
      model TEXT,
      color TEXT,
      owner TEXT,
      comment TEXT,
      display_color TEXT,
      photo TEXT,
      order_index INTEGER DEFAULT 0,
      is_location BOOLEAN DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des réservations
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      client_name TEXT,
      driver_name TEXT,
      pickup_location TEXT,
      return_location TEXT,
      notes TEXT,
      google_event_id TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des conducteurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      license_number TEXT,
      phone TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des lieux
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      lat REAL,
      lng REAL,
      place_id TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des garages
  db.exec(`
    CREATE TABLE IF NOT EXISTS garages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table des maintenances
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenances (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      garage TEXT,
      cost REAL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Table de l'historique des modifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS modification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changes TEXT,
      user_id INTEGER,
      user_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Table de configuration (calendrier, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  console.log('✅ Base de données initialisée');
}

// Fonctions helper pour l'historique
export function addToHistory(entityType, entityId, action, changes, userId, userName) {
  const stmt = db.prepare(`
    INSERT INTO modification_history (entity_type, entity_id, action, changes, user_id, user_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(entityType, entityId, action, JSON.stringify(changes), userId, userName);
}

export function getHistory(entityType, entityId) {
  const stmt = db.prepare(`
    SELECT * FROM modification_history 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `);
  
  return stmt.all(entityType, entityId);
}

initializeDatabase();

export default db;
