=====================================================================
PROMPT 1 — PLAN D’ACTION UNIFIÉ
=====================================================================
Tu es Copilot. Crée le fichier PLAN_ACTION_EMAG_UNIFIE.md.  
Objectif : fusionner les résultats de tous les audits (global, backend, DB, frontend, UI/UX, a11y, performance, sécurité) en un plan d’action unique, structuré et priorisé.

Structure obligatoire :
1. Résumé exécutif (vision globale, état du système, maturité technique)
2. Synthèse des audits (1 paragraphe par audit)
3. Points critiques P0 (sécurité, corruption, crashs, incohérences majeures)
4. Points importants P1 (performance, UX bloquante, modules instables)
5. Points moyens P2 (refactors, normalisation, a11y)
6. Points faibles P3 (polish, cosmétique, documentation)
7. Dépendances entre tâches (graphes logiques, prérequis)
8. Impacts potentiels (risques, bénéfices, ROI)
9. Modules concernés (planning, personnel, affaires, équipements, stock, display, GCal)
10. Risques si non traités (techniques, métier, sécurité)
11. Gains si traités (stabilité, performance, UX, sécurité)
12. Plan d’action court terme (1–2 semaines)
13. Plan d’action moyen terme (1–2 mois)
14. Plan d’action long terme (3–6 mois)

Contraintes :
- Document exhaustif, structuré, exploitable immédiatement.
- Pas de code.
- Style professionnel, clair, orienté action.

=====================================================================
PROMPT 2 — BACKLOG TECHNIQUE PRIORISÉ
=====================================================================
Tu es Copilot. Crée le fichier BACKLOG_TECHNIQUE_PRIORISE.md.  
Objectif : transformer le plan d’action unifié en backlog opérationnel.

Structure obligatoire :
1. Priorité 0 — Critique  
   - Pour chaque tâche : description, module, impact, dépendances, complexité, durée, risques, livrables.
2. Priorité 1 — Haute  
   - Même structure.
3. Priorité 2 — Moyenne  
   - Même structure.
4. Priorité 3 — Faible  
   - Même structure.

Contraintes :
- Format prêt à être importé dans un outil de gestion de projet.
- Pas de code.
- Style concis, orienté exécution.

=====================================================================
PROMPT 3 — BRANCHES D’AUDIT ET DE CORRECTION
=====================================================================
Tu es Copilot. Crée le fichier BRANCHES_AUDIT_CORRECTION.md.  
Objectif : définir toutes les branches nécessaires pour corriger les audits.

Structure obligatoire :
1. Branches d’audit : audit/global, audit/backend, audit/db, audit/frontend, audit/uiux, audit/a11y, audit/perf, audit/security.
2. Branches de correction : fix/global/<issue>, fix/backend/<issue>, etc.
3. Règles de merge : uniquement vers dev, jamais vers main.
4. Règles de commit : Conventional Commits strict.
5. Règles de PR : description, motivation, captures, changelog.
6. Règles de review : 1 reviewer minimum, CI verte obligatoire.
7. Règles CI : lint, tests, build, docs:check.

Contraintes :
- Pas de code.
- Document opérationnel pour gouvernance.

=====================================================================
PROMPT 4 — SYSTÈME DE STABILISATION CONTINUE
=====================================================================
Tu es Copilot. Crée le fichier STABILISATION_CONTINUE.md.  
Objectif : définir un système complet de stabilisation continue pour eM@g.

Structure obligatoire :
1. Lint strict (backend + frontend)
2. Tests obligatoires avant merge (Husky + CI)
3. CI/CD renforcée (build séparés, tests DB init, tests migrations)
4. Audit mensuel automatique (workflow GitHub)
5. Vérification documentaire automatique (docs:check)
6. Tests API smoke
7. Tests UI smoke
8. Conditions de succès
9. Processus de validation
10. Règles de non-régression

Contraintes :
- Pas de code.
- Document normatif.

=====================================================================
PROMPT 5 — STABILISATION DES MODULES CRITIQUES
=====================================================================
Tu es Copilot. Crée le fichier STABILISATION_MODULES_CRITIQUES.md.  
Objectif : analyser et stabiliser les modules critiques.

