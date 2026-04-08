/**
 * Seed welcome messages from calendar-dashboard config into eM@g database
 */
const { join } = require('path');
const Database = require(join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'));
const db = new Database(join(__dirname, '..', 'server', 'vehicules.db'));

const messages = {
  lundi: {
    matin: 'Bonjour !',
    matinee: 'Joyeux Lundi !',
    midi: 'Bon appétit !',
    apres_midi: 'Courage !',
    soir: 'Bonne soirée !',
  },
  mardi: {
    matin: 'Good morning !',
    matinee: "Le mardi c'est permis !",
    midi: 'Enjoy your meal !',
    apres_midi: 'Force et robustesse !',
    soir: 'Good evening !',
  },
  mercredi: {
    matin: '¡Buenos dias !',
    matinee: 'On est Credi !',
    midi: '¡buen provecho!',
    apres_midi: 'Courage et dévouement !',
    soir: '¡Buenas tardes !',
  },
  jeudi: {
    matin: 'Gutten Tag !',
    matinee: 'Le retour du Jeudi',
    midi: 'Guten Appetit !',
    apres_midi: 'Allez les verts!',
    soir: 'Schönen Abend !',
  },
  vendredi: {
    matin: 'Buongiorno !',
    matinee: 'On tient le rythme !',
    midi: 'Buon appetito !',
    apres_midi: 'Pensez à ranger!',
    soir: 'Ayé! Bon weekend !',
  },
};

const upsert = db.prepare(
  `INSERT INTO display_welcome_messages (day, slot, message) VALUES (?, ?, ?)
   ON CONFLICT(day, slot) DO UPDATE SET message = excluded.message`
);

const t = db.transaction(() => {
  for (const [day, slots] of Object.entries(messages)) {
    for (const [slot, msg] of Object.entries(slots)) {
      upsert.run(day, slot, msg);
    }
  }
});
t();

const rows = db.prepare('SELECT day, slot, message FROM display_welcome_messages ORDER BY day, slot').all();
console.log(`✅ ${rows.length} messages insérés :`);
rows.forEach(r => console.log(`  ${r.day} / ${r.slot} → ${r.message}`));
db.close();
