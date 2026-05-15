// Script Node.js pour corriger le hash du mot de passe et du code PIN admin
// Usage : node fix-admin-password.js

import Database from 'better-sqlite3';

const db = new Database('/Users/reunion/eM@g/apps/api/vehicules-dev.db');

const email = 'admin@magsav.com';
const passwordHash = '$2b$10$HIYF4psZcNP8GmeF3rLHzO4EOGehD4KsKxsjpPDl2T/yjEMhQ9f3G';
const pinHash = '$2b$10$OkHIrQmNiAoOcSe4tygZJedEk8RObf3f1U.aIjiG5EfyCdNlBy/iC';

const stmt = db.prepare('UPDATE users SET password_hash = ?, pin_hash = ? WHERE email = ?');
const info = stmt.run(passwordHash, pinHash, email);

console.log('Mise à jour effectuée:', info);
db.close();
