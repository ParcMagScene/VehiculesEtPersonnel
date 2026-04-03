# Changelog des Prompts — eM@g

> Toute évolution d'un prompt versionné doit être documentée ici.
> Format : [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

---

## [v1.0.0] - 2026-03-30
### Prompt: taxonomie
- Ajout : prompt maître v1.0.0 — familles, marques, alias, brandHelpers, migrations
- Notes : couvre les 13 familles, 87 marques, 64 alias

### Prompt: fournisseurs_catalogue
- Ajout : prompt maître v1.0.0 — import catalogues, mapping ALGAM, enrichissement automatique
- Notes : flux complet CSV/PDF → enrichArticle → stockage

### Prompt: images_generiques
- Ajout : prompt maître v1.0.0 — génération SVG placeholder par famille d'équipement
- Notes : 7 familles couvertes avec couleurs et icônes

### Prompt: design_system
- Ajout : prompt maître v1.0.0 — 147+ tokens CSS, 3 niveaux (primitives/sémantiques/composants)
- Notes : couvre atomes, molécules, organismes, 3 thèmes (principal, compact, TV)

### Prompt: gui_conventions
- Ajout : prompt maître v1.0.0 — patterns Panel, Toolbar, Table, Dialog, Toast, Tabs, Status
- Notes : templates JSX complets avec exemples de code

### Prompt: sync_dev_prod
- Ajout : prompt maître v1.0.0 — sync bidirectionnelle non destructive dev ↔ prod
- Notes : tables exclues, tables timestamp-only, workflow complet en 4 étapes

### Prompt: migrations
- Ajout : prompt maître v1.0.0 — format de migration, safeAddColumn, _migrations_log
- Notes : conventions de nommage, idempotence, transactions

### Prompt: refactors
- Ajout : prompt maître v1.0.0 — principes, conventions de nommage, checklist, interdictions
- Notes : couvre backend Express + frontend React

### Prompt: operations_sensibles
- Ajout : prompt maître v1.0.0 — déploiement, backup, PM2, démarrage dev, gestion d'incidents
- Notes : safe-deploy.sh, backup-databases.sh, dev-start.sh

## [init] - 2026-03-30
### Système de versioning
- Ajout : structure `/prompts/` avec sous-dossiers `masters/`, `operations/`, `design/`, `sync/`, `gui/`, `taxonomie/`, `archive/`
- Ajout : `prompts-index.json` — index centralisé de toutes les versions
- Ajout : `CHANGELOG_PROMPTS.md` — ce fichier
- Notes : aucun prompt maître encore généré — en attente de validation de la structure
