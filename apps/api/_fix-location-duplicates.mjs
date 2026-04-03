import Database from 'better-sqlite3';
const db = new Database('./vehicules-dev.db');

// Fix AB Autobilan: id 34 has place_id but wrong type, id 35 has correct type but no place_id
// → Keep 34, fix its type to Garage, delete 35
db.prepare("UPDATE locations SET type = 'Garage' WHERE id = 34").run();
db.prepare("DELETE FROM locations WHERE id = 35").run();
console.log('✅ AB Autobilan: gardé id=34 (type corrigé → Garage), supprimé id=35');

// Auto Poids Lourd 42: id 36 has place_id, id 37 doesn't
db.prepare("DELETE FROM locations WHERE id = 37").run();
console.log('✅ Auto Poids Lourd 42: gardé id=36, supprimé id=37');

// Hippodrome st galmier: id 46 et 47 identiques
db.prepare("DELETE FROM locations WHERE id = 47").run();
console.log('✅ Hippodrome st galmier: gardé id=46, supprimé id=47');

// LA FORGE / La Forge: id 14 (MAJUSCULES) et 15 (casse correcte), même place_id
db.prepare("DELETE FROM locations WHERE id = 14").run();
console.log('✅ La Forge: gardé id=15, supprimé id=14');

// Le Scarabée: triple id 38, 39, 40 — tous identiques
db.prepare("DELETE FROM locations WHERE id IN (39, 40)").run();
console.log('✅ Le Scarabée: gardé id=38, supprimé id=39 et 40');

// SL Trucks: id 32 has place_id, id 33 doesn't
db.prepare("DELETE FROM locations WHERE id = 33").run();
console.log('✅ SL Trucks: gardé id=32, supprimé id=33');

// Salle Muriel Robin: id 17 et 21 identiques
db.prepare("DELETE FROM locations WHERE id = 21").run();
console.log('✅ Salle Muriel Robin: gardé id=17, supprimé id=21');

// les foréziales: id 30 has place_id, id 31 doesn't
db.prepare("DELETE FROM locations WHERE id = 31").run();
console.log('✅ les foréziales: gardé id=30, supprimé id=31');

// Verify
const remaining = db.prepare('SELECT COUNT(*) as count FROM locations').get();
console.log(`\n📊 Lieux restants: ${remaining.count} (supprimé 10 doublons)`);

db.close();
