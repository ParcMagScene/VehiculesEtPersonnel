const Database = require('./node_modules/better-sqlite3');
const db = new Database('./vehicules.db');
const cols = db.prepare('PRAGMA table_info(vehicles)').all().map(c => c.name);
const missing = [
  ['category', 'TEXT'],
  ['vin', 'TEXT'],
  ['status', "TEXT DEFAULT 'available'"],
  ['notes', 'TEXT'],
  ['year', 'INTEGER'],
  ['last_maintenance_date', 'TEXT'],
  ['last_maintenance_km', 'INTEGER'],
  ['mileage_history', 'TEXT'],
  ['assigned_to', 'INTEGER'],
  ['pupitre', 'TEXT'],
  ['is_insured', 'BOOLEAN DEFAULT 0'],
  ['insurance_company', 'TEXT'],
  ['insurance_number', 'TEXT'],
  ['insurance_expiry', 'TEXT'],
  ['latitude', 'REAL'],
  ['longitude', 'REAL'],
  ['location_updated_at', 'DATETIME'],
];
let added = 0;
for (const [name, def] of missing) {
  if (cols.indexOf(name) === -1) {
    db.exec('ALTER TABLE vehicles ADD COLUMN ' + name + ' ' + def);
    added++;
    console.log('  Added:', name);
  }
}
console.log('Total added:', added);
db.close();
