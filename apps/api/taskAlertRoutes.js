// ═══════════════════════════════════════════════════════════════
// taskAlertRoutes.js — Alertes sonores sur les taches planifiees
//
// Config par section (rdv, courses, chargement, depart, ...) :
//   - toggle enabled
//   - son (bibliotheque predefinie ou upload custom)
//   - offset (minutes avant l'heure de debut)
//   - blink_duration_sec (15 / 30 / 60 / 300 / 900 / -1=infini)
//
// Endpoints publics (auth TV) : /alert-sounds/list  /alerts/ack/:taskId
// Endpoints admin (JWT admin) : rules CRUD, sound upload/delete.
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import multer from 'multer';
import { basename, extname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

import db from './database.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

// public/alert-sounds/ : sons predefinis (bell/buzzer/chime/siren/klaxon/whistle)
// + sons uploades par l'admin, prefixe custom-<timestamp>.<ext>.
const alertSoundsDir = join(__dirname, '..', '..', 'public', 'alert-sounds');
fs.mkdirSync(alertSoundsDir, { recursive: true });

const BUILTIN_SOUNDS = [
  { name: 'bell', label: 'Cloche', path: '/alert-sounds/bell.wav' },
  { name: 'buzzer', label: 'Buzzer', path: '/alert-sounds/buzzer.wav' },
  { name: 'chime', label: 'Carillon', path: '/alert-sounds/chime.wav' },
  { name: 'siren', label: 'Sirène', path: '/alert-sounds/siren.wav' },
  { name: 'klaxon', label: 'Klaxon', path: '/alert-sounds/klaxon.wav' },
  { name: 'whistle', label: 'Sifflet', path: '/alert-sounds/whistle.wav' },
];

const SECTIONS = [
  'rdv',
  'evenements',
  'taches_prioritaires',
  'courses',
  'prep_locations',
  'prep_prestations',
  'prep_ventes',
  'prep_installations',
  'prep_tournees',
  'chargement',
  'depart',
  'enlevement',
  'retour',
  'recuperation',
  'installation',
  'montage',
  'demontage',
  'intervention',
  'taches_secondaires',
  'manual',
];

const VALID_BLINK_DURATIONS = new Set([15, 30, 60, 300, 900, -1]);
const MAX_OFFSET_MINUTES = 60;

// ── Multer : upload sons custom (max 2 Mo, mimetype audio/*) ──
const soundStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, alertSoundsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    const safeExt = /^\.(mp3|wav|ogg|m4a|aac|webm)$/.test(ext) ? ext : '.mp3';
    cb(null, `custom-${Date.now()}${safeExt}`);
  },
});
const uploadSound = multer({
  storage: soundStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Seuls les fichiers audio sont autorisés'));
  },
});

/** Charge la regle d'une section (ou retourne le default si aucune ligne). */
function getRuleForSection(db, section) {
  const row = db.prepare('SELECT * FROM task_alert_rules WHERE section = ?').get(section);
  if (row) {
    return {
      section: row.section,
      enabled: !!row.enabled,
      soundPath: row.sound_path,
      offsetMinutes: row.offset_minutes,
      blinkDurationSec: row.blink_duration_sec,
      updatedAt: row.updated_at,
    };
  }
  return {
    section,
    enabled: false,
    soundPath: '/alert-sounds/bell.wav',
    offsetMinutes: 0,
    blinkDurationSec: 30,
    updatedAt: null,
  };
}

/**
 * Calcule les alertes actives pour un lot de taches du jour.
 * Une alerte est active si :
 *   - la section a une regle enabled
 *   - la tache a un `time` (HH:MM)
 *   - `now >= (task.time - offsetMinutes)` cote heure locale
 *   - la tache n'est pas 'done' / 'cancelled'
 *   - pas d'acquittement dans task_alert_acks pour ce (taskId, eventDate)
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} todayISO YYYY-MM-DD
 * @param {Array<{id:string,time:string,section:string,status:string}>} dayTasks
 * @returns {Array<{taskId:string, section:string, soundPath:string, triggeredAt:string, blinkDurationSec:number}>}
 */
export function computeActiveAlerts(db, todayISO, dayTasks) {
  if (!Array.isArray(dayTasks) || dayTasks.length === 0) return [];

  // Precache toutes les regles activees
  const enabledRules = db.prepare('SELECT * FROM task_alert_rules WHERE enabled = 1').all();
  if (enabledRules.length === 0) return [];
  const rulesBySection = new Map(enabledRules.map((r) => [r.section, r]));

  // Precache les ack du jour
  const acks = db.prepare('SELECT task_id FROM task_alert_acks WHERE event_date = ?').all(todayISO);
  const ackedSet = new Set(acks.map((a) => a.task_id));

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const alerts = [];
  for (const task of dayTasks) {
    if (!task.time || typeof task.time !== 'string') continue;
    if (task.status === 'done' || task.status === 'cancelled') continue;

    const rule = rulesBySection.get(task.section);
    if (!rule) continue;

    const [hh, mm] = task.time.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const taskMinutes = hh * 60 + mm;
    const triggerMinutes = taskMinutes - (rule.offset_minutes || 0);

    if (nowMinutes >= triggerMinutes) {
      if (ackedSet.has(String(task.id))) continue;
      alerts.push({
        taskId: String(task.id),
        section: task.section,
        soundPath: rule.sound_path,
        triggeredAt: `${todayISO}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`,
        blinkDurationSec: rule.blink_duration_sec,
        offsetMinutes: rule.offset_minutes || 0,
      });
    }
  }
  return alerts;
}

