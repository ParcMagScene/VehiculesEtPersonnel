// ═══════════════════════════════════════════════════════════════
// migrations/video-v1.js — Module Surveillance Vidéo
// Tables: cameras, video_access_logs, video_sessions
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runVideoMigrations(db) {
  // ─── 1. Table cameras ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT DEFAULT 'generic',
      model TEXT,
      ip TEXT NOT NULL,
      rtsp_url TEXT,
      rtsp_port INTEGER DEFAULT 554,
      http_port INTEGER DEFAULT 80,
      username TEXT,
      password_encrypted TEXT,
      ptz_supported BOOLEAN DEFAULT 0,
      location TEXT,
      affaire_id INTEGER,
      zone TEXT,
      enabled BOOLEAN DEFAULT 1,
      stream_profile TEXT DEFAULT 'main',
      snapshot_path TEXT,
      last_seen DATETIME,
      status TEXT DEFAULT 'offline' CHECK(status IN ('online','offline','error')),
      sort_order INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`);
    logger.info('  ✅ Migration video: table cameras OK');
  } catch (e) {
    if (!e.message.includes('already exists')) logger.warn('Migration cameras:', e.message);
  }

  // ─── 2. Table video_access_logs ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS video_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      camera_id INTEGER NOT NULL,
      camera_name TEXT,
      action TEXT NOT NULL CHECK(action IN ('view','snapshot','ptz','start_stream','stop_stream')),
      ip_address TEXT,
      details TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    )`);
    logger.info('  ✅ Migration video: table video_access_logs OK');
  } catch (e) {
    if (!e.message.includes('already exists'))
      logger.warn('Migration video_access_logs:', e.message);
  }

  // ─── 3. Table video_sessions (sessions WebRTC actives) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS video_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camera_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      peer_id TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','closed','error')),
      started_at DATETIME DEFAULT (datetime('now')),
      ended_at DATETIME,
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    )`);
    logger.info('  ✅ Migration video: table video_sessions OK');
  } catch (e) {
    if (!e.message.includes('already exists')) logger.warn('Migration video_sessions:', e.message);
  }

  // ─── 4. Index de performance ───
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cameras_enabled ON cameras(enabled)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cameras_affaire ON cameras(affaire_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_video_logs_camera ON video_access_logs(camera_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_video_logs_user ON video_access_logs(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_video_sessions_token ON video_sessions(session_token)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status)`);
    logger.info('  ✅ Migration video: index OK');
  } catch (e) {
    logger.warn('Migration video index:', e.message);
  }

  // ─── 5. Colonne channel (multi-channel par caméra) ───
  try {
    db.exec(`ALTER TABLE cameras ADD COLUMN channel INTEGER DEFAULT 1`);
    logger.info('  ✅ Migration video: colonne channel ajoutée');
  } catch (e) {
    if (!e.message.includes('duplicate column')) {
      /* déjà présente, OK */
    }
  }

  // ─── 5bis. [T-P0-17] Enrichissement `video_access_logs` : ajout des
  //     colonnes user_agent, request_id, resource_uri (URI RTSP masquée),
  //     response_status. Idempotent via pragma table_info.
  //     Voir docs/02-Securite/VIDEO_HARDENING.md §5.
  try {
    const cols = db.pragma('table_info(video_access_logs)');
    const names = cols.map((c) => c.name);
    if (!names.includes('user_agent')) {
      db.exec(`ALTER TABLE video_access_logs ADD COLUMN user_agent TEXT`);
      logger.info('  ✅ video_access_logs.user_agent ajoutée');
    }
    if (!names.includes('request_id')) {
      db.exec(`ALTER TABLE video_access_logs ADD COLUMN request_id TEXT`);
      logger.info('  ✅ video_access_logs.request_id ajoutée');
    }
    if (!names.includes('resource_uri')) {
      db.exec(`ALTER TABLE video_access_logs ADD COLUMN resource_uri TEXT`);
      logger.info('  ✅ video_access_logs.resource_uri ajoutée');
    }
    if (!names.includes('response_status')) {
      db.exec(`ALTER TABLE video_access_logs ADD COLUMN response_status INTEGER`);
      logger.info('  ✅ video_access_logs.response_status ajoutée');
    }
  } catch (e) {
    logger.warn('Migration video_access_logs (T-P0-17):', e.message);
  }

  // ─── 6. Table camera_presets (vues multi-caméras) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS camera_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      camera_ids TEXT NOT NULL DEFAULT '[]',
      user_id INTEGER,
      is_shared BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`);
    logger.info('  ✅ Migration video: table camera_presets OK');
  } catch (e) {
    if (!e.message.includes('already exists')) logger.warn('Migration camera_presets:', e.message);
  }

  // ─── 7. Nettoyage sessions expirées (> 24h) ───
  try {
    db.exec(
      `DELETE FROM video_sessions WHERE status != 'active' AND started_at < datetime('now', '-1 day')`,
    );
  } catch (_) {
    /* ignore */
  }
}
