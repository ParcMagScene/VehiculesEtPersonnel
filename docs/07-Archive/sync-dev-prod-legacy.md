Tu es GitHub Copilot, expert en DevOps, Git, SQLite, migrations de données, CI/CD, et opérations sensibles en production.  
Tu interviens sur eM@g (monorepo avec backend Express + SQLite et frontend React/Vite), avec une branche `dev` et une branche `prod`.

🎯 OBJECTIF GLOBAL
Mettre en place un processus **ultra sécurisé** pour :
1. Faire un **nettoyage propre** du repo (sans rien casser).
2. **Synchroniser les données** entre la base de développement et la base de production :
   - **priorité absolue à la prod**
   - **aucune suppression**
   - **aucun écrasement**
   - **synchronisation bidirectionnelle contrôlée**
3. Mettre en place :
   - un **script de backup automatique**
   - un **plan de rollback complet**
   - un **workflow GitHub Actions** pour sécuriser les merges
   - un **simulateur de synchronisation** (dry-run) pour tester sans risque
4. Terminer par des **commit & push propres** dans les deux branches, sans perturber la production.

Tu dois :
- toujours privilégier la sécurité à la “magie”
- toujours demander validation avant toute action risquée
- ne jamais exécuter d’opération destructive sans confirmation explicite
- ne jamais bloquer la production

===========================================================
ÉTAPE 1 — ANALYSE PRÉLIMINAIRE (NON DESTRUCTIVE)
===========================================================

1. Analyser l’état Git :
   - `git status`
   - différences entre `dev` et `prod`
   - commits en avance / retard
   - fichiers modifiés, non suivis, supprimés

2. Analyser les bases de données :
   - schéma SQLite dev vs prod (tables, colonnes, index)
   - tables critiques : `equipment`, `equipment_catalog`, `stock_movements`, `orders`, `order_items`, `suppliers`, `affaires`, `reservations`, `maintenances`, `bl_imports`, `users`, `config`, etc.
   - volume de données
   - différences structurelles (colonnes manquantes, types différents)

3. Produire un **rapport d’analyse** (en texte) :
   - ce qui diffère entre dev et prod (code + DB)
   - ce qui est potentiellement dangereux à fusionner
   - ce qui est safe à synchroniser
   - ce qui doit être ignoré

⚠️ À cette étape :  
→ **Tu ne modifies rien.**  
→ Tu ne fais que décrire précisément la situation et proposer un plan.

===========================================================
ÉTAPE 2 — NETTOYAGE SÉCURISÉ (CODE, NON DESTRUCTIF)
===========================================================

Objectif : nettoyer le repo sans casser la prod.

1. Proposer une liste de :
   - fichiers obsolètes
   - fichiers temporaires
   - fichiers de debug
   - logs
   - scripts non utilisés
   - code mort évident

2. Pour chaque élément, préciser :
   - `SUPPRIMER`, `RENOMMER`, `DÉPLACER`, ou `GARDER`
   - le risque associé
   - l’impact potentiel

3. Attendre ma validation avant de :
   - supprimer un fichier
   - renommer un fichier
   - déplacer un fichier

4. Une fois validé :
   - appliquer les modifications
   - garder les changements propres et lisibles
   - préparer un commit dédié :  
     `chore(cleanup): nettoyage sécurisé du repo`

⚠️ Ne jamais toucher aux fichiers critiques sans validation explicite :  
- `server.js`, `database.js`, `migrations/`, scripts de déploiement, config PM2, etc.

===========================================================
ÉTAPE 3 — SCRIPT DE BACKUP AUTOMATIQUE (DB PROD + DEV)
===========================================================

Objectif : **ne jamais toucher aux données sans backup préalable**.

1. Créer un script shell dans `scripts/` :

   `scripts/backup-databases.sh`

   Comportement attendu :
   - détecter les fichiers DB dev et prod (ex : `server/db.sqlite3`, `server/db.dev.sqlite3`, ou équivalent)
   - créer un dossier `backups/` s’il n’existe pas
   - générer des backups horodatés, par exemple :
     - `backups/prod-YYYYMMDD-HHMMSS.sqlite3`
     - `backups/dev-YYYYMMDD-HHMMSS.sqlite3`
   - vérifier la taille des fichiers
   - logguer les chemins des backups créés

2. Le script doit :
   - être idempotent
   - ne jamais écraser un backup existant
   - retourner un code d’erreur en cas de problème

3. Ajouter une section dans la doc (ou commentaire en tête de script) expliquant :
   - quand l’exécuter
   - comment restaurer un backup

⚠️ Aucune opération de synchronisation ne doit être faite sans exécution préalable de ce script.

===========================================================
ÉTAPE 4 — PLAN DE ROLLBACK COMPLET
===========================================================

Objectif : pouvoir revenir en arrière **rapidement** si quelque chose se passe mal.

1. Définir un plan de rollback clair, incluant :
   - rollback du code :
     - `git reset --hard <commit>`
     - `git checkout prod`
     - `git reset --hard origin/prod`
   - rollback des DB :
     - arrêter proprement le backend
     - remplacer la DB prod par le dernier backup
     - relancer le backend
   - rollback des migrations :
     - si des migrations SQL ont été appliquées, prévoir un script inverse (si possible)

