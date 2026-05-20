# 📚 Documentation eM@g

> Index global de la documentation du projet eM@g — v2.6.0 (avril 2026)

---

## 📇 Index API Global

→ **[API-INDEX.md](API-INDEX.md)** — Référence exhaustive : routes API, tables DB, modules, glossaire et dépendances entre documents.

---

## Structure documentaire

### 📐 01-Architecture
- [ARCHITECTURE.md](01-Architecture/ARCHITECTURE.md) — Architecture technique complète (monorepo apps/, DB, API, composants, catalogue, deep linking, dépôts)
- [SCHEMA_DB.md](01-Architecture/SCHEMA_DB.md) — Schéma détaillé de la base de données SQLite par domaine

### 🔒 02-Securite
- [SECURITY.md](02-Securite/SECURITY.md) — Politique de sécurité, vulnérabilités connues, procédures de signalement
- [AUDIT.md](02-Securite/AUDIT.md) — Audit technique unifié (Juillet 2025 + Mars 2026)
- [AUDITS_OVERVIEW.md](02-Securite/AUDITS_OVERVIEW.md) — Vue d'ensemble des audits réalisés

### 📖 03-Guides
- [GUIDE_UTILISATEUR.md](03-Guides/GUIDE_UTILISATEUR.md) — Guide de démarrage rapide pour les utilisateurs
- [GUIDE_DEVELOPPEUR.md](03-Guides/GUIDE_DEVELOPPEUR.md) — Installation, configuration, déploiement, commandes
- [GUIDE_GOOGLE_OAUTH2.md](03-Guides/GUIDE_GOOGLE_OAUTH2.md) — Configuration Google OAuth2 et Calendar
- [GUIDE_SONOS.md](03-Guides/GUIDE_SONOS.md) — Module Sonos : architecture, discovery, contrôle

### ⚙️ 04-Operations
- [CHECKLIST_PRODUCTION.md](04-Operations/CHECKLIST_PRODUCTION.md) — Checklist pré-déploiement production
- [PLAN_MAINTENANCE.md](04-Operations/PLAN_MAINTENANCE.md) — Cycles de maintenance, monitoring, procédures
- [ROLLBACK_PLAN.md](04-Operations/ROLLBACK_PLAN.md) — Procédures de rollback en cas d'incident

### 📋 05-Specs
- [README.md](05-Specs/README.md) — Index des spécifications
- [SONOS_FULL_GUI_PLAN.md](05-Specs/SONOS_FULL_GUI_PLAN.md) — Plan GUI Sonos complet
- [UNIFICATION_PERSONS_DRIVERS.md](05-Specs/UNIFICATION_PERSONS_DRIVERS.md) — Design doc unification persons/drivers
- [Annotations_PDF_ViT.md](05-Specs/Annotations_PDF_ViT.md) — 🔴 Spec future : Annotations PDF + Vision Transformer
- [MODULE_VIDEO.md](05-Specs/MODULE_VIDEO.md) — 🔴 Spec future : Module vidéo WebRTC
- [MODE_VS_CODE.md](05-Specs/MODE_VS_CODE.md) — 🟢 Thème VS Code (implémenté)
- [taxonomie-unifiee.md](05-Specs/taxonomie-unifiee.md) — Référence des 13 familles, catégories, types
- [taxonomie-fournisseurs.md](05-Specs/taxonomie-fournisseurs.md) — Référence fournisseurs, marques, modèles
- [uniformisation-categories.md](05-Specs/uniformisation-categories.md) — Uniformisation des catégories
- [uniformisation-marques-societes.md](05-Specs/uniformisation-marques-societes.md) — Uniformisation marques et sociétés
- [maintenance-auto-taxonomie.md](05-Specs/maintenance-auto-taxonomie.md) — Maintenance automatique taxonomie
- [images-generiques.md](05-Specs/images-generiques.md) — Génération d'images génériques

### 🎨 DesignSystem
- [DesignSystem.md](DesignSystem/DesignSystem.md) — Documentation de référence du Design System (43 composants, tokens, thèmes)
- [Etape1-Analyse.md](DesignSystem/Etape1-Analyse.md) → [Etape10-RapportFinal.md](DesignSystem/Etape10-RapportFinal.md) — 10 étapes de conception
- [HEX_RESIDUELS.md](DesignSystem/HEX_RESIDUELS.md) — Suivi des couleurs hex résiduelles

### 📝 06-Changelog
- [CHANGELOG_API.md](06-Changelog/CHANGELOG_API.md) — Changelog des endpoints API
- [CHANGELOG_DB.md](06-Changelog/CHANGELOG_DB.md) — Changelog du schéma DB
- [CHANGELOG_UI.md](06-Changelog/CHANGELOG_UI.md) — Changelog frontend/UI
- [CHANGELOG_DOCS.md](06-Changelog/CHANGELOG_DOCS.md) — Changelog de la documentation

### 🗃️ 07-Archive
Documents historiques conservés pour référence : audits terminés, plans achevés, specs réalisées.
→ Voir [docs/07-Archive/](07-Archive/)

---

## Documentation Technique

### 🧪 Tests & Qualité
- **523+ tests** automatisés (46 fichiers Vitest + 5 fichiers node:test backend)
- **Validation Zod** sur 43 endpoints (schemas `apps/api/schemas/`)
- **CI** : GitHub Actions (`ci.yml` + `protect-prod.yml`)

### 📡 API (~431 endpoints)
- **[api/README.md](api/README.md)** — Index API (18 modules, middlewares)
- auth · vehicles · personnel · equipment · affaires · orders · stock · planning · messaging · leaves · annuaire · video · display · attachments · supplier-catalog · sonos · mailing
- → Voir tous les fichiers dans `docs/api/`

### ⚙️ Workflows
- **[workflows/state-machines.md](workflows/state-machines.md)** — 9 machines d'état (commandes, SAV, missions, congés, etc.)

### 📐 Règles métier
- **[business-rules/rules.md](business-rules/rules.md)** — Règles consolidées (IDCC 3252, SIRET, mdp, uploads, rate limiting)

### 📊 Index machine-readable
- **[docs-index.json](docs-index.json)** — Index JSON de toute la documentation

---

## Voir aussi

- [README.md](../README.md) — README principal du projet
- [CHANGELOG.md](../CHANGELOG.md) — Changelog unifié
- [ROADMAP.md](../ROADMAP.md) — Roadmap produit
- [CODING_STANDARDS.md](../CODING_STANDARDS.md) — Conventions de code
