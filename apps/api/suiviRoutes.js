// ═══════════════════════════════════════════════════════════════
// MODULE SUIVI DU PERSONNEL — Routes API Express
// Fiches quotidiennes + synthèses + export PDF
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

import PDFDocument from 'pdfkit';

import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  entryPatchSchema,
  sheetUpdateSchema,
  syntheseDateSchema,
  syntheseMonthSchema,
  syntheseWeekSchema,
} from './schemas/suivi.js';

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getOrCreateSheet(personId, date, userId) {
  let sheet = db
    .prepare('SELECT * FROM tracking_sheets WHERE person_id = ? AND date = ?')
    .get(personId, date);

  if (!sheet) {
    const id = crypto.randomUUID().replace(/-/g, '');
    db.prepare(
      `INSERT INTO tracking_sheets (id, person_id, date, status, created_by)
       VALUES (?, ?, ?, 'draft', ?)`,
    ).run(id, personId, date, userId);
    sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(id);

    // Pré-remplir avec les tâches planifiées du jour
    const tasks = db
      .prepare(
        `SELECT ta.id, ta.period, ta.title, ta.notes, ta.section, ta.time, ta.end_time,
                ta.affaire_num, ta.google_event_title, ta.status
         FROM task_assignments ta
         WHERE ta.person_id = ? AND ta.date = ? AND ta.deleted_at IS NULL
         ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
      )
      .all(personId, date);

    if (tasks.length > 0) {
      const insert = db.prepare(
        `INSERT INTO tracking_entries (id, sheet_id, period, task, time_spent, comment, completed, task_assignment_id, sort_order)
         VALUES (?, ?, ?, ?, 0, '', ?, ?, ?)`,
      );

      const insertMany = db.transaction((items) => {
        for (let i = 0; i < items.length; i++) {
          const t = items[i];
          const entryId = crypto.randomUUID().replace(/-/g, '');
          const label =
            t.title || t.google_event_title || t.notes || `Tâche ${t.section || 'manuelle'}`;
          const completed = t.status === 'done' ? 1 : 0;
          insert.run(entryId, sheet.id, t.period || 'AM', label, completed, t.id, i);
        }
      });
      insertMany(tasks);
    }
  }

  return sheet;
}

function getSheetWithEntries(sheetId) {
  const sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(sheetId);
  if (!sheet) return null;

  const entries = db
    .prepare(
      `SELECT te.*, ta.status AS task_status, ta.section AS task_section,
              ta.affaire_num, ta.google_event_title
       FROM tracking_entries te
       LEFT JOIN task_assignments ta ON te.task_assignment_id = ta.id
       WHERE te.sheet_id = ?
       ORDER BY te.period ASC, te.sort_order ASC`,
    )
    .all(sheetId);

  const person = db
    .prepare('SELECT id, first_name, last_name, type, status FROM persons WHERE id = ?')
    .get(sheet.person_id);

  return { ...sheet, entries, person };
}

function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getWeekDates(weekStr) {
  // weekStr = "2026-W16"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  // ISO: semaine 1 contient le 4 janvier
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // lundi=1
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getMonthDates(monthStr) {
  // monthStr = "2026-04"
  const [year, month] = monthStr.split('-').map(Number);
  const dates = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function buildSynthese(dates, personId) {
  const placeholders = dates.map(() => '?').join(',');
  let query = `
    SELECT ts.*, p.first_name, p.last_name, p.type AS person_type
    FROM tracking_sheets ts
    JOIN persons p ON p.id = ts.person_id
    WHERE ts.date IN (${placeholders})
  `;
  const params = [...dates];
  if (personId) {
    query += ' AND ts.person_id = ?';
    params.push(personId);
  }
  query += ' ORDER BY ts.date ASC, p.last_name ASC';

  const sheets = db.prepare(query).all(...params);

  // Charger les entrées pour chaque fiche
  const sheetIds = sheets.map((s) => s.id);
  let entries = [];
  if (sheetIds.length > 0) {
    const ePlaceholders = sheetIds.map(() => '?').join(',');
    entries = db
      .prepare(
        `SELECT * FROM tracking_entries WHERE sheet_id IN (${ePlaceholders}) ORDER BY period ASC, sort_order ASC`,
      )
      .all(...sheetIds);
  }

  const entriesBySheet = {};
  for (const e of entries) {
    if (!entriesBySheet[e.sheet_id]) entriesBySheet[e.sheet_id] = [];
    entriesBySheet[e.sheet_id].push(e);
  }

  // Agréger les stats
  let totalTasks = 0;
  let completedTasks = 0;
  let totalTime = 0;
  const anomalies = [];

  const enrichedSheets = sheets.map((s) => {
    const sheetEntries = entriesBySheet[s.id] || [];
    const done = sheetEntries.filter((e) => e.completed === 1).length;
    const notDone = sheetEntries.filter((e) => e.completed === 0).length;
    const time = sheetEntries.reduce((sum, e) => sum + (e.time_spent || 0), 0);

    totalTasks += sheetEntries.length;
    completedTasks += done;
    totalTime += time;

    if (notDone > 0 && s.status !== 'draft') {
      anomalies.push({
        date: s.date,
        person: `${s.first_name} ${s.last_name}`,
        person_id: s.person_id,
        not_done: notDone,
      });
    }

    return {
      ...s,
      entries: sheetEntries,
      stats: { total: sheetEntries.length, done, not_done: notDone, time },
    };
  });

  return {
    dates,
    sheets: enrichedSheets,
    summary: {
      total_sheets: sheets.length,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      total_time: Math.round(totalTime * 10) / 10,
      anomalies,
    },
  };
}

// ═══════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════

function generateSheetPdf(sheet, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="fiche-suivi-${sheet.person?.last_name || 'personnel'}-${sheet.date}.pdf"`,
  );
  doc.pipe(res);

  // En-tête
  doc.fontSize(18).font('Helvetica-Bold').text('FICHE DE SUIVI QUOTIDIEN', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Date : ${formatDateFR(sheet.date)}`, { align: 'center' });
  if (sheet.person) {
    doc.text(
      `Personnel : ${sheet.person.first_name} ${sheet.person.last_name} — ${sheet.person.type || 'permanent'}`,
      { align: 'center' },
    );
  }
  doc.text(
    `Statut : ${sheet.status === 'validated' ? 'Validée' : sheet.status === 'submitted' ? 'Soumise' : 'Brouillon'}`,
    { align: 'center' },
  );
  doc.moveDown(1);

  // Tableau
  const tableLeft = 40;
  const colWidths = [55, 200, 55, 150, 55]; // Période, Tâche, Temps, Commentaire, Fait
  const headers = ['Période', 'Tâche', 'Temps (h)', 'Commentaire', 'Effectué'];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  let y = doc.y;
  doc.rect(tableLeft, y, tableWidth, 20).fillColor('#1e3a5f').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = tableLeft;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, align: 'center' });
    x += colWidths[i];
  }
  y += 20;

  // Entries
  doc.font('Helvetica').fontSize(8).fillColor('#111111');
  const amEntries = (sheet.entries || []).filter((e) => e.period === 'AM');
  const pmEntries = (sheet.entries || []).filter((e) => e.period === 'PM');

  const renderEntries = (entries, label) => {
    if (entries.length === 0) return;

    // Section header
    doc.rect(tableLeft, y, tableWidth, 16).fillColor('#e8edf2').fill();
    doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(8);
    doc.text(label, tableLeft + 5, y + 4);
    y += 16;

    doc.font('Helvetica').fontSize(8).fillColor('#111111');
    for (const entry of entries) {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }
      const rowH = 16;
      const bgColor = entry.completed ? '#f0fdf4' : '#fef2f2';
      doc.rect(tableLeft, y, tableWidth, rowH).fillColor(bgColor).fill();
      doc.fillColor('#111111');

      x = tableLeft;
      doc.text(entry.period, x + 3, y + 4, { width: colWidths[0] - 6, align: 'center' });
      x += colWidths[0];
      doc.text((entry.task || '').substring(0, 60), x + 3, y + 4, { width: colWidths[1] - 6 });
      x += colWidths[1];
      doc.text(entry.time_spent ? String(entry.time_spent) : '-', x + 3, y + 4, {
        width: colWidths[2] - 6,
        align: 'center',
      });
      x += colWidths[2];
      doc.text((entry.comment || '').substring(0, 45), x + 3, y + 4, { width: colWidths[3] - 6 });
      x += colWidths[3];
      doc.text(entry.completed ? '✓' : '✗', x + 3, y + 4, {
        width: colWidths[4] - 6,
        align: 'center',
      });
      y += rowH;
    }
  };

  renderEntries(amEntries, 'MATIN (AM)');
  renderEntries(pmEntries, 'APRÈS-MIDI (PM)');

  // Totaux
  y += 10;
  const totalTime = (sheet.entries || []).reduce((s, e) => s + (e.time_spent || 0), 0);
  const totalDone = (sheet.entries || []).filter((e) => e.completed).length;
  const totalEntries = (sheet.entries || []).length;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(`Total : ${totalDone}/${totalEntries} tâches effectuées — ${totalTime}h`, tableLeft, y);

  if (sheet.notes) {
    y += 20;
    doc.font('Helvetica').fontSize(8);
    doc.text(`Notes : ${sheet.notes}`, tableLeft, y, { width: tableWidth });
  }

  // Footer
  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, tableLeft, 800, {
    align: 'center',
    width: tableWidth,
  });

  doc.end();
}

function generateSynthesePdf(synthese, title, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="synthese-${title}.pdf"`);
  doc.pipe(res);

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(`SYNTHÈSE — ${title.toUpperCase()}`, { align: 'center' });
  doc.moveDown(0.3);

  // Résumé global
  const s = synthese.summary;
  doc.fontSize(9).font('Helvetica');
  doc.text(
    `${s.total_sheets} fiches | ${s.completed_tasks}/${s.total_tasks} tâches effectuées (${s.completion_rate}%) | Temps total : ${s.total_time}h`,
    { align: 'center' },
  );
  doc.moveDown(0.8);

  // Tableau par personnel
  const tableLeft = 30;
  const colWidths = [120, 80, 60, 60, 60, 60, 80, 230];
  const headers = [
    'Personnel',
    'Date',
    'Total',
    'Fait',
    'Non fait',
    'Temps (h)',
    'Statut',
    'Anomalies',
  ];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  let y = doc.y;
  doc.rect(tableLeft, y, tableWidth, 18).fillColor('#1e3a5f').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  let x = tableLeft;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 2, y + 4, { width: colWidths[i] - 4, align: 'center' });
    x += colWidths[i];
  }
  y += 18;

  doc.font('Helvetica').fontSize(7).fillColor('#111111');
  for (const sheet of synthese.sheets) {
    if (y > 540) {
      doc.addPage();
      y = 30;
    }
    const bgColor = sheet.stats.not_done > 0 ? '#fef2f2' : '#f0fdf4';
    doc.rect(tableLeft, y, tableWidth, 15).fillColor(bgColor).fill();
    doc.fillColor('#111111');

    x = tableLeft;
    const personName = `${sheet.first_name} ${sheet.last_name}`;
    const statusLabel =
      sheet.status === 'validated'
        ? 'Validée'
        : sheet.status === 'submitted'
          ? 'Soumise'
          : 'Brouillon';
    const anomaly =
      sheet.stats.not_done > 0 ? `${sheet.stats.not_done} tâche(s) non effectuée(s)` : '—';

    const values = [
      personName,
      sheet.date,
      String(sheet.stats.total),
      String(sheet.stats.done),
      String(sheet.stats.not_done),
      String(sheet.stats.time),
      statusLabel,
      anomaly,
    ];

    for (let i = 0; i < values.length; i++) {
      doc.text(values[i], x + 2, y + 4, {
        width: colWidths[i] - 4,
        align: i < 2 ? 'left' : 'center',
      });
      x += colWidths[i];
    }
    y += 15;
  }

  // Anomalies section
  if (s.anomalies.length > 0) {
    y += 15;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#dc2626');
    doc.text('⚠ ANOMALIES', tableLeft, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#111111');
    for (const a of s.anomalies) {
      doc.text(
        `• ${a.person} (${a.date}) : ${a.not_done} tâche(s) non effectuée(s)`,
        tableLeft + 10,
        y,
      );
      y += 12;
    }
  }

  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, 30, 570, {
    align: 'center',
    width: tableWidth,
  });

  doc.end();
}