export function setupTaskAlertRoutes(app, authenticateToken, requireAdmin, optionalTvToken) {
  // ── GET /api/display/alert-rules — liste completes (avec sections defaults) ──
  app.get('/api/display/alert-rules', authenticateToken, (_req, res) => {
    try {
      const rules = SECTIONS.map((s) => getRuleForSection(db, s));
      res.json({ sections: rules });
    } catch (e) {
      logger.error('alert-rules list:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ── PUT /api/display/alert-rules/:section — upsert d'une regle ──
  app.put('/api/display/alert-rules/:section', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { section } = req.params;
      if (!SECTIONS.includes(section)) {
        return res.status(400).json({ success: false, error: 'Section inconnue' });
      }
      const {
        enabled = false,
        soundPath = '/alert-sounds/bell.wav',
        offsetMinutes = 0,
        blinkDurationSec = 30,
      } = req.body || {};

      const off = parseInt(offsetMinutes, 10);
      if (!Number.isFinite(off) || off < 0 || off > MAX_OFFSET_MINUTES) {
        return res
          .status(400)
          .json({
            success: false,
            error: `offsetMinutes doit être entre 0 et ${MAX_OFFSET_MINUTES}`,
          });
      }
      const dur = parseInt(blinkDurationSec, 10);
      if (!VALID_BLINK_DURATIONS.has(dur)) {
        return res.status(400).json({
          success: false,
          error: 'blinkDurationSec doit être 15, 30, 60, 300, 900 ou -1',
        });
      }

      // soundPath doit rester dans /alert-sounds/ (defense path traversal).
      const safeName = basename(String(soundPath));
      if (!safeName || safeName === '.' || safeName === '..') {
        return res.status(400).json({ success: false, error: 'soundPath invalide' });
      }
      const soundFile = resolve(alertSoundsDir, safeName);
      if (!soundFile.startsWith(resolve(alertSoundsDir) + sep)) {
        return res.status(400).json({ success: false, error: 'soundPath invalide' });
      }
      if (!fs.existsSync(soundFile)) {
        return res.status(400).json({ success: false, error: 'Fichier son introuvable' });
      }
      const normalizedSoundPath = `/alert-sounds/${safeName}`;

      db.prepare(
        `INSERT INTO task_alert_rules (section, enabled, sound_path, offset_minutes, blink_duration_sec, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(section) DO UPDATE SET
           enabled = excluded.enabled,
           sound_path = excluded.sound_path,
           offset_minutes = excluded.offset_minutes,
           blink_duration_sec = excluded.blink_duration_sec,
           updated_at = CURRENT_TIMESTAMP`,
      ).run(section, enabled ? 1 : 0, normalizedSoundPath, off, dur);

      res.json({ success: true, rule: getRuleForSection(db, section) });
    } catch (e) {
      logger.error('alert-rules upsert:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ── GET /api/display/alert-sounds — liste des sons (builtin + custom) ──
  app.get('/api/display/alert-sounds', authenticateToken, (_req, res) => {
    try {
      const files = fs.readdirSync(alertSoundsDir).filter((f) => f.startsWith('custom-'));
      const customs = files.map((f) => ({
        name: f.replace(/^custom-(\d+)\..+$/, 'Custom $1'),
        label: f,
        path: `/alert-sounds/${f}`,
        custom: true,
      }));
      res.json({ builtin: BUILTIN_SOUNDS, custom: customs });
    } catch (e) {
      logger.error('alert-sounds list:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ── POST /api/display/alert-sounds/upload — upload custom (admin only) ──
  app.post(
    '/api/display/alert-sounds/upload',
    authenticateToken,
    requireAdmin,
    uploadSound.single('sound'),
    (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Fichier requis' });
        res.json({
          success: true,
          sound: {
            label: req.file.filename,
            path: `/alert-sounds/${req.file.filename}`,
            custom: true,
          },
        });
      } catch (e) {
        logger.error('alert-sounds upload:', e);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ── DELETE /api/display/alert-sounds/:filename — suppression d'un son custom ──
  app.delete('/api/display/alert-sounds/:filename', authenticateToken, requireAdmin, (req, res) => {
    try {
      const safeName = basename(String(req.params.filename));
      if (!safeName.startsWith('custom-')) {
        return res
          .status(400)
          .json({ success: false, error: 'Seuls les sons custom peuvent être supprimés' });
      }
      const filePath = resolve(alertSoundsDir, safeName);
      if (!filePath.startsWith(resolve(alertSoundsDir) + sep)) {
        return res.status(400).json({ success: false, error: 'Nom invalide' });
      }
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      // Reset les rules qui pointaient sur ce fichier
      db.prepare(
        "UPDATE task_alert_rules SET sound_path = '/alert-sounds/bell.wav' WHERE sound_path = ?",
      ).run(`/alert-sounds/${safeName}`);

      res.json({ success: true });
    } catch (e) {
      logger.error('alert-sounds delete:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ── POST /api/display/alerts/ack/:taskId — acquitte une alerte (auth TV ou admin) ──
  app.post('/api/display/alerts/ack/:taskId', optionalTvToken || authenticateToken, (req, res) => {
    try {
      const taskId = String(req.params.taskId).slice(0, 64);
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      db.prepare(
        `INSERT INTO task_alert_acks (task_id, event_date, acked_at, acked_by)
           VALUES (?, ?, CURRENT_TIMESTAMP, ?)
           ON CONFLICT(task_id, event_date) DO UPDATE SET acked_at = CURRENT_TIMESTAMP`,
      ).run(taskId, todayISO, req.user?.id || null);

      res.json({ success: true });
    } catch (e) {
      logger.error('alerts ack:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
