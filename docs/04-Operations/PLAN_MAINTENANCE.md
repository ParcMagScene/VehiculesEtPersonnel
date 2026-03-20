# 🔄 Plan de maintenance continue — eM@g

> **Créé** : 20 mars 2026 — **Branche** : `dev`
> **Objectif** : Garder eM@g propre, stable, sécurisé et performant sur la durée.

---

## Vue d'ensemble

| Cycle | Fréquence | Durée estimée | Quand |
|-------|-----------|---------------|-------|
| 🧹 Nettoyage | Mensuel | ~1h | 1er lundi du mois |
| 🔒 Sécurité | Mensuel | ~30min | 1er lundi du mois |
| ⚡ Performance | Trimestriel | ~1h | 1er lundi du trimestre |
| 📖 Documentation | À chaque merge `dev → main` | ~30min | Avant chaque PR |

---

## 🧹 Cycle de nettoyage — Mensuel

### A. Lint & code quality

```bash
# 1. Vérifier ESLint (objectif : 0 erreurs, max 9 warnings — logger.js)
npm run lint

# 2. Vérifier le build frontend (objectif : 0 warnings Vite)
npm run build 2>&1 | grep -i 'warning\|error'

# 3. Lancer les tests
npm run test:all
```

**Seuils acceptés** :
- ESLint : 0 erreurs, ≤ 9 warnings (tous `no-console` dans `logger.js`)
- Vite build : 0 warnings, chunk max 600 KB
- Tests : 100% pass

### B. Dépendances

```bash
# Chercher les vulnérabilités connues
npm audit --omit=dev

# Vérifier les mises à jour disponibles (patch/minor uniquement)
npx npm-check-updates --target minor
```

**Règle** : Appliquer les patches de sécurité immédiatement. Les mises à jour mineures passent par `dev` + test complet avant merge.

### C. Fichiers orphelins

```bash
# CSS inutilisés (vérifier les imports avant suppression)
find apps/web/src -name '*.css' | while read f; do
  base=$(basename "$f")
  grep -rl "$base" apps/web/src --include='*.jsx' --include='*.js' | head -1 || echo "ORPHELIN: $f"
done

# Vérifier qu'aucun console.log non gardé n'est apparu
grep -rn 'console\.log' apps/web/src --include='*.jsx' --include='*.js' | grep -v '// eslint' | grep -v 'logger'
```

### D. Base de données

```bash
# Sauvegarder la base prod
bash apps/api/backup-database.sh

# Vérifier la taille et nettoyer le WAL
sqlite3 apps/api/vehicules.db "PRAGMA wal_checkpoint(TRUNCATE); SELECT page_count * page_size / 1024 / 1024 AS 'Taille (MB)' FROM pragma_page_count(), pragma_page_size();"

# Purger les sessions expirées (> 30 jours)
sqlite3 apps/api/vehicules.db "DELETE FROM active_sessions WHERE expires_at < datetime('now', '-30 days');"

# Purger les événements TV complétés anciens (> 90 jours)
sqlite3 apps/api/vehicules.db "DELETE FROM display_completed_events WHERE event_date < date('now', '-90 days');"

# Compter les backups et supprimer les plus anciens (garder les 30 derniers)
ls -t apps/api/backups/*.db | tail -n +31 | xargs rm -f 2>/dev/null
```

---

## 🔒 Cycle de sécurité — Mensuel

### A. Audit des dépendances

```bash
# Niveau critique/high uniquement (bloquant)
npm audit --audit-level=high

# Rapport complet
npm audit
```

**Action** : Toute vulnérabilité `critical` ou `high` doit être corrigée sous 48h.

### B. Vérifications de configuration

| Point de contrôle | Commande / vérification | Attendu |
|---|---|---|
| JWT_SECRET | `grep JWT_SECRET apps/api/.env` | Secret ≥ 32 chars, pas le défaut |
| Algo JWT | Vérifier `authenticate.js` | `algorithms: ['HS256']` présent |
| Cookie secure | Vérifier `authRoutes.js` | `secure: true` en production |
| Rate limiting | Vérifier `server.js` | Tous endpoints auth protégés |
| CORS origins | Vérifier `config/cors.js` | Pas d'origine `*` ou localhost en prod |
| Helmet actif | `curl -sI https://magsav.duckdns.org/api/ \| grep -i 'x-content-type\|x-frame'` | Headers présents |

### C. Revue des uploads

```bash
# Vérifier la taille du dossier attachments
du -sh public/attachments/ public/avatars/ public/Photos/

# Chercher les fichiers suspects (extensions non attendues)
find public/attachments -type f \( -name '*.php' -o -name '*.sh' -o -name '*.exe' -o -name '*.js' -o -name '*.html' \)
```

### D. Sessions actives

