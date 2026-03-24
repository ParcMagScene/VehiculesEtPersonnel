# Plan de Rollback — eM@g

> Document de référence pour revenir en arrière rapidement en cas de problème après un déploiement, une synchronisation de données, ou une migration.

---

## Prérequis

- Accès SSH ou terminal sur la machine de production (Mac Mini)
- Backups récents créés via `bash scripts/backup-databases.sh`
- Connaissance de la branche/commit cible de retour

---

## 1. Rollback du Code (Git)

### 1a. Annuler le dernier commit (pas encore poussé)

```bash
cd /Users/reunion/eM@g
git log --oneline -5                    # Identifier le commit à annuler
git reset --soft HEAD~1                 # Annule le commit, garde les fichiers modifiés
```

### 1b. Revenir à un commit précis (déjà poussé sur dev)

```bash
cd /Users/reunion/eM@g
git checkout dev
git log --oneline -10                   # Trouver le <commit-sha> cible
git revert <commit-sha>                 # Crée un commit inverse (safe, traçable)
git push origin dev
```

### 1c. Rollback complet de la branche prod (urgence)

⚠️ **À utiliser uniquement si la production est cassée.**

```bash
cd /Users/reunion/eM@g
git checkout main
git log --oneline -5                    # Identifier le dernier commit stable
git reset --hard <commit-sha-stable>    # Revient au commit stable
# NE PAS git push --force — plutôt faire un revert propre
git revert HEAD                         # Crée un commit de retour
git push origin main
```

### 1d. Restaurer la branche prod depuis origin (si divergence locale)

```bash
cd /Users/reunion/eM@g
git checkout main
git fetch origin
git reset --hard origin/main            # ⚠️ Écrase les changements locaux
```

---

## 2. Rollback de la Base de Données

### 2a. Identifier les backups disponibles

```bash
ls -lhtr /Users/reunion/eM@g/backups/*.db | tail -10
```

Format des noms : `prod-YYYYMMDD-HHMMSS.db`, `dev-YYYYMMDD-HHMMSS.db`

### 2b. Restaurer la base PROD

```bash
# 1. Arrêter le backend de production
pm2 stop vehicules-backend

# 2. Vérifier l'intégrité du backup AVANT de restaurer
sqlite3 /Users/reunion/eM@g/backups/prod-XXXXXXXX-XXXXXX.db "PRAGMA integrity_check;"
# Doit retourner "ok"

# 3. Remplacer la base de données
cp /Users/reunion/eM@g/apps/api/vehicules.db /Users/reunion/eM@g/apps/api/vehicules.db.before-rollback
cp /Users/reunion/eM@g/backups/prod-XXXXXXXX-XXXXXX.db /Users/reunion/eM@g/apps/api/vehicules.db

# 4. Supprimer les fichiers WAL/SHM résiduels
rm -f /Users/reunion/eM@g/apps/api/vehicules.db-wal
rm -f /Users/reunion/eM@g/apps/api/vehicules.db-shm

# 5. Relancer le backend
pm2 start vehicules-backend
pm2 logs vehicules-backend --lines 20   # Vérifier que tout est OK
```

### 2c. Restaurer la base DEV

```bash
# 1. Arrêter le backend dev
lsof -ti:3003 | xargs kill -9 2>/dev/null

# 2. Remplacer la base
cp /Users/reunion/eM@g/backups/dev-XXXXXXXX-XXXXXX.db /Users/reunion/eM@g/apps/api/vehicules-dev.db

# 3. Supprimer WAL/SHM
rm -f /Users/reunion/eM@g/apps/api/vehicules-dev.db-wal
rm -f /Users/reunion/eM@g/apps/api/vehicules-dev.db-shm

# 4. Relancer le dev
npm run dev:start
```

---

## 3. Rollback d'un Déploiement Frontend

Le script `scripts/safe-deploy.sh` crée automatiquement un `dist-backup/` avant chaque build. Si le déploiement échoue, il restaure automatiquement.

