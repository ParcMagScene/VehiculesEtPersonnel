# Opérations Sensibles — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Procédures pour les opérations sensibles — déploiement, sauvegarde, restauration, PM2, gestion des bases de données.

---

## Contexte

eM@g fonctionne sur une infrastructure locale (Mac Mini) avec PM2 pour la production et des processus shell pour le développement. Les opérations sensibles nécessitent une attention particulière pour éviter la perte de données.

---

## Infrastructure

| Service | Port | Process Manager |
|---------|------|----------------|
| Prod frontend | 4173 | PM2 (`vehicules`) |
| Prod backend | 3002 | PM2 (`vehicules-backend`) |
| Dev frontend | 5174 | Shell (Vite) |
| Dev backend | 3003 | Shell (Node) |

Base de données :
- Production : `apps/api/vehicules.db`
- Développement : `apps/api/vehicules-dev.db`

---

## Déploiement (safe-deploy.sh)

```bash
# Séquence complète :
1. Backup dist/ → dist-backup/
2. Build Vite → dist/
3. Vérifier dist/index.html existe
4. Si build OK  → restart PM2 (frontend + backend)
5. Si build KO → restore dist-backup/, ne pas restart
```

Commande : `npm run deploy` ou `scripts/safe-deploy.sh`

---

## Sauvegarde base de données

```bash
# Utilise sqlite3 .backup (safe pendant les écritures)
sqlite3 apps/api/vehicules.db ".backup backups/prod-$(date +%Y%m%d-%H%M%S).db"

# Vérification d'intégrité
sqlite3 backups/prod-*.db "PRAGMA integrity_check"
```

Script : `scripts/backup-databases.sh`

Règles :
- Ne jamais écraser un backup existant
- Nommage : `prod-YYYYMMDD-HHMMSS.db`
- Vérifier l'intégrité après chaque backup

---

## Démarrage dev (dev-start.sh)

```bash
1. Copier vehicules.db → vehicules-dev.db (si absent)
2. Kill ports 3003, 5174
3. Vérifier que prod tourne toujours (3002, 4173)
4. Lancer backend : NODE_ENV=development node server.js --dev
5. Lancer frontend : npx vite (proxy /api → localhost:3003)
```

---

## Règles impératives

1. **JAMAIS toucher la branche main directement** — toujours passer par dev + cherry-pick
2. **JAMAIS supprimer vehicules.db** (production) — toujours travailler sur vehicules-dev.db
3. **Toujours sauvegarder avant un déploiement**
4. **Toujours vérifier que la prod tourne** après un démarrage dev
5. **Ne jamais utiliser `git push --force`**
6. **Ne jamais utiliser `git reset --hard`** sans backup
7. **Toujours vérifier le build** avant de restart PM2

---

## Commandes PM2

```bash
pm2 restart vehicules vehicules-backend  # Restart prod
pm2 logs vehicules-backend --lines 50    # Logs backend
pm2 status                                # État des processus
pm2 save                                  # Sauvegarder la config PM2
```

---

## En cas d'incident

1. **Build cassé** → `safe-deploy.sh` restaure automatiquement `dist-backup/`
2. **DB corrompue** → restaurer depuis `backups/prod-*.db` le plus récent
3. **Port occupé** → `lsof -ti:PORT | xargs kill -9`
4. **PM2 ne répond plus** → `pm2 kill && pm2 resurrect`

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `scripts/safe-deploy.sh` | Déploiement sécurisé |
| `scripts/dev-start.sh` | Démarrage environnement dev |
| `scripts/backup-databases.sh` | Sauvegarde des bases |
