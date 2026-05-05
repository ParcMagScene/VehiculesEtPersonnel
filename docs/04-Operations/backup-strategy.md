# Stratégie de backup — eM@g

## Vue d'ensemble

| Paramètre | Valeur |
|-----------|--------|
| Base de données prod | `apps/api/vehicules.db` (~14 MB, WAL mode) |
| Base de données dev | `apps/api/vehicules-dev.db` (~13 MB) |
| Dossier backups | `backups/` (racine du projet) |
| Rétention | 30 jours (configurable via `BACKUP_RETENTION_DAYS`) |
| Permissions | `chmod 600` (propriétaire uniquement) |

---

## Backup automatique (cron)

Un backup prod est planifié **chaque nuit à 2h00** via crontab :

```cron
0 2 * * * cd /Users/reunion/eM@g && bash scripts/backup-databases.sh --prod >> /Users/reunion/eM@g/backups/backup-cron.log 2>&1
```

Pour vérifier :
```bash
crontab -l
tail -20 backups/backup-cron.log
```

---

## Backup manuel

```bash
# Prod + Dev
bash scripts/backup-databases.sh

# Prod seulement (recommandé avant chaque deploy)
bash scripts/backup-databases.sh --prod

# Dev seulement
bash scripts/backup-databases.sh --dev
```

Le script :
1. Utilise `sqlite3 .backup` (safe avec WAL, même si la DB est utilisée)
2. Vérifie l'intégrité (`PRAGMA integrity_check`)
3. Rejette les backups vides (0 octets)
4. Applique `chmod 600`
5. Purge automatiquement les fichiers >30 jours

---

## Runbook de restauration

### Avant toute restauration

```bash
# 1. Vérifier l'intégrité du backup cible
sqlite3 backups/prod-YYYYMMDD-HHMMSS.db "PRAGMA integrity_check"
# Doit retourner : ok

# 2. Lister les backups disponibles
ls -lhtr backups/*.db
```

### Restauration prod

```bash
# 1. Arrêter le backend
pm2 stop emag-api
# OU : lsof -ti:3003 | xargs kill -9 2>/dev/null

# 2. Sauvegarder la DB actuelle avant écrasement
cp apps/api/vehicules.db apps/api/vehicules.db.avant-restauration

# 3. Copier le backup
cp backups/prod-YYYYMMDD-HHMMSS.db apps/api/vehicules.db

# 4. Supprimer le WAL et SHM résiduels
rm -f apps/api/vehicules.db-wal apps/api/vehicules.db-shm

# 5. Vérifier l'intégrité
sqlite3 apps/api/vehicules.db "PRAGMA integrity_check"

# 6. Relancer le backend
pm2 start emag-api
# OU : npm run dev:start
```

### Restauration dev

Même procédure en remplaçant `vehicules.db` par `vehicules-dev.db` et le backup `dev-*.db`.

---

## Points de vigilance

### WAL (Write-Ahead Log)

SQLite en mode WAL génère deux fichiers auxiliaires :
- `vehicules.db-wal` — transactions non encore checkpointées
- `vehicules.db-shm` — mémoire partagée

Le script `backup-databases.sh` utilise `.backup` qui force un checkpoint et produit un fichier DB complet cohérent. **Ne pas copier `vehicules.db` directement** sans faire `.backup` — le WAL peut contenir des données non consolidées.

### `synchronous = FULL`

La DB est configurée en `synchronous = FULL` (mode le plus conservateur). Chaque transaction est garantie sur disque avant retour. Ce mode est sûr mais ralentit les écritures intensives.

> Pour passer à `synchronous = NORMAL` (équivalent en WAL mode, +30% perf writes) : modifier `database.js` ligne `PRAGMA synchronous = FULL`.

---

## Historique des backups

```
backups/
  prod-20260428-150823.db   ← Backup initial post-audit Sprint 0 (14 MB)
  backup-cron.log           ← Logs du cron quotidien
```

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `BACKUP_RETENTION_DAYS` | `30` | Nombre de jours de rétention des backups |
