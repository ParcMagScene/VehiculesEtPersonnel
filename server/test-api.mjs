import jwt from "jsonwebtoken";
import crypto from "crypto";
import Database from "better-sqlite3";

const secret = "dev-secret-key-not-for-production";
const token = jwt.sign({ id: 1, username: "admin", role: "admin" }, secret, { expiresIn: "1h" });

const db = new Database("vehicules-dev.db");
const tokenHash = crypto.createHash("sha256").update(token).digest("hex").substring(0, 64);
try {
  db.prepare("INSERT OR REPLACE INTO active_sessions (user_id, token_hash, expires_at, created_at) VALUES (1, ?, datetime('now', '+1 hour'), datetime('now'))").run(tokenHash);
  console.log("Session created OK");
} catch(e) { console.log("Session insert:", e.message); }
db.close();

const resp = await fetch("http://localhost:3003/api/affaires", { headers: { Authorization: "Bearer " + token } });
const data = await resp.json();
console.log("Status:", resp.status);
if (Array.isArray(data)) {
  console.log("Total affaires:", data.length);
  const m = data.find(a => a.numeroAffaire === "AF33137");
  if (m) {
    console.log("AF33137 TROUVEE:", JSON.stringify({id:m.id, num:m.numeroAffaire, client:m.client, dateDebut:m.dateDebut, dateFin:m.dateFin, source:m.source}));
  } else {
    console.log("AF33137 ABSENTE!");
    console.log("Numeros presents:", data.map(a => a.numeroAffaire).join(", "));
  }
} else {
  console.log("Non-array response:", JSON.stringify(data).slice(0, 300));
}
