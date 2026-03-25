// Script ponctuel : recherche avancée des doublons dans equipment (DEV)
const db = require('better-sqlite3')(__dirname + '/../apps/api/vehicules-dev.db');

const total = db.prepare('SELECT COUNT(*) as c FROM equipment').get();
console.log('Total équipements:', total.c);

// Doublons exacts : même nom, ref, serial_number, category_id, brand
const exactDupes = db.prepare(`
  SELECT LOWER(TRIM(name)) as n, COALESCE(reference,'') as ref, 
         COALESCE(serial_number,'') as sn, COALESCE(category_id, 0) as cat,
         COALESCE(brand,'') as br, COUNT(*) as cnt
  FROM equipment 
  GROUP BY n, LOWER(TRIM(ref)), LOWER(TRIM(sn)), cat, LOWER(TRIM(br))
  HAVING cnt > 1
  ORDER BY cnt DESC LIMIT 20
`).all();
console.log('Doublons exacts:', exactDupes.length);
if (exactDupes.length > 0) {
  console.log(JSON.stringify(exactDupes.slice(0,10), null, 2));
  
  // Est-ce que ça concerne des items avec stock_quantity > 1 ?
  const d = exactDupes[0];
  const details = db.prepare(`
    SELECT id, name, reference, uid, serial_number, stock_quantity, status, category_id, brand
    FROM equipment 
    WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(COALESCE(reference,''))) = ?
      AND LOWER(TRIM(COALESCE(serial_number,''))) = ? 
      AND COALESCE(category_id,0) = ? AND LOWER(TRIM(COALESCE(brand,''))) = ?
    ORDER BY id LIMIT 5
  `).all(d.n, d.ref.toLowerCase().trim(), d.sn.toLowerCase().trim(), d.cat, d.br.toLowerCase().trim());
  console.log('Premier groupe:', JSON.stringify(details, null, 2));
}

// IDs à supprimer (garder le premier de chaque groupe)
const idsToRemove = [];
for (const d of exactDupes) {
  const rows = db.prepare(`
    SELECT id FROM equipment 
    WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(COALESCE(reference,''))) = ?
      AND LOWER(TRIM(COALESCE(serial_number,''))) = ? 
      AND COALESCE(category_id,0) = ? AND LOWER(TRIM(COALESCE(brand,''))) = ?
    ORDER BY id
  `).all(d.n, d.ref.toLowerCase().trim(), d.sn.toLowerCase().trim(), d.cat, d.br.toLowerCase().trim());
  for (let i = 1; i < rows.length; i++) idsToRemove.push(rows[i].id);
}

console.log('IDs à supprimer:', idsToRemove.length);

if (idsToRemove.length > 0) {
  // Vérifier tickets SAV liés
  const ph = idsToRemove.map(()=>'?').join(',');
  const ticketLinked = db.prepare(`SELECT COUNT(*) as c FROM sav_tickets WHERE equipment_id IN (${ph})`).get(...idsToRemove);
  console.log('Tickets SAV liés aux doublons:', ticketLinked.c);
  
  if (ticketLinked.c > 0) {
    // Réassigner les tickets au premier ID de chaque groupe avant suppression
    for (const d of exactDupes) {
      const rows = db.prepare(`
        SELECT id FROM equipment 
        WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(COALESCE(reference,''))) = ?
          AND LOWER(TRIM(COALESCE(serial_number,''))) = ?
          AND COALESCE(category_id,0) = ? AND LOWER(TRIM(COALESCE(brand,''))) = ?
        ORDER BY id
      `).all(d.n, d.ref.toLowerCase().trim(), d.sn.toLowerCase().trim(), d.cat, d.br.toLowerCase().trim());
      const keepId = rows[0].id;
      for (let i = 1; i < rows.length; i++) {
        db.prepare('UPDATE sav_tickets SET equipment_id = ? WHERE equipment_id = ?').run(keepId, rows[i].id);
      }
    }
    console.log('Tickets SAV réassignés vers les IDs conservés');
  }
  
  db.prepare(`DELETE FROM equipment WHERE id IN (${ph})`).run(...idsToRemove);
  console.log(`✅ ${idsToRemove.length} doublon(s) supprimé(s)`);
  const remaining = db.prepare('SELECT COUNT(*) as c FROM equipment').get();
  console.log('Équipements restants:', remaining.c);
} else {
  console.log('✅ Aucun doublon exact trouvé');
}

db.close();
