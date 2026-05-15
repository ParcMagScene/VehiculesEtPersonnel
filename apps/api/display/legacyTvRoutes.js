// ═══════════════════════════════════════════════════════════════
// apps/api/display/legacyTvRoutes.js
// [S2-1] Extrait de displayRoutes.js (split par sous-domaine).
// Routes legacy /api/... historiquement consommées par le client TV
// (events, config, welcome-message, completed-events, color-rules,
// location-icons, weather, sneaky-photo, logo).
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import { basename, join, resolve, sep } from 'path';

import db from '../database.js';
import logger from '../logger.js';

/**
 * @param {import('express').Application} app
 * @param {{
 *   optionalTvToken: import('express').RequestHandler,
 *   tvWriteLimiter: import('express').RequestHandler,
 *   displayDataDir: string,
 *   sneakyDir: string,
 *   logoDir: string,
 *   readJsonFile: (path: string, fallback?: unknown) => unknown,
 *   isValidEventId: (id: string) => boolean,
 * }} deps
 */
export function setupDisplayLegacyTvRoutes(app, deps) {
  const {
    optionalTvToken,
    tvWriteLimiter,
    displayDataDir,
    sneakyDir,
    logoDir,
    readJsonFile,
    isValidEventId,
  } = deps;

  // /api/events → Tâches du jour au format { regular, recurrent }
  app.get('/api/events', optionalTvToken, async (_req, res) => {
    try {
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const dayTasks = db
        .prepare(
          `SELECT ta.id, ta.title, ta.time, ta.end_time, ta.section, ta.period,
                ta.notes, ta.status, ta.source_type, ta.google_event_title, ta.affaire_num,
                dde.client AS event_client, dde.location AS event_location,
                COALESCE(
                  v.name,
                  (
                    SELECT GROUP_CONCAT(DISTINCT v2.name)
                    FROM reservations r2
                    LEFT JOIN vehicles v2 ON r2.vehicle_id = v2.id
                    WHERE (
                        (
                          ta.affaire_num != ''
                          AND UPPER(r2.affaire) = UPPER(ta.affaire_num)
                        )
                        OR (
                          (r2.affaire IS NULL OR TRIM(r2.affaire) = '')
                          AND r2.client_name IS NOT NULL
                          AND ta.affaire_num != ''
                          AND EXISTS (
                            SELECT 1
                            FROM affaires af2
                            WHERE af2.numero_affaire = ta.affaire_num
                              AND (
                                (
                                  COALESCE(TRIM(af2.client), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.client))) > 0
                                    OR INSTR(LOWER(TRIM(af2.client)), LOWER(r2.client_name)) >
                                      0
                                  )
                                )
                                OR (
                                  COALESCE(TRIM(af2.nom), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.nom))) > 0
                                    OR INSTR(LOWER(TRIM(af2.nom)), LOWER(r2.client_name)) > 0
                                  )
                                )
                                OR (
                                  COALESCE(TRIM(af2.titre), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.titre))) > 0
                                    OR INSTR(LOWER(TRIM(af2.titre)), LOWER(r2.client_name)) > 0
                                  )
                                )
                              )
                          )
                        )
                      )
                      AND ta.date >= r2.start_date
                      AND ta.date <= r2.end_date
                  )
                ) AS reservation_vehicle_name,
                COALESCE(
                  v.registration,
                  (
                    SELECT GROUP_CONCAT(DISTINCT v2.registration)
                    FROM reservations r2
                    LEFT JOIN vehicles v2 ON r2.vehicle_id = v2.id
                    WHERE (
                        (
                          ta.affaire_num != ''
                          AND UPPER(r2.affaire) = UPPER(ta.affaire_num)
                        )
                        OR (
                          (r2.affaire IS NULL OR TRIM(r2.affaire) = '')
                          AND r2.client_name IS NOT NULL
                          AND ta.affaire_num != ''
                          AND EXISTS (
                            SELECT 1
                            FROM affaires af2
                            WHERE af2.numero_affaire = ta.affaire_num
                              AND (
                                (
                                  COALESCE(TRIM(af2.client), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.client))) > 0
                                    OR INSTR(LOWER(TRIM(af2.client)), LOWER(r2.client_name)) >
                                      0
                                  )
                                )
                                OR (
                                  COALESCE(TRIM(af2.nom), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.nom))) > 0
                                    OR INSTR(LOWER(TRIM(af2.nom)), LOWER(r2.client_name)) > 0
                                  )
                                )
                                OR (
                                  COALESCE(TRIM(af2.titre), '') != ''
                                  AND (
                                    INSTR(LOWER(r2.client_name), LOWER(TRIM(af2.titre))) > 0
                                    OR INSTR(LOWER(TRIM(af2.titre)), LOWER(r2.client_name)) > 0
                                  )
                                )
                              )
                          )
                        )
                      )
                      AND ta.date >= r2.start_date
                      AND ta.date <= r2.end_date
                  )
                ) AS reservation_vehicle_reg
         FROM task_assignments ta
         LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
         LEFT JOIN reservations r ON ta.reservation_id = r.id
         LEFT JOIN vehicles v ON r.vehicle_id = v.id
         WHERE ta.date = ? AND ta.visible = 1
           AND ta.status != 'cancelled'
           AND ta.deleted_at IS NULL
         ORDER BY ta.time ASC, ta.created_at ASC`,
        )
        .all(todayISO);

      const SECTION_LABELS = {
        rdv: 'RDV',
        evenements: 'Événement',
        taches_prioritaires: 'Prioritaire',
        courses: 'Courses',
        prep_locations: 'Prépa Location',
        prep_prestations: 'Prépa Prestation',
        prep_ventes: 'Prépa Vente',
        prep_installations: 'Prépa Installation',
        prep_tournees: 'Prépa Tournée',
        chargement: 'Chargement',
        depart: 'Départ',
        enlevement: 'Enlèvement',
        retour: 'Retour',
        recuperation: 'Récupération',
        installation: 'Installation',
        taches_secondaires: 'Secondaire',
        manual: 'Divers',
      };

      const events = dayTasks.map((t) => ({
        id: String(t.id),
        start: t.time ? `${todayISO}T${t.time}` : todayISO,
        end: t.end_time ? `${todayISO}T${t.end_time}` : '',
        summary: t.google_event_title || t.title || '',
        title: t.google_event_title || t.title || '',
        section: t.section || 'manual',
        sectionLabel: SECTION_LABELS[t.section] || t.section || 'Divers',
        status: t.status || 'pending',
        location: t.event_location || '',
        client: t.event_client || '',
        reservation_vehicle_name: t.reservation_vehicle_name || '',
        reservation_vehicle_reg: t.reservation_vehicle_reg || '',
        description: t.affaire_num ? `Affaire ${t.affaire_num}` : t.notes || '',
        is_recurrent: t.source_type === 'recurring' ? 1 : 0,
      }));

      events.sort((a, b) => a.start.localeCompare(b.start));

      res.json({
        regular: events.filter((e) => !e.is_recurrent),
        recurrent: events.filter((e) => e.is_recurrent),
        all: events,
      });
    } catch (error) {
      logger.error('Compat /api/events:', error);
      res.status(500).json({ success: false, error: 'Impossible de récupérer les événements' });
    }
  });

  // /api/config → config apparence
  app.get('/api/config', optionalTvToken, (_req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM display_config').all();
      const config = {};
      rows.forEach((r) => {
        try {
          config[r.key] = JSON.parse(r.value);
        } catch {
          config[r.key] = r.value;
        }
      });
      res.json(config);
    } catch (error) {
      logger.error('Compat /api/config:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/welcome-message → message d'accueil
  app.get('/api/welcome-message', optionalTvToken, (_req, res) => {
    try {
      const sneakyFile = join(displayDataDir, 'sneaky-message.json');
      const sneaky = readJsonFile(sneakyFile, null);
      if (sneaky && sneaky.active && new Date(sneaky.expiresAt) > new Date()) {
        return res.json({ message: sneaky.message });
      }
      const now = new Date();
      const joursFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const day = joursFR[now.getDay()];
      const hh = now.getHours();
      const mm = now.getMinutes();
      let slot = 'soir';
      if (hh >= 6 && (hh < 9 || (hh === 9 && mm < 30))) slot = 'matin';
      else if ((hh === 9 && mm >= 30) || (hh >= 10 && hh < 12)) slot = 'matinee';
      else if (hh >= 12 && hh < 13) slot = 'midi';
      else if (hh >= 13 && hh < 18) slot = 'apres_midi';
      const row = db
        .prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?')
        .get(day, slot);
      res.json({ message: row?.message || '' });
    } catch (error) {
      logger.error('Compat /api/welcome-message:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/completed-events → événements terminés du jour
  app.get('/api/completed-events', optionalTvToken, (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = db
        .prepare('SELECT event_id FROM display_completed_events WHERE event_date = ?')
        .all(today);
      res.json({ completed: rows.map((r) => r.event_id) });
    } catch (error) {
      logger.error('Compat /api/completed-events:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/complete-event → marquer terminé
  app.post('/api/complete-event', optionalTvToken, tvWriteLimiter, (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId || !isValidEventId(String(eventId)))
        return res.status(400).json({ success: false, error: 'eventId invalide' });
      const today = new Date().toISOString().split('T')[0];
      db.prepare(
        'INSERT OR IGNORE INTO display_completed_events (event_id, event_date) VALUES (?, ?)',
      ).run(String(eventId), today);
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Compat /api/complete-event:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/uncomplete-event → démarquer
  app.post('/api/uncomplete-event', optionalTvToken, tvWriteLimiter, (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId || !isValidEventId(String(eventId)))
        return res.status(400).json({ success: false, error: 'eventId invalide' });
      const today = new Date().toISOString().split('T')[0];
      db.prepare('DELETE FROM display_completed_events WHERE event_id = ? AND event_date = ?').run(
        String(eventId),
        today,
      );
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Compat /api/uncomplete-event:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/event-color-rules → règles de couleurs
  app.get('/api/event-color-rules', optionalTvToken, (_req, res) => {
    try {
      const rules = db
        .prepare('SELECT keyword, color, description FROM display_color_rules ORDER BY sort_order')
        .all();
      res.json(rules);
    } catch (error) {
      logger.error('Compat /api/event-color-rules:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/location-icons → icônes de lieux
  app.get('/api/location-icons', optionalTvToken, (_req, res) => {
    try {
      const rules = db
        .prepare(
          'SELECT keyword, gif_filename FROM display_location_icon_rules ORDER BY sort_order',
        )
        .all();
      res.json(rules);
    } catch (error) {
      logger.error('Compat /api/location-icons:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/weather → météo (proxy)
  app.get('/api/weather', optionalTvToken, async (_req, res) => {
    try {
      const apiKeyRow = db
        .prepare("SELECT value FROM display_config WHERE key = 'weatherApiKey'")
        .get();
      const cityRow = db
        .prepare("SELECT value FROM display_config WHERE key = 'weatherCity'")
        .get();
      const apiKey = apiKeyRow ? JSON.parse(apiKeyRow.value) : '';
      const city = cityRow ? JSON.parse(cityRow.value) : 'Saint-Denis,RE,FR';
      if (!apiKey)
        return res.status(503).json({ success: false, error: 'Clé API météo non configurée' });
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      logger.error('Compat /api/weather:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/sneaky-photo/status → photo furtive
  app.get('/api/sneaky-photo/status', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-photo.json'), null);
      if (config && config.active && new Date(config.expiresAt) > new Date()) {
        res.json({ active: true, expiresAt: config.expiresAt, path: config.path });
      } else {
        res.json({ active: false });
      }
    } catch (error) {
      logger.error('Compat /api/sneaky-photo/status:', error);
      res.json({ active: false });
    }
  });

  // /api/sneaky-photo/image → image furtive
  app.get('/api/sneaky-photo/image', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-photo.json'), null);
      if (config && config.active && config.filename) {
        // [SEC PHASE 1] Defense in depth contre path traversal :
        // basename() + resolve()-startsWith.
        const safeName = basename(String(config.filename));
        if (safeName && safeName !== '.' && safeName !== '..') {
          const filePath = resolve(sneakyDir, safeName);
          const baseResolved = resolve(sneakyDir);
          if (
            (filePath === baseResolved || filePath.startsWith(baseResolved + sep)) &&
            fs.existsSync(filePath)
          ) {
            return res.sendFile(filePath);
          }
        }
      }
      res.status(404).json({ success: false, error: 'Aucune photo active' });
    } catch (_error) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // /api/logo → logo
  app.get('/api/logo', (_req, res) => {
    try {
      const files = fs
        .readdirSync(logoDir)
        .filter((f) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
      if (files.length > 0) {
        return res.sendFile(join(logoDir, files[0]));
      }
      res.status(404).json({ success: false, error: 'Aucun logo trouvé' });
    } catch (_error) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
