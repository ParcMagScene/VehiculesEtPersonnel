// ═══════════════════════════════════════════════════════════════
// Module Planning — Routes Tasks + Export PDF
// Extrait de planningRoutes.js — Sprint 2
// ═══════════════════════════════════════════════════════════════

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import db from '../database.js';
import logger from '../logger.js';
import { validate } from '../schemas/imports.js';
import { taskBatchSchema, taskCreateSchema, taskUpdateSchema } from '../schemas/planning.js';
import { safeContentDispositionName } from '../utils/safeFilename.js';

// Validation dates/heures (copie locale depuis planningRoutes.js)
const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function isValidDate(str) {
  return typeof str === 'string' && DATE_RE.test(str);
}
function isValidTime(str) {
  return typeof str === 'string' && TIME_RE.test(str);
}

/**
 * Construit l'URL absolue de la vue mobile "Tâches du jour" pour une date.
 * Le hash router mobile gère la query string : `#/mobile/tasks?date=YYYY-MM-DD`.
 * La vue MobileTasks ne permet que de cocher/décocher le statut (effectué).
 */
function buildTasksDayUrl(date) {
  const root = (process.env.API_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
  return `${root}/#/mobile/tasks?date=${encodeURIComponent(date)}`;
}

/**
 * Pré-génère le buffer PNG du QR code pour une date donnée.
 * Retourne null en cas d'échec (le PDF est rendu sans QR).
 */
async function generateTasksDayQrBuffer(date) {
  try {
    return await QRCode.toBuffer(buildTasksDayUrl(date), {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 256,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    logger.warn(`[tasks-pdf] QR generation failed: ${e?.message || e}`);
    return null;
  }
}

export function setupTaskRoutes(app, authenticateToken) {
  // ═══════════════════════════════════════════════
  // PLANIFICATION — TÂCHES — CRUD
  // ═══════════════════════════════════════════════

  // ─── GET /api/planning/tasks ───
  // Filtres : date, dateFrom, dateTo, person_id, section, status
  app.get('/api/planning/tasks', authenticateToken, (req, res) => {
    try {
      let query = `
      SELECT ta.*, 
             dde.affaire_id AS event_affaire_id,
             dde.type AS event_type,
             dde.category AS event_category,
             dde.client AS event_client,
             dde.location AS event_location,
             p.first_name AS person_first_name,
             p.last_name AS person_last_name,
             r.vehicle_id AS reservation_vehicle_id,
             v.name AS reservation_vehicle_name,
             v.registration AS reservation_vehicle_reg,
             r.start_date AS reservation_start,
             r.end_date AS reservation_end,
             r.driver_name AS reservation_driver
      FROM task_assignments ta
      LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
      LEFT JOIN persons p ON ta.person_id = p.id
      LEFT JOIN reservations r ON ta.reservation_id = r.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE ta.deleted_at IS NULL
    `;
      const params = [];

      if (req.query.date) {
        query += ' AND ta.date = ?';
        params.push(req.query.date);
      }
      if (req.query.dateFrom) {
        query += ' AND ta.date >= ?';
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        query += ' AND ta.date <= ?';
        params.push(req.query.dateTo);
      }
      if (req.query.person_id) {
        query += ' AND ta.person_id = ?';
        params.push(req.query.person_id);
      }
      if (req.query.section) {
        query += ' AND ta.section = ?';
        params.push(req.query.section);
      }
      if (req.query.status) {
        query += ' AND ta.status = ?';
        params.push(req.query.status);
      }
      if (req.query.affaire_num) {
        query += ' AND ta.affaire_num = ?';
        params.push(req.query.affaire_num);
      }

      query += ' ORDER BY ta.date ASC, ta.period ASC, ta.time ASC';

      const tasks = db.prepare(query).all(...params);
      res.json(tasks);
    } catch (error) {
      logger.error('GET /api/planning/tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════════════
  // EXPORT PDF — Fiche journalière complète
  // ═══════════════════════════════════════════════

  const handleExportPdf = async (req, res) => {
    try {
      const { date, taskIds, eventIds } = req.query;
      const gcalEvents = req.body?.gcalEvents || [];

      const parseCsvIds = (value) =>
        String(value || '')
          .split(',')
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);
      const parseArrayIds = (value) =>
        Array.isArray(value)
          ? value.filter((n) => {
              // Garder les nombres positifs
              if (typeof n === 'number') {
                return Number.isFinite(n) && n > 0;
              }
              // Garder les strings non-vides (UUIDs, codes, etc.)
              if (typeof n === 'string') {
                return n.trim().length > 0;
              }
              return false;
            })
          : [];

      const selectedTaskIds = parseArrayIds(req.body?.taskIds);
      if (selectedTaskIds.length === 0) selectedTaskIds.push(...parseCsvIds(taskIds));

      const selectedEventIds = parseArrayIds(req.body?.eventIds);
      if (selectedEventIds.length === 0) selectedEventIds.push(...parseCsvIds(eventIds));

      if (!date) {
        return res.status(400).json({ success: false, error: 'Le paramètre date est requis' });
      }

      // ── 1) Charger les tâches ──
      let tasks = db
        .prepare(
          `
      SELECT ta.*, 
             dde.affaire_id AS event_affaire_id,
             dde.type AS event_type,
             dde.category AS event_category,
             dde.client AS event_client,
             dde.location AS event_location,
             dde.status AS event_status,
             p.first_name AS person_first_name,
             p.last_name AS person_last_name
      FROM task_assignments ta
      LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
      LEFT JOIN persons p ON ta.person_id = p.id
      WHERE ta.date = ? AND ta.deleted_at IS NULL
      ORDER BY ta.section ASC, ta.period ASC, ta.time ASC
    `,
        )
        .all(date);

      // Exclure les tâches terminées du PDF (ne pas exclure selon le statut du display event lié)
      tasks = tasks.filter((t) => t.status !== 'done');

      if (selectedTaskIds.length > 0) {
        const idSet = new Set(selectedTaskIds);
        tasks = tasks.filter((t) => idSet.has(t.id));
      }

      // Affaires exclues de l'export PDF (seules les tâches sont pertinentes)
      const affaires = [];

      // ── 3) Charger les événements d'affichage (exclure les terminés) ──
      let displayEvts = [];
      if (selectedEventIds.length > 0) {
        const ids = selectedEventIds.filter((n) => !isNaN(n));
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          displayEvts = db
            .prepare(`SELECT * FROM dynamic_display_events WHERE id IN (${placeholders})`)
            .all(...ids);
          displayEvts = displayEvts.filter((ev) => ev.status !== 'done');
        }
      }

      // ── Index affaires par numéro (pour enrichir les titres de tâches) ──
      const affaireByNum = new Map();
      affaires.forEach((a) => {
        if (a.numero_affaire) affaireByNum.set(a.numero_affaire.toUpperCase(), a);
      });
      // Inclure aussi les affaires de la date (pour enrichir les tâches même si affaire non sélectionnée)
      const allDateAffaires = db
        .prepare(
          `
      SELECT * FROM affaires
      WHERE date_debut <= ? AND (date_fin IS NULL OR date_fin = '' OR date_fin >= ?)
    `,
        )
        .all(date, date);
      allDateAffaires.forEach((a) => {
        if (a.numero_affaire && !affaireByNum.has(a.numero_affaire.toUpperCase())) {
          affaireByNum.set(a.numero_affaire.toUpperCase(), a);
        }
      });

      // ── Charger les multi-affectations (planning_assignments) ──
      const allAssignments = db
        .prepare(
          `
      SELECT pa.entity_type, pa.entity_id, pa.person_id,
             p.first_name, p.last_name
      FROM planning_assignments pa
      LEFT JOIN persons p ON pa.person_id = p.id
    `,
        )
        .all();
      const assignmentsByEntity = new Map();
      allAssignments.forEach((a) => {
        const key = `${a.entity_type}:${a.entity_id}`;
        if (!assignmentsByEntity.has(key)) assignmentsByEntity.set(key, []);
        assignmentsByEntity.get(key).push(a);
      });

      // ── Helper: Nettoyer les caractères non supportés par Helvetica (emojis, symboles) ──
      const stripEmoji = (str) => {
        if (!str) return '';
        return (
          str
            /* eslint-disable no-misleading-character-class */
            .replace(
              /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
              '',
            )
            /* eslint-enable no-misleading-character-class */
            .replace(/[\u2700-\u27BF]/g, '')
            .replace(/[\u2190-\u21FF]/g, '->') // flèches
            .replace(/\u2014|\u2013/g, '-') // tirets longs
            .replace(/\u2018|\u2019/g, "'") // apostrophes courbes
            .replace(/\u201C|\u201D/g, '"') // guillemets courbes
            .replace(/\u2026/g, '...') // ellipse
            .replace(/\u00A0/g, ' ') // espace insécable
            .replace(/\s{2,}/g, ' ')
            .trim()
        );
      };

      // ── Sections & couleurs ──
      const SECTIONS = {
        rdv: { label: 'RDV du jour' },
        taches_prioritaires: { label: 'Tâches Prioritaires' },
        courses: { label: 'Courses' },
        prep_locations: { label: 'Préparations Locations' },
        prep_prestations: { label: 'Préparations Prestations' },
        prep_ventes: { label: 'Préparations Ventes' },
        prep_installations: { label: 'Préparations Installations' },
        prep_tournees: { label: 'Préparations Tournées' },
        chargement: { label: 'Chargement' },
        depart: { label: 'Départ' },
        installation: { label: 'Installation' },
        montage: { label: 'Montage' },
        demontage: { label: 'Démontage' },
        depot: { label: 'Dépôt' },
        evenements: { label: 'Autres Événements' },
        taches_secondaires: { label: 'Tâches Secondaires' },
        manual: { label: 'Autres' },
      };

      // Aliases de section (identiques au frontend)
      const SECTION_ALIASES = { enlevement: 'courses', retour: 'courses', recuperation: 'courses' };
      const normalizeSection = (sec) => SECTION_ALIASES[sec] || sec;

      // Couleurs et labels des types de course
      const COURSE_TYPE_INFO = {
        livraison: { label: 'Livraison', color: '#10b981' },
        enlevement: { label: 'Enlevement', color: '#f59e0b' },
        retour: { label: 'Retour', color: '#8b5cf6' },
        recuperation: { label: 'Recuperation', color: '#ef4444' },
      };

      const SECTION_COLORS = {
        rdv: [5, 150, 105],
        evenements: [100, 116, 139],
        prep_locations: [245, 158, 11],
        prep_prestations: [59, 130, 246],
        prep_ventes: [16, 185, 129],
        prep_installations: [139, 92, 246],
        prep_tournees: [236, 72, 153],
        chargement: [245, 158, 11],
        depart: [59, 130, 246],
        installation: [16, 185, 129],
        montage: [8, 145, 178],
        demontage: [220, 38, 38],
        depot: [99, 102, 241],
        taches_prioritaires: [239, 68, 68],
        taches_secondaires: [245, 158, 11],
        courses: [139, 92, 246],
        manual: [100, 116, 139],
      };

      const AFFAIRE_TYPE_MAP = {
        Prestation: 'prep_prestations',
        Location: 'prep_locations',
        Vente: 'prep_ventes',
        Installation: 'prep_installations',
        Tournée: 'prep_tournees',
      };

      const EVENT_TYPE_MAP = {
        preparation: 'prep_locations',
        livraison: 'taches_prioritaires',
        enlevement: 'taches_prioritaires',
        depart: 'taches_prioritaires',
        retour: 'taches_secondaires',
        recuperation: 'taches_secondaires',
        montage: 'montage',
        demontage: 'demontage',
      };

      const EVENT_TYPE_LABELS = {
        preparation: 'Préparation',
        enlevement: 'Enlèvement',
        livraison: 'Livraison',
        depart: 'Départ',
        retour: 'Retour',
        recuperation: 'Récupération',
        montage: 'Montage',
        demontage: 'Démontage',
      };

      const drawCheckbox = (x, y, checked = false, size = 10) => {
        doc.save();
        doc.rect(x, y, size, size).strokeColor('#333333').lineWidth(0.8).stroke();
        if (checked) {
          // Coche à l'intérieur
          doc
            .moveTo(x + 2, y + size / 2)
            .lineTo(x + size / 2 - 0.5, y + size - 2.5)
            .lineTo(x + size - 1.5, y + 2)
            .strokeColor('#333333')
            .lineWidth(1.2)
            .stroke();
        }
        doc.restore();
      };

      // ── Sections qui sont "affaire only" (le label est redondant dans le titre des tâches) ──
      const AFFAIRE_ONLY_SECTIONS = new Set([
        'prep_locations',
        'prep_prestations',
        'prep_ventes',
        'prep_installations',
        'chargement',
        'depart',
        'enlevement',
        'retour',
        'recuperation',
        'installation',
        'montage',
        'demontage',
      ]);

      // Nettoyer le titre d'une tâche pour le PDF (supprimer doublons avec section/affaire)
      const cleanTaskTitle = (task, sectionKey) => {
        // Priorité : titre édité par l'utilisateur > titre Google
        let title = stripEmoji(task.title || '-');
        const googleTitle = task.google_event_title || '';
        // Extraire le N° d'affaire depuis le champ OU depuis le titre/google_event_title
        const affNum =
          task.affaire_num ||
          ((task.title || '').match(/\bAF\s*\d{3,}/i) || [''])[0]
            .toUpperCase()
            .replace(/\s+/g, '') ||
          ((task.google_event_title || '').match(/\bAF\s*\d{3,}/i) || [''])[0]
            .toUpperCase()
            .replace(/\s+/g, '') ||
          '';

        // 1. Retirer le suffixe " - eventSummary" (tâches Google: "Label - Summary")
        if (googleTitle) {
          const dashIdx = title.indexOf(' - ');
          if (dashIdx >= 0) {
            const suffix = title.slice(dashIdx + 3).trim();
            if (suffix.toLowerCase() === stripEmoji(googleTitle).trim().toLowerCase()) {
              title = title.slice(0, dashIdx).trim();
            }
          }
        }
        // 2. Retirer le label de section (redondant avec le bandeau)
        if (AFFAIRE_ONLY_SECTIONS.has(sectionKey)) {
          title = title
            .replace(
              /^(Preparation|Préparation|Chargement|Depart|Départ|Enlevement|Enlèvement|Retour|Recuperation|Récupération|Installation|Livraison|Montage|Demontage|Démontage|Dépôt|Depot)\s*[—–\-:]?\s*/i,
              '',
            )
            .trim();
          // Si vide, utiliser le google_event_title ou les notes
          if (!title) {
            title = stripEmoji(googleTitle) || task.notes || '-';
          }
        }
        // Aussi retirer le label de section pour les courses (Livraison, Récupération, etc.)
        title = title
          .replace(/^(Livraison|R[eé]cup[eé]ration|Enl[eè]vement|Retour)\s*[—–\-:]?\s*/i, '')
          .trim();
        if (!title) {
          title = stripEmoji(googleTitle) || task.notes || '-';
        }
        // 3. Retirer le N° d'affaire du titre (déjà affiché en badge)
        //    Pattern souple : "AF30875", "AF 30875", "af 30 875", etc.
        const stripAfNum = (text) => {
          if (!text || !affNum) return text;
          const digits = affNum.replace(/^AF/i, '');
          const flexDigits = digits.split('').join('\\s*');
          const pattern = new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi');
          return text
            .replace(pattern, '')
            .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        };
        title = stripAfNum(title);
        // 4. Enrichir avec client/titre de l'affaire si titre trop générique
        const linkedAffaire = affNum ? affaireByNum.get(affNum.toUpperCase()) : null;
        // 4. Enrichir avec client/titre de l'affaire SEULEMENT si titre vide/générique
        if (!title || /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(title)) {
          if (linkedAffaire) {
            title = stripEmoji(
              stripAfNum(
                linkedAffaire.client ||
                  linkedAffaire.titre ||
                  linkedAffaire.event_name ||
                  title ||
                  '-',
              ),
            );
          }
        }
        // Auto-majuscule
        if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
        return title || '-';
      };

      // ── Regrouper tous les items par section ──
      const grouped = {};
      Object.keys(SECTIONS).forEach((k) => {
        grouped[k] = [];
      });

      // Tasks (normaliser les sections courses)
      tasks.forEach((t) => {
        const sec = normalizeSection(t.section || 'manual');
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push({ type: 'task', data: t });
      });

      // Affaires → dans leur section opérationnelle + dans RDV si titre contient "rdv"
      affaires.forEach((a) => {
        const sec = AFFAIRE_TYPE_MAP[a.type] || 'manual';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push({ type: 'affaire', data: a });
        // Dupliquer dans RDV si le titre contient "rdv"
        if (a.titre && /rdv/i.test(a.titre)) {
          grouped.rdv.push({ type: 'affaire', data: a });
        }
      });

      // Display events (exclure les terminés, normaliser sections)
      const linkedEventIds = new Set(
        tasks.filter((t) => t.display_event_id).map((t) => t.display_event_id),
      );
      displayEvts
        .filter((ev) => !linkedEventIds.has(ev.id) && ev.status !== 'done')
        .forEach((ev) => {
          let sec = EVENT_TYPE_MAP[ev.type] || 'manual';
          if (ev.type === 'preparation') {
            if (ev.category === 'prestation') sec = 'prep_prestations';
            else if (ev.category === 'vente') sec = 'prep_ventes';
            else if (ev.category === 'installation') sec = 'prep_installations';
            else sec = 'prep_locations';
          }
          sec = normalizeSection(sec);
          if (!grouped[sec]) grouped[sec] = [];
          grouped[sec].push({ type: 'event', data: ev });
        });

      // Google Calendar events
      (gcalEvents || []).forEach((ev) => {
        grouped.rdv.push({ type: 'gcal', data: ev });
      });

      // Dédupliquer : retirer les tâches dont l'affaire est déjà affichée dans la même section
      const extractAFNum = (str) => {
        const m = (str || '').match(/\bAF\s*\d{4,}/i);
        return m ? m[0].toUpperCase().replace(/\s+/g, '') : '';
      };
      Object.keys(grouped).forEach((sec) => {
        const items = grouped[sec];
        const affaireNums = new Set(
          items
            .filter((i) => i.type === 'affaire')
            .map((i) => (i.data.numero_affaire || '').toUpperCase())
            .filter(Boolean),
        );
        if (affaireNums.size === 0) return;
        grouped[sec] = items.filter((i) => {
          if (i.type !== 'task') return true;
          const t = i.data;
          const taskAffNum =
            (t.affaire_num || '').toUpperCase() ||
            extractAFNum(t.title) ||
            extractAFNum(t.google_event_title);
          return !(taskAffNum && affaireNums.has(taskAffNum));
        });
      });

      // Compter le total
      let totalItems = 0;
      Object.values(grouped).forEach((arr) => {
        totalItems += arr.length;
      });

      // ── Date en français ──
      const dateObj = new Date(date + 'T00:00:00');
      const dateFr = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // ── Générer le PDF (tout sur 1 page) ──
      // QR code pré-généré (async) avant d'ouvrir le pipe : permet d'embarquer
      // le PNG directement dans le header sans attente côté stream.
      const qrBuffer = await generateTasksDayQrBuffer(date);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 25, bottom: 20, left: 25, right: 25 },
        info: {
          Title: `Fiche du jour - ${dateFr}`,
          Author: 'eM@g',
          Subject: 'Planification journalière',
        },
      });

      const filename = safeContentDispositionName(`fiche-${date}.pdf`, 'fiche.pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftX = doc.page.margins.left;
      const pageH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

      // ── Calcul dynamique pour tenir en 1 page ──
      const nonEmptySections = Object.entries(SECTIONS).filter(
        ([key]) => (grouped[key] || []).length > 0,
      );
      const totalSections = nonEmptySections.length;
      const FREE_LINES = Math.max(2, Math.min(5, 6 - Math.floor(totalItems / 12)));
      // HEADER_H inclut titre + date + total + QR code (60x60) + caption + marges.
      const HEADER_H = 78;
      const FOOTER_H = 12;
      const BANNER_H = 15;
      const SECTION_GAP = 2;
      const FREE_LINE_H = 16;
      const sectionOverhead = totalSections * (BANNER_H + SECTION_GAP);
      const notesH = BANNER_H + FREE_LINES * FREE_LINE_H + 6;
      const availableForItems = pageH - HEADER_H - FOOTER_H - sectionOverhead - notesH - 8;
      const rowH = Math.max(
        12,
        Math.min(18, Math.floor(availableForItems / Math.max(totalItems, 1))),
      );
      const fs = rowH <= 12 ? 9 : rowH <= 14 ? 10.5 : 11;
      const fsSmall = fs - 1;
      const cbSize = Math.min(8, rowH - 3);

      // ── Badge helper ──
      const drawBadge = (text, x, y, color = '#f59e0b') => {
        if (!text) return 0;
        doc.save();
        const bfs = Math.max(5, fs - 1);
        doc.font('Helvetica-Bold').fontSize(bfs);
        const tw = doc.widthOfString(text);
        const bw = tw + 6;
        const bh = bfs + 4;
        const by = y + Math.max(0, (rowH - bh) / 2);
        doc.roundedRect(x, by, bw, bh, 2).fillColor(color).fill();
        doc.fillColor('#ffffff').text(text, x + 3, by + 1.5, { width: tw + 2, lineBreak: false });
        doc.restore();
        return bw + 3;
      };

      // Couleur badge selon section
      const getBadgeColor = (sectionKey) => {
        if (sectionKey.includes('location')) return '#d97706';
        if (sectionKey.includes('prestation')) return '#2563eb';
        if (sectionKey.includes('vente')) return '#7c3aed';
        if (sectionKey.includes('installation')) return '#059669';
        if (sectionKey === 'chargement') return '#d97706';
        if (sectionKey === 'depart') return '#2563eb';
        if (sectionKey === 'enlevement' || sectionKey === 'recuperation') return '#059669';
        if (sectionKey === 'retour') return '#7c3aed';
        return '#6b7280';
      };

      // ── EN-TÊTE (compact) ──
      const headerStartY = doc.y;

      // QR code en haut à droite (renvoie vers /#/mobile/tasks?date=...)
      const QR_SIZE = 60;
      const qrX = leftX + pageW - QR_SIZE;
      const qrY = headerStartY;
      if (qrBuffer) {
        try {
          doc.image(qrBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
          doc
            .fontSize(5.5)
            .fillColor('#666666')
            .text('Scanner pour cocher', qrX, qrY + QR_SIZE + 1, {
              width: QR_SIZE,
              align: 'center',
              lineBreak: false,
            });
          doc.fillColor('#000000');
        } catch (e) {
          logger.warn(`[tasks-pdf] QR draw failed: ${e?.message || e}`);
        }
      }

      // Réinitialiser le curseur après le QR (doc.image le déplace).
      // Centrer titre/date/éléments dans la zone gauche (hors QR).
      const titleAreaW = pageW - QR_SIZE - 8;
      doc.x = leftX;
      doc.y = headerStartY;
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Fiche du jour', leftX, headerStartY, { width: titleAreaW, align: 'center' });
      doc.moveDown(0.15);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(dateFr.charAt(0).toUpperCase() + dateFr.slice(1), leftX, doc.y, {
          width: titleAreaW,
          align: 'center',
        });
      doc.moveDown(0.1);
      doc
        .fontSize(7)
        .fillColor('#999999')
        .text(`${totalItems} élément${totalItems > 1 ? 's' : ''}`, leftX, doc.y, {
          width: titleAreaW,
          align: 'center',
        });
      doc.fillColor('#000000');
      // S'assurer que la barre de séparation passe sous le QR code.
      const qrBottom = qrY + QR_SIZE + 8;
      if (doc.y < qrBottom) doc.y = qrBottom;
      doc.moveDown(0.3);
      doc
        .moveTo(leftX, doc.y)
        .lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);

      // ── SECTIONS ──
      nonEmptySections.forEach(([key, info]) => {
        const items = grouped[key] || [];
        const color = SECTION_COLORS[key] || [100, 100, 100];
        const hexColor = `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
        const badgeColor = getBadgeColor(key);

        // Bandeau de section (compact)
        const bannerY = doc.y;
        doc.rect(leftX, bannerY, pageW, BANNER_H).fillColor(hexColor).fill();
        doc
          .fontSize(fs + 1)
          .font('Helvetica-Bold')
          .fillColor('#ffffff')
          .text(`${info.label} (${items.length})`, leftX + 6, bannerY + 3, { width: pageW - 12 });
        doc.fillColor('#000000');
        doc.y = bannerY + BANNER_H + 1;

        items.forEach((item, i) => {
          if (item.type === 'task') {
            const t = item.data;
            const taskSection = normalizeSection(t.section || 'manual');
            let titleStr = cleanTaskTitle(t, key);
            // Extraire le N° d'affaire depuis le champ OU depuis le titre/google_event_title
            const affNum =
              t.affaire_num ||
              ((t.title || '').match(/\bAF\s*\d{3,}/i) || [''])[0]
                .toUpperCase()
                .replace(/\s+/g, '') ||
              ((t.google_event_title || '').match(/\bAF\s*\d{3,}/i) || [''])[0]
                .toUpperCase()
                .replace(/\s+/g, '') ||
              '';
            const linkedAffaire = affNum ? affaireByNum.get(affNum.toUpperCase()) : null;

            // Extraction du type de course (3 sources: section -> eventType -> regex titre)
            let courseType = null;
            if (taskSection === 'courses') {
              const SECTION_COURSE = {
                enlevement: 'enlevement',
                retour: 'retour',
                recuperation: 'recuperation',
              };
              const EVENT_COURSE = {
                livraison: 'livraison',
                enlevement: 'enlevement',
                retour: 'retour',
                recuperation: 'recuperation',
              };
              if (SECTION_COURSE[t.section]) courseType = SECTION_COURSE[t.section];
              else if (t.event_type && EVENT_COURSE[t.event_type])
                courseType = EVENT_COURSE[t.event_type];
              else {
                const cm = (t.title || '').match(
                  /^[^a-zA-Z]*(Livraison|R[eé]cup[eé]ration|Enl[eè]vement|Retour)\b/i,
                );
                if (cm) {
                  const raw = cm[1]
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                  courseType =
                    {
                      livraison: 'livraison',
                      recuperation: 'recuperation',
                      enlevement: 'enlevement',
                      retour: 'retour',
                    }[raw] || null;
                }
              }
              // Retirer le type du titre (redondant avec badge)
              if (courseType) {
                titleStr =
                  titleStr
                    .replace(
                      /^(Livraison|R[eé]cup(?:[eé]ration)?|Enl[eè]v(?:ement)?|Retour)\s*[—–\-:]?\s*/i,
                      '',
                    )
                    .trim() ||
                  stripEmoji(t.google_event_title) ||
                  t.notes ||
                  '-';
              }
            }

            // Client et lieu
            const displayClient = stripEmoji(
              t.client_name || t.event_client || (linkedAffaire ? linkedAffaire.client : '') || '',
            );
            const displayLocation = stripEmoji(
              t.event_location ||
                (linkedAffaire ? (linkedAffaire.adresse_livraison || '').split('\n')[0] : '') ||
                '',
            );

            // Horaires (ou période AM/PM/Journée si pas d'heure)
            const isAllDay = t.all_day === 1 || t.all_day === true;
            const rawTime = t.time || (isAllDay ? 'Journée' : t.period) || '';
            const timeStr = String(rawTime)
              .split(/\s*(?:>|→|-)\s*/)[0]
              .trim();

            // Multi-affectations ou personne unique
            const multiAssign = assignmentsByEntity.get(`task:${t.id}`) || [];
            const personStr =
              multiAssign.length > 0
                ? multiAssign
                    .map((a) =>
                      `${a.first_name || ''} ${a.last_name ? a.last_name.charAt(0) + '.' : ''}`.trim(),
                    )
                    .join(', ')
                : t.person_first_name || t.person_last_name
                  ? `${t.person_first_name || ''} ${t.person_last_name ? t.person_last_name.charAt(0) + '.' : ''}`.trim()
                  : '';
            const personCount = multiAssign.length || (t.person_first_name ? 1 : 0);
            // Largeur dynamique pour multi-affectations (eviter le clipping).
            const personColW = personCount >= 4 ? 130 : personCount >= 2 ? 100 : personStr ? 70 : 0;
            // "Journée" demande un peu plus de place que "AM"/"PM".
            const timeColW = timeStr ? (isAllDay ? 56 : 42) : 0;

            // Détection doublons client/lieu vs titre (éviter affichage double pour les courses)
            const titleLower = titleStr.toLowerCase();
            const clientLower = displayClient ? displayClient.toLowerCase() : '';
            const locationLower = displayLocation ? displayLocation.toLowerCase() : '';
            const clientAlreadyInTitle =
              displayClient &&
              (titleLower.includes(clientLower) || clientLower.includes(titleLower));
            const locationAlreadyInTitle =
              displayLocation &&
              (titleLower.includes(locationLower) || locationLower.includes(titleLower));
            const showClient = displayClient && !clientAlreadyInTitle;
            const showLocation = !showClient && displayLocation && !locationAlreadyInTitle;

            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Case à cocher
            const cbX = leftX + 3;
            const cbY = rowY + Math.max(1, (rowH - cbSize) / 2);
            drawCheckbox(cbX, cbY, t.status === 'done', cbSize);
            // Badge N° affaire (directement après la checkbox)
            let titleX = leftX + cbSize + 8;
            if (affNum) {
              const badgeW = drawBadge(affNum, titleX, rowY, badgeColor);
              titleX += badgeW;
            }
            // Badge type de course
            if (courseType && COURSE_TYPE_INFO[courseType]) {
              const ct = COURSE_TYPE_INFO[courseType];
              const badgeW = drawBadge(ct.label, titleX, rowY, ct.color);
              titleX += badgeW;
            }
            // Titre
            const rightInfoW =
              timeColW + (showClient ? 65 : showLocation ? 55 : 0) + personColW + 8;
            const titleW = leftX + pageW - titleX - rightInfoW;
            if (t.status === 'done') {
              doc.font('Helvetica-Oblique').fontSize(fs).fillColor('#999999');
            } else {
              doc.font('Helvetica').fontSize(fs).fillColor('#111111');
            }
            doc.text(titleStr, titleX, rowY + 2, { width: Math.max(titleW, 40), lineBreak: false });
            if (t.status === 'done') {
              const tw = doc.widthOfString(titleStr, { width: titleW });
              doc
                .moveTo(titleX, rowY + rowH / 2)
                .lineTo(titleX + Math.min(tw, titleW), rowY + rowH / 2)
                .strokeColor('#999999')
                .lineWidth(0.4)
                .stroke();
            }
            // Notes (en italique après le titre) — seulement si différent du titre affiché
            const notesText = (t.notes || '').trim();
            const notesLower = notesText.toLowerCase();
            if (
              notesText &&
              notesLower !== titleLower &&
              !titleLower.includes(notesLower) &&
              !notesLower.includes(titleLower)
            ) {
              const titleUsedW = doc.widthOfString(titleStr);
              const notesX = titleX + Math.min(titleUsedW, titleW) + 4;
              const notesW = leftX + pageW - notesX - rightInfoW;
              if (notesW > 20) {
                doc
                  .font('Helvetica-Oblique')
                  .fontSize(Math.max(5, fs - 1))
                  .fillColor('#777777')
                  .text(notesText, notesX, rowY + 2, { width: notesW, lineBreak: false });
              }
            }
            // Largeur dynamique de la colonne PERSONNES (multi-affectations).
            // Police plus petite quand plusieurs personnes pour eviter le clipping.
            const personFs =
              personCount >= 3
                ? Math.max(5, fsSmall - 1.5)
                : personCount >= 2
                  ? fsSmall - 0.5
                  : fsSmall;

            // Horaires (colonne la plus à droite)
            let rightX = leftX + pageW;
            if (timeStr) {
              rightX -= timeColW;
              doc
                .font('Helvetica-Bold')
                .fontSize(fsSmall)
                .fillColor('#444444')
                .text(timeStr, rightX, rowY + 2, { width: timeColW - 2, lineBreak: false });
            }
            // Personnel juste avant la colonne heure/période
            if (personStr) {
              rightX -= personColW;
              doc
                .font('Helvetica')
                .fontSize(personFs)
                .fillColor('#555555')
                .text(personStr, rightX, rowY + 2, {
                  width: personColW - 2,
                  height: rowH - 2,
                  lineBreak: false,
                  ellipsis: true,
                });
            }
            // Client/Lieu ensuite (plus à gauche)
            if (showClient) {
              rightX -= 65;
              doc
                .font('Helvetica-Oblique')
                .fontSize(fsSmall)
                .fillColor('#888888')
                .text(displayClient.slice(0, 18), rightX, rowY + 2, {
                  width: 63,
                  lineBreak: false,
                });
            } else if (showLocation) {
              rightX -= 55;
              doc
                .font('Helvetica')
                .fontSize(fsSmall)
                .fillColor('#888888')
                .text(displayLocation.slice(0, 16), rightX, rowY + 2, {
                  width: 53,
                  lineBreak: false,
                });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;
          } else if (item.type === 'affaire' || item.type === 'affaire-rdv') {
            const a = item.data;
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge N° affaire
            let contentX = leftX + 4;
            if (a.numero_affaire) {
              const badgeW = drawBadge(a.numero_affaire, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            // Détail
            const detail = `${a.type || ''} - ${a.client || 'Sans client'}${a.adresse_livraison ? ' - ' + a.adresse_livraison.split('\n')[0].slice(0, 35) : ''}`;
            const affAssign = assignmentsByEntity.get(`affaire:${a.id}`) || [];
            const affPersonStr =
              affAssign.length > 0
                ? affAssign
                    .map((as) =>
                      `${as.first_name || ''} ${as.last_name ? as.last_name.charAt(0) + '.' : ''}`.trim(),
                    )
                    .join(', ')
                : (a.interlocuteur || '').slice(0, 18);
            doc
              .font('Helvetica')
              .fontSize(fs)
              .fillColor('#111111')
              .text(stripEmoji(detail), contentX, rowY + 2, {
                width: leftX + pageW - contentX - 60,
                lineBreak: false,
              });
            if (affPersonStr) {
              doc
                .font('Helvetica')
                .fontSize(fsSmall)
                .fillColor('#555555')
                .text(affPersonStr, leftX + pageW - 55, rowY + 2, {
                  width: 52,
                  lineBreak: false,
                  align: 'right',
                });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;
          } else if (item.type === 'event') {
            const ev = item.data;
            const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type || 'Evenement';
            const isRedundant = AFFAIRE_ONLY_SECTIONS.has(key);
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge affaire_id si présent
            let contentX = leftX + 4;
            if (ev.affaire_id) {
              const badgeW = drawBadge(ev.affaire_id, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            // Label + detail
            let detail;
            if (isRedundant) {
              const parts = [];
              if (ev.client) parts.push(ev.client);
              if (ev.location) parts.push(ev.location.slice(0, 25));
              detail = parts.join(' - ') || '-';
            } else {
              if (!ev.affaire_id) {
                detail = `${typeLabel} - ${ev.client || ''}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
              } else {
                detail = `${typeLabel}${ev.client ? ' - ' + ev.client : ''}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
              }
            }
            // Multi-affectations pour événements
            const evAssign = assignmentsByEntity.get(`display_event:${ev.id}`) || [];
            const evPersonStr =
              evAssign.length > 0
                ? evAssign
                    .map((a) =>
                      `${a.first_name || ''} ${a.last_name ? a.last_name.charAt(0) + '.' : ''}`.trim(),
                    )
                    .join(', ')
                : '';
            doc
              .font('Helvetica')
              .fontSize(fs)
              .fillColor('#111111')
              .text(stripEmoji(detail) || '-', contentX, rowY + 2, {
                width: leftX + pageW - contentX - (evPersonStr ? 65 : 10),
                lineBreak: false,
              });
            if (evPersonStr) {
              doc
                .font('Helvetica')
                .fontSize(fsSmall)
                .fillColor('#555555')
                .text(evPersonStr, leftX + pageW - 60, rowY + 2, {
                  width: 55,
                  lineBreak: false,
                  align: 'right',
                });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;
          } else if (item.type === 'gcal') {
            const ev = item.data;
            const time =
              ev.start && ev.start.includes('T')
                ? new Date(ev.start).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge affaire si présent
            let contentX = leftX + 4;
            if (ev.affaire) {
              const badgeW = drawBadge(ev.affaire, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            const detail = `${stripEmoji(ev.summary) || 'RDV Google'}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
            doc
              .font('Helvetica')
              .fontSize(fs)
              .fillColor('#111111')
              .text(detail, contentX, rowY + 2, {
                width: leftX + pageW - contentX - 50,
                lineBreak: false,
              });
            if (time) {
              doc
                .font('Helvetica')
                .fontSize(fsSmall)
                .fillColor('#555555')
                .text(time, leftX + pageW - 40, rowY + 2, {
                  width: 38,
                  lineBreak: false,
                  align: 'right',
                });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;
          }
        });

        doc.y += SECTION_GAP;
      });

      // ── SECTION LIBRE : lignes pour notes manuscrites ──
      const freeY = doc.y;
      doc.rect(leftX, freeY, pageW, BANNER_H).fillColor('#6b7280').fill();
      doc
        .fontSize(fs + 1)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Notes / Tâches supplémentaires', leftX + 6, freeY + 3, { width: pageW - 12 });
      doc.fillColor('#000000');
      doc.y = freeY + BANNER_H + 2;

      for (let i = 0; i < FREE_LINES; i++) {
        const ly = doc.y;
        drawCheckbox(leftX + 3, ly + Math.max(1, (FREE_LINE_H - cbSize) / 2), false, cbSize);
        doc
          .moveTo(leftX + cbSize + 8, ly + FREE_LINE_H - 3)
          .lineTo(leftX + pageW, ly + FREE_LINE_H - 3)
          .strokeColor('#cccccc')
          .lineWidth(0.3)
          .dash(3, { space: 2 })
          .stroke();
        doc.undash();
        doc.y = ly + FREE_LINE_H;
      }

      // ── PIED DE PAGE ──
      doc.moveDown(0.4);
      doc
        .moveTo(leftX, doc.y)
        .lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc')
        .lineWidth(0.4)
        .stroke();
      doc.moveDown(0.2);
      doc
        .fontSize(6)
        .font('Helvetica')
        .fillColor('#bbbbbb')
        .text(`Généré par eM@g - ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

      doc.end();
    } catch (error) {
      logger.error('GET /api/planning/tasks/export-pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  };

  // ═══════════════════════════════════════════════

  app.get('/api/planning/tasks/export-pdf', authenticateToken, handleExportPdf);
  app.post('/api/planning/tasks/export-pdf', authenticateToken, handleExportPdf);

  // ─── GET /api/planning/tasks/:id ───
  app.get('/api/planning/tasks/:id', authenticateToken, (req, res) => {
    try {
      const task = db
        .prepare(
          `
      SELECT ta.*, 
             dde.affaire_id AS event_affaire_id,
             dde.type AS event_type,
             dde.category AS event_category,
             p.first_name AS person_first_name,
             p.last_name AS person_last_name
      FROM task_assignments ta
      LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
      LEFT JOIN persons p ON ta.person_id = p.id
      WHERE ta.id = ? AND ta.deleted_at IS NULL
    `,
        )
        .get(req.params.id);

      if (!task) return res.status(404).json({ success: false, error: 'Tâche non trouvée' });
      res.json(task);
    } catch (error) {
      logger.error('GET /api/planning/tasks/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/tasks ───
  app.post('/api/planning/tasks', authenticateToken, validate(taskCreateSchema), (req, res) => {
    try {
      const {
        display_event_id,
        person_id,
        date,
        period,
        time,
        end_time,
        section,
        title,
        notes,
        source_type,
        source_id,
        google_event_title,
        affaire_num,
        status,
        reservation_id,
        location_address,
        location_lat,
        location_lng,
        all_day,
        client_name,
      } = req.body;

      if (!date) {
        return res.status(400).json({ success: false, error: 'Le champ date est obligatoire' });
      }
      if (!isValidDate(date)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format date invalide (attendu YYYY-MM-DD)' });
      }
      if (time && !isValidTime(time)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format heure invalide (attendu HH:mm)' });
      }
      if (end_time && !isValidTime(end_time)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format end_time invalide (attendu HH:mm)' });
      }

      const id = crypto.randomUUID().replace(/-/g, '');

      // RDV/événements masqués par défaut sur l'écran TV (visible=0)
      const effectiveSection = section || 'manual';
      const EVENT_SECTIONS = ['rdv', 'evenements'];
      const defaultVisible = EVENT_SECTIONS.includes(effectiveSection) ? 0 : 1;

      const stmt = db.prepare(`
      INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, reservation_id, location_address, location_lat, location_lng, all_day, client_name, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

      stmt.run(
        id,
        display_event_id || null,
        person_id || null,
        date,
        period || null,
        time || null,
        end_time || null,
        effectiveSection,
        title || null,
        notes || '',
        source_type || 'manual',
        source_id || null,
        google_event_title || null,
        affaire_num || null,
        status || 'pending',
        defaultVisible,
        reservation_id || null,
        location_address || null,
        location_lat != null ? location_lat : null,
        location_lng != null ? location_lng : null,
        all_day ? 1 : 0,
        client_name || null,
        req.user.id,
      );

      // Retourner avec les JOINs
      const created = db
        .prepare(
          `
      SELECT ta.*, 
             dde.affaire_id AS event_affaire_id,
             dde.type AS event_type,
             p.first_name AS person_first_name,
             p.last_name AS person_last_name
      FROM task_assignments ta
      LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
      LEFT JOIN persons p ON ta.person_id = p.id
      WHERE ta.id = ?
    `,
        )
        .get(id);

      res.status(201).json(created);
    } catch (error) {
      logger.error('POST /api/planning/tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/tasks/batch ───
  // Création en lot de tâches (pour workflow événement → tâches)
  app.post(
    '/api/planning/tasks/batch',
    authenticateToken,
    validate(taskBatchSchema),
    (req, res) => {
      try {
        const { tasks: taskList } = req.body;

        const EVENT_SECTIONS_BATCH = ['rdv', 'evenements'];
        const insertStmt = db.prepare(`
      INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, location_address, location_lat, location_lng, all_day, client_name, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

        const createdIds = [];
        const skipped = [];
        const insertMany = db.transaction((items) => {
          for (const t of items) {
            if (!t.date) continue;
            if (!isValidDate(t.date)) {
              skipped.push(t.date);
              continue;
            }
            const id = crypto.randomUUID().replace(/-/g, '');
            const sect = t.section || 'manual';
            const vis = EVENT_SECTIONS_BATCH.includes(sect) ? 0 : 1;
            insertStmt.run(
              id,
              t.display_event_id || null,
              t.person_id || null,
              t.date,
              t.period || null,
              t.time || null,
              t.end_time || null,
              sect,
              t.title || null,
              t.notes || '',
              t.source_type || 'manual',
              t.source_id || null,
              t.google_event_title || null,
              t.affaire_num || null,
              t.status || 'pending',
              vis,
              t.location_address || null,
              t.location_lat != null ? t.location_lat : null,
              t.location_lng != null ? t.location_lng : null,
              t.all_day ? 1 : 0,
              t.client_name || null,
              req.user.id,
            );
            createdIds.push(id);
          }
        });

        insertMany(taskList);

        // Retourner les tâches créées
        if (createdIds.length > 0) {
          const placeholders = createdIds.map(() => '?').join(',');
          const created = db
            .prepare(
              `
        SELECT ta.*, 
               p.first_name AS person_first_name,
               p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id IN (${placeholders})
        ORDER BY ta.date ASC, ta.time ASC
      `,
            )
            .all(...createdIds);
          res.status(201).json(created);
        } else {
          res.status(201).json([]);
        }
      } catch (error) {
        logger.error('POST /api/planning/tasks/batch error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/planning/tasks/by-source/:sourceId ───
  // Supprimer toutes les tâches liées à un événement source
  app.delete('/api/planning/tasks/by-source/:sourceId', authenticateToken, (req, res) => {
    try {
      const result = db
        .prepare(
          "UPDATE task_assignments SET deleted_at = datetime('now') WHERE source_type = 'google_event' AND source_id = ? AND deleted_at IS NULL",
        )
        .run(req.params.sourceId);
      res.json({ success: true, deleted: result.changes });
    } catch (error) {
      logger.error('DELETE /api/planning/tasks/by-source error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/planning/tasks/:id ───
  app.put('/api/planning/tasks/:id', authenticateToken, validate(taskUpdateSchema), (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM task_assignments WHERE id = ? AND deleted_at IS NULL')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Tâche non trouvée' });

      const {
        display_event_id,
        person_id,
        date,
        period,
        time,
        end_time,
        section,
        title,
        notes,
        source_type,
        source_id,
        google_event_title,
        affaire_num,
        status,
        reservation_id,
        location_address,
        location_lat,
        location_lng,
        all_day,
        client_name,
      } = req.body;

      if (date && !isValidDate(date)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format date invalide (attendu YYYY-MM-DD)' });
      }
      if (time && !isValidTime(time)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format heure invalide (attendu HH:mm)' });
      }
      if (end_time && !isValidTime(end_time)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format end_time invalide (attendu HH:mm)' });
      }

      const stmt = db.prepare(`
      UPDATE task_assignments
      SET display_event_id = ?, person_id = ?, date = ?, period = ?, time = ?, end_time = ?, section = ?, title = ?, notes = ?, source_type = ?, source_id = ?, google_event_title = ?, affaire_num = ?, status = ?, reservation_id = ?, location_address = ?, location_lat = ?, location_lng = ?, all_day = ?, client_name = ?, modified_by = ?, modified_at = datetime('now')
      WHERE id = ?
    `);

      stmt.run(
        display_event_id !== undefined ? display_event_id : existing.display_event_id,
        person_id !== undefined ? person_id : existing.person_id,
        date || existing.date,
        period !== undefined ? period : existing.period,
        time !== undefined ? time : existing.time,
        end_time !== undefined ? end_time : existing.end_time,
        section || existing.section,
        title !== undefined ? title : existing.title,
        notes !== undefined ? notes : existing.notes,
        source_type || existing.source_type,
        source_id !== undefined ? source_id : existing.source_id,
        google_event_title !== undefined ? google_event_title : existing.google_event_title,
        affaire_num !== undefined ? affaire_num : existing.affaire_num,
        status || existing.status,
        reservation_id !== undefined ? reservation_id : existing.reservation_id,
        location_address !== undefined ? location_address : existing.location_address,
        location_lat !== undefined ? location_lat : existing.location_lat,
        location_lng !== undefined ? location_lng : existing.location_lng,
        all_day !== undefined ? (all_day ? 1 : 0) : existing.all_day,
        client_name !== undefined ? client_name : existing.client_name,
        req.user.id,
        req.params.id,
      );

      // Retourner avec les JOINs
      const updated = db
        .prepare(
          `
      SELECT ta.*, 
             dde.affaire_id AS event_affaire_id,
             dde.type AS event_type,
             p.first_name AS person_first_name,
             p.last_name AS person_last_name
      FROM task_assignments ta
      LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
      LEFT JOIN persons p ON ta.person_id = p.id
      WHERE ta.id = ?
    `,
        )
        .get(req.params.id);

      // Synchroniser le statut vers le suivi du personnel
      const newStatus = status || existing.status;
      if (newStatus === 'done' || newStatus === 'pending') {
        const completedValue = newStatus === 'done' ? 1 : null;
        db.prepare('UPDATE tracking_entries SET completed = ? WHERE task_assignment_id = ?').run(
          completedValue,
          req.params.id,
        );
      }

      res.json(updated);
    } catch (error) {
      logger.error('PUT /api/planning/tasks/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/tasks/:id/merge ─── (fusionner deux tâches)
  app.post('/api/planning/tasks/:id/merge', authenticateToken, (req, res) => {
    try {
      const { targetId } = req.body;
      if (!targetId) return res.status(400).json({ success: false, error: 'targetId requis' });
      if (String(targetId) === String(req.params.id)) {
        return res
          .status(400)
          .json({ success: false, error: 'Impossible de fusionner une tâche avec elle-même' });
      }

      const source = db
        .prepare('SELECT * FROM task_assignments WHERE id = ? AND deleted_at IS NULL')
        .get(req.params.id);
      if (!source)
        return res.status(404).json({ success: false, error: 'Tâche source non trouvée' });

      const target = db
        .prepare('SELECT * FROM task_assignments WHERE id = ? AND deleted_at IS NULL')
        .get(targetId);
      if (!target)
        return res.status(404).json({ success: false, error: 'Tâche cible non trouvée' });

      // Compléter la source avec les champs de la cible s'ils sont vides
      const updates = {};
      if (!source.notes && target.notes) updates.notes = target.notes;
      if (!source.person_id && target.person_id) updates.person_id = target.person_id;
      if (!source.affaire_num && target.affaire_num) updates.affaire_num = target.affaire_num;
      if (!source.location_address && target.location_address)
        updates.location_address = target.location_address;

      const mergeStmt = db.transaction(() => {
        if (Object.keys(updates).length > 0) {
          const sets = Object.keys(updates)
            .map((k) => `${k} = @${k}`)
            .join(', ');
          db.prepare(
            `UPDATE task_assignments SET ${sets}, modified_by = @modifiedBy, modified_at = datetime('now') WHERE id = @id`,
          ).run({ ...updates, modifiedBy: req.user.id, id: source.id });
        }
        // Soft-delete la cible
        db.prepare(
          "UPDATE task_assignments SET deleted_at = datetime('now'), modified_by = ?, modified_at = datetime('now') WHERE id = ?",
        ).run(req.user.id, target.id);
      });
      mergeStmt();

      const updated = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(source.id);
      res.json({ success: true, task: updated });
    } catch (error) {
      logger.error('POST /api/planning/tasks/:id/merge error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/planning/tasks/:id ─── (soft delete)
  app.delete('/api/planning/tasks/:id', authenticateToken, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM task_assignments WHERE id = ? AND deleted_at IS NULL')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Tâche non trouvée' });

      db.prepare(
        "UPDATE task_assignments SET deleted_at = datetime('now'), modified_by = ?, modified_at = datetime('now') WHERE id = ?",
      ).run(req.user.id, req.params.id);
      res.json({ success: true, message: 'Tâche supprimée' });
    } catch (error) {
      logger.error('DELETE /api/planning/tasks/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