Modules obligatoires :
- Planning
- Personnel
- Affaires
- Équipements
- Stock
- Display
- Google Calendar

Pour chaque module :
1. Analyse des risques
2. Problèmes connus
3. Corrections nécessaires
4. Refactors recommandés
5. Normalisations
6. Tests à ajouter
7. Dépendances
8. Impacts

Contraintes :
- Pas de code.
- Document orienté refactor et stabilisation.

=====================================================================
PROMPT 6 — DESIGN SYSTEM TECHNIQUE
=====================================================================
Tu es Copilot. Crée le fichier DESIGN_SYSTEM_TECHNIQUE.md.  
Objectif : définir un design system technique complet pour eM@g.

Sections obligatoires :
1. Patterns backend (routes, services, middlewares, transactions)
2. Patterns DB (FK, PK, index, migrations)
3. Patterns API (naming, payloads, erreurs)
4. Patterns React (hooks, state, props, DS)
5. Patterns modals (structure, a11y, fermeture)
6. Patterns hooks (naming, logique, side-effects)
7. Patterns navigation (desktop/mobile, URL = vérité)
8. Patterns tests (unitaires, intégration, UI, DB)

Contraintes :
- Pas de code.
- Document de référence technique.

=====================================================================
PROMPT 7 — ROADMAP EMAG 3.0.0
=====================================================================
Tu es Copilot. Crée le fichier ROADMAP_EMAG_3_0_0.md.  
Objectif : définir la roadmap de la version majeure eM@g 3.0.0.

Contenu obligatoire :
1. Vision 3.0.0
2. API v2 versionnée
3. Pagination cursor-based
4. WebSocket temps réel
5. Refactor modules lourds
6. DS complet
7. Responsive mobile-first
8. PWA offline-first
9. i18n
10. Optimisation DB
11. Refactor planning
12. Refactor personnel
13. Refactor affaires
14. Refactor stock
15. Refactor équipements
16. Jalons
17. Dépendances
18. Risques
19. Livrables

Contraintes :
- Pas de code.
- Document stratégique long terme.

=====================================================================
PROMPT 8 — SCRIPT D’ORCHESTRATION DES AUDITS
=====================================================================
Tu es Copilot. Crée le fichier SCRIPT_ORCHESTRATION_AUDITS.md.  
Objectif : décrire un script conceptuel qui exécute automatiquement tous les audits.

Structure obligatoire :
1. Ordre d’exécution : global → backend → DB → frontend → UI/UX → a11y → performance → sécurité
2. Dépendances entre audits
3. Conditions de succès
4. Sorties attendues
5. Rapports générés
6. Intégration CI
7. Processus de validation
8. Processus de publication

Contraintes :
- Pas de code.
- Document conceptuel.

=====================================================================
PROMPT 9 — TABLEAU DE BORD QUALITÉ
=====================================================================
Tu es Copilot. Crée le fichier DASHBOARD_QUALITE.md.  
Objectif : définir un tableau de bord qualité complet pour eM@g.

Sections obligatoires :
1. Score backend
2. Score frontend
3. Score DB
4. Score sécurité
5. Score performance
6. Score UX
7. Score a11y
8. Score documentation
9. Métriques
10. Seuils
11. Couleurs
12. Alertes
13. Tendances
14. Rapports mensuels

Contraintes :
- Pas de code.
- Document orienté monitoring qualité.

=====================================================================
PROMPT 10 — SYSTÈME DE NON-RÉGRESSION
=====================================================================
Tu es Copilot. Crée le fichier NON_REGRESSION_SYSTEM.md.  
Objectif : définir un système complet de non-régression pour eM@g.

Sections obligatoires :
1. Règles de PR
2. Règles de merge
3. Règles de tests
4. Règles de documentation
5. Règles de versioning
6. Règles de sécurité
7. Règles de navigation
8. Règles de Design System
9. Règles de modals
10. Règles a11y
11. Mécanismes de contrôle
12. Outils
13. Workflows
14. Obligations

Contraintes :
- Pas de code.
- Document normatif final.
