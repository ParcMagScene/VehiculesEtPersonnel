# 📚 Documentation eM@g

> Index global de la documentation du projet eM@g.

---

## 📇 Index API Global

→ **[API-INDEX.md](API-INDEX.md)** — Référence exhaustive : toutes les sections, routes API, tables DB, modules, glossaire et dépendances entre documents.

---

## Structure documentaire

### 📐 01-Architecture
- [ARCHITECTURE.md](01-Architecture/ARCHITECTURE.md) — Architecture technique complète (DB, API, composants, catalogue, deep linking, dépôts)

### 🔒 02-Securite
- [SECURITY.md](02-Securite/SECURITY.md) — Politique de sécurité, vulnérabilités connues, procédures de signalement
- [AUDIT.md](02-Securite/AUDIT.md) — Audit technique unifié (Juillet 2025 + Mars 2026) — vulnérabilités, correctifs, plans d'action

### 📖 03-Guides
- [GUIDE_UTILISATEUR.md](03-Guides/GUIDE_UTILISATEUR.md) — Guide de démarrage rapide pour les utilisateurs
- [GUIDE_DEVELOPPEUR.md](03-Guides/GUIDE_DEVELOPPEUR.md) — Installation, configuration, déploiement, commandes

### ⚙️ 04-Operations
- [CHECKLIST_PRODUCTION.md](04-Operations/CHECKLIST_PRODUCTION.md) — Checklist pré-déploiement production
- [PLAN_MAINTENANCE.md](04-Operations/PLAN_MAINTENANCE.md) — Cycles de maintenance, monitoring, procédures

### 📋 05-Specs
- [README.md](05-Specs/README.md) — Index complet des spécifications, prompts et taxonomies
- [Taxonomie_Unifiee.md](05-Specs/Taxonomie_Unifiee.md) — ✅ Référence des 13 familles, catégories, types
- [Taxonomie_Fournisseurs_Marques_Modeles.md](05-Specs/Taxonomie_Fournisseurs_Marques_Modeles.md) — ✅ Référence fournisseurs, marques, modèles
- [Annotations_PDF_ViT.md](05-Specs/Annotations_PDF_ViT.md) — 🔴 Spec future : Annotations PDF + Vision Transformer
- [MODULE_VIDEO.md](05-Specs/MODULE_VIDEO.md) — 🔴 Spec future : Module vidéo WebRTC
- [MODE_VS_CODE.md](05-Specs/MODE_VS_CODE.md) — 🟢 Thème VS Code (implémenté)
- [Directives_Audit.md](05-Specs/Directives_Audit.md) — Prompt Copilot pour audit technique
- [Reorganisation_Monorepo.md](05-Specs/Reorganisation_Monorepo.md) — Spec de la migration monorepo (✅ réalisée)

### 🎨 DesignSystem
- [DesignSystem.md](DesignSystem/DesignSystem.md) — Documentation de référence du Design System (43 composants, tokens, thèmes)
- [Etape1-Analyse.md](DesignSystem/Etape1-Analyse.md) — Analyse UI complète
- [Etape2-Tokens.md](DesignSystem/Etape2-Tokens.md) — Tokens de design (380+ variables CSS)
- [Etape3-Atomes.md](DesignSystem/Etape3-Atomes.md) — 10 composants atomiques
- [Etape4-Molecules.md](DesignSystem/Etape4-Molecules.md) — 11 composants moléculaires
- [Etape5-Organismes.md](DesignSystem/Etape5-Organismes.md) — 16 organismes & templates
- [Etape6-ReglesUX.md](DesignSystem/Etape6-ReglesUX.md) — Règles UX (10 catégories)
- [Etape7-Themes.md](DesignSystem/Etape7-Themes.md) — 5 thèmes, 3 axes, 40 combinaisons
- [Etape8-Documentation.md](DesignSystem/Etape8-Documentation.md) — Documentation automatique
- [Etape9-PlanMigration.md](DesignSystem/Etape9-PlanMigration.md) — Plan de migration (6 phases, 55-72h)
- [Etape10-RapportFinal.md](DesignSystem/Etape10-RapportFinal.md) — Rapport final de synthèse

### 📝 06-Changelog
- [SilentRefresh.md](06-Changelog/SilentRefresh.md) — Spec du Silent JWT Refresh (✅ implémenté)
- [CHANGELOG_API.md](06-Changelog/CHANGELOG_API.md) — Changelog des endpoints API
- [CHANGELOG_DB.md](06-Changelog/CHANGELOG_DB.md) — Changelog du schéma DB
- [CHANGELOG_UI.md](06-Changelog/CHANGELOG_UI.md) — Changelog frontend/UI
- [CHANGELOG_DOCS.md](06-Changelog/CHANGELOG_DOCS.md) — Changelog de la documentation

---

## 🆕 Documentation Technique (v1.0.0 — avril 2026)

### 📡 API (~243 endpoints)
- **[api/README.md](api/README.md)** — Index API (16 modules, middlewares)
- auth · vehicles · personnel · equipment · affaires · orders · stock · planning · messaging · leaves · annuaire · video · display · attachments · supplier-catalog
- → Voir tous les fichiers dans `docs/api/`

### 🗄️ Base de données (87 tables, 21 domaines)
- **[database/README.md](database/README.md)** — Vue d'ensemble schéma SQLite
- **[database/SCHEMA.md](database/SCHEMA.md)** — Schéma détaillé par domaine

### 🧩 Modules frontend (16 modules React)
- **[modules/README.md](modules/README.md)** — Index modules (hooks, contexts, services)
- auth · vehicles · personnel · equipment · affaires · orders · stock · planning · messaging · leaves · annuaire · video · display · inventory · mailing
- → Voir tous les fichiers dans `docs/modules/`

### ⚙️ Workflows
- **[workflows/state-machines.md](workflows/state-machines.md)** — 9 machines d'état (commandes, SAV, missions, congés, etc.)

### 📐 Règles métier
- **[business-rules/rules.md](business-rules/rules.md)** — Règles consolidées (IDCC 3252, SIRET, mdp, uploads, rate limiting)

### 📊 Index machine-readable
- **[docs-index.json](docs-index.json)** — Index JSON de toute la documentation (40 fichiers)

---

## Voir aussi

- [README.md](../README.md) — README principal du projet (vue d'ensemble + fonctionnalités)
