// ═══════════════════════════════════════════════════════════════
// [S2-1 step 3] Génération PDF extraite de suiviRoutes.js
// Constantes layout + fonctions de rendu (PDFKit).
// ═══════════════════════════════════════════════════════════════

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { decToHM, formatDateFR, isUnreportedPeriodEntries } from './_helpers.js';
import { attachPdfSanitizer } from './_pdf-sanitize.js';

export const PDF_MARGIN = 40;
export const PDF_TABLE_LEFT = 40;
export const PDF_COL_WIDTHS = [24, 250, 60, 133, 48]; // N, Tache, Temps, Commentaire, Fait
export const PDF_TABLE_WIDTH = PDF_COL_WIDTHS.reduce((a, b) => a + b, 0);
export const PDF_HEADERS = ['N.', 'Tache', 'Temps', 'Commentaire', 'Fait'];
export const PDF_ROW_MIN_H = 22;
export const PDF_TEXT_PADDING_X = 4;
export const PDF_TEXT_PADDING_Y = 5;
export const PDF_TABLE_BOTTOM = 760;
export const PDF_WATERMARK_COLOR = '#b0b8c4';
export const PDF_QR_SIZE = 70;

// ─── Helpers métadonnées personnel & URL ───

const PERSON_TYPE_LABELS = {
  permanent: 'Permanent',
  contractuel: 'Contractuel',
  stagiaire: 'Stagiaire',
  apprenti: 'Apprenti',
};

/**
 * Convertit `persons.type` (+ contract_type éventuel) en libellé lisible.
 * Fallback : Title Case de la valeur brute.
 */
