import Database from "better-sqlite3";
const db = new Database("database/vehicules-dev.db", {readonly:true});
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(t.name));
