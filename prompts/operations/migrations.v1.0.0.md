# Migrations Base de Données — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Conventions et procédures pour les migrations SQLite dans eM@g — création de tables, ajout de colonnes, seeds de données.

---

## Contexte

eM@g utilise **better-sqlite3** avec un système de migrations maison exécutées au démarrage du serveur. Chaque migration est enregistrée dans `_migrations_log` pour garantir l'idempotence.

---

## Architecture

```
apps/api/
├── database.js              ← initializeDatabase() appelle toutes les migrations
├── migrations/
│   ├── taxonomy-brands-v1.js    ← 13 migrations marques
│   ├── taxonomy-v1.js           ← catégories équipement
│   ├── taxonomy-maintenance-v1.js ← catégories stock
│   ├── inventory-v1.js          ← inventaire et mouvements
│   └── video-v1.js              ← sessions vidéo
```

---

## Format d'une migration

```javascript
// apps/api/migrations/{feature}-v1.js
export function run{Feature}Migrations(db) {
  const applied = new Set(
    db.prepare("SELECT key FROM _migrations_log").all().map(r => r.key)
  );

  function runMigration(key, fn) {
    if (applied.has(key)) return;
    try {
      fn();
      db.prepare("INSERT INTO _migrations_log (key) VALUES (?)").run(key);
      console.log(`✅ Migration ${key} appliquée`);
    } catch (err) {
      console.error(`❌ Migration ${key} échouée:`, err.message);
    }
  }

  // Migration 1
  runMigration('feature-001-description', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS ...`);
  });

  // Migration 2
  runMigration('feature-002-description', () => {
    safeAddColumn(db, 'table_name', 'column_name', 'TEXT DEFAULT ""');
  });
}
```

---

## Fonctions utilitaires

```javascript
// Ajout sécurisé de colonne (vérifie existence avant ALTER)
function safeAddColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
```

---

## Règles impératives

1. **Jamais modifier une migration existante** — toujours en ajouter une nouvelle
2. **Jamais supprimer une migration** — la clé dans `_migrations_log` empêche la ré-exécution
3. Utiliser `CREATE TABLE IF NOT EXISTS` et `INSERT OR IGNORE` pour l'idempotence
4. Utiliser `safeAddColumn()` pour les ALTER TABLE
5. Wrapper les opérations batch dans une **transaction** : `db.transaction(() => { ... })()`
6. Les clés de migration suivent le format : `{feature}-{NNN}-{description}`
7. Numéroter séquentiellement par fichier (001, 002, 003...)
8. Logger avec `console.log('✅ ...')` / `console.error('❌ ...')`

---

## Enregistrement au démarrage

Dans `database.js` → `initializeDatabase()` :
```javascript
import { runTaxonomyBrandsMigrations } from './migrations/taxonomy-brands-v1.js';
// ...
runTaxonomyBrandsMigrations(db);
```

---

## Workflow de création

1. Identifier le fichier de migration existant ou en créer un nouveau
2. Ajouter la migration avec une clé unique descriptive
3. Tester sur la base dev (`vehicules-dev.db`)
4. Vérifier que le serveur démarre sans erreur
5. Vérifier l'idempotence (redémarrer 2 fois)
6. Commit : `feat(db): migrate {description}`

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `apps/api/database.js` | Initialisation DB + appel des migrations |
| `apps/api/migrations/*.js` | Fichiers de migration par domaine |