export function getPersonTypeLabel(person) {
  if (!person) return '';
  const raw = String(person.type || '').toLowerCase();
  if (PERSON_TYPE_LABELS[raw]) return PERSON_TYPE_LABELS[raw];
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Construit l'URL absolue de remplissage de fiche pour un personnel donné.
 * Utilise API_BASE_URL (env) avec fallback dev. Le hash router mobile gère
 * la query string : `#/mobile/suivi?date=...&person=...`.
 */
export function buildSuiviSheetUrl(sheet) {
  const root = (process.env.API_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (sheet?.date) params.set('date', sheet.date);
  if (sheet?.person?.id) params.set('person', String(sheet.person.id));
  const qs = params.toString();
  return `${root}/#/mobile/suivi${qs ? `?${qs}` : ''}`;
}

/**
 * Pré-génère un buffer PNG pour le QR de chaque fiche et l'attache à
 * `sheet._qrBuffer`. À appeler avant le rendu PDF (drawPdfHeader est sync).
 */
export async function ensureSheetQrBuffers(sheets) {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  await Promise.all(
    list.map(async (sheet) => {
      if (!sheet || sheet._qrBuffer) return;
      try {
        const url = buildSuiviSheetUrl(sheet);
        sheet._qrBuffer = await QRCode.toBuffer(url, {
          errorCorrectionLevel: 'M',
          type: 'png',
          margin: 1,
          width: 256,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (e) {
        console.warn('[suivi-pdf] QR generation failed:', e?.message || e);
        sheet._qrBuffer = null;
      }
    }),
  );
}

// ─── Helpers PDF communs ───

export function drawPdfHeader(doc, sheet, subtitle) {
  const dateStr = formatDateFR(sheet.date);
  const personName = sheet.person
    ? `${sheet.person.first_name} ${sheet.person.last_name}`
    : 'Personnel';
  const personTypeLabel = getPersonTypeLabel(sheet.person);

  // Réserver l'espace en haut à droite pour le QR (largeur PDF_QR_SIZE)
  const qrX = PDF_TABLE_LEFT + PDF_TABLE_WIDTH - PDF_QR_SIZE;
  const qrY = PDF_MARGIN;
  if (sheet._qrBuffer) {
    try {
      doc.image(sheet._qrBuffer, qrX, qrY, { width: PDF_QR_SIZE, height: PDF_QR_SIZE });
      // Légende sous le QR
      doc.fontSize(6).font('Helvetica').fillColor('#64748b');
      doc.text('Scanner pour remplir en ligne', qrX - 4, qrY + PDF_QR_SIZE + 2, {
        width: PDF_QR_SIZE + 8,
        align: 'center',
        lineBreak: false,
      });
    } catch (e) {
      console.warn('[suivi-pdf] QR image embed failed:', e?.message || e);
    }
  }

  // Date en haut à gauche
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#334155');
  doc.text(dateStr, PDF_TABLE_LEFT, PDF_MARGIN, { lineBreak: false });

  // Nom du personnel en titre principal — centré sur toute la largeur du tableau
  // (le QR reste superposé en haut à droite, le centrage page reste visuel)
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(personName.toUpperCase(), PDF_TABLE_LEFT, PDF_MARGIN + 18, {
    width: PDF_TABLE_WIDTH,
    align: 'center',
  });

  // Type de personnel sous le nom — centré sur toute la largeur
  if (personTypeLabel) {
    doc.fontSize(10).font('Helvetica').fillColor('#475569');
    doc.text(personTypeLabel, PDF_TABLE_LEFT, PDF_MARGIN + 40, {
      width: PDF_TABLE_WIDTH,
      align: 'center',
      lineBreak: false,
    });
  }

  // Calage Y minimum pour ne pas chevaucher le QR
  const headerBottom = Math.max(
    PDF_MARGIN + 40 + (personTypeLabel ? 14 : 0),
    qrY + PDF_QR_SIZE + 12, // sous le QR + sa légende
  );
  doc.y = headerBottom;

  // Sous-titre Matin/Après-midi si présent
  if (subtitle) {
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#334155');
    doc.text(subtitle, PDF_TABLE_LEFT, doc.y, { width: PDF_TABLE_WIDTH, align: 'center' });
  }

  // Contexte du jour (toujours affiché)
  const ctx = sheet.day_context || {};
  const contextParts = [];
  if (Array.isArray(ctx.availabilities) && ctx.availabilities.length > 0) {
    const labels = [
      ...new Set(ctx.availabilities.map((a) => a?.type_label || a?.type).filter(Boolean)),
    ];
    if (labels.length > 0) contextParts.push(`Disponibilites: ${labels.join(', ')}`);
  }
  if (Array.isArray(ctx.missions) && ctx.missions.length > 0) {
    contextParts.push(`Missions: ${ctx.missions.length}`);
  }
  const affaires = Array.isArray(ctx.planning_affaires) ? ctx.planning_affaires : [];
  if (affaires.length > 0) {
    const labels = affaires
      .map((a) => {
        const num = String(a?.affaire_num || '').trim();
        const label = String(a?.affaire_label || '').trim();
        if (!num && !label) return '';
        if (!label || label.toLowerCase() === num.toLowerCase()) return num || label;
        return `${num} (${label})`;
      })
      .filter(Boolean);
    if (labels.length > 0) contextParts.push(`Affaires: ${labels.join(', ')}`);
  }
  if (contextParts.length === 0) contextParts.push('Aucun contexte declare');

  {
    doc.moveDown(0.4);
    const blockX = PDF_TABLE_LEFT;
    const blockW = PDF_TABLE_WIDTH;
    const blockY = doc.y;
    const labelH = 16;
    const rowH = 13;
    const totalH = labelH + contextParts.length * rowH + 4;

    // Fond bleu pâle
    doc.rect(blockX, blockY, blockW, totalH).fillColor('#eef4fb').fill();
    doc.rect(blockX, blockY, blockW, totalH).lineWidth(0.5).strokeColor('#93c5fd').stroke();

    // Étiquette
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e40af');
    doc.text('Contexte du jour :', blockX + 6, blockY + 4, { lineBreak: false });

    // Lignes contexte
    doc.font('Helvetica').fillColor('#1e3a5f');
    contextParts.forEach((text, idx) => {
      const rowY = blockY + labelH + idx * rowH;
      doc.fontSize(8).text(`• ${text}`, blockX + 12, rowY, {
        width: blockW - 18,
        lineBreak: false,
        ellipsis: true,
      });
    });

    doc.y = blockY + totalH + 4;
  }

  doc.moveDown(0.4);
}

export function drawPdfTableHeader(doc, y) {
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, 20).fillColor('#1e3a5f').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = PDF_TABLE_LEFT;
  for (let i = 0; i < PDF_HEADERS.length; i++) {
    const label = PDF_HEADERS[i];
    const cellWidth = PDF_COL_WIDTHS[i];
    const textWidth = doc.widthOfString(label);
    const textX = x + Math.max(3, (cellWidth - textWidth) / 2);
    doc.text(label, textX, y + 5, { lineBreak: false });
    x += PDF_COL_WIDTHS[i];
  }
  return y + 20;
}

export function drawPdfNonRenseigneeNotice(doc, y) {
  const noticeH = 26;
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, noticeH).fillColor('#fee2e2').fill();
  doc
    .rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, noticeH)
    .lineWidth(0.5)
    .strokeColor('#ef4444')
    .stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#991b1b');
  doc.text('Non renseignee pour cette periode', PDF_TABLE_LEFT + 8, y + 8, {
    width: PDF_TABLE_WIDTH - 16,
    lineBreak: false,
  });
  return y + noticeH;
}

export function getPdfEntryRowHeight(doc, entry) {
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

export function drawPdfEntryRow(doc, entry, rowNum, y, rowHeight) {
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

  doc.text(entry.time_spent ? decToHM(entry.time_spent) : '-', x + 2, y + PDF_TEXT_PADDING_Y, {
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

export function drawPdfWatermarkRows(doc, startY, maxY) {
  let y = startY;
  let rowNum = 0;
  while (y + PDF_ROW_MIN_H <= maxY) {
    rowNum++;
    doc.lineWidth(0.5).strokeColor(PDF_WATERMARK_COLOR);
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

export function drawPdfFooter(doc, entries, _label) {
  const totalTime = entries.reduce((s, e) => s + (e.time_spent || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(
    `${totalDone}/${entries.length} effectuee(s) — ${decToHM(totalTime)}`,
    PDF_TABLE_LEFT,
    765,
    {
      width: PDF_TABLE_WIDTH * 0.5,
      lineBreak: false,
    },
  );

  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Genere par eM@g -- ${new Date().toLocaleString('fr-FR')}`, PDF_TABLE_LEFT, 790, {
    align: 'center',
    width: PDF_TABLE_WIDTH,
    lineBreak: false,
  });
}

// ─── MODE NORMAL : AM + PM sur les memes pages, pas de filigrane ───

export function renderNormalEntries(doc, entries, startY) {
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

export function generateNormalSheetPdf(sheet, doc) {
  const allEntries = sheet.entries || [];
  const amEntries = allEntries.filter((e) => e.period === 'AM');
  const pmEntries = allEntries.filter((e) => e.period === 'PM');
  const unreportedAm = isUnreportedPeriodEntries(amEntries);
  const unreportedPm = isUnreportedPeriodEntries(pmEntries);

  drawPdfHeader(doc, sheet, null);

  // Section Matin
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text('MATIN (AM)', PDF_TABLE_LEFT, doc.y);
  doc.moveDown(0.3);
  let y = drawPdfTableHeader(doc, doc.y);
  y = renderNormalEntries(doc, amEntries, y);
  if (unreportedAm) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

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
  if (unreportedPm) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

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

// ─── MODE IMPRESSION : recto unique, Matin (haut) + Apres-midi (bas), lignes filigrane ───

/**
 * Rend une demi-section (Matin ou Apres-midi) bornee verticalement entre [top, bottom].
 * Inclut: sous-titre, en-tete de tableau, lignes saisies, lignes filigrane et mini-total.
 */
export function renderPrintHalfSection(doc, sheet, entries, label, period, top, bottom) {
  // Sous-titre de section centre
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text(label, PDF_TABLE_LEFT, top, {
    width: PDF_TABLE_WIDTH,
    align: 'center',
    lineBreak: false,
  });

  let y = top + 16;
  y = drawPdfTableHeader(doc, y);

  // Reserver une bande basse pour le mini-total de la section
  const FOOTER_RESERVE = 14;
  const entriesBottom = bottom - FOOTER_RESERVE;

  for (let i = 0; i < entries.length; i++) {
    const rowHeight = getPdfEntryRowHeight(doc, entries[i]);
    if (y + rowHeight > entriesBottom) break;
    drawPdfEntryRow(doc, entries[i], i + 1, y, rowHeight);
    y += rowHeight;
  }

  if (period && isUnreportedPeriodEntries(entries)) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

  drawPdfWatermarkRows(doc, y, entriesBottom);

  // Mini-total de section
  const totalTime = entries.reduce((s, e) => s + (e.time_spent || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(
    `${label} — ${totalDone}/${entries.length} effectuee(s) — ${decToHM(totalTime)}`,
    PDF_TABLE_LEFT,
    bottom - 11,
    {
      width: PDF_TABLE_WIDTH,
      align: 'left',
      lineBreak: false,
    },
  );
}

/**
 * Rend une fiche complete sur une seule page : header partage, page coupee
 * en deux dans la hauteur (Matin en haut, Apres-midi en bas), separateur horizontal,
 * puis pied de page partage (signature + generation).
 */
export function renderPrintFullDayPage(doc, sheet) {
  drawPdfHeader(doc, sheet, null);

  const startY = doc.y;
  const FOOTER_TOP = 758; // au-dessus de la zone signature/genere
  const SECTION_GAP = 10;
  const totalArea = FOOTER_TOP - startY;
  const halfHeight = (totalArea - SECTION_GAP) / 2;
  const topSectionBottom = startY + halfHeight;
  const bottomSectionTop = topSectionBottom + SECTION_GAP;
  const bottomSectionBottom = FOOTER_TOP;

  const amEntries = (sheet.entries || []).filter((e) => e.period === 'AM');
  const pmEntries = (sheet.entries || []).filter((e) => e.period === 'PM');

  // Section haute : Matin
  renderPrintHalfSection(doc, sheet, amEntries, 'MATIN (AM)', 'AM', startY, topSectionBottom);

  // Separateur horizontal (trait pointille pour suggerer le pli/decoupe)
  const sepY = topSectionBottom + SECTION_GAP / 2;
  doc.save();
  doc
    .lineWidth(0.8)
    .strokeColor('#94a3b8')
    .dash(4, { space: 3 })
    .moveTo(PDF_TABLE_LEFT, sepY)
    .lineTo(PDF_TABLE_LEFT + PDF_TABLE_WIDTH, sepY)
    .stroke();
  doc.undash();
  doc.restore();

  // Section basse : Apres-midi
  renderPrintHalfSection(
    doc,
    sheet,
    pmEntries,
    'APRES-MIDI (PM)',
    'PM',
    bottomSectionTop,
    bottomSectionBottom,
  );

  // Pied de page partage (horodatage uniquement)
  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Genere par eM@g -- ${new Date().toLocaleString('fr-FR')}`, PDF_TABLE_LEFT, 792, {
    align: 'center',
    width: PDF_TABLE_WIDTH,
    lineBreak: false,
  });
}

// ─── Fonctions de generation finales ───

// [SEC PHASE 1] Sanitize une valeur dynamique pour Content-Disposition.
// Bloque l'injection CRLF / quote-break + path traversal dans le filename.
export function safePdfFilename(value) {
  return (
    String(value ?? '')
      .replace(/[\r\n"\\/]/g, '_') // CR, LF, quotes, slashes
      .replace(/[^\w\s\-().]/g, '_') // tout caractère non sûr
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 80) || 'export'
  );
}

/**
 * PDF normal individuel (AM+PM ensemble, pas de filigrane).
 * Async : pré-génère le QR avant rendu.
 */
export async function generateSheetPdf(sheet, res) {
  await ensureSheetQrBuffers(sheet);
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  attachPdfSanitizer(doc);
  res.setHeader('Content-Type', 'application/pdf');
  const safeName = safePdfFilename(sheet.person?.last_name || 'personnel');
  const safeDate = safePdfFilename(sheet.date);
  const fname = `fiche-suivi-${safeName}-${safeDate}.pdf`;
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
  );
  doc.pipe(res);
  generateNormalSheetPdf(sheet, doc);
  doc.end();
}

/**
 * PDF normal multi-fiches (export batch).
 * Async : pré-génère les QR avant rendu.
 */
export async function generateBatchPdf(sheets, res) {
  await ensureSheetQrBuffers(sheets);
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  attachPdfSanitizer(doc);
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
 * PDF impression multi-fiches : une seule page (recto) par fiche,
 * coupee en deux dans la hauteur (Matin haut / Apres-midi bas), lignes filigrane.
 * Async : pré-génère les QR avant rendu.
 */
export async function generateBatchPrintPdf(sheets, res) {
  await ensureSheetQrBuffers(sheets);
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  attachPdfSanitizer(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="fiches-suivi-impression.pdf"');
  doc.pipe(res);

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (s > 0) doc.addPage();

    renderPrintFullDayPage(doc, sheet);

    if (sheet.notes) {
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text(`Notes : ${sheet.notes}`, PDF_TABLE_LEFT, 770, {
        width: PDF_TABLE_WIDTH * 0.5,
        lineBreak: false,
        ellipsis: true,
      });
    }
  }

  doc.end();
}

export function generateSynthesePdf(synthese, title, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  attachPdfSanitizer(doc);
  res.setHeader('Content-Type', 'application/pdf');
  const fname = `synthese-${safePdfFilename(title)}.pdf`;
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
  );
  doc.pipe(res);

  const LEFT = 30;
  const USABLE_W = 782;
  const FOOTER_Y = 570;

  // ─── Titre ───
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor('#1e3a5f')
    .text(`SYNTHÈSE — ${title.toUpperCase()}`, { align: 'center' });
  doc.moveDown(0.2);

  const s = synthese.summary;
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#475569')
    .text(
      `${s.total_sheets} fiches  |  ${s.completed_tasks}/${s.total_tasks} tâches effectuées (${s.completion_rate}%)  |  Temps total : ${decToHM(s.total_time)}`,
      { align: 'center' },
    );
  doc.moveDown(0.8);

  // ─── Grouper par personne ───
  const byPerson = new Map();
  for (const sh of synthese.sheets) {
    if (!byPerson.has(sh.person_id)) {
      byPerson.set(sh.person_id, {
        first_name: sh.first_name,
        last_name: sh.last_name,
        sheets: [],
      });
    }
    byPerson.get(sh.person_id).sheets.push(sh);
  }
  const persons = Array.from(byPerson.values()).sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  );

  // ─── Colonnes tableau journalier ───
  // Date | AM | PM | Total | Fait | Non fait | Temps | Contexte
  const COL = [90, 115, 115, 55, 50, 58, 65, 234];
  const COL_HEADS = ['Date', 'AM', 'PM', 'Total', 'Fait', 'Non fait', 'Temps', 'Contexte'];

  let y = doc.y;

  const ensureSpace = (needed) => {
    if (y + needed > FOOTER_Y) {
      doc.addPage();
      y = 30;
    }
  };

  const drawDayColHeaders = () => {
    doc.rect(LEFT, y, USABLE_W, 14).fillColor('#334155').fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
    let x = LEFT;
    for (let i = 0; i < COL_HEADS.length; i++) {
      doc.text(COL_HEADS[i], x + 2, y + 3, {
        width: COL[i] - 4,
        align: i < 3 ? 'left' : 'center',
      });
      x += COL[i];
    }
    y += 14;
  };

  // ─── Sections par Personnel ───
  for (const pg of persons) {
    const totTime = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.time || 0), 0);
    const totDone = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.done || 0), 0);
    const totTasks = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.total || 0), 0);
    const hasWarning = pg.sheets.some((sh) => {
      const c = sh.day_context || {};
      const hasCtx =
        c.has_unavailability || c.has_leave || c.has_mission || c.has_enterprise_presence;
      return sh.stats?.not_done > 0 || sh.stats?.unreported_am || sh.stats?.unreported_pm || hasCtx;
    });

    ensureSpace(46 + pg.sheets.length * 14);

    // En-tête personne
    const headerBg = hasWarning ? '#7f1d1d' : '#1e3a5f';
    doc.rect(LEFT, y, USABLE_W, 18).fillColor(headerBg).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text(`${pg.first_name} ${pg.last_name}`, LEFT + 6, y + 4, { width: 260 });
    doc.font('Helvetica').fontSize(8);
    doc.text(
      `${pg.sheets.length} jour(s)  |  ${totDone}/${totTasks} tâches  |  ${decToHM(totTime)}`,
      LEFT + 280,
      y + 5,
      { width: USABLE_W - 286 },
    );
    y += 18;

    // En-têtes colonnes
    drawDayColHeaders();

    // Lignes par jour
    doc.font('Helvetica').fontSize(7).fillColor('#111111');
    let odd = false;
    const sortedSheets = [...pg.sheets].sort((a, b) => a.date.localeCompare(b.date));
    for (const sh of sortedSheets) {
      const rowBg =
        sh.stats?.not_done > 0 || sh.stats?.unreported_am || sh.stats?.unreported_pm
          ? '#fef2f2'
          : odd
            ? '#f8fafc'
            : '#ffffff';
      odd = !odd;

      const amEntries = sh.entries?.filter((e) => e.period === 'AM') || [];
      const pmEntries = sh.entries?.filter((e) => e.period === 'PM') || [];
      const amTime = amEntries.reduce((acc, e) => acc + (e.time_spent || 0), 0);
      const pmTime = pmEntries.reduce((acc, e) => acc + (e.time_spent || 0), 0);

      const ctx = sh.day_context || {};

      const amCell = sh.stats?.unreported_am
        ? '⚠ Non renseignée'
        : `${amEntries.length} tâche(s) — ${decToHM(amTime)}`;
      const pmCell = sh.stats?.unreported_pm
        ? '⚠ Non renseignée'
        : `${pmEntries.length} tâche(s) — ${decToHM(pmTime)}`;

      const alertParts = [];
      if (sh.stats?.not_done > 0) alertParts.push(`${sh.stats.not_done} non faite(s)`);
      if (sh.stats?.unreported_am) alertParts.push('AM non-renseignée');
      if (sh.stats?.unreported_pm) alertParts.push('PM non-renseignée');
      // Contexte : indisponibilités + missions
      for (const av of ctx.availabilities || []) {
        alertParts.push(av.type_label || av.type);
      }
      for (const m of ctx.missions || []) {
        alertParts.push(m.title || m.affaire || 'Mission');
      }
      const planningAffaires = Array.isArray(ctx.planning_affaires) ? ctx.planning_affaires : [];
      for (const a of planningAffaires) {
        const num = String(a.affaire_num || '').trim();
        if (!num) continue;
        const label = String(a.affaire_label || '').trim();
        const hasDistinctLabel = label && label.toLowerCase() !== num.toLowerCase();
        const base = hasDistinctLabel ? `${num} (${label})` : num;
        alertParts.push(a.is_tournee ? `Affaire ${base} [Tournée]` : `Affaire ${base}`);
      }

      const rowVals = [
        sh.date,
        amCell,
        pmCell,
        String(sh.stats?.total ?? 0),
        String(sh.stats?.done ?? 0),
        String(sh.stats?.not_done ?? 0),
        decToHM(sh.stats?.time ?? 0),
        alertParts.join(' / ') || '—',
      ];

      doc.rect(LEFT, y, USABLE_W, 14).fillColor(rowBg).fill();
      const textColor = sh.stats?.unreported_am || sh.stats?.unreported_pm ? '#991b1b' : '#111111';
      doc.fillColor(textColor);
      let x = LEFT;
      for (let i = 0; i < rowVals.length; i++) {
        doc.text(rowVals[i], x + 2, y + 3, {
          width: COL[i] - 4,
          align: i < 3 ? 'left' : 'center',
        });
        x += COL[i];
      }
      y += 14;
    }

    // Ligne résumé (total personne)
    doc.rect(LEFT, y, USABLE_W, 14).fillColor('#e2e8f0').fill();
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a5f');
    doc.text('TOTAL', LEFT + 2, y + 3, { width: COL[0] - 4 });
    let rx = LEFT + COL[0] + COL[1] + COL[2];
    doc.text(String(totTasks), rx + 2, y + 3, { width: COL[3] - 4, align: 'center' });
    rx += COL[3];
    doc.text(String(totDone), rx + 2, y + 3, { width: COL[4] - 4, align: 'center' });
    rx += COL[4];
    doc.text(String(totTasks - totDone), rx + 2, y + 3, { width: COL[5] - 4, align: 'center' });
    rx += COL[5];
    doc.text(decToHM(totTime), rx + 2, y + 3, { width: COL[6] - 4, align: 'center' });
    y += 14;

    y += 12; // espace entre personnes
  }

  // ─── Anomalies ───
  if (s.anomalies.length > 0) {
    ensureSpace(34 + s.anomalies.length * 12);
    y += 6;
    doc.rect(LEFT, y, USABLE_W, 16).fillColor('#dc2626').fill();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('/!\\ ANOMALIES', LEFT + 6, y + 3);
    y += 16;
    doc.font('Helvetica').fontSize(8).fillColor('#7f1d1d');
    for (const a of s.anomalies) {
      const parts = [];
      if (a.not_done > 0) parts.push(`${a.not_done} tâche(s) non effectuée(s)`);
      if (a.unreported_periods?.length > 0)
        parts.push(`Activité non renseignée : ${a.unreported_periods.join(', ')}`);
      doc.text(`• ${a.person} (${a.date}) : ${parts.join(' — ')}`, LEFT + 10, y);
      y += 12;
    }
  }

  // ─── Synthèse incidents (même période) ───
  // Démarre toujours sur une nouvelle page pour une lecture claire.
  doc.addPage();
  y = 30;

  const incidentSummary = synthese.incidents?.summary || null;
  const incidentByAffaire = Array.isArray(synthese.incidents?.by_affaire)
    ? synthese.incidents.by_affaire
    : [];
  const incidentDetailedTickets = Array.isArray(synthese.incidents?.detailed_tickets)
    ? synthese.incidents.detailed_tickets
    : [];
  const incidentPeriod = synthese.incidents?.period || null;
  const INCIDENT_TYPE_LABELS = {
    vehicle_problem: 'Problème sur véhicule',
    equipment_problem: 'Problème sur équipement',
    equipment_omission: 'Oubli équipement',
    equipment_error: 'Erreur équipement',
    other: 'Autre incident',
  };
  const formatIncidentType = (type) => {
    const raw = String(type || 'incident').trim();
    if (!raw) return 'Incident';
    if (INCIDENT_TYPE_LABELS[raw]) return INCIDENT_TYPE_LABELS[raw];
    const normalized = raw.replace(/_/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };
  const writeWrappedText = (text, x, width, font = 'Helvetica', size = 7, color = '#0f172a') => {
    doc.font(font).fontSize(size).fillColor(color);
    const h = doc.heightOfString(text, { width });
    doc.text(text, x, y, { width });
    y += h + 2;
  };

  ensureSpace(44);
  y += 10;
  doc.rect(LEFT, y, USABLE_W, 16).fillColor('#0f766e').fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('INCIDENTS (période de la synthèse)', LEFT + 6, y + 3);
  y += 18;

  const periodText = incidentPeriod
    ? `${incidentPeriod.start} -> ${incidentPeriod.end}`
    : 'Periode inconnue';
  doc.font('Helvetica').fontSize(8).fillColor('#134e4a');
  doc.text(
    `${periodText}  |  Tickets : ${incidentSummary?.total_tickets || 0}  |  Incidents : ${incidentSummary?.total_incidents || 0}  |  Affaires : ${incidentSummary?.affaires_count || 0}`,
    LEFT,
    y,
    { width: USABLE_W },
  );
  y += 14;

  const drawIncidentsSummaryHeader = (continuation = false) => {
    ensureSpace(24);
    doc.rect(LEFT, y, USABLE_W, 14).fillColor('#0f766e').fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(
      continuation
        ? 'INCIDENTS (periode de la synthese) - SUITE'
        : 'INCIDENTS (periode de la synthese) - PAR AFFAIRE',
      LEFT + 6,
      y + 3,
    );
    y += 16;
  };

  drawIncidentsSummaryHeader(false);

  if (incidentByAffaire.length === 0) {
    ensureSpace(16);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b');
    doc.text('Aucun ticket incident sur cette période.', LEFT + 6, y);
    y += 12;
  } else {
    doc.font('Helvetica').fontSize(8).fillColor('#1f2937');
    for (const it of incidentByAffaire) {
      if (y + 12 > FOOTER_Y) {
        doc.addPage();
        y = 30;
        drawIncidentsSummaryHeader(true);
      }
      const affaireLabel =
        it.affaire_name && it.affaire_name !== it.affaire_num
          ? `${it.affaire_num} (${it.affaire_name})`
          : it.affaire_num;
      doc.text(
        `- ${affaireLabel} : ${it.tickets} ticket(s), ${it.incidents} incident(s)`,
        LEFT + 6,
        y,
      );
      y += 12;
    }
  }

  // ─── Détail du contenu des incidents ───
  if (incidentDetailedTickets.length > 0) {
    const drawIncidentDetailsHeader = (continuation = false) => {
      ensureSpace(22);
      if (continuation) y += 2;
      doc.rect(LEFT, y, USABLE_W, 14).fillColor('#0f172a').fill();
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text(
        continuation
          ? 'DETAIL DU CONTENU DES INCIDENTS (SUITE)'
          : 'DETAIL DU CONTENU DES INCIDENTS',
        LEFT + 6,
        y + 3,
      );
      y += 16;
    };

    ensureSpace(22);
    y += 2;
    drawIncidentDetailsHeader(false);

    for (const ticket of incidentDetailedTickets) {
      const affaireLabel =
        ticket.affaire_name && ticket.affaire_name !== ticket.affaire_num
          ? `${ticket.affaire_num} (${ticket.affaire_name})`
          : ticket.affaire_num;
      const ticketHeader = `Ticket ${ticket.week_key} - ${affaireLabel}`;

      if (y + 22 > FOOTER_Y) {
        doc.addPage();
        y = 30;
        drawIncidentDetailsHeader(true);
      }
      writeWrappedText(ticketHeader, LEFT + 6, USABLE_W - 12, 'Helvetica-Bold', 8, '#0f172a');

      if (ticket.notes) {
        writeWrappedText(
          `Note ticket: ${ticket.notes}`,
          LEFT + 12,
          USABLE_W - 18,
          'Helvetica-Oblique',
          7,
          '#334155',
        );
      }

      if (!ticket.incidents || ticket.incidents.length === 0) {
        writeWrappedText('- Aucun incident detaille sur ce ticket', LEFT + 12, USABLE_W - 18);
      } else {
        for (const incident of ticket.incidents) {
          const meta = [];
          if (incident.reporter_name) meta.push(`déclarant: ${incident.reporter_name}`);
          if (incident.vehicle_name_snapshot)
            meta.push(`vehicule: ${incident.vehicle_name_snapshot}`);

          const content = String(incident.description || '').trim() || 'Sans description';
          const line = `- [${formatIncidentType(incident.incident_type)}] ${content}${meta.length ? ` (${meta.join(', ')})` : ''}`;

          ensureSpace(16);
          writeWrappedText(line, LEFT + 12, USABLE_W - 18, 'Helvetica', 7, '#1f2937');
        }
      }

      y += 3;
    }
  }

  // ─── Pied de page ───
  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, LEFT, FOOTER_Y, {
    align: 'center',
    width: USABLE_W,
  });

  doc.end();
}

// ═══════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════
