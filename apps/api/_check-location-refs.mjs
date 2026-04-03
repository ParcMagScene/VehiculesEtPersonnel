import Database from 'better-sqlite3';
const db = new Database('./vehicules-dev.db');

// Check if locations are referenced in other tables
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
const refs = tables.filter(t => t.sql && t.sql.includes('location'));
console.log('Tables referencing location:');
refs.forEach(t => console.log('-', t.name));

// Check vehicles
try {
  const vWithLoc = db.prepare('SELECT id, immatriculation, location_id FROM vehicles WHERE location_id IS NOT NULL LIMIT 10').all();
  console.log('\nVehicles with location_id:', JSON.stringify(vWithLoc));
} catch(e) { console.log('No location_id in vehicles'); }

// Check affaires  
try {
  const aWithLoc = db.prepare("SELECT id, nom, location_id FROM affaires WHERE location_id IS NOT NULL LIMIT 10").all();
  console.log('\nAffaires with location_id:', JSON.stringify(aWithLoc));
} catch(e) { console.log('No location_id in affaires:', e.message); }

// Check planning
try {
  const pWithLoc = db.prepare("SELECT id, location_id FROM planning WHERE location_id IS NOT NULL LIMIT 10").all();
  console.log('\nPlanning with location_id:', JSON.stringify(pWithLoc));
} catch(e) { console.log('No location_id in planning:', e.message); }

// Duplicate IDs to check: 35, 37, 47, 14, 39, 40, 33, 21, 31
const dupIds = [14, 21, 31, 33, 35, 37, 39, 40, 47];
console.log('\n--- Checking references to duplicate IDs:', dupIds);

for (const table of tables) {
  if (table.name === 'locations' || table.name === 'sqlite_sequence') continue;
  try {
    const cols = db.prepare(`PRAGMA table_info(${table.name})`).all();
    const locCol = cols.find(c => c.name === 'location_id');
    if (locCol) {
      const rows = db.prepare(`SELECT * FROM ${table.name} WHERE location_id IN (${dupIds.join(',')})`).all();
      if (rows.length > 0) {
        console.log(`\n⚠️ ${table.name} has ${rows.length} rows referencing duplicate location IDs:`, rows.map(r => r.location_id));
      }
    }
  } catch(e) {}
}

console.log('\nDone.');
db.close();
