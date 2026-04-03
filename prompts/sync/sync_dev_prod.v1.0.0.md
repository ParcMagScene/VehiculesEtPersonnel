# Synchronisation Dev ↔ Prod — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Procédure de synchronisation bidirectionnelle non destructive entre les bases de données dev et prod.

---

## Contexte

eM@g maintient deux bases SQLite séparées :
- **Production** : `apps/api/vehicules.db` (port 3002)
- **Développement** : `apps/api/vehicules-dev.db` (port 3003)

La synchronisation est **non destructive** et **bidirectionnelle**.

---

## Règles fondamentales

| # | Règle | Justification |
|---|-------|--------------|
| 1 | **Production = source de vérité** | Les données prod ont priorité en cas de conflit |
| 2 | **Aucune suppression** | Jamais de DELETE pendant la sync |
| 3 | **INSERT WHERE NOT EXISTS uniquement** | Jamais de UPDATE destructif |
| 4 | **Toujours backup avant sync** | Point de restauration obligatoire |
| 5 | **Toujours dry-run d'abord** | Vérifier avant d'exécuter |

---

## Tables EXCLUES de la synchronisation

Ces tables ne sont jamais synchronisées :
- `active_sessions` — sessions actives
- `video_access_logs` — logs d'accès vidéo
- `display_logs` — logs d'affichage
- `modification_history` — historique
- `_migrations_log` — migrations appliquées
- `config` — configuration locale
- `users` — comptes utilisateurs
- `google_tokens` — tokens OAuth
- `access_requests` — demandes d'accès

---

## Tables en mode TIMESTAMP ONLY

Conflits ignorés, pas de sync de contenu :
- `brand_aliases`
- `brands`
- `brand_family_mapping`
- `taxonomy_family_mapping`
- `equipment_categories`
- `inventory_locations`
- `stock_categories`

---

## Workflow complet

### Étape 1 — Backup
```bash
scripts/backup-databases.sh
# → backups/prod-YYYYMMDD-HHMMSS.db
```

### Étape 2 — Dry-run
```bash
node scripts/sync-dev-prod.js --dry-run --phase all
# Affiche les INSERT qui seraient exécutés
```

### Étape 3 — Sync
```bash
# Prod → Dev (données utilisateurs vers dev)
node scripts/sync-dev-prod.js --phase prod-to-dev

# Dev → Prod (nouvelles features)
node scripts/sync-dev-prod.js --phase dev-to-prod

# Les deux sens
node scripts/sync-dev-prod.js --phase all
```

### Étape 4 — Vérification
```bash
# Vérifier que prod fonctionne
curl http://localhost:3002/api/health

# Vérifier que dev fonctionne
curl http://localhost:3003/api/health
```

---

## Gestion des conflits

- **Même ID, contenu différent** → la prod gagne
- **Nouvel enregistrement en dev** → inséré en prod (`INSERT OR IGNORE`)
- **Nouvel enregistrement en prod** → inséré en dev (`INSERT OR IGNORE`)
- **Tables de taxonomie** → ignorées (gérées par les migrations)

---

## Règles impératives

1. **JAMAIS de sync sans backup** — le backup est obligatoire
2. **JAMAIS de sync en mode auto** — toujours supervision humaine
3. **JAMAIS de DELETE dans le script de sync**
4. **Toujours vérifier les logs** : `backups/sync-log-*.txt`
5. **Tester le dry-run** avant chaque sync réelle

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `scripts/sync-dev-prod.js` | Script de synchronisation principal |
| `scripts/backup-databases.sh` | Sauvegarde des bases |
| `scripts/merge-dev-to-prod.cjs` | Merge alternatif dev→prod |
| `docs/Synchronisation Dev ↔ Prod + Commit & Push Sécurisés.md` | Documentation complète |
