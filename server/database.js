import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Créer/ouvrir la base de données
const db = new Database(join(__dirname, 'vehicules.db'));

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Activer le mode WAL (Write-Ahead Logging) pour une meilleure durabilité
// et permet des lectures pendant les écritures
db.pragma('journal_mode = WAL');

// Définir le mode de synchronisation pour garantir l'écriture sur disque
db.pragma('synchronous = FULL');

// Configurer le checkpoint automatique (tous les 1000 pages)
db.pragma('wal_autocheckpoint = 1000');

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
      password_reset_required BOOLEAN DEFAULT 0,
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

  // Table des sessions actives
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      technical_control_type TEXT,
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

  // Table des demandes de réservation (pour les non-admins)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservation_requests (
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
      status TEXT DEFAULT 'pending',
      requested_by INTEGER NOT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      rejection_reason TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);

  // Ajouter les colonnes kilométrage et contrôle technique si elles n'existent pas
  // NOTE: Les colonnes controle_technique_type, controle_technique_date, controle_technique_deadline
  // sont LEGACY — remplacées par la colonne JSON controles_techniques (format tableau).
  // Elles sont conservées pour compatibilité arrière mais NE DOIVENT PLUS être utilisées.
  // La migration vers controles_techniques est effectuée automatiquement ci-dessous.
  try {
    const columns = db.prepare("PRAGMA table_info(vehicles)").all();
    const hasKilometrage = columns.some(col => col.name === 'kilometrage');
    const hasControleTechniqueType = columns.some(col => col.name === 'controle_technique_type');
    const hasControleTechniqueDate = columns.some(col => col.name === 'controle_technique_date');
    const hasControleTechniqueDeadline = columns.some(col => col.name === 'controle_technique_deadline');
    const hasControlesTechniques = columns.some(col => col.name === 'controles_techniques');
    
    if (!hasKilometrage) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN kilometrage INTEGER DEFAULT 0").run();
      console.log('✅ Colonne kilometrage ajoutée');
    }
    
    if (!hasControleTechniqueType) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN controle_technique_type TEXT").run();
      console.log('✅ Colonne controle_technique_type ajoutée');
    }
    
    if (!hasControleTechniqueDate) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN controle_technique_date TEXT").run();
      console.log('✅ Colonne controle_technique_date ajoutée');
    }
    
    if (!hasControleTechniqueDeadline) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN controle_technique_deadline TEXT").run();
      console.log('✅ Colonne controle_technique_deadline ajoutée');
    }

    // Ajouter la nouvelle colonne pour les contrôles multiples
    if (!hasControlesTechniques) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN controles_techniques TEXT DEFAULT '[]'").run();
      console.log('✅ Colonne controles_techniques ajoutée');
      
      // Migrer les anciennes données vers le nouveau format
      const vehiclesWithOldData = db.prepare(`
        SELECT id, controle_technique_type, controle_technique_date, controle_technique_deadline 
        FROM vehicles 
        WHERE controle_technique_type IS NOT NULL AND controle_technique_type != ''
      `).all();
      
      for (const vehicle of vehiclesWithOldData) {
        const controles = [{
          type: vehicle.controle_technique_type,
          date: vehicle.controle_technique_date,
          deadline: vehicle.controle_technique_deadline
        }];
        db.prepare("UPDATE vehicles SET controles_techniques = ? WHERE id = ?")
          .run(JSON.stringify(controles), vehicle.id);
      }
      
      if (vehiclesWithOldData.length > 0) {
        console.log(`✅ Migration de ${vehiclesWithOldData.length} contrôles techniques vers le nouveau format`);
      }
    }
  } catch (error) {
    console.log('Info: Colonnes véhicules déjà présentes');
  }

  // Migration: ajouter trip_group_id dans trip_details pour lier les trajets
  try {
    const tripDetailColumns = db.prepare("PRAGMA table_info(trip_details)").all();
    const hasTripGroupId = tripDetailColumns.some(col => col.name === 'trip_group_id');
    
    if (!hasTripGroupId) {
      db.prepare("ALTER TABLE trip_details ADD COLUMN trip_group_id TEXT").run();
      db.exec("CREATE INDEX IF NOT EXISTS idx_trip_details_trip_group_id ON trip_details(trip_group_id)");
      console.log('✅ Colonne trip_group_id ajoutée à trip_details');
    }
  } catch (error) {
    console.log('Info: Colonne trip_group_id déjà présente ou table trip_details non créée');
  }

  // Migration: ajouter avatar dans users
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const hasAvatar = userColumns.some(col => col.name === 'avatar');
    if (!hasAvatar) {
      db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").run();
      console.log('✅ Colonne avatar ajoutée à users');
    }
  } catch (error) {
    console.log('Info: Colonne avatar déjà présente');
  }

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

// Fonction pour faire un checkpoint WAL (synchroniser les données sur disque)
export function checkpointDatabase() {
  try {
    db.pragma('wal_checkpoint(FULL)');
    console.log('✅ Checkpoint WAL effectué');
  } catch (error) {
    console.error('❌ Erreur checkpoint WAL:', error);
  }
}

// Fonction pour fermer proprement la base de données
export function closeDatabase() {
  try {
    // Faire un checkpoint final avant de fermer
    checkpointDatabase();
    db.close();
    console.log('✅ Base de données fermée proprement');
  } catch (error) {
    console.error('❌ Erreur fermeture DB:', error);
  }
}

// Checkpoint automatique toutes les 5 minutes
setInterval(() => {
  checkpointDatabase();
}, 5 * 60 * 1000);

export default db;
