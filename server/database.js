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
      is_admin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des demandes d'accès
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
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
      start_period TEXT DEFAULT 'AM',
      end_date TEXT NOT NULL,
      end_period TEXT DEFAULT 'PM',
      client_name TEXT,
      driver_name TEXT,
      location_name TEXT,
      prestation_name TEXT,
      notes TEXT,
      google_event_id TEXT,
      affaire TEXT,
      is_tournee BOOLEAN DEFAULT 0,
      linked_event_ids TEXT,
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
      vehicle_id TEXT,
      vehicle_name TEXT,
      type TEXT,
      status TEXT,
      date TEXT,
      end_date TEXT,
      start_date_period TEXT,
      end_date_period TEXT,
      description TEXT,
      garage_id INTEGER,
      cost REAL,
      mileage INTEGER,
      notes TEXT,
      is_immobilized BOOLEAN DEFAULT 0,
      is_quick_report BOOLEAN DEFAULT 0,
      reported_date DATETIME,
      reported_by INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (garage_id) REFERENCES garages(id),
      FOREIGN KEY (reported_by) REFERENCES users(id),
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

  // Table des emails autorisés
  db.exec(`
    CREATE TABLE IF NOT EXISTS authorized_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      activated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Base de données initialisée');
}

// Fonctions helper pour l'historique
export function addToHistory(entityType, entityId, action, changes, userId, userName) {
  // Si entityId est null ou undefined, ne pas enregistrer l'historique
  if (!entityId) {
    console.warn(`⚠️  Tentative d'ajout à l'historique sans entity_id pour ${entityType}`);
    return;
  }
  
  const stmt = db.prepare(`
    INSERT INTO modification_history (entity_type, entity_id, action, changes, user_id, user_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(entityType, String(entityId), action, JSON.stringify(changes), userId, userName);
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
