# Migrations versionnées

Ce dossier contient les **nouvelles** migrations DB versionnées exécutées
par `scripts/migrate.mjs`.

## Convention

- Nom de fichier : `NNNN_description.{sql|js|mjs}`
  - `NNNN` : numéro 4 chiffres croissant (`0001`, `0002`, …)
  - `description` : snake_case court
- `.sql` : exécuté tel quel via `db.exec()`
- `.js`/`.mjs` : module ESM exportant
  ```js
  export default function up(db) { /* … */ }
  ```

## Règles

1. **Ne jamais modifier une migration déjà appliquée.** Le runner détecte
   le drift par hash SHA-256 et bloque.
2. **Une migration = une transaction.** Le runner enveloppe l'exécution
   dans `db.transaction()`. Si `up()` lance, rollback automatique.
3. **Pas de logique métier ni de seeds non-idempotents** dans une
   migration. Réservé à : `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`,
   backfill simple.
4. **Migrations historiques** (apps/api/migrations/*.sql et `.js` inline
   dans `migrations.js`) restent gérées par `runPostInitMigrations(db)`
   au boot. Les NOUVELLES vont ici.

## Commandes

```bash
npm run db:migrate          # applique toutes les pendings
npm run db:migrate:status   # liste l'état
npm run db:migrate -- --dry # liste sans exécuter
```

Le runner crée la table `_migrations(name, hash, applied_at)` automatiquement.