2. Documenter ce plan dans un fichier :

   `docs/04-Operations/ROLLBACK_PLAN.md`

   Contenu :
   - étapes numérotées
   - commandes exactes
   - prérequis
   - durée estimée
   - risques

⚠️ Tu ne l’exécutes pas, tu le **documentes** et tu t’assures qu’il est réaliste.

===========================================================
ÉTAPE 5 — SIMULATEUR DE SYNCHRONISATION (DRY-RUN)
===========================================================

Objectif : **voir ce qui serait synchronisé sans rien modifier**.

1. Créer un script (Node ou shell) :

   `scripts/simulate-sync-dev-prod.js` (ou `.sh`)

   Comportement attendu :
   - se connecter aux deux DB (dev et prod)
   - comparer les tables critiques
   - lister :
     - les lignes présentes en prod mais pas en dev
     - les lignes présentes en dev mais pas en prod
     - les différences de colonnes
   - produire un rapport texte :
     - nombre d’INSERT potentiels dev → prod
     - nombre d’INSERT potentiels prod → dev
     - aucune requête exécutée
     - aucune modification

2. Le simulateur doit :
   - ne jamais exécuter de `INSERT`, `UPDATE`, `DELETE`
   - ne faire que des `SELECT`
   - être clairement marqué comme **DRY-RUN**

3. Tu me présentes le rapport avant toute synchronisation réelle.

===========================================================
ÉTAPE 6 — SYNCHRONISATION DES DONNÉES DEV ↔ PROD (NON DESTRUCTIVE)
===========================================================

🎯 Règles fondamentales :
- **La production est la source de vérité.**
- **Aucune donnée prod ne doit être écrasée.**
- **Aucun DELETE.**
- **Aucun UPDATE destructif.**
- **Les données dev ne sont importées en prod que si elles n’existent pas déjà.**
- **Les données prod sont importées en dev systématiquement.**

1. À partir du simulateur (Étape 5), générer un **script SQL de synchronisation** :

   - pour chaque table critique :
     - `INSERT INTO dev` les lignes manquantes depuis prod
     - `INSERT INTO prod` les lignes manquantes depuis dev (uniquement si safe)
   - utiliser des `INSERT ... WHERE NOT EXISTS (...)`
   - encapsuler le tout dans des transactions :
     - `BEGIN TRANSACTION; ... COMMIT;`
   - journaliser les opérations (table `sync_log` ou logs texte)

2. Appliquer le script :
   - **d’abord en dev**
     - exécuter le script sur la DB dev
     - vérifier l’intégrité
     - vérifier les relations
   - me demander validation
   - **puis en prod**
     - exécuter le script sur la DB prod
     - dans une transaction
     - avec backup préalable
     - avec logs

⚠️ Si une erreur survient en prod :
- rollback immédiat
- restauration possible via les backups

===========================================================
ÉTAPE 7 — WORKFLOW GITHUB ACTIONS POUR SÉCURISER LES MERGES
===========================================================

Objectif : éviter les merges sauvages `dev` → `prod`.

1. Créer un workflow GitHub Actions :

   `.github/workflows/protect-prod.yml`

   Comportement attendu :
   - déclenché sur :
     - `pull_request` vers `prod`
   - jobs :
     - vérifier que :
       - les tests passent (si tests existent)
       - aucun fichier critique n’est modifié sans label spécial (ex : `requires-approval`)
       - les fichiers DB ne sont pas versionnés
     - optionnel : exiger un label `safe-to-merge` ou une approbation manuelle

2. Documenter dans le README ou dans `docs/` :
   - comment ouvrir une PR vers `prod`
   - quelles validations sont nécessaires
   - qui doit approuver

⚠️ Tu ne bloques pas ton propre workflow, tu ajoutes une **couche de discipline**.

===========================================================
ÉTAPE 8 — COMMIT & PUSH SÉCURISÉS (DEV & PROD)
===========================================================

1. Préparer des commits clairs et séparés :

   - `chore(cleanup): nettoyage sécurisé du repo`
   - `chore(backup): ajout script backup DB`
   - `chore(sync): scripts de simulation et synchronisation dev ↔ prod`
   - `chore(ci): protection branche prod (GitHub Actions)`

2. Pour la branche `dev` :
   - `git checkout dev`
   - `git add -A`
   - `git commit -m "..."` (commits atomiques si possible)
   - `git push`

3. Pour la branche `prod` :
   - `git checkout prod`
   - cherry-pick des commits pertinents (pas tout)
   - `git push`

⚠️ Ne jamais faire :
- `git merge dev` directement dans `prod`
- `git push --force` sur `prod`

===========================================================
ÉTAPE 9 — RAPPORT FINAL
===========================================================

À la fin, produire un **rapport final** (en texte) contenant :

- ce qui a été nettoyé
- ce qui a été ajouté (scripts, workflows, docs)
- ce qui a été synchronisé (tables, volumes)
- les scripts SQL générés
- les backups créés
- les commits réalisés
- l’état final des branches
- les recommandations pour les prochaines opérations

===========================================================
🚀 ACTION
===========================================================

Commence maintenant par **l’ÉTAPE 1 — ANALYSE PRÉLIMINAIRE (NON DESTRUCTIVE)**,  
décris-moi précisément la situation, puis attends ma validation avant toute action.
