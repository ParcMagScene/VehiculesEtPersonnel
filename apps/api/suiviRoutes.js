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
  }

  // Sync incrémentale : injecter les tâches planifiées pas encore liées à la fiche
  // Combine : assignation directe (task_assignments.person_id) + multi-affectation (planning_assignments)
  const newTasks = db
    .prepare(
      `SELECT ta.id, ta.period, ta.title, ta.notes, ta.section, ta.time, ta.end_time,
              ta.affaire_num, ta.google_event_title, ta.status
       FROM task_assignments ta
       WHERE ta.date = ? AND ta.deleted_at IS NULL
         AND (
           ta.person_id = ?
           OR ta.id IN (
             SELECT pa.entity_id FROM planning_assignments pa
             WHERE pa.entity_type = 'task' AND pa.person_id = ?
           )
         )
         AND ta.id NOT IN (
           SELECT te.task_assignment_id FROM tracking_entries te
           WHERE te.sheet_id = ? AND te.task_assignment_id IS NOT NULL
         )
       ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
    )
    .all(date, personId, personId, sheet.id);

  if (newTasks.length > 0) {
    const maxOrder = db
      .prepare('SELECT MAX(sort_order) AS mx FROM tracking_entries WHERE sheet_id = ?')
      .get(sheet.id);
    let nextOrder = (maxOrder?.mx ?? -1) + 1;

    const insert = db.prepare(
      `INSERT INTO tracking_entries (id, sheet_id, period, task, time_spent, comment, completed, task_assignment_id, sort_order)
       VALUES (?, ?, ?, ?, 0, '', ?, ?, ?)`,
    );

    const insertMany = db.transaction((items) => {
      for (const t of items) {
        const entryId = crypto.randomUUID().replace(/-/g, '');
        const label =
          t.title || t.google_event_title || t.notes || `Tâche ${t.section || 'manuelle'}`;
        const completed = t.status === 'done' ? 1 : 0;
        insert.run(entryId, sheet.id, t.period || 'AM', label, completed, t.id, nextOrder++);
      }
    });
    insertMany(newTasks);
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

const PDF_MARGIN = 40;
const PDF_TABLE_LEFT = 40;
const PDF_COL_WIDTHS = [24, 250, 48, 145, 48]; // N, Tache, Temps, Commentaire, Fait
const PDF_TABLE_WIDTH = PDF_COL_WIDTHS.reduce((a, b) => a + b, 0);
const PDF_HEADERS = ['N.', 'Tache', 'Temps (h)', 'Commentaire', 'Fait'];
const PDF_ROW_MIN_H = 22;
const PDF_TEXT_PADDING_X = 4;
const PDF_TEXT_PADDING_Y = 5;
const PDF_TABLE_BOTTOM = 760;
const PDF_WATERMARK_COLOR = '#e0e4e8';

// ─── Helpers PDF communs ───

function drawPdfHeader(doc, sheet, subtitle) {
  const dateStr = formatDateFR(sheet.date);
  const personName = sheet.person
    ? `${sheet.person.first_name} ${sheet.person.last_name}`
    : 'Personnel';

  // Date en haut à gauche
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#334155');
  doc.text(dateStr, PDF_TABLE_LEFT, PDF_MARGIN, { lineBreak: false });

  // Nom du personnel en titre principal centré
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(personName.toUpperCase(), PDF_TABLE_LEFT, PDF_MARGIN + 18, {
    width: PDF_TABLE_WIDTH,
    align: 'center',
  });

  // Sous-titre Matin/Après-midi si présent
  if (subtitle) {
    doc.moveDown(0.2);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#334155');
    doc.text(subtitle, { align: 'center' });
  }
  doc.moveDown(0.5);
}

function drawPdfTableHeader(doc, y) {
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, 20).fillColor('#1e3a5f').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = PDF_TABLE_LEFT;
  for (let i = 0; i < PDF_HEADERS.length; i++) {
    doc.text(PDF_HEADERS[i], x + 3, y + 5, { width: PDF_COL_WIDTHS[i] - 6, align: 'center' });
    x += PDF_COL_WIDTHS[i];
  }
  return y + 20;
}

function getPdfEntryRowHeight(doc, entry) {
  const taskWidth = PDF_COL_WIDTHS[1] - PDF_TEXT_PADDING_X * 2;
  const commentWidth = PDF_COL_WIDTHS[3] - PDF_TEXT_PADDING_X * 2;

  doc.font('Helvetica').fontSize(8);

  const taskLines = doc.heightOfString(entry.task || '', {
    width: taskWidth,
    align: 'left',
  });
  const commentLines = doc.heightOfString(entry.comment || '', {
    width: commentWidth,
    align: 'left',
  });

  const lineHeight = doc.currentLineHeight(true);
  const taskHeight = Math.max(lineHeight, Math.ceil(taskLines));
  const commentHeight = Math.max(lineHeight, Math.ceil(commentLines));

  return Math.max(
    PDF_ROW_MIN_H,
    Math.ceil(taskHeight + PDF_TEXT_PADDING_Y * 2 + 2),
    Math.ceil(commentHeight + PDF_TEXT_PADDING_Y * 2 + 2),
  );
}

function drawPdfEntryRow(doc, entry, rowNum, y, rowHeight) {
  const bgColor = entry.completed === 1 ? '#f0fdf4' : '#ffffff';
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, rowHeight).fillColor(bgColor).fill();

  doc.lineWidth(0.5).strokeColor('#cbd5e1');
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, rowHeight).stroke();
  let x = PDF_TABLE_LEFT;
  for (let i = 0; i < PDF_COL_WIDTHS.length - 1; i++) {
    x += PDF_COL_WIDTHS[i];
    doc
      .moveTo(x, y)
      .lineTo(x, y + rowHeight)
      .stroke();
  }

  doc.fillColor('#111111').font('Helvetica').fontSize(8);
  x = PDF_TABLE_LEFT;
  doc.text(String(rowNum), x + 2, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[0] - 4,
    align: 'center',
  });
  x += PDF_COL_WIDTHS[0];

  doc.text(entry.task || '', x + PDF_TEXT_PADDING_X, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[1] - PDF_TEXT_PADDING_X * 2,
    align: 'left',
    lineBreak: true,
  });
  x += PDF_COL_WIDTHS[1];

  doc.text(entry.time_spent ? String(entry.time_spent) : '-', x + 2, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[2] - 4,
    align: 'center',
  });
  x += PDF_COL_WIDTHS[2];

  doc.text(entry.comment || '', x + PDF_TEXT_PADDING_X, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[3] - PDF_TEXT_PADDING_X * 2,
    align: 'left',
    lineBreak: true,
  });
  x += PDF_COL_WIDTHS[3];

  doc.text(
    entry.completed === 1 ? 'Oui' : entry.completed === 0 ? 'Non' : '',
    x + 2,
    y + PDF_TEXT_PADDING_Y,
    {
      width: PDF_COL_WIDTHS[4] - 4,
      align: 'center',
    },
  );
}

function drawPdfWatermarkRows(doc, startY, maxY) {
  let y = startY;
  let rowNum = 0;
  while (y + PDF_ROW_MIN_H <= maxY) {
    rowNum++;
    doc.lineWidth(0.3).strokeColor(PDF_WATERMARK_COLOR);
    doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, PDF_ROW_MIN_H).stroke();

    let x = PDF_TABLE_LEFT;
    for (let i = 0; i < PDF_COL_WIDTHS.length - 1; i++) {
      x += PDF_COL_WIDTHS[i];
      doc
        .moveTo(x, y)
        .lineTo(x, y + PDF_ROW_MIN_H)
        .stroke();
    }

    doc.fillColor(PDF_WATERMARK_COLOR).font('Helvetica').fontSize(7);
    doc.text(String(rowNum), PDF_TABLE_LEFT + 2, y + PDF_TEXT_PADDING_Y, {
      width: PDF_COL_WIDTHS[0] - 4,
      align: 'center',
    });

    y += PDF_ROW_MIN_H;
  }
  return y;
}

function drawPdfFooter(doc, entries, label) {
  const totalTime = entries.reduce((s, e) => s + (e.time_spent || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(`${totalDone}/${entries.length} effectuee(s) -- ${totalTime}h`, PDF_TABLE_LEFT, 765, {
    width: PDF_TABLE_WIDTH * 0.5,
    lineBreak: false,
  });

  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text('Signature / Visa :', PDF_TABLE_LEFT + PDF_TABLE_WIDTH * 0.55, 760, {
    width: PDF_TABLE_WIDTH * 0.45,
    align: 'right',
    lineBreak: false,
  });
  doc
    .lineWidth(0.5)
    .strokeColor('#94a3b8')
    .moveTo(PDF_TABLE_LEFT + PDF_TABLE_WIDTH * 0.7, 777)
    .lineTo(PDF_TABLE_LEFT + PDF_TABLE_WIDTH, 777)
    .stroke();

  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Genere par eM@g -- ${new Date().toLocaleString('fr-FR')}`, PDF_TABLE_LEFT, 790, {
    align: 'center',
    width: PDF_TABLE_WIDTH,
    lineBreak: false,
  });
}

