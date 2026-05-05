import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findDbPath() {
    const defaultPath = join(__dirname, 'apps/api/vehicules.db');
    try {
        const content = fs.readFileSync(join(__dirname, 'apps/api/database.js'), 'utf8');
        const match = content.match(/DB_FILENAME\s*=\s*(?:process\.env\.DB_PATH\s*\|\|\s*)?'([^']+)'/);
        if (match) {
            const path = join(__dirname, 'apps/api', match[1]);
            return fs.existsSync(path) ? path : defaultPath;
        }
    } catch (e) {}
    return defaultPath;
}

const dbPath = findDbPath();
console.log('Using database:', dbPath);

const db = new Database(dbPath);

const query = 'SELECT ' + 
    'r.id, ' +
    'r.affaire, ' +
    'r.vehicle_id, ' +
    'r.start_date, ' +
    'r.end_date, ' +
    'v.name as vehicle_name, ' +
    'v.registration as vehicle_registration ' +
    'FROM reservations r ' +
    'LEFT JOIN vehicles v ON r.vehicle_id = v.id ' +
    'WHERE r.affaire LIKE \'%33406%\' OR r.affaire LIKE \'%30864%\'';

const results = db.prepare(query).all();

if (results.length === 0) {
    console.log('No reservations found for affaires 33406 or 30864.');
} else {
    results.forEach(row => {
        console.log('-----------------------------------');
        console.log('ID: ' + row.id);
        console.log('Affaire: ' + row.affaire);
        console.log('Vehicle ID: ' + row.vehicle_id);
        console.log('Date: ' + row.start_date + ' -> ' + row.end_date);
        console.log('Vehicle: ' + row.vehicle_name + ' (' + (row.vehicle_registration || 'N/A') + ')');
    });
}
