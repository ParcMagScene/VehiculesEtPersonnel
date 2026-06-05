import QRCode from 'qrcode';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { formatDateSimple, safeDate } from '../../utils/formatUtils';

import { APP_BASE_URL } from './equipmentConstants';
import { analyzeQrBaseUrl } from './qrSafety';

const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

// Échappement HTML anti-XSS
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const SAV_STATUS = {
  open: { label: 'Ouvert', color: STATUS_COLORS.info },
  in_progress: { label: 'En cours', color: STATUS_COLORS.warning },
  waiting_parts: { label: 'Attente pièces', color: ACCENT_COLORS.violet },
  resolved: { label: 'Résolu', color: STATUS_COLORS.success },
  closed: { label: 'Clôturé', color: 'var(--theme-text-gray)' },
};

const SAV_TYPES = {
  panne: 'Panne',
  entretien: 'Entretien',
  reparation: 'Réparation',
  calibrage: 'Calibrage',
};

const SAV_PRIORITY = {
  low: { label: 'Basse', color: 'var(--theme-text-gray)' },
  medium: { label: 'Moyenne', color: STATUS_COLORS.warning },
  high: { label: 'Haute', color: STATUS_COLORS.danger },
  urgent: { label: 'Urgente', color: STATUS_COLORS.dangerDark },
};

const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: STATUS_COLORS.success, icon: '✅' },
  in_use: { label: 'En service', color: STATUS_COLORS.info, icon: '🔄' },
  maintenance: { label: 'En maintenance', color: STATUS_COLORS.warning, icon: '🔧' },
  retired: { label: 'Réformé', color: 'var(--theme-text-gray)', icon: '⛔' },
};