// ─── MODE NORMAL : AM + PM sur les memes pages, pas de filigrane ───

function renderNormalEntries(doc, entries, startY) {
  let y = startY;
  for (let i = 0; i < entries.length; i++) {
    const rowHeight = getPdfEntryRowHeight(doc, entries[i]);
    if (y + rowHeight > PDF_TABLE_BOTTOM) {
      drawPdfFooter(doc, entries.slice(0, i), 'Suite page suivante');
      doc.addPage();
      y = drawPdfTableHeader(doc, PDF_MARGIN);
    }
    drawPdfEntryRow(doc, entries[i], i + 1, y, rowHeight);
    y += rowHeight;
  }
  return y;
}

function generateNormalSheetPdf(sheet, doc) {
  const allEntries = sheet.entries || [];
  const amEntries = allEntries.filter((e) => e.period === 'AM');
  const pmEntries = allEntries.filter((e) => e.period === 'PM');

  drawPdfHeader(doc, sheet, null);

  // Section Matin
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text('MATIN (AM)', PDF_TABLE_LEFT, doc.y);
  doc.moveDown(0.3);
  let y = drawPdfTableHeader(doc, doc.y);
  y = renderNormalEntries(doc, amEntries, y);

  // Section Apres-midi
  if (y + 60 > 720) {
    doc.addPage();
    y = PDF_MARGIN;
  } else {
    y += 15;
  }
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text('APRES-MIDI (PM)', PDF_TABLE_LEFT, y);
  doc.moveDown(0.3);
  y = drawPdfTableHeader(doc, doc.y);
  y = renderNormalEntries(doc, pmEntries, y);

  // Notes
  if (sheet.notes) {
    if (y + 30 > 760) {
      doc.addPage();
      y = PDF_MARGIN;
    } else {
      y += 10;
    }
    doc.fontSize(8).font('Helvetica').fillColor('#475569');
    doc.text(`Notes : ${sheet.notes}`, PDF_TABLE_LEFT, y, { width: PDF_TABLE_WIDTH });
  }

  drawPdfFooter(doc, allEntries, 'Total');
}