```bash
# Nombre de sessions actives
sqlite3 apps/api/vehicules.db "SELECT COUNT(*) AS sessions_actives FROM active_sessions WHERE expires_at > datetime('now');"

# Sessions par utilisateur (détecter les anomalies)
sqlite3 apps/api/vehicules.db "SELECT u.name, COUNT(*) AS nb FROM active_sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > datetime('now') GROUP BY s.user_id ORDER BY nb DESC LIMIT 10;"
```

---

## ⚡ Cycle de performance — Trimestriel

### A. Métriques frontend

```bash
# Taille du bundle
npm run build 2>&1 | tail -20

# Vérifier la taille des chunks (seuil : 600 KB)
ls -lhS apps/web/dist/assets/*.js | head -10
```

**Seuils** :
- Plus gros chunk JS : < 600 KB
- Total assets : < 3 MB
- Build time : < 30s

### B. Métriques backend

```bash
# Vérifier les processus PM2
pm2 monit  # Surveiller CPU/RAM en temps réel (5 min)
pm2 info vehicules-backend  # Heap, uptime, restarts
```

| Métrique | Seuil acceptable | Action si dépassé |
|----------|-----------------|-------------------|
| RAM backend | < 200 MB | Chercher fuites mémoire |
| Restarts PM2 | 0 sur 30j | Investiguer les crashes dans les logs |
| CPU backend | < 5% au repos | Profiler les requêtes lentes |

### C. Base de données

```bash
# Requêtes lentes ? Activer temporairement le profiling
sqlite3 apps/api/vehicules.db "
  SELECT name, tbl_name FROM sqlite_master WHERE type='index';
" | wc -l
# Vérifier que les index existent sur les colonnes filtrées fréquemment
```

**Index critiques à vérifier** :
- `active_sessions(token_hash)`
- `active_sessions(expires_at)`
- `display_completed_events(event_date)`
- `equipment(category_id)`
- `users(email)`

### D. Cache & headers statiques

```bash
# Vérifier les headers de cache sur les assets statiques
curl -sI http://localhost:3002/avatars/test.jpg 2>/dev/null | grep -i cache-control
# Attendu : max-age=86400 (1 jour) pour avatars
# Attendu : max-age=3600 (1 heure) pour attachments
# Attendu : max-age=604800 (7 jours) pour display/logos
```

---

## 📖 Cycle de documentation — Avant chaque merge

### A. Checklist pré-merge (rappel)

Se référer à [CHECKLIST_PRODUCTION.md](CHECKLIST_PRODUCTION.md) pour la checklist complète.

### B. Mise à jour des docs

| Document | Quand le mettre à jour |
|----------|----------------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Nouveau module, route, ou changement de stack |
| [CHECKLIST_PRODUCTION.md](CHECKLIST_PRODUCTION.md) | Nouveau test ou point de vérification |
| [SECURITY.md](SECURITY.md) | Tout changement de sécurité |
| Ce fichier (PLAN_MAINTENANCE.md) | Nouveau seuil, script, ou procédure |

### C. Changelog

À chaque merge `dev → main`, ajouter une entrée dans le commit de merge :

```
## [Date] — vX.Y.Z

### Ajouts
- ...

### Corrections
- ...

### Sécurité
- ...
```

---

## 🚨 Procédures d'urgence

### Rollback frontend

```bash
# Le script safe-deploy.sh garde un dist-backup/
cp -r dist-backup/* apps/web/dist/
pm2 restart vehicules
```

### Rollback base de données

```bash
# Restaurer depuis la dernière sauvegarde
cp apps/api/backups/vehicules_backup_YYYY-MM-DD_HH-MM-SS.db apps/api/vehicules.db
pm2 restart vehicules-backend
```

### Bloquer un utilisateur compromis

```bash
# Révoquer toutes ses sessions immédiatement
sqlite3 apps/api/vehicules.db "DELETE FROM active_sessions WHERE user_id = (SELECT id FROM users WHERE email = 'xxx@xxx.com');"
```

---

## 📋 Résumé des commandes rapides

```bash
# Vérification rapide santé globale (< 2 min)
npm run lint && npm run build && npm run test:all && npm audit --audit-level=high

# Nettoyage DB mensuel
bash apps/api/backup-database.sh
sqlite3 apps/api/vehicules.db "DELETE FROM active_sessions WHERE expires_at < datetime('now', '-30 days'); DELETE FROM display_completed_events WHERE event_date < date('now', '-90 days'); PRAGMA wal_checkpoint(TRUNCATE);"

# Statut production
pm2 status
```

---

## Voir aussi

- [Checklist production](CHECKLIST_PRODUCTION.md)
- [Architecture technique](../01-Architecture/ARCHITECTURE.md)
- [Sécurité](../02-Securite/SECURITY.md)
- [Audit](../02-Securite/AUDIT.md)
