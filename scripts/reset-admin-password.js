// Script Node.js pour réinitialiser le mot de passe admin@magsav.com
// Usage : node reset-admin-password.js <nouveau_mot_de_passe>

import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const email = 'admin@magsav.com';
const newPassword = process.argv[2] || 'admin2026';

(async () => {
  const db = await open({
    filename: './apps/api/database.db',
    driver: sqlite3.Database
  });
  const hash = await bcrypt.hash(newPassword, 10);
  const res = await db.run('UPDATE users SET password_hash = ? WHERE email = ?', hash, email);
  if (res.changes > 0) {
    console.log(`Mot de passe admin réinitialisé à : ${newPassword}`);
  } else {
    console.error('Aucun utilisateur admin trouvé.');
  }
  await db.close();
})();