Pour un rollback **manuel** du frontend :

```bash
# Si dist-backup/ existe encore
cp -r /Users/reunion/eM@g/dist-backup/* /Users/reunion/eM@g/apps/web/dist/
pm2 restart vehicules
```

---

## 4. Rollback Après Synchronisation de Données

Si la synchronisation dev ↔ prod a causé des problèmes :

```bash
# 1. Toujours vérifier les backups AVANT la sync
ls -lhtr /Users/reunion/eM@g/backups/*.db | tail -5

# 2. Restaurer la DB prod depuis le backup pre-sync
pm2 stop vehicules-backend
cp /Users/reunion/eM@g/backups/prod-XXXXXXXX-XXXXXX.db /Users/reunion/eM@g/apps/api/vehicules.db
rm -f /Users/reunion/eM@g/apps/api/vehicules.db-wal /Users/reunion/eM@g/apps/api/vehicules.db-shm
pm2 start vehicules-backend

# 3. Restaurer la DB dev
lsof -ti:3003 | xargs kill -9 2>/dev/null
cp /Users/reunion/eM@g/backups/dev-XXXXXXXX-XXXXXX.db /Users/reunion/eM@g/apps/api/vehicules-dev.db
rm -f /Users/reunion/eM@g/apps/api/vehicules-dev.db-wal /Users/reunion/eM@g/apps/api/vehicules-dev.db-shm
npm run dev:start
```

---

## 5. Rollback Complet (Code + DB — Scénario Catastrophe)

Procédure complète si tout est cassé :

```bash
# 1. STOPPER TOUT
pm2 stop all

# 2. Backup de l'état cassé (pour diagnostic post-mortem)
mkdir -p /Users/reunion/eM@g/backups/crash-$(date +%Y%m%d-%H%M%S)
cp /Users/reunion/eM@g/apps/api/vehicules.db /Users/reunion/eM@g/backups/crash-$(date +%Y%m%d-%H%M%S)/
cp /Users/reunion/eM@g/apps/api/vehicules-dev.db /Users/reunion/eM@g/backups/crash-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null

# 3. Rollback Git
cd /Users/reunion/eM@g
git checkout main
git reset --hard origin/main

# 4. Restaurer la DB prod
cp /Users/reunion/eM@g/backups/prod-XXXXXXXX-XXXXXX.db /Users/reunion/eM@g/apps/api/vehicules.db
rm -f /Users/reunion/eM@g/apps/api/vehicules.db-wal /Users/reunion/eM@g/apps/api/vehicules.db-shm

# 5. Rebuild frontend
cd /Users/reunion/eM@g/apps/web && npx vite build

# 6. Relancer tout
pm2 start /Users/reunion/eM@g/apps/api/ecosystem.config.js
pm2 save

# 7. Vérifier
pm2 logs --lines 30
curl -s http://localhost:3002/api/health | head -5
```

---

## Checklist Rapide

| Situation | Action | Commande clé |
|---|---|---|
| Commit à annuler (pas poussé) | `git reset --soft HEAD~1` | ~5 sec |
| Commit poussé à défaire | `git revert <sha>` + push | ~30 sec |
| DB prod corrompue | Restaurer backup | `cp backups/prod-*.db apps/api/vehicules.db` |
| DB dev corrompue | Restaurer backup | `cp backups/dev-*.db apps/api/vehicules-dev.db` |
| Frontend cassé | Rebuild ou dist-backup | `cd apps/web && npx vite build` |
| Tout cassé | Procédure section 5 | ~3 min |

---

## Règles d'Or

1. **Toujours** exécuter `bash scripts/backup-databases.sh` **avant** toute opération risquée
2. **Ne jamais** utiliser `git push --force` sur `main`
3. **Ne jamais** supprimer un backup sans en avoir créé un nouveau
4. **Toujours** vérifier l'intégrité d'un backup avant de restaurer : `sqlite3 <backup> "PRAGMA integrity_check;"`
5. **Toujours** arrêter le backend avant de remplacer un fichier DB