export async function printEquipmentSheet(eq, photosList = [], logosList = []) {
  if (!eq) return;

  // Verrou sécurité : ne PAS imprimer si l'URL QR n'est pas publique HTTPS
  const qrSafety = analyzeQrBaseUrl(APP_BASE_URL);
  if (!qrSafety.safe) {
    // eslint-disable-next-line no-alert
    window.alert(
      `⛔ Impression bloquée — URL non publique : ${APP_BASE_URL}\n\n${qrSafety.reason}\n\nOuvrez l'application via https://magsav.duckdns.org avant d'imprimer la fiche.`,
    );
    return;
  }

  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
  const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;

  // Find matching photo
  const normalizeStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let photoPath = null;
  const ref = normalizeStr(eq.reference);
  const name = normalizeStr(eq.name);
  for (const p of photosList) {
    const norm = normalizeStr(p.replace(/\.[^.]+$/, ''));
    if (ref && ref.length > 2 && (norm === ref || norm.includes(ref) || ref.includes(norm))) {
      photoPath = `/Photos/Matériel/${p}`;
      break;
    }
    if (name && name.length > 2 && (norm.includes(name) || name.includes(norm))) {
      photoPath = `/Photos/Matériel/${p}`;
      break;
    }
  }

  // Find matching logo
  let logoPath = null;
  const brand = normalizeStr(eq.brand);
  for (const l of logosList) {
    const norm = normalizeStr(l.replace(/\.[^.]+$/, ''));
    if (brand && brand.length > 1 && (norm.includes(brand) || brand.includes(norm))) {
      logoPath = `/Logos/${l}`;
      break;
    }
  }

  const assignments = eq.assignments || [];
  const tickets = eq.savTickets || [];

  const today = formatDateSimple(new Date().toISOString());

  const qrDataUrl = qrUrl ? await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 }) : null;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche - ${esc(cleanName(eq.name))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 20px; max-width: 210mm; margin: 0 auto; }
    
    @media print {
      body { padding: 10mm; }
      .no-print { display: none !important; }
      @page { size: A4 portrait; margin: 10mm; }
    }

    .sheet-header { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; border-bottom: 3px solid #6366f1; margin-bottom: 20px; }
    .sheet-header-info { flex: 1; }
    .sheet-header h1 { font-size: 22px; color: #1e293b; margin-bottom: 4px; }
    .sheet-header .sheet-category { font-size: 13px; color: #64748b; }
    .sheet-status { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: 700; }
    .sheet-qr { text-align: center; }
    .sheet-qr img { display: block; }
    .sheet-qr span { display: block; font-size: 9px; color: #94a3b8; margin-top: 2px; font-family: monospace; }

    .sheet-media { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start; }
    .sheet-photo { width: 180px; height: 140px; border-radius: 8px; object-fit: contain; border: 1px solid #e2e8f0; background: #f8fafc; }
    .sheet-logo { height: 40px; object-fit: contain; }

    .sheet-section { margin-bottom: 16px; }
    .sheet-section h2 { font-size: 14px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }

    .sheet-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
    .sheet-field { display: flex; gap: 8px; font-size: 13px; }
    .sheet-field .label { color: #64748b; min-width: 120px; }
    .sheet-field .value { font-weight: 600; color: #1e293b; }

    .sheet-notes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #64748b; font-weight: 600; text-align: left; padding: 6px 10px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) { background: #fafafa; }

    .sheet-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .sheet-badge.active { background: #dcfce7; color: #16a34a; }
    .sheet-badge.returned { background: #f1f5f9; color: #64748b; }
    .sheet-badge.open { background: #dbeafe; color: #2563eb; }
    .sheet-badge.in_progress { background: #fef3c7; color: #d97706; }
    .sheet-badge.resolved { background: #dcfce7; color: #16a34a; }
    .sheet-badge.closed { background: #f1f5f9; color: #64748b; }

    .sheet-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    .sheet-empty { color: #94a3b8; font-style: italic; font-size: 12px; padding: 8px 0; }
  </style>
</head>
<body>
  <div class="sheet-header">
    ${photoPath ? `<img src="${esc(photoPath)}" class="sheet-photo" alt="Photo équipement" />` : ''}
    <div class="sheet-header-info">
      <h1>${esc(eq.categoryIcon || eq.category_icon || '📦')} ${esc(cleanName(eq.name))}</h1>
      <div class="sheet-category">${esc(eq.categoryName || eq.category_name || 'Non catégorisé')}</div>
      <div style="margin-top: 6px;">
        <span class="sheet-status" style="background: ${st.color}">${st.icon} ${st.label}</span>
      </div>
      ${logoPath ? `<img src="${esc(logoPath)}" class="sheet-logo" style="margin-top: 8px;" alt="Logo marque" />` : ''}
    </div>
    ${
      qrUrl
        ? `
    <div class="sheet-qr">
      <img src="${qrDataUrl}" width="120" height="120" alt="QR Code" />
      <span>${esc(eq.uid || '')}</span>
    </div>`
        : ''
    }
  </div>

  <div class="sheet-section">
    <h2>📋 Informations générales</h2>
    <div class="sheet-fields">
      ${eq.reference ? `<div class="sheet-field"><span class="label">Référence</span><span class="value">${esc(eq.reference)}</span></div>` : ''}
      ${eq.uid ? `<div class="sheet-field"><span class="label">UID</span><span class="value" style="font-family: monospace">${esc(eq.uid)}</span></div>` : ''}
      ${eq.serialNumber || eq.serial_number ? `<div class="sheet-field"><span class="label">N° de série</span><span class="value">${esc(eq.serialNumber || eq.serial_number)}</span></div>` : ''}
      ${eq.numeroMag || eq.numero_mag ? `<div class="sheet-field"><span class="label">N° MAG</span><span class="value">${esc(eq.numeroMag || eq.numero_mag)}</span></div>` : ''}
      ${eq.brand ? `<div class="sheet-field"><span class="label">Marque</span><span class="value">${esc(eq.brand)}</span></div>` : ''}
      ${eq.location ? `<div class="sheet-field"><span class="label">Localisation</span><span class="value">${esc(eq.location)}</span></div>` : ''}
      ${(eq.stockQuantity || eq.stock_quantity) > 1 ? `<div class="sheet-field"><span class="label">Quantité</span><span class="value">${eq.stockQuantity || eq.stock_quantity}</span></div>` : ''}
      ${eq.purchaseDate || eq.purchase_date ? `<div class="sheet-field"><span class="label">Date d'achat</span><span class="value">${safeDate(eq.purchaseDate || eq.purchase_date)}</span></div>` : ''}
      ${eq.purchasePrice || eq.purchase_price ? `<div class="sheet-field"><span class="label">Prix d'achat</span><span class="value">${parseFloat(eq.purchasePrice || eq.purchase_price).toFixed(2)} €</span></div>` : ''}
      ${eq.warrantyEnd || eq.warranty_end ? `<div class="sheet-field"><span class="label">Fin de garantie</span><span class="value">${safeDate(eq.warrantyEnd || eq.warranty_end)}</span></div>` : ''}
    </div>
    ${eq.notes ? `<div class="sheet-notes">${esc(eq.notes)}</div>` : ''}
  </div>

  <div class="sheet-section">
    <h2>👤 Historique des attributions (${assignments.length})</h2>
    ${
      assignments.length === 0
        ? '<p class="sheet-empty">Aucune attribution enregistrée</p>'
        : `
    <Table>
      <thead>
        <tr>
          <th>Personne</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Statut</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${assignments
          .map(
            (a) => `
        <tr>
          <td>${esc(a.firstName || a.first_name || '')} ${esc(a.lastName || a.last_name || '')}</td>
          <td>${safeDate(a.startDate || a.start_date)}</td>
          <td>${a.endDate || a.end_date ? safeDate(a.endDate || a.end_date) : 'En cours'}</td>
          <td><span class="sheet-badge ${a.status}">${a.status === STATUS.ACTIVE ? 'Actif' : 'Retourné'}</span></td>
          <td>${esc(a.notes || '—')}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </Table>`
    }
  </div>

  <div class="sheet-section">
    <h2>🔧 Historique des interventions SAV (${tickets.length})</h2>
    ${
      tickets.length === 0
        ? '<p class="sheet-empty">Aucune intervention enregistrée</p>'
        : `
    <Table>
      <thead>
        <tr>
          <th>Titre</th>
          <th>Type</th>
          <th>Priorité</th>
          <th>Statut</th>
          <th>Créé le</th>
          <th>Résolu le</th>
          <th>Coût</th>
        </tr>
      </thead>
      <tbody>
        ${tickets
          .map((t) => {
            const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
            const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
            return `
        <tr>
          <td><strong>${esc(t.title)}</strong>${t.description ? `<br><small style="color:#64748b">${esc(t.description.substring(0, 80))}${t.description.length > 80 ? '...' : ''}</small>` : ''}</td>
          <td>${SAV_TYPES[t.type] || t.type}</td>
          <td style="color: ${pri.color}; font-weight: 600">${pri.label}</td>
          <td><span class="sheet-badge ${t.status}">${tst.label}</span></td>
          <td>${safeDate(t.createdAt || t.created_at)}</td>
          <td>${safeDate(t.resolvedAt || t.resolved_at)}</td>
          <td>${t.cost != null && t.cost > 0 ? parseFloat(t.cost).toFixed(2) + ' €' : '—'}</td>
        </tr>`;
          })
          .join('')}
      </tbody>
    </Table>`
    }
  </div>

  <div class="sheet-footer">
    <span>Fiche matériel — ${esc(cleanName(eq.name))}</span>
    <span>Imprimée le ${today}</span>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export default printEquipmentSheet;