// ═══════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════

export function setupSuiviRoutes(app, authenticateToken, requireAdmin) {
  // ─────────────────────────────────────────────────
  // Routes statiques AVANT les routes avec paramètres
  // (sinon /api/suivi/:personnelId/:date intercepterait tout)
  // ─────────────────────────────────────────────────

  // ─── GET /api/suivi/personnel ─── Liste du personnel avec stats suivi
  app.get('/api/suivi/personnel', authenticateToken, (req, res) => {
    try {
      const persons = db
        .prepare(
          `SELECT p.id, p.first_name, p.last_name, p.type, p.status,
                  COUNT(ts.id) AS total_sheets,
                  SUM(CASE WHEN ts.status = 'validated' THEN 1 ELSE 0 END) AS validated_sheets
           FROM persons p
           LEFT JOIN tracking_sheets ts ON ts.person_id = p.id
           WHERE p.status = 'active'
           GROUP BY p.id
           ORDER BY p.last_name, p.first_name`,
        )
        .all();
      res.json(persons);
    } catch (error) {
      logger.error('GET /api/suivi/personnel error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/suivi/tache/:tacheId ─── Mise à jour d'une entrée
  app.patch(
    '/api/suivi/tache/:tacheId',
    authenticateToken,
    validate(entryPatchSchema),
    (req, res) => {
      try {
        const entry = db
          .prepare(
            'SELECT te.*, ts.person_id FROM tracking_entries te JOIN tracking_sheets ts ON ts.id = te.sheet_id WHERE te.id = ?',
          )
          .get(req.params.tacheId);
        if (!entry) {
          return res.status(404).json({ success: false, error: 'Entrée non trouvée' });
        }

        // Vérification des droits
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(entry.person_id);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const fields = [];
        const params = [];
        for (const [key, value] of Object.entries(req.body)) {
          if (['completed', 'time_spent', 'comment', 'task', 'period'].includes(key)) {
            fields.push(`${key} = ?`);
            params.push(value);
          }
        }

        if (fields.length > 0) {
          fields.push("modified_at = datetime('now')");
          db.prepare(`UPDATE tracking_entries SET ${fields.join(', ')} WHERE id = ?`).run(
            ...params,
            req.params.tacheId,
          );

          // Synchroniser le statut de la tâche planifiée liée
          if (req.body.completed !== undefined && entry.task_assignment_id) {
            const newStatus = req.body.completed ? 'done' : 'pending';
            db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
              newStatus,
              entry.task_assignment_id,
            );
          }
        }

        const updated = db
          .prepare('SELECT * FROM tracking_entries WHERE id = ?')
          .get(req.params.tacheId);
        res.json(updated);
      } catch (error) {
        logger.error('PATCH /api/suivi/tache/:tacheId error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/synthese/jour/:date ─── Synthèse journalière
  app.get('/api/suivi/synthese/jour/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }
      const synthese = buildSynthese([date]);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week ─── Synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      if (!/^\d{4}-W\d{2}$/.test(week)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month ─── Synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Format mois invalide (YYYY-MM)' });
      }
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/jour/:date/pdf ─── PDF synthèse journalière
  app.get('/api/suivi/synthese/jour/:date/pdf', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      const synthese = buildSynthese([date]);
      generateSynthesePdf(synthese, `jour-${date}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week/pdf ─── PDF synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week/pdf', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      generateSynthesePdf(synthese, `semaine-${week}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month/pdf ─── PDF synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month/pdf', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      generateSynthesePdf(synthese, `mois-${month}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─────────────────────────────────────────────────
  // Routes avec paramètres dynamiques (après les statiques)
  // ─────────────────────────────────────────────────

  // ─── GET /api/suivi/:personnelId/:date ─── Récupérer ou créer la fiche du jour
  app.get('/api/suivi/:personnelId/:date', authenticateToken, (req, res) => {
    try {
      const { personnelId, date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide (YYYY-MM-DD)' });
      }

      const person = db.prepare('SELECT id FROM persons WHERE id = ?').get(personnelId);
      if (!person) {
        return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
      }

      const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);
      const full = getSheetWithEntries(sheet.id);
      res.json(full);
    } catch (error) {
      logger.error('GET /api/suivi/:personnelId/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/:personnelId/:date ─── Mise à jour complète de la fiche
  app.post(
    '/api/suivi/:personnelId/:date',
    authenticateToken,
    validate(sheetUpdateSchema),
    (req, res) => {
      try {
        const { personnelId, date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: 'Format date invalide' });
        }

        const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);

        // Vérification des droits : propriétaire ou admin
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(personnelId);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res
            .status(403)
            .json({ success: false, error: 'Vous ne pouvez modifier que vos propres fiches' });
        }

        const { status, notes, entries } = req.body;

        // Mettre à jour la fiche
        const updates = [];
        const params = [];
        if (status) {
          updates.push('status = ?');
          params.push(status);
        }
        if (notes !== undefined) {
          updates.push('notes = ?');
          params.push(notes);
        }
        updates.push('modified_by = ?', "modified_at = datetime('now')");
        params.push(req.user.id);

        if (updates.length > 0) {
          db.prepare(`UPDATE tracking_sheets SET ${updates.join(', ')} WHERE id = ?`).run(
            ...params,
            sheet.id,
          );
        }

        // Remplacer les entrées
        db.prepare('DELETE FROM tracking_entries WHERE sheet_id = ?').run(sheet.id);
        if (entries && entries.length > 0) {
          const insert = db.prepare(
            `INSERT INTO tracking_entries (id, sheet_id, period, task, time_spent, comment, completed, task_assignment_id, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );
          const insertAll = db.transaction((items) => {
            for (let i = 0; i < items.length; i++) {
              const e = items[i];
              const entryId = e.id || crypto.randomUUID().replace(/-/g, '');
              insert.run(
                entryId,
                sheet.id,
                e.period,
                e.task || '',
                e.time_spent || 0,
                e.comment || '',
                e.completed ? 1 : 0,
                e.task_assignment_id || null,
                e.sort_order ?? i,
              );
            }
          });
          insertAll(entries);

          // Synchroniser le statut des tâches planifiées liées
          for (const e of entries) {
            if (e.task_assignment_id) {
              const newStatus = e.completed ? 'done' : 'pending';
              db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
                newStatus,
                e.task_assignment_id,
              );
            }
          }
        }

        const full = getSheetWithEntries(sheet.id);
        res.json(full);
      } catch (error) {
        logger.error('POST /api/suivi/:personnelId/:date error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/:ficheId/pdf ─── Export PDF individuel
  app.get('/api/suivi/:ficheId/pdf', authenticateToken, (req, res) => {
    try {
      const full = getSheetWithEntries(req.params.ficheId);
      if (!full) {
        return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
      }
      generateSheetPdf(full, res);
    } catch (error) {
      logger.error('GET /api/suivi/:ficheId/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── PUT /api/suivi/:ficheId/validate ─── Valider une fiche (admin)
  app.put('/api/suivi/:ficheId/validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const sheet = db
        .prepare('SELECT * FROM tracking_sheets WHERE id = ?')
        .get(req.params.ficheId);
      if (!sheet) {
        return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
      }

      db.prepare(
        `UPDATE tracking_sheets SET status = 'validated', validated_by = ?, validated_at = datetime('now'), modified_by = ?, modified_at = datetime('now') WHERE id = ?`,
      ).run(req.user.id, req.user.id, sheet.id);

      const full = getSheetWithEntries(sheet.id);
      res.json(full);
    } catch (error) {
      logger.error('PUT /api/suivi/:ficheId/validate error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
