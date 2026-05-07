// ═══════════════════════════════════════════════════════════════
// [S2-1 step 2] Gestion WAL extraite de database.js
//
// Module pur : chaque fonction reçoit `db` en paramètre.
// `setupWALScheduling(db)` démarre les timers ET les rend dismissibles
// (via la méthode `stop()` du handle retourné). C'est la pièce manquante
// qui permettait aux tests de laisser des timers actifs au runtime.
//
// Stratégie WAL S1-01 :
//   - PASSIVE  : 5 min   — non bloquant
//   - RESTART  : 30 min  — force la rotation du fichier WAL
//   - TRUNCATE : 1×/jour à 03:00 — libère réellement l'espace disque
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
// S3-4 — ANALYZE périodique pour rafraîchir les statistiques du planificateur.
const ANALYZE_INTERVAL = 6 * 60 * 60 * 1000; // 6 h

/**
 * Effectue un checkpoint WAL FULL (synchronise les données sur disque).
 */
export function checkpointDatabase(db) {
  try {
    db.pragma('wal_checkpoint(FULL)');
    logger.info('✅ Checkpoint WAL effectué');
  } catch (error) {
    logger.error('❌ Erreur checkpoint WAL:', error);
  }
}

/**
 * Démarre la stratégie WAL renforcée et retourne un handle dismissible.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ stop: () => void }} handle pour arrêter les timers (cleanup tests/SIGTERM)
 */
export function setupWALScheduling(db) {
  const checkpointTimer = setInterval(() => checkpointDatabase(db), FIVE_MIN);

  const restartTimer = setInterval(() => {
    try {
      const r = db.pragma('wal_checkpoint(RESTART)');
      logger.info(`🔁 WAL RESTART: ${JSON.stringify(r)}`);
    } catch (e) {
      logger.warn('⚠️ WAL RESTART échec (readers actifs):', e.message);
    }
  }, THIRTY_MIN);

  let truncateTimer = null;
  let truncateBootstrap = null;

  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  truncateBootstrap = setTimeout(() => {
    try {
      const r = db.pragma('wal_checkpoint(TRUNCATE)');
      logger.info(`🧹 WAL TRUNCATE quotidien: ${JSON.stringify(r)}`);
    } catch (e) {
      logger.error('❌ WAL TRUNCATE échec:', e);
    }
    truncateTimer = setInterval(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (_) {
        /* noop : sera retenté demain */
      }
    }, ONE_DAY);
  }, next - now);

  // Ajustement final wal_autocheckpoint à 500 pages (≈ 2 Mo)
  try {
    db.pragma('wal_autocheckpoint = 500');
  } catch (_) {
    /* noop : pragma non critique */
  }

  // S3-4 — ANALYZE toutes les 6 h (planificateur SQLite à jour).
  // 1er ANALYZE différé pour ne pas peser sur le boot.
  const analyzeBootstrap = setTimeout(() => {
    try {
      db.exec('ANALYZE');
    } catch (_) {
      /* noop */
    }
  }, 60 * 1000);
  const analyzeTimer = setInterval(() => {
    try {
      db.exec('ANALYZE');
    } catch (_) {
      /* noop */
    }
  }, ANALYZE_INTERVAL);
  if (typeof analyzeBootstrap.unref === 'function') analyzeBootstrap.unref();
  if (typeof analyzeTimer.unref === 'function') analyzeTimer.unref();

  return {
    stop() {
      clearInterval(checkpointTimer);
      clearInterval(restartTimer);
      if (truncateTimer) clearInterval(truncateTimer);
      if (truncateBootstrap) clearTimeout(truncateBootstrap);
      clearInterval(analyzeTimer);
      clearTimeout(analyzeBootstrap);
    },
  };
}

/**
 * Ferme proprement la DB : stoppe la programmation WAL, fait un TRUNCATE
 * final puis ferme l'instance better-sqlite3.
 */
export function closeDatabase(db, scheduling) {
  try {
    if (scheduling && typeof scheduling.stop === 'function') {
      scheduling.stop();
    }
    // S1-01 — Checkpoint TRUNCATE final pour libérer le WAL avant close
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) {
      checkpointDatabase(db);
    }
    db.close();
    logger.info('✅ Base de données fermée proprement');
  } catch (error) {
    logger.error('❌ Erreur fermeture DB:', error);
  }
}
