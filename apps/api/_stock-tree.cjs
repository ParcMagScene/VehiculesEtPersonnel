const D = require('better-sqlite3');
const db = new D('vehicules-dev.db', { readonly: true });
const all = db.prepare('SELECT id, name, parent_id FROM stock_categories ORDER BY parent_id, id').all();
const roots = all.filter(r => r.parent_id === null);
for (const r of roots) {
  console.log('[' + r.id + '] ' + r.name);
  const ch = all.filter(c => c.parent_id === r.id);
  for (const c of ch) console.log('  [' + c.id + '] ' + c.name);
}
db.close();
