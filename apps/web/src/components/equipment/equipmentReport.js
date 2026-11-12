const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

const getEquipmentGroupKey = (item) =>
  JSON.stringify([item.reference || '', item.brand || '', item.name || '']);

export function groupEquipmentForReport(equipment) {
  const groups = new Map();
  for (const item of equipment) {
    const key = getEquipmentGroupKey(item);
    const group = groups.get(key) || {
      reference: item.reference || '',
      brand: item.brand || '',
      name: item.name || '',
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.reference.localeCompare(b.reference, 'fr', { sensitivity: 'base' }) ||
      a.brand.localeCompare(b.brand, 'fr', { sensitivity: 'base' }) ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

const displayDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? escapeHtml(date) : parsed.toLocaleDateString('fr-FR');
};

const listHtml = (records, render) =>
  records.length
    ? `<ul>${records.map((record) => `<li>${render(record)}</li>`).join('')}</ul>`
    : '<span class="empty">—</span>';

export function buildEquipmentReportHtml(equipment) {
  const groups = groupEquipmentForReport(equipment);
  const sections = groups
    .map((group) => {
      const quantity = group.items.reduce(
        (sum, item) => sum + Math.max(1, Number(item.stockQuantity ?? item.stock_quantity) || 1),
        0,
      );
      const rows = group.items
        .map((item) => {
          const usage = item.usageHistory || item.usage_history || [];
          const tickets = item.interventions || [];
          const usageHtml = listHtml(
            usage,
            (record) =>
              `${escapeHtml(displayDate(record.usageDate || record.usage_date))} : ${escapeHtml(record.hours)} h`,
          );
          const interventionsHtml = listHtml(
            tickets,
            (ticket) =>
              `<strong>${escapeHtml(displayDate(ticket.createdAt || ticket.created_at))}</strong> — ${escapeHtml(ticket.title)} (${escapeHtml(ticket.status)})${ticket.resolution ? `<br><span class="resolution">${escapeHtml(ticket.resolution)}</span>` : ''}`,
          );

          return `<tr>
            <td>${escapeHtml(item.uid)}</td>
            <td>${escapeHtml(item.serialNumber || item.serial_number)}</td>
            <td>${escapeHtml(item.numeroMag || item.numero_mag)}</td>
            <td>${usageHtml}</td>
            <td>${interventionsHtml}</td>
          </tr>`;
        })
        .join('');

      return `<section class="equipment-group">
        <h2>${escapeHtml(group.reference || 'Sans référence')} <span>— ${escapeHtml(group.brand || 'Marque non renseignée')} — ${escapeHtml(group.name)} — Quantité : ${quantity}</span></h2>
        <table>
          <thead><tr><th>UID</th><th>Numéro de série</th><th>Numéro MAG</th><th>Temps d'utilisation</th><th>Interventions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rapport équipements</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { color: #1f2937; font: 11px Arial, sans-serif; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    .report-meta { color: #4b5563; margin-bottom: 18px; }
    .equipment-group { break-inside: avoid; margin: 0 0 18px; }
    h2 { background: #f3f4f6; border-left: 4px solid #4f46e5; font-size: 13px; margin: 0; padding: 8px; }
    h2 span { font-weight: normal; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #e5e7eb; }
    th:nth-child(1) { width: 12%; }
    th:nth-child(2) { width: 15%; }
    th:nth-child(3) { width: 12%; }
    th:nth-child(4) { width: 19%; }
    th:nth-child(5) { width: 42%; }
    ul { margin: 0; padding-left: 16px; }
    li + li { margin-top: 4px; }
    .empty, .resolution { color: #4b5563; }
    .resolution { display: inline-block; margin-top: 2px; }
    @media screen {
      body { padding: 18px; }
      .equipment-group { break-inside: auto; }
    }
  </style>
</head>
<body>
  <h1>Rapport des équipements sélectionnés</h1>
  <div class="report-meta">${equipment.length} équipement(s) · Généré le ${escapeHtml(new Date().toLocaleDateString('fr-FR'))}</div>
  ${sections}
</body>
</html>`;
}
