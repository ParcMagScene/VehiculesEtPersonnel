import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ⚠️ En ESM, les imports sont hoistés et exécutés AVANT le code de server.js.
// On doit charger dotenv ici (duplication intentionnelle avec env.js) car database.js
// est importé avant env.js à cause du hoisting ESM. Les deux doivent rester synchronisés.
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const envFile = isDev ? '.env.development' : '.env';
dotenv.config({ path: join(__dirname, envFile) });

// Chemin de la base de données — configurable via DB_PATH
const DB_FILENAME = process.env.DB_PATH || 'vehicules.db';
const dbPath = join(__dirname, DB_FILENAME);

// Créer/ouvrir la base de données
const db = new Database(dbPath);

// Log du fichier DB utilisé (utile pour vérifier l'isolation dev/prod)
const mode = process.env.NODE_ENV || 'production';
logger.info(`📂 Base de données: ${DB_FILENAME} (mode: ${mode})`);

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Activer le mode WAL (Write-Ahead Logging) pour une meilleure durabilité
// et permet des lectures pendant les écritures
db.pragma('journal_mode = WAL');

// Définir le mode de synchronisation pour garantir l'écriture sur disque
db.pragma('synchronous = FULL');

// Configurer le checkpoint automatique (tous les 1000 pages)
db.pragma('wal_autocheckpoint = 1000');

// [PHASE 4] Timeout 5s si la DB est verrouillée par un autre writer
db.pragma('busy_timeout = 5000');