// ─── MODE IMPRESSION : Recto-verso, Matin/Apres-midi, lignes filigrane ───

function renderPrintHalfDayPage(doc, sheet, entries, subtitle) {
  drawPdfHeader(doc, sheet, subtitle);

  let y = drawPdfTableHeader(doc, doc.y);

  for (let i = 0; i < entries.length; i++) {
    const rowHeight = getPdfEntryRowHeight(doc, entries[i]);
    if (y + rowHeight > PDF_TABLE_BOTTOM) break;
    drawPdfEntryRow(doc, entries[i], i + 1, y, rowHeight);
    y += rowHeight;
  }

  drawPdfWatermarkRows(doc, y, PDF_TABLE_BOTTOM);
  drawPdfFooter(doc, entries, subtitle);
}

// ─── Fonctions de generation finales ───

/**
 * PDF normal individuel (AM+PM ensemble, pas de filigrane)
 */
function generateSheetPdf(sheet, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="fiche-suivi-${sheet.person?.last_name || 'personnel'}-${sheet.date}.pdf"`,
  );
  doc.pipe(res);
  generateNormalSheetPdf(sheet, doc);
  doc.end();
}

/**
 * PDF normal multi-fiches (export batch)
 */
function generateBatchPdf(sheets, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fiches-suivi-batch.pdf"');
  doc.pipe(res);

  for (let s = 0; s < sheets.length; s++) {
    if (s > 0) doc.addPage();
    generateNormalSheetPdf(sheets[s], doc);
  }

  doc.end();
}

/**
 * PDF impression recto-verso multi-fiches (Recto=Matin, Verso=Apres-midi, lignes filigrane)
 */
function generateBatchPrintPdf(sheets, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="fiches-suivi-impression.pdf"');
  doc.pipe(res);

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (s > 0) doc.addPage();

    const amEntries = (sheet.entries || []).filter((e) => e.period === 'AM');
    const pmEntries = (sheet.entries || []).filter((e) => e.period === 'PM');

    // Recto: Matin
    renderPrintHalfDayPage(doc, sheet, amEntries, 'MATIN (AM)');

    // Verso: Apres-midi
    doc.addPage();
    renderPrintHalfDayPage(doc, sheet, pmEntries, 'APRES-MIDI (PM)');

    if (sheet.notes) {
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text(`Notes : ${sheet.notes}`, PDF_TABLE_LEFT, 740, { width: PDF_TABLE_WIDTH });
    }
  }

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
    .text(`SYNTHESE -- ${title.toUpperCase()}`, { align: 'center' });
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
    doc.text('/!\\ ANOMALIES', tableLeft, y);
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
           WHERE p.status = 'active' AND p.type IN ('permanent', 'contractuel', 'stagiaire', 'apprenti')
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

  // ─── GET /api/suivi/planning-tasks/:date ─── Tâches planifiées du jour (inclut terminées)
  app.get('/api/suivi/planning-tasks/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }

      // Tâches du jour (on conserve aussi les tâches terminées)
      const tasks = db
        .prepare(
          `SELECT ta.id, ta.title, ta.section, ta.period, ta.time, ta.end_time,
                  ta.affaire_num, ta.notes, ta.status, ta.google_event_title
           FROM task_assignments ta
           WHERE ta.date = ? AND ta.deleted_at IS NULL
           ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
        )
        .all(date);

      res.json(tasks);
    } catch (error) {
      logger.error('GET /api/suivi/planning-tasks error:', error);
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
            const newStatus = req.body.completed === 1 ? 'done' : 'pending';
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

  // ─── POST /api/suivi/batch/pdf ─── Export PDF multi-fiches (normal, sans recto-verso)
  app.post('/api/suivi/batch/pdf', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(full);
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF batch' });
      }
    }
  });

  // ─── POST /api/suivi/batch/print ─── PDF impression recto-verso (Matin/Après-midi + filigrane)
  app.post('/api/suivi/batch/print', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(full);
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPrintPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/print error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF impression' });
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

        // Remplacer les entrées de manière atomique pour éviter toute perte en cas d'erreur
        const replaceEntries = db.transaction((items) => {
          db.prepare('DELETE FROM tracking_entries WHERE sheet_id = ?').run(sheet.id);

          if (!items || items.length === 0) return;

          const insert = db.prepare(
            `INSERT INTO tracking_entries (id, sheet_id, period, task, time_spent, comment, completed, task_assignment_id, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );

          for (let i = 0; i < items.length; i++) {
            const e = items[i];
            const entryId = e.id || crypto.randomUUID().replace(/-/g, '');
            // `completed` est NOT NULL en base: toute valeur non "fait" est stockée à 0.
            const completed = e.completed === 1 ? 1 : 0;

            insert.run(
              entryId,
              sheet.id,
              e.period,
              e.task || '',
              e.time_spent || 0,
              e.comment || '',
              completed,
              e.task_assignment_id || null,
              e.sort_order ?? i,
            );
          }

          // Synchroniser le statut des tâches planifiées liées
          for (const e of items) {
            if (e.task_assignment_id) {
              const newStatus = e.completed === 1 ? 'done' : 'pending';
              db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
                newStatus,
                e.task_assignment_id,
              );
            }
          }
        });
        replaceEntries(entries || []);

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
