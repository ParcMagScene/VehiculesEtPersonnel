import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ⚠️ En ESM, les imports sont hoistés et exécutés AVANT le code de server.js.
// On doit charger dotenv ici pour que DB_PATH soit défini au moment de la lecture.
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
console.log(`📂 Base de données: ${DB_FILENAME} (mode: ${mode})`);

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
      google_drive_link TEXT,
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
      type TEXT NOT NULL DEFAULT 'technicien',
      status TEXT NOT NULL DEFAULT 'active',
      user_id INTEGER,
      driver_id INTEGER,
      license_types TEXT DEFAULT '[]',
      certifications TEXT DEFAULT '[]',
      contract_type TEXT,
        -- Type de contrat pour contractuels : 'intermittent', 'freelance', 'CDD', etc.
        -- NULL si type = 'permanent'
      default_positions TEXT DEFAULT '[]',
        -- JSON array des postes habituels : ["Technicien son", "Régisseur", etc.]
      notes TEXT,
      photo TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
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

  // Table des disponibilités / indisponibilités
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
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

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
        -- DEPRECATED: Ancienne FK vers une seule compétence requise
        -- Remplacé par required_skills (JSON array) qui permet plusieurs compétences
        -- Conservé pour compatibilité avec anciennes données
      required_skills TEXT,
        -- JSON array d'IDs de compétences requises : [1, 3, 5]
        -- Remplace required_skill_id pour supporter plusieurs compétences
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
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
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
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
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

  console.log('✅ Module Planning Personnel initialisé');

  // ═══════════════════════════════════════════════════════
  // MODULE AFFAIRES
  // ═══════════════════════════════════════════════════════

  db.exec(`
    CREATE TABLE IF NOT EXISTS affaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_affaire TEXT NOT NULL UNIQUE,
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
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_affaires_numero ON affaires(numero_affaire);
    CREATE INDEX IF NOT EXISTS idx_affaires_dates ON affaires(date_debut, date_fin);
    CREATE INDEX IF NOT EXISTS idx_affaires_type ON affaires(type);
    CREATE INDEX IF NOT EXISTS idx_affaires_google_event ON affaires(google_event_id);
  `);

  console.log('✅ Module Affaires initialisé');

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
      ('Assistant production', 'production', 0)
  `);

  console.log('✅ Module Postes initialisé');

  // Migration: required_skill_id (INTEGER FK) → required_skills (TEXT JSON, sans FK)
  try {
    const missionCols = db.prepare("PRAGMA table_info(missions)").all();
    const hasRequiredSkills = missionCols.some(col => col.name === 'required_skills');
    if (!hasRequiredSkills) {
      db.prepare("ALTER TABLE missions ADD COLUMN required_skills TEXT DEFAULT NULL").run();
      // Migrer les données existantes
      const missions = db.prepare('SELECT id, required_skill_id FROM missions WHERE required_skill_id IS NOT NULL').all();
      const update = db.prepare('UPDATE missions SET required_skills = ? WHERE id = ?');
      for (const m of missions) {
        // Si c'est déjà un JSON array, le garder tel quel ; sinon, l'emballer
        let val = String(m.required_skill_id);
        try { const parsed = JSON.parse(val); if (!Array.isArray(parsed)) val = JSON.stringify([m.required_skill_id]); }
        catch { val = JSON.stringify([m.required_skill_id]); }
        update.run(val, m.id);
      }
      console.log('✅ Migration required_skill_id → required_skills effectuée');
    }
  } catch (error) {
    console.warn('⚠️ Migration required_skills:', error.message);
  }

  // Migration: ajouter default_positions (JSON) dans persons
  try {
    const personsCols = db.prepare("PRAGMA table_info(persons)").all();
    const hasDefaultPositions = personsCols.some(col => col.name === 'default_positions');
    if (!hasDefaultPositions) {
      db.prepare("ALTER TABLE persons ADD COLUMN default_positions TEXT DEFAULT '[]'").run();
      console.log('✅ Colonne default_positions ajoutée à persons');
    }
  } catch (error) {
    // Colonne déjà présente
  }

  // ═══════════════════════════════════════════════════════
  // FIN MODULE PLANNING PERSONNEL
  // ═══════════════════════════════════════════════════════

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

  // Migration: ajouter google_drive_link dans reservations
  try {
    const resColumns = db.prepare("PRAGMA table_info(reservations)").all();
    const hasDriveLink = resColumns.some(col => col.name === 'google_drive_link');
    if (!hasDriveLink) {
      db.prepare("ALTER TABLE reservations ADD COLUMN google_drive_link TEXT").run();
      console.log('✅ Colonne google_drive_link ajoutée à reservations');
    }
  } catch (error) {
    console.log('Info: Colonne google_drive_link déjà présente');
  }

  // Migration: ajouter contract_type dans persons + migrer les types existants
  try {
    const personsColumns = db.prepare("PRAGMA table_info(persons)").all();
    const hasContractType = personsColumns.some(col => col.name === 'contract_type');
    if (!hasContractType) {
      db.prepare("ALTER TABLE persons ADD COLUMN contract_type TEXT").run();
      console.log('✅ Colonne contract_type ajoutée à persons');

      // Migrer les types existants vers le nouveau système
      // salarié, technicien, conducteur → type='permanent'
      // intermittent → type='contractuel', contract_type='intermittent'
      // indépendant → type='contractuel', contract_type='freelance'
      const personsToMigrate = db.prepare("SELECT id, type FROM persons").all();
      const updateStmt = db.prepare("UPDATE persons SET type = ?, contract_type = ? WHERE id = ?");
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
        console.log(`✅ Migration types personnel : ${migrated} personnes migrées (permanent/contractuel)`);
      }
    }
  } catch (error) {
    console.log('Info: Colonne contract_type déjà présente ou erreur migration:', error.message);
  }

  // Migration: ajouter day_states (JSON) dans missions pour stocker les jours ON/OFF
  try {
    db.prepare("ALTER TABLE missions ADD COLUMN day_states TEXT").run();
    console.log('✅ Migration: colonne day_states ajoutée à missions');
  } catch (error) {
    // Colonne déjà présente — OK
  }

  // Migration: ajouter colonne 'affaire' dans missions pour lien direct affaire↔mission
  try {
    db.prepare("ALTER TABLE missions ADD COLUMN affaire TEXT").run();
    console.log('✅ Migration: colonne affaire ajoutée à missions');
    // Backfill: extraire le numéro d'affaire depuis le titre (ex: "AF32512 — ...")
    const missionsToFix = db.prepare("SELECT id, title, notes FROM missions WHERE affaire IS NULL").all();
    for (const m of missionsToFix) {
      // Chercher un pattern AF\d+ dans le titre ou les notes
      const match = (m.title || '').match(/AF\d+/i) || (m.notes || '').match(/AF\d+/i);
      if (match) {
        db.prepare('UPDATE missions SET affaire = ? WHERE id = ?').run(match[0].toUpperCase(), m.id);
      }
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_missions_affaire ON missions(affaire)');
    console.log('✅ Migration: backfill affaire dans missions effectué');
  } catch (error) {
    // Colonne déjà présente — OK
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