// Créer les tables
// [AUDIT FIX P1-12] Les clauses ON DELETE des FOREIGN KEY ne s'appliquent qu'aux nouvelles bases.
// Pour les bases existantes, SQLite ne permet pas de modifier les FK via ALTER TABLE.
function initializeDatabase() {
  // [AUDIT FIX P0-5] Helper pour migrations ALTER TABLE idempotentes
  function safeAddColumn(table, column, type, defaultVal) {
    const cols = db.pragma(`table_info(${table})`).map((c) => c.name);
    if (!cols.includes(column)) {
      const defClause = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : '';
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defClause}`);
      logger.info(`  ✅ Migration: ${table}.${column} ajouté`);
      return true;
    }
    return false;
  }

  // Table des utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0,
      password_reset_required BOOLEAN DEFAULT 0,
      reset_token_hash TEXT,
      reset_token_expires TEXT,
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
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Table des véhicules
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      category TEXT,
      registration TEXT,
      brand TEXT,
      model TEXT,
      year INTEGER,
      color TEXT,
      vin TEXT,
      status TEXT DEFAULT 'available',
      notes TEXT,
      owner TEXT,
      comment TEXT,
      display_color TEXT,
      photo TEXT,
      order_index INTEGER DEFAULT 0,
      is_location BOOLEAN DEFAULT 0,
      kilometrage INTEGER DEFAULT 0,
      last_maintenance_date TEXT,
      last_maintenance_km INTEGER,
      mileage_history TEXT,
      controle_technique_type TEXT,
      controle_technique_date TEXT,
      controle_technique_deadline TEXT,
      controles_techniques TEXT DEFAULT '[]',
      assigned_to INTEGER,
      pupitre TEXT,
      is_insured BOOLEAN DEFAULT 0,
      insurance_company TEXT,
      insurance_number TEXT,
      insurance_expiry TEXT,
      latitude REAL,
      longitude REAL,
      location_updated_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES persons(id) ON DELETE SET NULL
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
      google_drive_link TEXT,
      affaire TEXT,
      is_tournee BOOLEAN DEFAULT 0,
      linked_event_ids TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table des lieux
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      type TEXT DEFAULT 'Salle de spectacle',
      lat REAL,
      lng REAL,
      place_id TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (garage_id) REFERENCES garages(id) ON DELETE SET NULL,
      FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table de configuration (calendrier, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table des emails autorisés
  db.exec(`
    CREATE TABLE IF NOT EXISTS authorized_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      is_admin INTEGER DEFAULT 0,
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
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // ═══════════════════════════════════════════════════════
  // MODULE PLANNING PERSONNEL — MagLog 1.0
  // ═══════════════════════════════════════════════════════

  // Table des personnes (personnel)
  db.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      type TEXT NOT NULL DEFAULT 'permanent',
      status TEXT NOT NULL DEFAULT 'active',
      user_id INTEGER,
      driver_id INTEGER,
      license_types TEXT DEFAULT '[]',
      certifications TEXT DEFAULT '[]',
      notes TEXT,
      photo TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table des compétences (référentiel)
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table de liaison personnes ↔ compétences
  db.exec(`
    CREATE TABLE IF NOT EXISTS person_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      level TEXT DEFAULT 'intermédiaire',
      UNIQUE(person_id, skill_id),
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  `);

  // Table des disponibilités / indisponibilités / congés
  db.exec(`
    CREATE TABLE IF NOT EXISTS availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_period TEXT DEFAULT 'AM',
      end_period TEXT DEFAULT 'PM',
      type TEXT NOT NULL DEFAULT 'unavailable',
      reason TEXT,
      source TEXT NOT NULL DEFAULT 'admin',
      is_recurring BOOLEAN DEFAULT 0,
      recurrence_rule TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      approved_by INTEGER,
      approved_at DATETIME,
      rejection_reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table des soldes de congés par personne/année/type
  db.exec(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'conge_paye',
      days_entitled REAL NOT NULL DEFAULT 25,
      days_taken REAL NOT NULL DEFAULT 0,
      UNIQUE(person_id, year, type),
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_leave_balances_person ON leave_balances(person_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year)`);

  // Table des votes pour les demandes de congés
  db.exec(`
    CREATE TABLE IF NOT EXISTS leave_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      availability_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL,
      vote TEXT NOT NULL CHECK(vote IN ('approve', 'reject')),
      comment TEXT,
      voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(availability_id, voter_id),
      FOREIGN KEY (availability_id) REFERENCES availabilities(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_leave_votes_availability ON leave_votes(availability_id)`,
  );

  // Table des missions
  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      reservation_id TEXT,
      affaire TEXT,
      client_name TEXT,
      location_name TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      position TEXT,
      required_skill_id INTEGER,
      vehicle_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      day_states TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
      FOREIGN KEY (required_skill_id) REFERENCES skills(id) ON DELETE SET NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Table des affectations (mission ↔ personne)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      person_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed',
      position TEXT,
      comment TEXT,
      responded_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mission_id, person_id),
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Index de performance — module personnel
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(type);
    CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status);
    CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id);
    CREATE INDEX IF NOT EXISTS idx_person_skills_person ON person_skills(person_id);
    CREATE INDEX IF NOT EXISTS idx_person_skills_skill ON person_skills(skill_id);
    CREATE INDEX IF NOT EXISTS idx_availabilities_person ON availabilities(person_id);
    CREATE INDEX IF NOT EXISTS idx_availabilities_dates ON availabilities(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_missions_dates ON missions(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
    CREATE INDEX IF NOT EXISTS idx_missions_reservation ON missions(reservation_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_mission ON mission_assignments(mission_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_person ON mission_assignments(person_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON mission_assignments(status);
  `);

  // Seed : compétences de base (INSERT OR IGNORE = idempotent)
  db.exec(`
    INSERT OR IGNORE INTO skills (name, category, description) VALUES
      ('Sonorisation', 'son', 'Installation et réglage de systèmes de sonorisation'),
      ('Mixage live', 'son', 'Mixage en direct pour événements'),
      ('Backline', 'son', 'Installation et gestion du backline'),
      ('Éclairage scénique', 'lumière', 'Conception et conduite lumière'),
      ('Poursuite', 'lumière', 'Opérateur poursuite'),
      ('LED / Écrans', 'vidéo', 'Installation et gestion d''écrans LED'),
      ('Régie vidéo', 'vidéo', 'Régie vidéo live et diffusion'),
      ('Montage structure', 'plateau', 'Montage de scènes et structures'),
      ('Rigging', 'plateau', 'Accroche et levage de matériel'),
      ('Machinerie', 'plateau', 'Opérations de machinerie scénique'),
      ('Régie générale', 'régie', 'Coordination technique générale'),
      ('Régie plateau', 'régie', 'Gestion du plateau et des changements'),
      ('Conduite VL', 'conduite', 'Conduite de véhicules légers'),
      ('Conduite PL', 'conduite', 'Conduite de poids lourds'),
      ('Conduite SPL', 'conduite', 'Conduite de super poids lourds'),
      ('Manutention', 'logistique', 'Chargement / déchargement'),
      ('CACES', 'logistique', 'Conduite d''engins de chantier / nacelle'),
      ('Électricité', 'logistique', 'Habilitation électrique');
  `);

  logger.info('✅ Module Planning Personnel initialisé');

  // ═══════════════════════════════════════════════════════
  // MODULE AFFAIRES
  // ═══════════════════════════════════════════════════════

  db.exec(`
    CREATE TABLE IF NOT EXISTS affaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_affaire TEXT NOT NULL UNIQUE,
      nom TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Prestation',
      client TEXT,
      interlocuteur TEXT,
      tel TEXT,
      fax TEXT,
      date_debut TEXT,
      date_fin TEXT,
      devis TEXT,
      adresse_livraison TEXT,
      titre TEXT,
      description TEXT,
      google_event_id TEXT,
      event_name TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Migration : ajouter colonne 'nom' si absente
  try {
    const cols = db
      .prepare('PRAGMA table_info(affaires)')
      .all()
      .map((c) => c.name);
    if (!cols.includes('nom')) {
      db.exec("ALTER TABLE affaires ADD COLUMN nom TEXT DEFAULT ''");
      // Pré-remplir nom avec event_name ou client pour les affaires existantes
      db.exec(
        "UPDATE affaires SET nom = COALESCE(NULLIF(event_name, ''), NULLIF(client, ''), '') WHERE nom IS NULL OR nom = ''",
      );
      logger.info('✅ Migration: colonne nom ajoutée à affaires');
    }
  } catch (e) {
    /* colonne existe déjà */
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_affaires_numero ON affaires(numero_affaire);
    CREATE INDEX IF NOT EXISTS idx_affaires_dates ON affaires(date_debut, date_fin);
    CREATE INDEX IF NOT EXISTS idx_affaires_type ON affaires(type);
    CREATE INDEX IF NOT EXISTS idx_affaires_google_event ON affaires(google_event_id);
  `);

  // ── Liaisons entre affaires (ex: Tournée ↔ affaires individuelles) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS affaire_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
      child_affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_affaire_id, child_affaire_id)
    );
    CREATE INDEX IF NOT EXISTS idx_affaire_links_parent ON affaire_links(parent_affaire_id);
    CREATE INDEX IF NOT EXISTS idx_affaire_links_child ON affaire_links(child_affaire_id);
  `);

  logger.info('✅ Module Affaires initialisé');

  // ═══════════════════════════════════════════════════════
  // MODULE POSTES
  // ═══════════════════════════════════════════════════════

  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      is_common BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed : postes de référence (INSERT OR IGNORE = idempotent)
  db.exec(`
    INSERT OR IGNORE INTO positions (name, category, is_common) VALUES
      ('Directeur technique', 'direction', 0),
      ('Régisseur général', 'direction', 1),
      ('Régisseur de production', 'direction', 0),
      ('Régisseur plateau', 'direction', 1),
      ('Régisseur de tournée', 'direction', 0),
      ('Assistant régie / régisseur adjoint', 'direction', 0),
      ('Stage manager', 'direction', 0),
      ('Ingénieur du son façade (FOH)', 'son', 1),
      ('Ingénieur retours (monitoring)', 'son', 1),
      ('Technicien son', 'son', 1),
      ('Opérateur systèmes / technicien systèmes', 'son', 0),
      ('Opérateur HF / micros / in-ear', 'son', 0),
      ('Perchman', 'son', 0),
      ('Sound designer', 'son', 0),
      ('Concepteur lumière / light designer', 'lumiere', 0),
      ('Régisseur lumière', 'lumiere', 1),
      ('Opérateur pupitre / console lumière', 'lumiere', 1),
      ('Technicien lumière', 'lumiere', 1),
      ('Chef électricien', 'lumiere', 0),
      ('Électricien plateau', 'lumiere', 0),
      ('Régisseur vidéo', 'video', 0),
      ('Technicien vidéo', 'video', 1),
      ('Opérateur vidéo / VJ', 'video', 0),
      ('Opérateur caméra', 'video', 0),
      ('Opérateur serveurs médias', 'video', 1),
      ('Technicien LED / murs d''\u00e9crans', 'video', 1),
      ('Technicien projection', 'video', 0),
      ('Machiniste', 'plateau', 1),
      ('Chef machiniste', 'plateau', 0),
      ('Technicien plateau', 'plateau', 0),
      ('Constructeur décor', 'plateau', 0),
      ('Accessoiriste', 'plateau', 0),
      ('Technicien accroche / levage', 'plateau', 0),
      ('Rigger / cordiste spectacle', 'plateau', 1),
      ('Conducteur de machinerie motorisée', 'plateau', 0),
      ('Backliner général', 'backline', 1),
      ('Backliner guitare', 'backline', 0),
      ('Backliner batterie', 'backline', 0),
      ('Backliner claviers', 'backline', 0),
      ('Technicien instruments', 'backline', 0),
      ('Accordeur', 'backline', 0),
      ('Habilleur', 'costumes', 0),
      ('Costumier', 'costumes', 0),
      ('Maquilleur / coiffeur', 'costumes', 0),
      ('Styliste', 'costumes', 0),
      ('Électricien spectacle', 'electricite', 0),
      ('Technicien réseau (IT, fibre, Dante, intercom)', 'electricite', 0),
      ('Responsable sécurité / SSIAP', 'electricite', 0),
      ('Chargé de prévention', 'electricite', 0),
      ('Chef d''équipe / chef de chantier', 'logistique', 1),
      ('Road manager', 'logistique', 0),
      ('Chauffeur PL / SPL', 'logistique', 0),
      ('Manutentionnaire / crew', 'logistique', 1),
      ('Runner', 'logistique', 0),
      ('Réalisateur multicam', 'captation', 0),
      ('Assistant réalisateur', 'captation', 0),
      ('Ingénieur vision', 'captation', 0),
      ('Opérateur steadycam / grue / travelling', 'captation', 0),
      ('Technicien streaming / broadcast', 'captation', 0),
      ('Chargé de production', 'production', 0),
      ('Administrateur de tournée', 'production', 0),
      ('Booker / programmateur', 'production', 0),
      ('Assistant production', 'production', 0),
      ('Directeur général', 'administratif', 0),
      ('Directeur adjoint', 'administratif', 0),
      ('Directeur administratif et financier', 'administratif', 0),
      ('Cadre administratif', 'administratif', 0),
      ('Responsable administratif', 'administratif', 0),
      ('Secrétaire de direction', 'administratif', 0),
      ('Assistant(e) administratif(ve)', 'administratif', 0),
      ('Comptable', 'administratif', 0),
      ('Responsable RH', 'administratif', 0),
      ('Assistant(e) RH', 'administratif', 0),
      ('Responsable commercial', 'administratif', 0),
      ('Chargé(e) de communication', 'administratif', 0),
      ('Responsable logistique', 'administratif', 0),
      ('Responsable achats', 'administratif', 0),
      ('Coordinateur(trice) de projets', 'administratif', 0)
  `);

  logger.info('✅ Module Postes initialisé');

  // Migration: required_skill_id (INTEGER FK) → required_skills (TEXT JSON, sans FK)
  try {
    const missionCols = db.prepare('PRAGMA table_info(missions)').all();
    const hasRequiredSkills = missionCols.some((col) => col.name === 'required_skills');
    if (!hasRequiredSkills) {
      db.prepare('ALTER TABLE missions ADD COLUMN required_skills TEXT DEFAULT NULL').run();
      // Migrer les données existantes
      const missions = db
        .prepare('SELECT id, required_skill_id FROM missions WHERE required_skill_id IS NOT NULL')
        .all();
      const update = db.prepare('UPDATE missions SET required_skills = ? WHERE id = ?');
      for (const m of missions) {
        // Si c'est déjà un JSON array, le garder tel quel ; sinon, l'emballer
        let val = String(m.required_skill_id);
        try {
          const parsed = JSON.parse(val);
          if (!Array.isArray(parsed)) val = JSON.stringify([m.required_skill_id]);
        } catch {
          val = JSON.stringify([m.required_skill_id]);
        }
        update.run(val, m.id);
      }
      logger.info('✅ Migration required_skill_id → required_skills effectuée');
    }
  } catch (error) {
    logger.warn('⚠️ Migration required_skills:', error.message);
  }

  // Migration: ajouter default_positions (JSON) dans persons
  try {
    const personsCols = db.prepare('PRAGMA table_info(persons)').all();
    const hasDefaultPositions = personsCols.some((col) => col.name === 'default_positions');
    if (!hasDefaultPositions) {
      db.prepare("ALTER TABLE persons ADD COLUMN default_positions TEXT DEFAULT '[]'").run();
      logger.info('✅ Colonne default_positions ajoutée à persons');
    }
  } catch (error) {
    // Colonne déjà présente
  }

  // ═══════════════════════════════════════════════════════
  // FIN MODULE PLANNING PERSONNEL
  // ═══════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════
  // MODULE GESTION DES CONGÉS — Conforme IDCC 3252
  // ═══════════════════════════════════════════════════════

  // Table principale des demandes de congés
  db.exec(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      user_id INTEGER,
      request_date TEXT NOT NULL DEFAULT (date('now')),
      leave_type TEXT NOT NULL DEFAULT 'conge_paye',
      exceptional_type TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_period TEXT DEFAULT 'AM',
      end_period TEXT DEFAULT 'PM',
      working_days REAL NOT NULL DEFAULT 0,
      employee_comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_comment TEXT,
      decision_date TEXT,
      decision_by INTEGER,
      reception_date TEXT,
      modified_start_date TEXT,
      modified_end_date TEXT,
      modified_working_days REAL,
      signature_employee TEXT,
      signature_employee_date TEXT,
      signature_admin TEXT,
      signature_admin_date TEXT,
      justification_path TEXT,
      justification_filename TEXT,
      pdf_path TEXT,
      priority_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (decision_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_person ON leave_requests(person_id);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(leave_type);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
  `);

  // Historique des modifications de demandes
  db.exec(`
    CREATE TABLE IF NOT EXISTS leave_request_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_request_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      performed_by INTEGER,
      performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_leave_history_request ON leave_request_history(leave_request_id)`,
  );

  // Jours fériés (configurables par admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS public_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      is_custom BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_holidays_year ON public_holidays(year)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_holidays_date ON public_holidays(date)`);

  // Pré-remplir les jours fériés 2025-2027
  db.exec(`
    INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES
      ('2025-01-01', 'Jour de l''An', 2025),
      ('2025-04-21', 'Lundi de Pâques', 2025),
      ('2025-05-01', 'Fête du Travail', 2025),
      ('2025-05-08', 'Victoire 1945', 2025),
      ('2025-05-29', 'Ascension', 2025),
      ('2025-06-09', 'Lundi de Pentecôte', 2025),
      ('2025-07-14', 'Fête Nationale', 2025),
      ('2025-08-15', 'Assomption', 2025),
      ('2025-11-01', 'Toussaint', 2025),
      ('2025-11-11', 'Armistice', 2025),
      ('2025-12-25', 'Noël', 2025),
      ('2026-01-01', 'Jour de l''An', 2026),
      ('2026-04-06', 'Lundi de Pâques', 2026),
      ('2026-05-01', 'Fête du Travail', 2026),
      ('2026-05-08', 'Victoire 1945', 2026),
      ('2026-05-14', 'Ascension', 2026),
      ('2026-05-25', 'Lundi de Pentecôte', 2026),
      ('2026-07-14', 'Fête Nationale', 2026),
      ('2026-08-15', 'Assomption', 2026),
      ('2026-11-01', 'Toussaint', 2026),
      ('2026-11-11', 'Armistice', 2026),
      ('2026-12-25', 'Noël', 2026),
      ('2027-01-01', 'Jour de l''An', 2027),
      ('2027-03-29', 'Lundi de Pâques', 2027),
      ('2027-05-01', 'Fête du Travail', 2027),
      ('2027-05-06', 'Ascension', 2027),
      ('2027-05-08', 'Victoire 1945', 2027),
      ('2027-05-17', 'Lundi de Pentecôte', 2027),
      ('2027-07-14', 'Fête Nationale', 2027),
      ('2027-08-15', 'Assomption', 2027),
      ('2027-11-01', 'Toussaint', 2027),
      ('2027-11-11', 'Armistice', 2027),
      ('2027-12-25', 'Noël', 2027)
  `);

  logger.info('✅ Module Gestion des Congés initialisé');

  // ═══════════════════════════════════════════════════════
  // FIN MODULE GESTION DES CONGÉS
  // ═══════════════════════════════════════════════════════

  // Ajouter les colonnes kilométrage et contrôle technique si elles n'existent pas
  // NOTE: Les colonnes controle_technique_type, controle_technique_date, controle_technique_deadline
  // sont LEGACY — remplacées par la colonne JSON controles_techniques (format tableau).
  // Elles sont conservées pour compatibilité arrière mais NE DOIVENT PLUS être utilisées.
  // La migration vers controles_techniques est effectuée automatiquement ci-dessous.
  try {
    const columns = db.prepare('PRAGMA table_info(vehicles)').all();
    const hasKilometrage = columns.some((col) => col.name === 'kilometrage');
    const hasControleTechniqueType = columns.some((col) => col.name === 'controle_technique_type');
    const hasControleTechniqueDate = columns.some((col) => col.name === 'controle_technique_date');
    const hasControleTechniqueDeadline = columns.some(
      (col) => col.name === 'controle_technique_deadline',
    );
    const hasControlesTechniques = columns.some((col) => col.name === 'controles_techniques');

    if (!hasKilometrage) {
      db.prepare('ALTER TABLE vehicles ADD COLUMN kilometrage INTEGER DEFAULT 0').run();
      logger.info('✅ Colonne kilometrage ajoutée');
    }

    if (!hasControleTechniqueType) {
      db.prepare('ALTER TABLE vehicles ADD COLUMN controle_technique_type TEXT').run();
      logger.info('✅ Colonne controle_technique_type ajoutée');
    }

    if (!hasControleTechniqueDate) {
      db.prepare('ALTER TABLE vehicles ADD COLUMN controle_technique_date TEXT').run();
      logger.info('✅ Colonne controle_technique_date ajoutée');
    }

    if (!hasControleTechniqueDeadline) {
      db.prepare('ALTER TABLE vehicles ADD COLUMN controle_technique_deadline TEXT').run();
      logger.info('✅ Colonne controle_technique_deadline ajoutée');
    }

    // Ajouter la nouvelle colonne pour les contrôles multiples
    if (!hasControlesTechniques) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN controles_techniques TEXT DEFAULT '[]'").run();
      logger.info('✅ Colonne controles_techniques ajoutée');

      // Migrer les anciennes données vers le nouveau format
      const vehiclesWithOldData = db
        .prepare(
          `
        SELECT id, controle_technique_type, controle_technique_date, controle_technique_deadline 
        FROM vehicles 
        WHERE controle_technique_type IS NOT NULL AND controle_technique_type != ''
      `,
        )
        .all();

      for (const vehicle of vehiclesWithOldData) {
        const controles = [
          {
            type: vehicle.controle_technique_type,
            date: vehicle.controle_technique_date,
            deadline: vehicle.controle_technique_deadline,
          },
        ];
        db.prepare('UPDATE vehicles SET controles_techniques = ? WHERE id = ?').run(
          JSON.stringify(controles),
          vehicle.id,
        );
      }

      if (vehiclesWithOldData.length > 0) {
        logger.info(
          `✅ Migration de ${vehiclesWithOldData.length} contrôles techniques vers le nouveau format`,
        );
      }
    }
  } catch (error) {
    logger.info('Info: Colonnes véhicules déjà présentes');
  }

  // Migration ONE-TIME: Ajouter les contrôles TACHYGRAPHE et LIMITEUR pour les PL
  try {
    // Créer la table migrations_log si elle n'existe pas
    db.exec(`CREATE TABLE IF NOT EXISTS migrations_log (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )`);

    const alreadyApplied = db
      .prepare('SELECT 1 FROM migrations_log WHERE name = ?')
      .get('add_tachygraphe_limiteur');

    if (!alreadyApplied) {
      const plTypes = ['PL', 'CAMION', 'PORTEUR', 'TRACTEUR', 'SEMI'];
      const allVehicles = db.prepare('SELECT id, type, controles_techniques FROM vehicles').all();
      let addedCount = 0;

      for (const v of allVehicles) {
        if (!v.type) continue;
        const vType = v.type.toUpperCase();
        const isPL = plTypes.some((t) => vType.includes(t));
        if (!isPL) continue;

        let controles = [];
        try {
          controles = v.controles_techniques ? JSON.parse(v.controles_techniques) : [];
        } catch (e) {
          controles = [];
        }
        if (!Array.isArray(controles)) controles = [];

        let modified = false;
        if (!controles.some((c) => c.type === 'TACHYGRAPHE')) {
          controles.push({ type: 'TACHYGRAPHE', date: null, deadline: null });
          modified = true;
        }
        if (!controles.some((c) => c.type === 'LIMITEUR')) {
          controles.push({ type: 'LIMITEUR', date: null, deadline: null });
          modified = true;
        }

        if (modified) {
          db.prepare('UPDATE vehicles SET controles_techniques = ? WHERE id = ?').run(
            JSON.stringify(controles),
            v.id,
          );
          addedCount++;
        }
      }

      // Marquer la migration comme appliquée
      db.prepare('INSERT INTO migrations_log (name) VALUES (?)').run('add_tachygraphe_limiteur');
      logger.info(`✅ Migration Tachygraphe/Limiteur appliquée (${addedCount} véhicule(s) PL)`);
    }
  } catch (error) {
    logger.error('Erreur migration Tachygraphe/Limiteur:', error.message);
  }

  // Table des détails de trajets
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id TEXT NOT NULL,
      event_id TEXT,
      event_order INTEGER DEFAULT 0,
      departure_location TEXT,
      departure_date TEXT,
      departure_time TEXT,
      arrival_location TEXT,
      arrival_date TEXT,
      arrival_time TEXT,
      return_departure_location TEXT,
      return_departure_date TEXT,
      return_departure_time TEXT,
      return_arrival_location TEXT,
      return_arrival_date TEXT,
      return_arrival_time TEXT,
      driver_name TEXT,
      outbound_duration TEXT,
      return_duration TEXT,
      has_junction_with_next INTEGER DEFAULT 0,
      junction_location TEXT,
      trip_group_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    )
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_trip_details_reservation_id ON trip_details(reservation_id)',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_trip_details_trip_group_id ON trip_details(trip_group_id)',
  );

  // Table des pauses de trajets
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_detail_id INTEGER NOT NULL,
      pause_type TEXT,
      location TEXT,
      start_time TEXT,
      duration TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_detail_id) REFERENCES trip_details(id) ON DELETE CASCADE
    )
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_trip_pauses_trip_detail_id ON trip_pauses(trip_detail_id)',
  );

  // Migration: ajouter trip_group_id dans trip_details pour lier les trajets
  try {
    const tripDetailColumns = db.prepare('PRAGMA table_info(trip_details)').all();
    const hasTripGroupId = tripDetailColumns.some((col) => col.name === 'trip_group_id');

    if (!hasTripGroupId) {
      db.prepare('ALTER TABLE trip_details ADD COLUMN trip_group_id TEXT').run();
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_trip_details_trip_group_id ON trip_details(trip_group_id)',
      );
      logger.info('✅ Colonne trip_group_id ajoutée à trip_details');
    }
  } catch (error) {
    logger.info('Info: Colonne trip_group_id déjà présente ou table trip_details non créée');
  }

  // Migration: ajouter avatar dans users
  try {
    const userColumns = db.prepare('PRAGMA table_info(users)').all();
    const hasAvatar = userColumns.some((col) => col.name === 'avatar');
    if (!hasAvatar) {
      db.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run();
      logger.info('✅ Colonne avatar ajoutée à users');
    }
    const hasPreferences = userColumns.some((col) => col.name === 'preferences');
    if (!hasPreferences) {
      db.prepare("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'").run();
      logger.info('✅ Colonne preferences ajoutée à users');
    }
    const hasPermissions = userColumns.some((col) => col.name === 'permissions');
    if (!hasPermissions) {
      db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}'").run();
      logger.info('✅ Colonne permissions ajoutée à users');
    }
    // [AUDIT FIX CRIT-1] Colonnes OTP reset password
    const hasResetToken = userColumns.some((col) => col.name === 'reset_token_hash');
    if (!hasResetToken) {
      db.prepare('ALTER TABLE users ADD COLUMN reset_token_hash TEXT').run();
      db.prepare('ALTER TABLE users ADD COLUMN reset_token_expires TEXT').run();
      logger.info('✅ Colonnes reset_token_hash/expires ajoutées à users');
    }
    // [AUDIT FIX C5] Colonnes 2FA/TOTP
    const hasTotp = userColumns.some((col) => col.name === 'totp_secret');
    if (!hasTotp) {
      db.prepare('ALTER TABLE users ADD COLUMN totp_secret TEXT').run();
      db.prepare('ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0').run();
      logger.info('✅ Colonnes totp_secret/totp_enabled ajoutées à users');
    }
    // Migration: ajouter is_blocked dans users
    const hasBlocked = userColumns.some((col) => col.name === 'is_blocked');
    if (!hasBlocked) {
      db.prepare('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0').run();
      logger.info('✅ Colonne is_blocked ajoutée à users');
    }
  } catch (error) {
    logger.info('Info: Colonnes avatar/preferences déjà présentes');
  }

  // Migration: ajouter is_admin dans authorized_emails (pour bases existantes)
  try {
    const authEmailCols = db.prepare('PRAGMA table_info(authorized_emails)').all();
    const hasIsAdmin = authEmailCols.some((col) => col.name === 'is_admin');
    if (!hasIsAdmin) {
      db.prepare('ALTER TABLE authorized_emails ADD COLUMN is_admin INTEGER DEFAULT 0').run();
      logger.info('✅ Colonne is_admin ajoutée à authorized_emails');
    }
  } catch (error) {
    logger.info('Info: Migration is_admin authorized_emails:', error.message);
  }

  // Migration: ajouter google_drive_link dans reservations
  try {
    const resColumns = db.prepare('PRAGMA table_info(reservations)').all();
    const hasDriveLink = resColumns.some((col) => col.name === 'google_drive_link');
    if (!hasDriveLink) {
      db.prepare('ALTER TABLE reservations ADD COLUMN google_drive_link TEXT').run();
      logger.info('✅ Colonne google_drive_link ajoutée à reservations');
    }
  } catch (error) {
    logger.info('Info: Colonne google_drive_link déjà présente');
  }

  // Migration: ajouter contract_type dans persons + migrer les types existants
  try {
    const personsColumns = db.prepare('PRAGMA table_info(persons)').all();
    const hasContractType = personsColumns.some((col) => col.name === 'contract_type');
    if (!hasContractType) {
      db.prepare('ALTER TABLE persons ADD COLUMN contract_type TEXT').run();
      logger.info('✅ Colonne contract_type ajoutée à persons');

      // Migrer les types existants vers le nouveau système
      // salarié, technicien, conducteur → type='permanent'
      // intermittent → type='contractuel', contract_type='intermittent'
      // indépendant → type='contractuel', contract_type='freelance'
      const personsToMigrate = db.prepare('SELECT id, type FROM persons').all();
      const updateStmt = db.prepare('UPDATE persons SET type = ?, contract_type = ? WHERE id = ?');
      let migrated = 0;
      for (const p of personsToMigrate) {
        if (['salarié', 'technicien', 'conducteur'].includes(p.type)) {
          updateStmt.run('permanent', null, p.id);
          migrated++;
        } else if (p.type === 'intermittent') {
          updateStmt.run('contractuel', 'intermittent', p.id);
          migrated++;
        } else if (p.type === 'indépendant') {
          updateStmt.run('contractuel', 'freelance', p.id);
          migrated++;
        }
      }
      if (migrated > 0) {
        logger.info(
          `✅ Migration types personnel : ${migrated} personnes migrées (permanent/contractuel)`,
        );
      }
    }
  } catch (error) {
    logger.info('Info: Colonne contract_type déjà présente ou erreur migration:', error.message);
  }

  // [AUDIT FIX P0-5] Migration: ajouter day_states (JSON) dans missions pour stocker les jours ON/OFF
  safeAddColumn('missions', 'day_states', 'TEXT');

  // [AUDIT FIX P0-5] Migration: ajouter colonne 'affaire' dans missions pour lien direct affaire↔mission
  try {
    if (safeAddColumn('missions', 'affaire', 'TEXT')) {
      // Backfill: extraire le numéro d'affaire depuis le titre (ex: "AF32512 — ...")
      const missionsToFix = db
        .prepare('SELECT id, title, notes FROM missions WHERE affaire IS NULL')
        .all();
      for (const m of missionsToFix) {
        // Chercher un pattern AF\d+ dans le titre ou les notes
        const match = (m.title || '').match(/AF\d+/i) || (m.notes || '').match(/AF\d+/i);
        if (match) {
          db.prepare('UPDATE missions SET affaire = ? WHERE id = ?').run(
            match[0].toUpperCase(),
            m.id,
          );
        }
      }
      logger.info('✅ Migration: backfill affaire dans missions effectué');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_missions_affaire ON missions(affaire)');
  } catch (error) {
    logger.warn('⚠️ Migration missions.affaire:', error.message);
  }

  // ═══ Migration: Tables de messagerie interne ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'direct',
        title TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, user_id)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT,
        type TEXT NOT NULL DEFAULT 'text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited_at DATETIME,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id)',
    );
  } catch (error) {
    logger.warn('⚠️ Migration messagerie:', error.message);
  }

  // ═══ Table configuration email ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN DEFAULT 0,
        smtp_host TEXT,
        smtp_port INTEGER DEFAULT 587,
        smtp_secure BOOLEAN DEFAULT 0,
        smtp_user TEXT,
        smtp_pass TEXT,
        from_name TEXT DEFAULT 'eM@g',
        alert_access_request BOOLEAN DEFAULT 1,
        alert_reservation BOOLEAN DEFAULT 1,
        alert_assignment BOOLEAN DEFAULT 1,
        alert_overdue BOOLEAN DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Insérer une config par défaut si elle n'existe pas
    db.exec(`INSERT OR IGNORE INTO email_config (id) VALUES (1)`);

    // Migration: ajouter les nouvelles colonnes d'alerte
    const emailCols = db
      .prepare('PRAGMA table_info(email_config)')
      .all()
      .map((c) => c.name);
    if (!emailCols.includes('alert_leave')) {
      db.prepare('ALTER TABLE email_config ADD COLUMN alert_leave BOOLEAN DEFAULT 1').run();
      logger.info('  + email_config.alert_leave');
    }
    if (!emailCols.includes('alert_sav')) {
      db.prepare('ALTER TABLE email_config ADD COLUMN alert_sav BOOLEAN DEFAULT 1').run();
      logger.info('  + email_config.alert_sav');
    }
    if (!emailCols.includes('alert_maintenance')) {
      db.prepare('ALTER TABLE email_config ADD COLUMN alert_maintenance BOOLEAN DEFAULT 1').run();
      logger.info('  + email_config.alert_maintenance');
    }
  } catch (error) {
    logger.warn('⚠️ Migration email_config:', error.message);
  }

  // [AUDIT FIX P0-5] Migration: Système de gestion des congés (colonne par colonne, idempotent)
  try {
    safeAddColumn('availabilities', 'status', 'TEXT NOT NULL', "'approved'");
    safeAddColumn('availabilities', 'approved_by', 'INTEGER');
    safeAddColumn('availabilities', 'approved_at', 'DATETIME');
    safeAddColumn('availabilities', 'rejection_reason', 'TEXT');
  } catch (error) {
    logger.warn('⚠️ Migration leave management:', error.message);
  }

  // ═══ Module Parc Matériel + SAV ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        level TEXT NOT NULL DEFAULT 'category',
        icon TEXT DEFAULT '📦',
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES equipment_categories(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        reference TEXT,
        serial_number TEXT,
        category_id INTEGER,
        brand TEXT,
        uid TEXT,
        stock_quantity INTEGER DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'available',
        location TEXT,
        purchase_date TEXT,
        purchase_price REAL,
        warranty_end TEXT,
        notes TEXT,
        photo TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        assigned_to INTEGER,
        assigned_by INTEGER,
        start_date TEXT NOT NULL,
        end_date TEXT,
        affaire_id TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES persons(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS sav_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        reported_by INTEGER,
        assigned_to INTEGER,
        type TEXT NOT NULL DEFAULT 'panne',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        title TEXT NOT NULL,
        description TEXT,
        resolution TEXT,
        cost REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES persons(id) ON DELETE SET NULL
      )
    `);

    // Migration : ajouter parent_id et level si manquants
    try {
      const catCols = db
        .prepare('PRAGMA table_info(equipment_categories)')
        .all()
        .map((c) => c.name);
      if (!catCols.includes('parent_id')) {
        db.prepare('ALTER TABLE equipment_categories ADD COLUMN parent_id INTEGER').run();
        logger.info('✅ Migration: parent_id ajouté à equipment_categories');
      }
      if (!catCols.includes('level')) {
        db.prepare(
          "ALTER TABLE equipment_categories ADD COLUMN level TEXT NOT NULL DEFAULT 'category'",
        ).run();
        logger.info('✅ Migration: level ajouté à equipment_categories');
      }
    } catch (e) {
      /* colonnes déjà présentes */
    }

    // Migration : ajouter brand et stock_quantity à equipment
    try {
      const eqCols = db
        .prepare('PRAGMA table_info(equipment)')
        .all()
        .map((c) => c.name);
      if (!eqCols.includes('brand')) {
        db.prepare('ALTER TABLE equipment ADD COLUMN brand TEXT').run();
        logger.info('✅ Migration: brand ajouté à equipment');
      }
      if (!eqCols.includes('stock_quantity')) {
        db.prepare('ALTER TABLE equipment ADD COLUMN stock_quantity INTEGER DEFAULT 1').run();
        logger.info('✅ Migration: stock_quantity ajouté à equipment');
      }
      if (!eqCols.includes('uid')) {
        db.prepare('ALTER TABLE equipment ADD COLUMN uid TEXT').run();
        // SQLite ne supporte pas ADD COLUMN UNIQUE, on crée un index séparé
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_uid ON equipment(uid)').run();
        logger.info('✅ Migration: uid ajouté à equipment');
        // Générer les UID pour les équipements existants
        const existingEq = db.prepare('SELECT id FROM equipment WHERE uid IS NULL').all();
        const updateUid = db.prepare('UPDATE equipment SET uid = ? WHERE id = ?');
        for (const eq of existingEq) {
          const uid = 'EMAG-' + String(eq.id).padStart(5, '0');
          updateUid.run(uid, eq.id);
        }
        if (existingEq.length > 0) logger.info(`✅ Migration: ${existingEq.length} UID générés`);
      }
    } catch (e) {
      /* colonnes déjà présentes */
    }

    // ═══ Table favoris/surveillance matériel ═══
    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        list_type TEXT NOT NULL DEFAULT 'favorite',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(equipment_id, user_id, list_type)
      )
    `);

    // Migration : ajouter colonnes import à sav_tickets + rendre equipment_id nullable
    try {
      const savCols = db
        .prepare('PRAGMA table_info(sav_tickets)')
        .all()
        .map((c) => c.name);
      if (!savCols.includes('import_code')) {
        // Recréer la table avec equipment_id nullable et colonnes import
        db.exec(`
          CREATE TABLE IF NOT EXISTS sav_tickets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id INTEGER,
            reported_by INTEGER,
            assigned_to INTEGER,
            type TEXT NOT NULL DEFAULT 'panne',
            priority TEXT NOT NULL DEFAULT 'medium',
            status TEXT NOT NULL DEFAULT 'open',
            title TEXT NOT NULL,
            description TEXT,
            resolution TEXT,
            cost REAL,
            import_code TEXT,
            import_serial TEXT,
            import_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
            FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (assigned_to) REFERENCES persons(id) ON DELETE SET NULL
          );
          INSERT INTO sav_tickets_new (id, equipment_id, reported_by, assigned_to, type, priority, status, title, description, resolution, cost, created_at, updated_at, resolved_at)
            SELECT id, equipment_id, reported_by, assigned_to, type, priority, status, title, description, resolution, cost, created_at, updated_at, resolved_at FROM sav_tickets;
          DROP TABLE sav_tickets;
          ALTER TABLE sav_tickets_new RENAME TO sav_tickets;
          CREATE INDEX IF NOT EXISTS idx_sav_tickets_equipment_id ON sav_tickets(equipment_id);
        `);
        logger.info(
          '✅ Migration: import_code/serial/name ajoutés à sav_tickets, equipment_id nullable',
        );
      }
    } catch (e) {
      logger.warn('⚠️ Migration sav_tickets import:', e.message);
    }

    // Catégories par défaut
    const catCount = db.prepare('SELECT COUNT(*) as c FROM equipment_categories').get();
    if (catCount.c === 0) {
      const insertCat = db.prepare(
        'INSERT INTO equipment_categories (name, icon, color, level) VALUES (?, ?, ?, ?)',
      );
      insertCat.run('Sonorisation', '🔊', '#3b82f6', 'family');
      insertCat.run('Éclairage', '💡', '#f59e0b', 'family');
      insertCat.run('Structure', '🏗️', '#ef4444', 'family');
      insertCat.run('Audiovisuel', '🎥', '#8b5cf6', 'family');
      insertCat.run('Distribution Électrique', '⚡', '#f97316', 'family');
      insertCat.run('Backline', '🎸', '#10b981', 'family');
      insertCat.run('Rideau-Machinerie', '🎭', '#ec4899', 'family');
      insertCat.run('Informatique', '💻', '#06b6d4', 'family');
      insertCat.run('Accroche', '🔗', '#14b8a6', 'family');
      insertCat.run('Motorisation', '⚙️', '#f97316', 'family');
      insertCat.run('Mobilier', '🪑', '#6b7280', 'family');
      insertCat.run('Outillage & EPI', '🔧', '#f59e0b', 'family');
      insertCat.run('Divers', '📋', '#94a3b8', 'family');
    }
  } catch (error) {
    logger.warn('⚠️ Migration parc matériel:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Commandes & Ventes (P3B)
  // ═══════════════════════════════════════════════════════════════
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'purchase',
        affaire_id TEXT,
        supplier_id INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        order_date TEXT,
        expected_date TEXT,
        received_date TEXT,
        total_ht REAL DEFAULT 0,
        tva_rate REAL DEFAULT 20,
        total_ttc REAL DEFAULT 0,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        designation TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT DEFAULT 'u',
        unit_price_ht REAL NOT NULL DEFAULT 0,
        tva_rate REAL DEFAULT 20,
        total_ht REAL DEFAULT 0,
        received_qty REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL,
        affaire_id TEXT,
        client_name TEXT,
        client_email TEXT,
        client_address TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        quote_date TEXT,
        validity_date TEXT,
        total_ht REAL DEFAULT 0,
        tva_rate REAL DEFAULT 20,
        total_ttc REAL DEFAULT 0,
        notes TEXT,
        converted_to_order_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (converted_to_order_id) REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        designation TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT DEFAULT 'u',
        unit_price_ht REAL NOT NULL DEFAULT 0,
        tva_rate REAL DEFAULT 20,
        total_ht REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
      )
    `);

    logger.info('✅ Tables commandes & ventes créées');
  } catch (error) {
    logger.warn('⚠️ Migration commandes & ventes:', error.message);
  }

  // Migration: ajouter code_libre et postal_code, city dans persons
  try {
    const personsCols2 = db.prepare('PRAGMA table_info(persons)').all();
    const hasCodeLibre = personsCols2.some((col) => col.name === 'code_libre');
    if (!hasCodeLibre) {
      db.prepare('ALTER TABLE persons ADD COLUMN code_libre TEXT').run();
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_code_libre ON persons(code_libre)');
      logger.info('✅ Colonne code_libre ajoutée à persons');
    }
    const hasPostalCode = personsCols2.some((col) => col.name === 'postal_code');
    if (!hasPostalCode) {
      db.prepare('ALTER TABLE persons ADD COLUMN postal_code TEXT').run();
      logger.info('✅ Colonne postal_code ajoutée à persons');
    }
    const hasCity = personsCols2.some((col) => col.name === 'city');
    if (!hasCity) {
      db.prepare('ALTER TABLE persons ADD COLUMN city TEXT').run();
      logger.info('✅ Colonne city ajoutée à persons');
    }
  } catch (error) {
    logger.info('Info: Migration code_libre/postal_code/city:', error.message);
  }

  // ============================================================
  // Tables Catalogue Matériel + Flight-Cases + Modèles Camions
  // Intégration eM@g ↔ Catalogue ↔ Chargement 3D
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_catalog (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE,
      name TEXT NOT NULL,
      family TEXT,
      subfamily TEXT,
      category TEXT,
      dimensions TEXT,
      weight REAL,
      default_flightcase_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS flightcases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      internal_code TEXT,
      dimensions TEXT,
      capacity INTEGER DEFAULT 1,
      category TEXT,
      texture TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS truck_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('semi', 'porteur', 'utilitaire')),
      internal_code TEXT,
      dimensions TEXT,
      axle_config TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_to_vehicle (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      flightcase_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment_catalog(id) ON DELETE CASCADE,
      FOREIGN KEY (flightcase_id) REFERENCES flightcases(id) ON DELETE SET NULL
    )
  `);

  // Index pour les nouvelles tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_catalog_family ON equipment_catalog(family)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_category ON equipment_catalog(category)',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_reference ON equipment_catalog(reference)',
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_flightcases_category ON flightcases(category)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_truck_models_type ON truck_models(type)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_equipment_to_vehicle_reservation ON equipment_to_vehicle(reservation_id)',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_equipment_to_vehicle_equipment ON equipment_to_vehicle(equipment_id)',
  );

  // ═══ Migration: Localisation dépôt pour equipment_catalog ═══
  try {
    const catalogCols = db.prepare('PRAGMA table_info(equipment_catalog)').all();
    const colNames = catalogCols.map((c) => c.name);
    if (!colNames.includes('location_zone')) {
      db.prepare('ALTER TABLE equipment_catalog ADD COLUMN location_zone TEXT').run();
      logger.info('✅ Migration: ajout colonne location_zone à equipment_catalog');
    }
    if (!colNames.includes('location_code')) {
      db.prepare('ALTER TABLE equipment_catalog ADD COLUMN location_code TEXT').run();
      logger.info('✅ Migration: ajout colonne location_code à equipment_catalog');
    }
    if (!colNames.includes('location_floor')) {
      db.prepare('ALTER TABLE equipment_catalog ADD COLUMN location_floor TEXT').run();
      logger.info('✅ Migration: ajout colonne location_floor à equipment_catalog');
    }
    if (!colNames.includes('location_depot')) {
      db.prepare('ALTER TABLE equipment_catalog ADD COLUMN location_depot TEXT').run();
      logger.info('✅ Migration: ajout colonne location_depot à equipment_catalog');
    }
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_location_zone ON equipment_catalog(location_zone)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_location_floor ON equipment_catalog(location_floor)',
    );
  } catch (error) {
    logger.warn('⚠️ Migration location_zone/code/floor:', error.message);
  }

  // ═══ Migration: Localisation dépôt pour equipment (inventaire matériel) ═══
  try {
    const eqCols = db.prepare('PRAGMA table_info(equipment)').all();
    const eqColNames = eqCols.map((c) => c.name);
    if (!eqColNames.includes('location_zone')) {
      db.prepare('ALTER TABLE equipment ADD COLUMN location_zone TEXT').run();
      logger.info('✅ Migration: ajout colonne location_zone à equipment');
    }
    if (!eqColNames.includes('location_code')) {
      db.prepare('ALTER TABLE equipment ADD COLUMN location_code TEXT').run();
      logger.info('✅ Migration: ajout colonne location_code à equipment');
    }
    if (!eqColNames.includes('location_floor')) {
      db.prepare('ALTER TABLE equipment ADD COLUMN location_floor TEXT').run();
      logger.info('✅ Migration: ajout colonne location_floor à equipment');
    }
    if (!eqColNames.includes('location_depot')) {
      db.prepare('ALTER TABLE equipment ADD COLUMN location_depot TEXT').run();
      logger.info('✅ Migration: ajout colonne location_depot à equipment');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_location_zone ON equipment(location_zone)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_location_floor ON equipment(location_floor)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_location_depot ON equipment(location_depot)');
  } catch (error) {
    logger.warn('⚠️ Migration equipment location_zone/code/floor:', error.message);
  }

  // ═══ Migration: Parser les valeurs texte "location" → champs structurés ═══
  try {
    const needsMigration = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM equipment WHERE location IS NOT NULL AND location != '' AND (location_depot IS NULL OR location_depot = '')",
      )
      .get();
    if (needsMigration.cnt > 0) {
      logger.info(`📦 Migration localisation: ${needsMigration.cnt} équipements à migrer...`);

      // Mapping zone → étage pour chaque dépôt
      const depot1RDC = new Set([
        'A1',
        'A2',
        'A3',
        'A4',
        'A5',
        'B1',
        'B2',
        'B3',
        'B4',
        'C',
        'C1',
        'C2',
        'C3',
        'C4',
        'C5',
        'C6',
        'D1',
        'D2',
        'D3',
        'D4',
        'QUAI1',
        'QUAI2',
        'QUAI3',
        'BUREAUX',
        'ENTREE',
        'I1',
        'I2',
        'I3',
      ]);
      const depot1MEZZ = new Set([
        'E1',
        'E2',
        'E3',
        'F',
        'F1',
        'F2',
        'F3',
        'F4',
        'F5',
        'F6',
        'F7',
        'F8',
        'G',
        'G1',
        'G2',
        'G3',
        'H',
        'H1',
        'H2',
        'H3',
        'CUISINE',
        'LOCAL_GELAT',
        'CHAMBRE',
        'SALLE_REU',
        'ARC_INFO',
      ]);
      const depot2RDC = new Set([
        'J',
        'J1',
        'J2',
        'J3',
        'J4',
        'J5',
        'K',
        'K1',
        'K2',
        'K3',
        'K4',
        'L',
        'L1',
        'L2',
        'N',
        'QUAI1',
        'QUAI2',
        'TOURNEES',
        'WC',
      ]);
      const depot2MEZZ = new Set(['M', 'M1']);

      const items = db
        .prepare(
          "SELECT id, location FROM equipment WHERE location IS NOT NULL AND location != '' AND (location_depot IS NULL OR location_depot = '')",
        )
        .all();

      const updateStmt = db.prepare(
        'UPDATE equipment SET location_depot = ?, location_zone = ?, location_floor = ? WHERE id = ?',
      );

      const migrateTransaction = db.transaction(() => {
        let migrated = 0;
        for (const item of items) {
          const match = item.location.match(/^Entrepôt\s+(\d+)\s*:\s*(.+)$/i);
          if (match) {
            const depot = match[1];
            let zone = match[2].trim();
            let floor = null;

            if (depot === '1') {
              if (depot1RDC.has(zone)) floor = 'RDC';
              else if (depot1MEZZ.has(zone)) floor = 'MEZZ';
            } else if (depot === '2') {
              // "M" seul → M1
              if (zone === 'M') zone = 'M1';
              if (depot2RDC.has(zone)) floor = 'RDC';
              else if (depot2MEZZ.has(zone)) floor = 'MEZZ';
            }

            updateStmt.run(depot, zone, floor, item.id);
            migrated++;
          } else if (
            /^[A-Z]\d?$/i.test(item.location) &&
            item.location !== 'Hors stock' &&
            item.location !== 'Hors-Stock'
          ) {
            // Zone seule sans "Entrepôt" (ex: "E3") — essayer de deviner le dépôt
            const zone = item.location.trim();
            if (depot1RDC.has(zone) || depot1MEZZ.has(zone)) {
              const floor = depot1RDC.has(zone) ? 'RDC' : 'MEZZ';
              updateStmt.run('1', zone, floor, item.id);
              migrated++;
            } else if (depot2RDC.has(zone) || depot2MEZZ.has(zone)) {
              const floor = depot2RDC.has(zone) ? 'RDC' : 'MEZZ';
              updateStmt.run('2', zone, floor, item.id);
              migrated++;
            }
          }
        }
        return migrated;
      });

      const count = migrateTransaction();
      logger.info(`✅ Migration localisation: ${count}/${items.length} équipements migrés`);
    }
  } catch (error) {
    logger.warn('⚠️ Migration parsing location:', error.message);
  }

  // ═══ Module Mailing Avancé ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mail_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        html_body TEXT NOT NULL DEFAULT '',
        variables TEXT DEFAULT '[]',
        category TEXT DEFAULT 'general',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS mail_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        recipients TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        error_message TEXT,
        sent_by INTEGER,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES mail_templates(id) ON DELETE SET NULL,
        FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_mail_history_sent_at ON mail_history(sent_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mail_history_template ON mail_history(template_id)');
  } catch (error) {
    logger.warn('⚠️ Migration mailing:', error.message);
  }

  // ═══ Tables Stock & Pièces ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        parent_id INTEGER,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT '📦',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES stock_categories(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        unit TEXT DEFAULT 'u',
        unit_price REAL DEFAULT 0,
        sell_price REAL DEFAULT 0,
        quantity REAL DEFAULT 0,
        min_quantity REAL DEFAULT 0,
        location TEXT,
        supplier_id INTEGER,
        notes TEXT,
        photo TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_item_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment', 'return')),
        quantity REAL NOT NULL,
        previous_quantity REAL NOT NULL,
        new_quantity REAL NOT NULL,
        reason TEXT,
        reference TEXT,
        linked_entity_type TEXT,
        linked_entity_id INTEGER,
        user_id INTEGER,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stock_items_reference ON stock_items(reference)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type)');
  } catch (error) {
    logger.warn('⚠️ Migration stock:', error.message);
  }

  // ═══ Migration: Localisation dépôt + type pour stock_items ═══
  try {
    const siCols = db.prepare('PRAGMA table_info(stock_items)').all();
    const siColNames = siCols.map((c) => c.name);
    if (!siColNames.includes('stock_type')) {
      db.prepare("ALTER TABLE stock_items ADD COLUMN stock_type TEXT DEFAULT 'vente'").run();
      logger.info('✅ Migration: ajout colonne stock_type à stock_items');
    }
    if (!siColNames.includes('location_depot')) {
      db.prepare("ALTER TABLE stock_items ADD COLUMN location_depot TEXT DEFAULT ''").run();
      logger.info('✅ Migration: ajout colonne location_depot à stock_items');
    }
    if (!siColNames.includes('location_zone')) {
      db.prepare("ALTER TABLE stock_items ADD COLUMN location_zone TEXT DEFAULT ''").run();
      logger.info('✅ Migration: ajout colonne location_zone à stock_items');
    }
    if (!siColNames.includes('location_floor')) {
      db.prepare("ALTER TABLE stock_items ADD COLUMN location_floor TEXT DEFAULT ''").run();
      logger.info('✅ Migration: ajout colonne location_floor à stock_items');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_stock_items_type ON stock_items(stock_type)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_stock_items_location_zone ON stock_items(location_zone)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_stock_items_location_depot ON stock_items(location_depot)',
    );
  } catch (error) {
    logger.warn('⚠️ Migration stock location/type:', error.message);
  }

  // ═══ MODULE COMMUNICATION (Affichage dynamique + Planification + Import BL) ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dynamic_display_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        affaire_id TEXT,
        bl_import_id TEXT,
        type TEXT NOT NULL CHECK(type IN ('preparation', 'enlevement', 'livraison', 'depart', 'retour', 'recuperation')),
        category TEXT NOT NULL CHECK(category IN ('vente', 'location', 'prestation', 'installation')),
        date TEXT NOT NULL,
        period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
        time TEXT,
        comment TEXT DEFAULT '',
        client TEXT DEFAULT '',
        location TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT
      )
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_dde_date ON dynamic_display_events(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dde_affaire ON dynamic_display_events(affaire_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dde_type ON dynamic_display_events(type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dde_category ON dynamic_display_events(category)');

    // Migration : ajout colonne visible si absente
    const ddeColumns = db.pragma('table_info(dynamic_display_events)');
    if (!ddeColumns.find((c) => c.name === 'visible')) {
      db.exec('ALTER TABLE dynamic_display_events ADD COLUMN visible INTEGER DEFAULT 1');
      logger.info('✅ Colonne visible ajoutée à dynamic_display_events');
    }
    if (!ddeColumns.find((c) => c.name === 'assigned_person_id')) {
      db.exec(
        'ALTER TABLE dynamic_display_events ADD COLUMN assigned_person_id INTEGER DEFAULT NULL REFERENCES persons(id)',
      );
      logger.info('✅ Colonne assigned_person_id ajoutée à dynamic_display_events');
    }
    if (!ddeColumns.find((c) => c.name === 'status')) {
      db.exec("ALTER TABLE dynamic_display_events ADD COLUMN status TEXT DEFAULT 'pending'");
      logger.info('✅ Colonne status ajoutée à dynamic_display_events');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS bl_imports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        affaire_id TEXT,
        filename TEXT NOT NULL,
        file_path TEXT,
        mime_type TEXT,
        raw_text TEXT,
        parsed_data TEXT,
        status TEXT DEFAULT 'validated' CHECK(status IN ('pending', 'validated', 'rejected')),
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_bl_affaire ON bl_imports(affaire_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_bl_status ON bl_imports(status)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
        time TEXT,
        end_time TEXT,
        section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
          'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
          'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
          'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
        )),
        title TEXT,
        notes TEXT DEFAULT '',
        source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'affaire')),
        source_id TEXT,
        google_event_title TEXT,
        affaire_num TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT
      )
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_reservation ON task_assignments(reservation_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ta_source ON task_assignments(source_type, source_id)');

    // Table planning_hidden_affaires: affaires masquées de la planification
    db.exec(`
      CREATE TABLE IF NOT EXISTS planning_hidden_affaires (
        numero_affaire TEXT PRIMARY KEY,
        hidden_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Table planning_affaire_status: statut de traitement des affaires dans la planification
    db.exec(`
      CREATE TABLE IF NOT EXISTS planning_affaire_status (
        numero_affaire TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Table planning_event_status: statut de traitement des événements Google/iCal/RDV dans la planification
    db.exec(`
      CREATE TABLE IF NOT EXISTS planning_event_status (
        event_type TEXT NOT NULL,
        event_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (event_type, event_id)
      )
    `);

    // Table planning_assignments : affectation multi-personnel générique
    db.exec(`
      CREATE TABLE IF NOT EXISTS planning_assignments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        entity_type TEXT NOT NULL CHECK(entity_type IN ('affaire', 'display_event', 'task')),
        entity_id TEXT NOT NULL,
        person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(entity_type, entity_id, person_id)
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_pa_entity ON planning_assignments(entity_type, entity_id)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_pa_person ON planning_assignments(person_id)');

    // Migration : ajout colonne visible si absente
    const taCols = db.pragma('table_info(task_assignments)');
    if (!taCols.find((c) => c.name === 'visible')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN visible INTEGER DEFAULT 1');
      logger.info('✅ Colonne visible ajoutée à task_assignments');
    }

    // Migration : colonnes enrichies pour task_assignments (end_time, google_event_title, affaire_num)
    const taColNames = taCols.map((c) => c.name);
    if (!taColNames.includes('end_time')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN end_time TEXT');
      logger.info('  + task_assignments.end_time');
    }
    if (!taColNames.includes('google_event_title')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN google_event_title TEXT');
      logger.info('  + task_assignments.google_event_title');
    }
    if (!taColNames.includes('affaire_num')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN affaire_num TEXT');
      logger.info('  + task_assignments.affaire_num');
    }
    if (!taColNames.includes('reservation_id')) {
      db.exec(
        'ALTER TABLE task_assignments ADD COLUMN reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL',
      );
      logger.info('  + task_assignments.reservation_id');
    }
    if (!taColNames.includes('location_address')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN location_address TEXT');
      logger.info('  + task_assignments.location_address');
    }
    if (!taColNames.includes('location_lat')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN location_lat REAL');
      logger.info('  + task_assignments.location_lat');
    }
    if (!taColNames.includes('location_lng')) {
      db.exec('ALTER TABLE task_assignments ADD COLUMN location_lng REAL');
      logger.info('  + task_assignments.location_lng');
    }

    // Migration : corriger le CHECK constraint section pour inclure rdv et prep_installations
    try {
      const checkInfo = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
        .get();
      if (checkInfo && checkInfo.sql && !checkInfo.sql.includes("'rdv'")) {
        logger.info('Migration: correction CHECK constraint section de task_assignments...');
        db.exec('BEGIN TRANSACTION');
        db.exec(`
          CREATE TABLE task_assignments_new (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
            person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
            time TEXT,
            end_time TEXT,
            section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
              'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
              'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
              'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
            )),
            title TEXT,
            notes TEXT DEFAULT '',
            source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire')),
            source_id TEXT,
            google_event_title TEXT,
            affaire_num TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
            visible INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            modified_by INTEGER,
            modified_at TEXT
          )
        `);
        // Récupérer les noms de colonnes de l'ancienne table
        const oldColNames = db.pragma('table_info(task_assignments)').map((c) => c.name);
        const newColNames = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
        const commonCols = oldColNames.filter((c) => newColNames.includes(c)).join(', ');
        db.exec(
          `INSERT INTO task_assignments_new (${commonCols}) SELECT ${commonCols} FROM task_assignments`,
        );
        db.exec('DROP TABLE task_assignments');
        db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
        db.exec('COMMIT');
        logger.info('✅ CHECK constraint section corrigé (ajout rdv, prep_installations)');
      }
    } catch (migErr) {
      try {
        db.exec('ROLLBACK');
      } catch (e) {
        /* ignored */
      }
      logger.warn('Migration CHECK constraint section:', migErr.message);
    }

    // Migration : corriger le CHECK constraint source_type pour inclure 'affaire'
    try {
      const checkInfo2 = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
        .get();
      if (checkInfo2 && checkInfo2.sql && !checkInfo2.sql.includes("'affaire'")) {
        logger.info('Migration: correction CHECK constraint source_type de task_assignments...');
        db.exec('BEGIN TRANSACTION');
        db.exec(`
          CREATE TABLE task_assignments_new (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
            person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
            time TEXT,
            end_time TEXT,
            section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
              'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
              'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
              'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
            )),
            title TEXT,
            notes TEXT DEFAULT '',
            source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire')),
            source_id TEXT,
            google_event_title TEXT,
            affaire_num TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
            visible INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            modified_by INTEGER,
            modified_at TEXT
          )
        `);
        const oldCols2 = db.pragma('table_info(task_assignments)').map((c) => c.name);
        const newCols2 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
        const commonCols2 = oldCols2.filter((c) => newCols2.includes(c)).join(', ');
        db.exec(
          `INSERT INTO task_assignments_new (${commonCols2}) SELECT ${commonCols2} FROM task_assignments`,
        );
        db.exec('DROP TABLE task_assignments');
        db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
        db.exec('COMMIT');
        logger.info('✅ CHECK constraint source_type corrigé (ajout affaire)');
      }
    } catch (migErr2) {
      try {
        db.exec('ROLLBACK');
      } catch (e) {
        /* ignored */
      }
      logger.warn('Migration CHECK constraint source_type:', migErr2.message);
    }

    // Migration : ajouter les sections opérationnelles (chargement, depart, enlevement, retour, recuperation, evenements)
    try {
      const checkInfo3 = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
        .get();
      if (checkInfo3 && checkInfo3.sql && !checkInfo3.sql.includes("'chargement'")) {
        logger.info('Migration: ajout sections opérationnelles à task_assignments...');
        db.exec('BEGIN TRANSACTION');
        db.exec(`
          CREATE TABLE task_assignments_new (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
            person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
            time TEXT,
            end_time TEXT,
            section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
              'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
              'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
              'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
            )),
            title TEXT,
            notes TEXT DEFAULT '',
            source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire')),
            source_id TEXT,
            google_event_title TEXT,
            affaire_num TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
            visible INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            modified_by INTEGER,
            modified_at TEXT
          )
        `);
        const oldCols3 = db.pragma('table_info(task_assignments)').map((c) => c.name);
        const newCols3 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
        const commonCols3 = oldCols3.filter((c) => newCols3.includes(c)).join(', ');
        db.exec(
          `INSERT INTO task_assignments_new (${commonCols3}) SELECT ${commonCols3} FROM task_assignments`,
        );
        // Migrer les anciennes tâches vers les nouvelles sections
        db.exec(
          `UPDATE task_assignments_new SET section = 'chargement' WHERE section = 'taches_prioritaires' AND title LIKE '%Chargement%'`,
        );
        db.exec(
          `UPDATE task_assignments_new SET section = 'depart' WHERE section = 'taches_prioritaires' AND title LIKE '%Départ%'`,
        );
        db.exec(
          `UPDATE task_assignments_new SET section = 'enlevement' WHERE section = 'taches_prioritaires' AND title LIKE '%Enlèvement%'`,
        );
        db.exec(
          `UPDATE task_assignments_new SET section = 'retour' WHERE section = 'taches_secondaires' AND title LIKE '%Retour%'`,
        );
        db.exec(
          `UPDATE task_assignments_new SET section = 'recuperation' WHERE section = 'taches_secondaires' AND title LIKE '%Récupération%'`,
        );
        db.exec('DROP TABLE task_assignments');
        db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
        db.exec('COMMIT');
        logger.info(
          '✅ Sections opérationnelles ajoutées (chargement, depart, enlevement, retour, recuperation, evenements)',
        );
      }
    } catch (migErr3) {
      try {
        db.exec('ROLLBACK');
      } catch (e) {
        /* ignored */
      }
      logger.warn('Migration sections opérationnelles:', migErr3.message);
    }

    // Migration : ajouter la section 'installation' pour les tâches d'affaires de type Installation
    try {
      const checkInfo4 = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'")
        .get();
      if (checkInfo4 && checkInfo4.sql && !checkInfo4.sql.includes("'installation'")) {
        logger.info('Migration: ajout section installation à task_assignments...');
        db.exec('BEGIN TRANSACTION');
        db.exec(`
          CREATE TABLE task_assignments_new (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
            person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
            time TEXT,
            end_time TEXT,
            section TEXT NOT NULL DEFAULT 'manual' CHECK(section IN (
              'rdv', 'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
              'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
              'evenements', 'taches_prioritaires', 'taches_secondaires', 'courses', 'manual'
            )),
            title TEXT,
            notes TEXT DEFAULT '',
            source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event', 'ical_event', 'affaire')),
            source_id TEXT,
            google_event_title TEXT,
            affaire_num TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
            visible INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            modified_by INTEGER,
            modified_at TEXT
          )
        `);
        const oldCols4 = db.pragma('table_info(task_assignments)').map((c) => c.name);
        const newCols4 = db.pragma('table_info(task_assignments_new)').map((c) => c.name);
        const commonCols4 = oldCols4.filter((c) => newCols4.includes(c)).join(', ');
        db.exec(
          `INSERT INTO task_assignments_new (${commonCols4}) SELECT ${commonCols4} FROM task_assignments`,
        );
        db.exec(
          `UPDATE task_assignments_new SET section = 'installation' WHERE title LIKE '%Installation%' AND source_type = 'affaire'`,
        );
        db.exec('DROP TABLE task_assignments');
        db.exec('ALTER TABLE task_assignments_new RENAME TO task_assignments');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_date ON task_assignments(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_person ON task_assignments(person_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_display ON task_assignments(display_event_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_section ON task_assignments(section)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ta_status ON task_assignments(status)');
        db.exec('COMMIT');
        logger.info('✅ Section installation ajoutée');
      }
    } catch (migErr4) {
      try {
        db.exec('ROLLBACK');
      } catch (e) {
        /* ignored */
      }
      logger.warn('Migration section installation:', migErr4.message);
    }

    // Migration : colonnes enrichies pour bl_imports (Phase 5)
    const blCols = db
      .prepare('PRAGMA table_info(bl_imports)')
      .all()
      .map((c) => c.name);
    if (!blCols.includes('affaire_type')) {
      db.prepare('ALTER TABLE bl_imports ADD COLUMN affaire_type TEXT').run();
      logger.info('  + bl_imports.affaire_type');
    }
    if (!blCols.includes('doc_type')) {
      db.prepare('ALTER TABLE bl_imports ADD COLUMN doc_type TEXT').run();
      logger.info('  + bl_imports.doc_type');
    }
    if (!blCols.includes('confidence_score')) {
      db.prepare('ALTER TABLE bl_imports ADD COLUMN confidence_score REAL').run();
      logger.info('  + bl_imports.confidence_score');
    }
    if (!blCols.includes('sections_data')) {
      db.prepare('ALTER TABLE bl_imports ADD COLUMN sections_data TEXT').run();
      logger.info('  + bl_imports.sections_data');
    }
    if (!blCols.includes('field_confidence')) {
      db.prepare('ALTER TABLE bl_imports ADD COLUMN field_confidence TEXT').run();
      logger.info('  + bl_imports.field_confidence');
    }
  } catch (error) {
    logger.warn('⚠️ Migration planning:', error.message);
  }

  // ═══ Table bp_items : liaison BP → Matériel (equipment) ═══
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bp_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bl_import_id TEXT NOT NULL,
        equipment_catalog_id TEXT,
        equipment_id INTEGER,
        reference TEXT,
        description TEXT,
        section TEXT,
        quantity INTEGER DEFAULT 1,
        poids REAL,
        volume REAL,
        match_status TEXT DEFAULT 'unmatched',
        match_confidence REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bl_import_id) REFERENCES bl_imports(id) ON DELETE CASCADE,
        FOREIGN KEY (equipment_catalog_id) REFERENCES equipment_catalog(id) ON DELETE SET NULL,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
      )
    `);
    // [AUDIT FIX P0-5] Migration : ajouter equipment_id si absente (AVANT index)
    const bpCols = db.pragma('table_info(bp_items)').map((c) => c.name);
    if (!bpCols.includes('equipment_id')) {
      db.exec(
        'ALTER TABLE bp_items ADD COLUMN equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL',
      );
      logger.info('  ✅ Migration: bp_items.equipment_id ajouté');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_bp_items_bl ON bp_items(bl_import_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_bp_items_catalog ON bp_items(equipment_catalog_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_bp_items_equipment ON bp_items(equipment_id)');

    // Migration : ajouter item_type (materiel | article) + supplier_article_id + stock_item_id
    if (!bpCols.includes('item_type')) {
      db.exec("ALTER TABLE bp_items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'materiel'");
      // Reclasser les items existants dont la section est VENTE ou VTE
      db.exec("UPDATE bp_items SET item_type = 'article' WHERE UPPER(section) IN ('VENTE', 'VTE')");
      logger.info('  ✅ Migration: bp_items.item_type ajouté');
    }
    if (!bpCols.includes('supplier_article_id')) {
      db.exec(
        'ALTER TABLE bp_items ADD COLUMN supplier_article_id INTEGER REFERENCES supplier_articles(id) ON DELETE SET NULL',
      );
      logger.info('  ✅ Migration: bp_items.supplier_article_id ajouté');
    }
    if (!bpCols.includes('stock_item_id')) {
      db.exec(
        'ALTER TABLE bp_items ADD COLUMN stock_item_id INTEGER REFERENCES stock_items(id) ON DELETE SET NULL',
      );
      logger.info('  ✅ Migration: bp_items.stock_item_id ajouté');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_bp_items_item_type ON bp_items(item_type)');

    logger.info('  ✅ Table bp_items (liaison BP ↔ matériel)');
  } catch (error) {
    logger.warn('⚠️ Migration bp_items:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Dashboard — Affichage Dynamique (écrans, playlists, médias…)
  // ═══════════════════════════════════════════════════════════════
  try {
    // --- Écrans physiques ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_screens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        resolution TEXT DEFAULT '1920x1080',
        orientation TEXT DEFAULT 'landscape' CHECK(orientation IN ('landscape','portrait')),
        status TEXT DEFAULT 'offline' CHECK(status IN ('online','offline','maintenance')),
        playlist_id INTEGER,
        config TEXT DEFAULT '{}',
        last_heartbeat TEXT,
        token TEXT UNIQUE,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // --- Playlists ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        transition TEXT DEFAULT 'fade' CHECK(transition IN ('fade','slide','none')),
        default_duration INTEGER DEFAULT 10,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // --- Items d'une playlist (contenus ordonnés) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_playlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        item_type TEXT NOT NULL CHECK(item_type IN ('media','message','template','url','event')),
        item_id INTEGER,
        url TEXT,
        duration INTEGER DEFAULT 10,
        sort_order INTEGER DEFAULT 0,
        config TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (playlist_id) REFERENCES display_playlists(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_dpi_playlist ON display_playlist_items(playlist_id)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_dpi_sort ON display_playlist_items(playlist_id, sort_order)',
    );

    // --- Templates de mise en page ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        description TEXT,
        layout TEXT NOT NULL DEFAULT '{}',
        thumbnail TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // --- Messages / annonces ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT,
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
        style TEXT DEFAULT '{}',
        template_id INTEGER,
        date_start TEXT,
        date_end TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        modified_by INTEGER,
        modified_at TEXT,
        FOREIGN KEY (template_id) REFERENCES display_templates(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_dm_active ON display_messages(is_active, date_start, date_end)',
    );

    // --- Médias uploadés ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        media_type TEXT DEFAULT 'image' CHECK(media_type IN ('image','video')),
        width INTEGER,
        height INTEGER,
        duration_seconds REAL,
        thumbnail_path TEXT,
        tags TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_dmed_type ON display_media(media_type)');

    // --- Logs d'activité ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_id INTEGER,
        action TEXT NOT NULL,
        details TEXT DEFAULT '{}',
        user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (screen_id) REFERENCES display_screens(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_dlog_screen ON display_logs(screen_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dlog_date ON display_logs(created_at)');

    logger.info('  ✅ Module Dashboard (écrans, playlists, médias, messages, templates, logs)');
  } catch (error) {
    logger.warn('⚠️ Migration Dashboard:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Dashboard TV — Config apparence, messages accueil, couleurs, icônes, Sonos
  // ═══════════════════════════════════════════════════════════════
  try {
    // --- Configuration clé/valeur (apparence, sonos, météo…) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // --- Messages d'accueil par jour / créneau ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_welcome_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        slot TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        UNIQUE(day, slot)
      )
    `);

    // --- Règles de couleurs événements (mot-clé → couleur) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_color_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#00e1ff',
        description TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0
      )
    `);

    // --- Règles d'icônes de lieux (mot-clé → gif) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_location_icon_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        gif_filename TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // --- Événements terminés (toggle sur écran TV) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS display_completed_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        event_date TEXT NOT NULL,
        completed_at TEXT DEFAULT (datetime('now')),
        UNIQUE(event_id, event_date)
      )
    `);

    logger.info('  ✅ Module Dashboard TV (config, messages accueil, couleurs, icônes)');
  } catch (error) {
    logger.warn('⚠️ Migration Dashboard TV:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Annuaire — Enrichissement Clients / Fournisseurs / Prestataires / Contacts
  // ═══════════════════════════════════════════════════════════════
  try {
    // --- Tables de référence (lookup) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS annuaire_legal_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS annuaire_service_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS annuaire_activity_sectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS annuaire_contact_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);

    // --- Table prestataires ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS prestataires (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_libre TEXT UNIQUE,
        name TEXT NOT NULL,
        legal_structure TEXT,
        siret TEXT,
        tva_intra TEXT,
        address TEXT,
        postal_code TEXT,
        city TEXT,
        country TEXT DEFAULT 'France',
        phone TEXT,
        phone2 TEXT,
        email TEXT,
        website TEXT,
        activity_sector TEXT,
        service_types TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_by INTEGER,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // --- Table contacts (multi-entité) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS annuaire_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        supplier_id INTEGER,
        prestataire_id INTEGER,
        first_name TEXT,
        last_name TEXT NOT NULL,
        job_title TEXT,
        category TEXT,
        email TEXT,
        phone TEXT,
        phone2 TEXT,
        is_primary INTEGER DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_by INTEGER,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_client ON annuaire_contacts(client_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_supplier ON annuaire_contacts(supplier_id)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_contacts_prestataire ON annuaire_contacts(prestataire_id)',
    );

    // Migration : ajouter code_libre sur annuaire_contacts (pour import CSV / déduplication)
    const contactCols = db.pragma('table_info(annuaire_contacts)').map((c) => c.name);
    if (!contactCols.includes('code_libre')) {
      db.exec('ALTER TABLE annuaire_contacts ADD COLUMN code_libre TEXT');
      logger.info('  + annuaire_contacts.code_libre');
    }
    try {
      db.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_code_libre ON annuaire_contacts(code_libre)',
      );
    } catch (_) {
      /* ignored */
    }

    logger.info('  ✅ Tables Annuaire (lookup + prestataires + contacts)');

    // --- Migration : enrichir la table clients ---
    const clientCols = db.pragma('table_info(clients)').map((c) => c.name);
    const clientNewCols = {
      code_libre: 'TEXT',
      postal_code: 'TEXT',
      city: 'TEXT',
      country: "TEXT DEFAULT 'France'",
      type: "TEXT DEFAULT 'client'",
      legal_structure: 'TEXT',
      siret: 'TEXT',
      tva_intra: 'TEXT',
      naf_code: 'TEXT',
      website: 'TEXT',
      phone2: 'TEXT',
      activity_sector: 'TEXT',
      service_types: 'TEXT',
      notes: 'TEXT',
      is_active: 'INTEGER DEFAULT 1',
    };
    for (const [col, def] of Object.entries(clientNewCols)) {
      if (!clientCols.includes(col)) {
        db.exec(`ALTER TABLE clients ADD COLUMN ${col} ${def}`);
        logger.info(`  + clients.${col}`);
      }
    }
    // UNIQUE index séparé (ALTER TABLE ADD COLUMN ne supporte pas UNIQUE)
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code_libre ON clients(code_libre)');
    } catch (_) {
      /* ignored */
    }

    // --- Migration : enrichir la table suppliers ---
    const supplierCols = db.pragma('table_info(suppliers)').map((c) => c.name);
    const supplierNewCols = {
      code_libre: 'TEXT',
      postal_code: 'TEXT',
      city: 'TEXT',
      country: "TEXT DEFAULT 'France'",
      type: "TEXT DEFAULT 'fournisseur'",
      legal_structure: 'TEXT',
      siret: 'TEXT',
      tva_intra: 'TEXT',
      naf_code: 'TEXT',
      website: 'TEXT',
      phone2: 'TEXT',
      activity_sector: 'TEXT',
      service_types: 'TEXT',
      is_active: 'INTEGER DEFAULT 1',
      created_by: 'INTEGER',
      modified_by: 'INTEGER',
      modified_at: 'DATETIME',
    };
    for (const [col, def] of Object.entries(supplierNewCols)) {
      if (!supplierCols.includes(col)) {
        db.exec(`ALTER TABLE suppliers ADD COLUMN ${col} ${def}`);
        logger.info(`  + suppliers.${col}`);
      }
    }
    // UNIQUE index séparé (ALTER TABLE ADD COLUMN ne supporte pas UNIQUE)
    try {
      db.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_code_libre ON suppliers(code_libre)',
      );
    } catch (_) {
      /* ignored */
    }

    // --- Migration : enrichir la table prestataires ---
    const prestaCols = db.pragma('table_info(prestataires)').map((c) => c.name);
    if (!prestaCols.includes('naf_code')) {
      db.exec('ALTER TABLE prestataires ADD COLUMN naf_code TEXT');
      logger.info('  + prestataires.naf_code');
    }

    // --- Seed lookup tables (si vides) ---
    const lsCount = db.prepare('SELECT COUNT(*) as c FROM annuaire_legal_structures').get();
    if (lsCount.c === 0) {
      const ins = db.prepare(
        'INSERT INTO annuaire_legal_structures (code, name, sort_order) VALUES (?, ?, ?)',
      );
      const structures = [
        ['EI', 'Entreprise Individuelle'],
        ['EIRL', 'EIRL'],
        ['EURL', 'EURL'],
        ['SARL', 'SARL'],
        ['SAS', 'SAS'],
        ['SASU', 'SASU'],
        ['SA', 'SA'],
        ['SNC', 'SNC'],
        ['SCS', 'SCS'],
        ['SCA', 'SCA'],
        ['SCOP', 'SCOP'],
        ['SCI', 'SCI'],
        ['SCM', 'SCM'],
        ['SEL', "SEL (Société d'exercice libéral)"],
        ['ASSO', 'Association loi 1901'],
        ['GIE', 'GIE'],
        ['EPIC', 'EPIC'],
        ['EPA', 'EPA'],
        ['AE', 'Auto-entrepreneur / Micro-entreprise'],
        ['PL', 'Profession libérale'],
        ['COOP', 'Coopérative'],
        ['FNDN', 'Fondation'],
        ['AUTRE', 'Autre'],
      ];
      structures.forEach(([code, name], i) => ins.run(code, name, i + 1));
      logger.info('  ✅ Seed: annuaire_legal_structures (' + structures.length + ')');
    }

    const stCount = db.prepare('SELECT COUNT(*) as c FROM annuaire_service_types').get();
    if (stCount.c === 0) {
      const ins = db.prepare(
        'INSERT INTO annuaire_service_types (code, name, sort_order) VALUES (?, ?, ?)',
      );
      const services = [
        ['SON', 'Sonorisation'],
        ['LUM', 'Éclairage / Lumière'],
        ['VID', 'Vidéo / Projection'],
        ['SCENE', 'Scénographie / Décor'],
        ['STRUCT', 'Structure / Gril / Pont'],
        ['ENERG', 'Énergie / Groupe électrogène'],
        ['TRANSP', 'Transport / Logistique'],
        ['LEVAG', 'Levage / Nacelle'],
        ['SECU', 'Sécurité / Gardiennage'],
        ['BARR', 'Barrières / Clôtures'],
        ['TRIB', 'Tribunes / Gradins'],
        ['MOB', 'Mobilier événementiel'],
        ['TENT', 'Tente / Chapiteau'],
        ['SANIT', 'Sanitaires / WC'],
        ['TRAIT', 'Traiteur / Restauration'],
        ['COMM', 'Communication / Signalétique'],
        ['PRINT', 'Impression / Sérigraphie'],
        ['PHOTO', 'Photo / Vidéo (captation)'],
        ['ARTIS', 'Artiste / Intermittent'],
        ['TECHN', 'Technicien spécialisé'],
        ['FORM', 'Formation / Conseil'],
        ['ADMIN', 'Administratif / Juridique'],
        ['AUTRE', 'Autre'],
      ];
      services.forEach(([code, name], i) => ins.run(code, name, i + 1));
      logger.info('  ✅ Seed: annuaire_service_types (' + services.length + ')');
    }

    const asCount = db.prepare('SELECT COUNT(*) as c FROM annuaire_activity_sectors').get();
    if (asCount.c === 0) {
      const ins = db.prepare(
        'INSERT INTO annuaire_activity_sectors (code, name, sort_order) VALUES (?, ?, ?)',
      );
      const sectors = [
        ['SPEC', 'Spectacle vivant'],
        ['MUSIC', 'Musique / Concert'],
        ['FEST', 'Festivals'],
        ['CORP', 'Événementiel corporate'],
        ['SPORT', 'Événement sportif'],
        ['EXPO', 'Exposition / Salon'],
        ['CINE', 'Cinéma / Audiovisuel'],
        ['THEATRE', 'Théâtre'],
        ['COLLECT', 'Collectivités / Institutionnel'],
        ['INDUS', 'Industrie'],
        ['BTP', 'BTP / Construction'],
        ['AUTO', 'Automobile'],
        ['AGRI', 'Agriculture'],
        ['SANTE', 'Santé'],
        ['EDUC', 'Éducation / Formation'],
        ['AUTRE', 'Autre'],
      ];
      sectors.forEach(([code, name], i) => ins.run(code, name, i + 1));
      logger.info('  ✅ Seed: annuaire_activity_sectors (' + sectors.length + ')');
    }

    const ccCount = db.prepare('SELECT COUNT(*) as c FROM annuaire_contact_categories').get();
    if (ccCount.c === 0) {
      const ins = db.prepare(
        'INSERT INTO annuaire_contact_categories (code, name, sort_order) VALUES (?, ?, ?)',
      );
      const categories = [
        ['DIR', 'Direction / Gérant'],
        ['COMM', 'Commercial'],
        ['TECH', 'Technique / Régisseur'],
        ['ADMIN', 'Administratif'],
        ['COMPTA', 'Comptabilité'],
        ['ACHAT', 'Achats'],
        ['LOGIST', 'Logistique / Livraison'],
        ['SAV', 'SAV / Support'],
        ['RH', 'Ressources humaines'],
        ['PROD', 'Production / Planning'],
        ['JURIDI', 'Juridique'],
        ['AUTRE', 'Autre'],
      ];
      categories.forEach(([code, name], i) => ins.run(code, name, i + 1));
      logger.info('  ✅ Seed: annuaire_contact_categories (' + categories.length + ')');
    }

    logger.info('  ✅ Module Annuaire initialisé');
  } catch (error) {
    logger.warn('⚠️ Migration Annuaire:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Articles Fournisseurs (Catalogues PDF)
  // ═══════════════════════════════════════════════════════════════
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        supplier_ref TEXT,
        brand TEXT,
        model TEXT,
        designation TEXT NOT NULL,
        description TEXT,
        family TEXT,
        subfamily TEXT,
        category TEXT,
        price_ht REAL,
        currency TEXT DEFAULT 'EUR',
        weight REAL,
        dimensions TEXT,
        unit TEXT DEFAULT 'u',
        metadata TEXT,
        import_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (import_id) REFERENCES catalog_imports(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS catalog_imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        filename TEXT NOT NULL,
        file_size INTEGER,
        page_count INTEGER,
        items_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        imported_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_articles_supplier ON supplier_articles(supplier_id)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_articles_brand ON supplier_articles(brand)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_articles_family ON supplier_articles(family)');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_articles_ref ON supplier_articles(supplier_ref)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_supplier_articles_import ON supplier_articles(import_id)',
    );
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_articles_unique ON supplier_articles(supplier_id, supplier_ref) WHERE supplier_ref IS NOT NULL',
    );

    logger.info('  ✅ Module Articles Fournisseurs initialisé');
  } catch (error) {
    logger.warn('⚠️ Migration Articles Fournisseurs:', error.message);
  }

  // ── Index de performance — Phase 4 ──
  // Véhicules & réservations (tables les plus requêtées)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
    CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration);
    CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_to ON vehicles(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_reservations_vehicle ON reservations(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_reservations_affaire ON reservations(affaire);
    CREATE INDEX IF NOT EXISTS idx_reservations_created_by ON reservations(created_by);
  `);
  // Maintenances
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle ON maintenances(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_maintenances_status ON maintenances(status);
    CREATE INDEX IF NOT EXISTS idx_maintenances_date ON maintenances(date);
    CREATE INDEX IF NOT EXISTS idx_maintenances_type ON maintenances(type);
  `);
  // Historique des modifications (audit logs)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_entity ON modification_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_history_user ON modification_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON modification_history(timestamp);
  `);
  // Référentiels (clients, conducteurs, lieux, garages)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
    CREATE INDEX IF NOT EXISTS idx_reservation_requests_status ON reservation_requests(status);
  `);
  // Sessions actives
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON active_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON active_sessions(token_hash);
  `);

  // Index critiques auth & lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash);
    CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);
  `);

  logger.info('✅ Base de données initialisée');
}

// Fonctions helper réexportées depuis db-helpers.js
// (conservé ici pour compatibilité avec les imports existants)
export { addToHistory, getHistory } from './db-helpers.js';

initializeDatabase();

// Migrations post-init extraites dans migrations.js
import { runPostInitMigrations } from './migrations.js';
runPostInitMigrations(db);

// Fonction pour faire un checkpoint WAL (synchroniser les données sur disque)
export function checkpointDatabase() {
  try {
    db.pragma('wal_checkpoint(FULL)');
    logger.info('✅ Checkpoint WAL effectué');
  } catch (error) {
    logger.error('❌ Erreur checkpoint WAL:', error);
  }
}

// Fonction pour fermer proprement la base de données
export function closeDatabase() {
  try {
    clearInterval(checkpointTimer);
    // Faire un checkpoint final avant de fermer
    checkpointDatabase();
    db.close();
    logger.info('✅ Base de données fermée proprement');
  } catch (error) {
    logger.error('❌ Erreur fermeture DB:', error);
  }
}

// Checkpoint automatique toutes les 5 minutes
const checkpointTimer = setInterval(
  () => {
    checkpointDatabase();
  },
  5 * 60 * 1000,
);

export default db;
