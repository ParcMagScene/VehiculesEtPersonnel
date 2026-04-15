# 🗺️ PLAN DE REFONTE & ROADMAP — eM@g

> **Date** : 15 avril 2026
> **Branche** : `feature/sonos-full-gui`
> **Prérequis** : [AUDIT_COMPLET.md](AUDIT_COMPLET.md) (Score B- 67%) + [DESIGN_SYSTEM_EMAG.md](DESIGN_SYSTEM_EMAG.md) (Score A- 85%)
> **Règle absolue** : ❌ NE JAMAIS TOUCHER À LA PRODUCTION sans autorisation écrite

---

## TABLE DES MATIÈRES

1. [Principes directeurs](#1-principes-directeurs)
2. [Axes de refonte (6 chantiers)](#2-axes-de-refonte-6-chantiers)
3. [Roadmap en 6 phases](#3-roadmap-en-6-phases)
4. [Phase 1 — Fondations & sécurité](#4-phase-1--fondations--sécurité)
5. [Phase 2 — Composants monstres](#5-phase-2--composants-monstres)
6. [Phase 3 — Mobile & responsive](#6-phase-3--mobile--responsive)
7. [Phase 4 — Backend consolidation](#7-phase-4--backend-consolidation)
8. [Phase 5 — Tests & CI/CD](#8-phase-5--tests--cicd)
9. [Phase 6 — Polish & documentation](#9-phase-6--polish--documentation)
10. [Dépendances entre phases](#10-dépendances-entre-phases)
11. [Critères de validation](#11-critères-de-validation)
12. [Risques & mitigations](#12-risques--mitigations)
13. [Cible — Scores attendus](#13-cible--scores-attendus)

---

## 1. PRINCIPES DIRECTEURS

| # | Principe | Explication |
|---|---------|-------------|
| P1 | **Zéro régression** | Chaque changement passe les 485 tests existants avant commit |
| P2 | **Incrémental** | Petits commits ciblés, pas de big-bang refactoring |
| P3 | **Branch dev uniquement** | Tout se fait sur `feature/sonos-full-gui` ou sous-branches |
| P4 | **Tests d'abord** | Ajouter les tests AVANT de refactoriser un composant |
| P5 | **Un fichier = une responsabilité** | Aucun fichier > 500 lignes après refonte |
| P6 | **Design System first** | Tout nouveau code utilise les tokens et composants DS |
| P7 | **Pas de sur-ingénierie** | Ne pas abstraire ce qui n'est utilisé qu'une fois |

---

## 2. AXES DE REFONTE (6 chantiers)

| Axe | Origine audit | Problèmes | Impact |
|-----|---------------|-----------|--------|
| **A. Sécurité & validation** | B1, SEC1 | 6 routes sans Zod, endpoints non protégés | 🔴 Critique |
| **B. Composants géants** | F1, U5 | 5 fichiers > 2500L, surcharge cognitive | 🔴 Critique |
| **C. Mobile** | M1, M2 | Routing par state, app séparée, 0 tests | 🟠 Élevé |
| **D. Backend** | B2-B4, D1-D3 | Erreurs incohérentes, FK manquantes, duplication DB | 🟠 Élevé |
| **E. Tests & CI** | TS1-TS5 | Features 0%, mobile 0%, pas de CI GitHub | 🟠 Élevé |
| **F. CSS & polish** | C1-C6, U1-U2 | Hex bruts, z-index, a11y | 🟡 Moyen |

---

## 3. ROADMAP EN 6 PHASES

```
Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4 ──── Phase 5 ──── Phase 6
Fondations   Monstres     Mobile       Backend      Tests+CI     Polish
  ✅           ✅           ✅         ~2 semaines  ~2 semaines  ~1 semaine
```

**Vue séquentielle avec dépendances** :

```
Phase 1 (Fondations) ─────────────┐
  ├── Zod 6 routes                │
  ├── Z-index fix                 │
  ├── Hex bruts cleanup           │
  └── DS: BottomSheet, Skeleton   │
                                  ↓
Phase 2 (Monstres) ──────────────┐
  ├── EquipmentPanel → 6 sous    │
  ├── Calendar → 4 sous          │
  ├── OrdersPanel → 5 sous       │
  ├── TaskPlanningPanel → 4 sous │
  └── Header → 3 sous            │
                                  ↓
Phase 3 (Mobile) ────────────────┐
  ├── React Router mobile        │
  ├── Composants DS partagés     │
  └── BottomSheet standardisé    │
                                  ↓
Phase 4 (Backend) ───────────────┐
  ├── Format erreur unifié       │
  ├── Logger structuré           │
  ├── FK manquantes              │
  └── Unifier persons/drivers    │
                                  ↓
Phase 5 (Tests + CI) ────────────┐
  ├── Tests features (top 5)     │
  ├── Tests mobile (hooks)       │
  ├── GitHub Actions CI          │
  └── E2E Playwright (smoke)     │
                                  ↓
Phase 6 (Polish)
  ├── a11y (aria-pressed, aria-live)
  ├── Storybook DS
  └── Documentation consolidée
```

---

## 4. PHASE 1 — FONDATIONS & SÉCURITÉ

**Objectif** : Corriger les problèmes critiques et poser les bases pour la refonte.

### 4.1 Tâches

| # | Tâche | Fichier(s) cible | Sévérité | Effort |
|---|-------|------------------|----------|--------|
| 1.1 | Ajouter validation Zod à `catalogRoutes.js` | catalogRoutes.js | 🔴 | 2h |
| 1.2 | Ajouter validation Zod à `inventoryRoutes.js` | inventoryRoutes.js | 🔴 | 2h |
| 1.3 | Ajouter validation Zod à `supplierCatalogRoutes.js` | supplierCatalogRoutes.js | 🔴 | 1.5h |
| 1.4 | Ajouter validation Zod à `displayRoutes.js` | displayRoutes.js | 🔴 | 2h |
| 1.5 | Ajouter validation Zod à `sonosRoutes.js` | sonosRoutes.js | 🔴 | 1.5h |
| 1.6 | Ajouter validation Zod à `cameraRoutes.js` | cameraRoutes.js | 🔴 | 1h |
| 1.7 | Protéger `GET /api/display/welcome-message` (requireAuth) | displayRoutes.js | 🟡 | 15min |
| 1.8 | Remplacer 3 z-index hardcodés par tokens | AnnuairePanel.css, App.css, MobileApp.css | 🟡 | 30min |
| 1.9 | Tokeniser hex bruts dans InventoryPanel.css | InventoryPanel.css | 🟠 | 1h |
| 1.10 | Migrer ErrorBoundary inline styles → tokens | ErrorBoundary.jsx | 🟡 | 30min |
| 1.11 | Tokeniser font-size brutes dans AnnuairePanel.css | AnnuairePanel.css | 🟡 | 30min |
| 1.12 | Simplifier fallback CSS var imbriqués | AnnuairePanel.css, ContactsCSVImportDialog.css | 🟡 | 30min |
| 1.13 | Créer composant DS `Skeleton` | components/ui/Skeleton.jsx | 🟡 | 2h |
| 1.14 | Créer composant DS `BottomSheet` | components/ui/BottomSheet.jsx | 🟡 | 3h |

### 4.2 Critères de succès Phase 1

- [ ] 0 route API sans validation Zod
- [ ] 0 z-index hardcodé
- [ ] 0 hex brut dans InventoryPanel.css
- [ ] 2 nouveaux composants DS avec tests
- [ ] 485+ tests passent (0 régression)

---

## 5. PHASE 2 — COMPOSANTS MONSTRES

**Objectif** : Découper les 5 composants > 2500 lignes en sous-composants < 500L.

### 5.1 Stratégie de découpage

**Principe** : Chaque composant monstre est découpé en :
1. **Container** (~100L) — État, data fetching, orchestration
2. **Sous-composants** (~200-400L chacun) — UI spécialisée
3. **Hooks** (~50-150L) — Logique réutilisable extraite

### 5.2 EquipmentPanel.jsx (3166L → ~6 fichiers)

| Sous-composant | Responsabilité | Lignes estimées |
|----------------|---------------|:--:|
| `EquipmentPanel.jsx` | Container + layout | ~150 |
| `EquipmentList.jsx` | Tableau + filtres + recherche | ~400 |
| `EquipmentDetail.jsx` | Fiche détail + édition | ~400 |
| `EquipmentForm.jsx` | Formulaire création/édition | ~350 |
| `EquipmentSAV.jsx` | Tickets SAV + historique | ~300 |
| `useEquipment.js` | Hook état + CRUD + filtrage | ~200 |

### 5.3 Calendar.jsx (2744L → ~5 fichiers)

| Sous-composant | Responsabilité | Lignes estimées |
|----------------|---------------|:--:|
| `Calendar.jsx` | Container + layout | ~150 |
| `CalendarGrid.jsx` | Grille mois/semaine/jour | ~400 |
| `CalendarEvent.jsx` | Rendu événement + drag | ~250 |
| `CalendarToolbar.jsx` | Navigation + vues + filtres | ~200 |
| `useCalendar.js` | Hook état + navigation + events | ~250 |

### 5.4 OrdersPanel.jsx (2621L → ~6 fichiers)

| Sous-composant | Responsabilité | Lignes estimées |
|----------------|---------------|:--:|
| `OrdersPanel.jsx` | Container + layout | ~150 |
| `OrdersList.jsx` | Tableau + statuts + tri | ~350 |
| `OrderDetail.jsx` | Détail commande | ~350 |
| `OrderForm.jsx` | Formulaire création | ~300 |
| `OrderLines.jsx` | Lignes de commande | ~300 |
| `useOrders.js` | Hook état + CRUD + validation | ~200 |

### 5.5 TaskPlanningPanel.jsx (2592L → ~5 fichiers)

| Sous-composant | Responsabilité | Lignes estimées |
|----------------|---------------|:--:|
| `TaskPlanningPanel.jsx` | Container + layout | ~150 |
| `PlanningTimeline.jsx` | Vue timeline | ~400 |
| `TaskBoard.jsx` | Kanban / liste tâches | ~350 |
| `TaskForm.jsx` | Formulaire tâche + assignation | ~300 |
| `useTaskPlanning.js` | Hook état + filtres + CRUD | ~200 |

### 5.6 Header.jsx (1101L → ~4 fichiers)

| Sous-composant | Responsabilité | Lignes estimées |
|----------------|---------------|:--:|
| `Header.jsx` | Shell + layout | ~100 |
| `HeaderNav.jsx` | Navigation modules | ~200 |
| `HeaderNotifications.jsx` | Badge + panel notifications | ~250 |
| `HeaderProfile.jsx` | Profile + theme + settings | ~200 |

### 5.7 Critères de succès Phase 2

- [ ] 0 fichier composant > 500 lignes (tolérance 600L pour les panneaux complexes)
- [ ] Chaque sous-composant est auto-suffisant et testable isolément
- [ ] Le comportement visuel et fonctionnel est identique (0 régression UX)
- [ ] 485+ tests passent

---

## 6. PHASE 3 — MOBILE & RESPONSIVE ✅

**Objectif** : Moderniser l'architecture mobile pour la rendre maintenable et testable.

### 6.1 Tâches

| # | Tâche | Détail | Effort | Statut |
|---|-------|--------|--------|--------|
| 3.1 | Intégrer un router hash pour le mobile | Hook `useMobileRouter` — bookmarks, back, refresh, QR deep links | 3h | ✅ |
| 3.2 | Standardiser les bottom sheets | `BottomSheet` DS dans MobileApp (user menu) + MobileLogin (reset password) | 4h | ✅ |
| 3.3 | Ajouter `Skeleton` loading | `MobileListSkeleton` (3 variants) sur 5 écrans mobile | 2h | ✅ |
| 3.4 | Migrer MobileApp.css monolithique | 1041L → 558L + `MobileSheet.css` + `MobileModuleWrapper.css` co-localisés | 3h | ✅ |
| 3.5 | Améliorer la détection mobile | `window.matchMedia('(pointer: coarse)')` + resize listener | 1h | ✅ |
| 3.6 | Adapter les composants DS au mobile | Button/Input/Modal: touch targets 44px, `font-size: 16px` iOS, footer colonne | 2h | ✅ |

### 6.2 Critères de succès Phase 3

- [x] Navigation mobile avec URL (bookmarkable, back browser fonctionne)
- [x] Skeleton loading visible sur chaque écran mobile
- [x] MobileApp.css éclaté en fichiers co-localisés
- [x] 413+ tests passent

---

## 7. PHASE 4 — BACKEND CONSOLIDATION ✅

**Objectif** : Uniformiser les patterns backend et corriger les incohérences DB.

### 7.1 Tâches

| # | Tâche | Détail | Statut |
|---|-------|--------|--------|
| 4.1 | Uniformiser le format d'erreur API | `success: false` ajouté à 998 réponses erreur + normalisation mutations | ✅ |
| 4.2 | Ajouter un middleware de logging | `httpLogger.js` — method, path, status, duration (skip health/assets) | ✅ |
| 4.3 | Remplacer console.log dans import-backup.js | Migré vers logger structuré (24 occurrences) | ✅ |
| 4.4 | Ajouter les FK manquantes + indexes | `vehicles.assigned_to → persons.id` + idx_vehicles_assigned_to, idx_ta_reservation, idx_ta_source | ✅ |
| 4.5 | Planifier unification persons/drivers | Design doc: `docs/05-Specs/UNIFICATION_PERSONS_DRIVERS.md` | ✅ |
| 4.6 | Normaliser task_assignments | Table déjà bien structurée ; ajout indexes manquants (reservation_id, source) | ✅ |
| 4.7 | Supprimer dead code adminRoutes | Commentaire orphelin supprimé ; endpoints tous actifs | ✅ |
| 4.8 | Extraire constantes magic numbers displayRoutes | `TIME_SLOTS` objet (MATIN_END, MATINEE_END, MIDI_END, APRES_MIDI_END) | ✅ |

### 7.2 Critères de succès Phase 4

- [x] Format erreur unifié sur 100% des endpoints
- [x] Logger structuré actif (pas de console.log)
- [x] FK manquantes ajoutées
- [x] 413 tests passent (zéro régression)

---

## 8. PHASE 5 — TESTS & CI/CD

**Objectif** : Atteindre une couverture tests significative et automatiser le CI.

### 8.1 Tâches

| # | Tâche | Détail | Effort |
|---|-------|--------|--------|
| 5.1 | Tests pour EquipmentList (post-refonte Phase 2) | Render, filtrage, tri, sélection | 4h |
| 5.2 | Tests pour OrdersList (post-refonte Phase 2) | Render, statuts, actions | 3h |
| 5.3 | Tests pour CalendarGrid (post-refonte Phase 2) | Render, navigation, events | 4h |
| 5.4 | Tests pour TaskBoard (post-refonte Phase 2) | Render, drag, statuts | 3h |
| 5.5 | Tests pour HeaderNav + HeaderNotifications | Navigation, badges, panel | 3h |
| 5.6 | Tests hooks mobile (useSwipeBack, usePullToRefresh) | Gestes, résultat | 2h |
| 5.7 | Tests useSonos hook | Mock API, polling, actions | 2h |
| 5.8 | GitHub Actions CI workflow | `npm test` + `vitest run` + `npm run build` sur push/PR | 3h |
| 5.9 | E2E smoke test Playwright | Login → navigation → CRUD basique (1 scénario) | 4h |

### 8.2 Objectifs de couverture

| Domaine | Actuel | Cible Phase 5 |
|---------|--------|---------------|
| DS composants | 100% (355) | 100% |
| Features desktop | ~5% (45) | ~30% (+~80 tests) |
| Mobile hooks | 0% | ~50% (+~15 tests) |
| Backend | ~40% (85) | ~50% (+~20 tests) |
| E2E | 0% | 1 scénario smoke |
| **Total** | **485** | **~600+** |

### 8.3 Critères de succès Phase 5

- [ ] 600+ tests passent
- [ ] GitHub Actions CI vert sur push
- [ ] 1 scenario E2E Playwright opérationnel
- [ ] Couverture features desktop ≥ 25%

---

## 9. PHASE 6 — POLISH & DOCUMENTATION

**Objectif** : Finaliser les détails UX, accessibilité et documentation.

### 9.1 Tâches

| # | Tâche | Détail | Effort |
|---|-------|--------|--------|
| 6.1 | Ajouter `aria-pressed` aux Toggle/boutons toggle | DS Toggle + feature toggles | 1h |
| 6.2 | Ajouter `aria-live="polite"` aux toasts/notifications | Système de notification | 1h |
| 6.3 | Ajouter skip-to-content link | Layout principal | 30min |
| 6.4 | Audit contraste mode sombre | Vérifier ratio WCAG 2.1 AA sur toutes les palettes | 3h |
| 6.5 | Initialiser Storybook | Config + stories pour les 16 atomes DS | 4h |
| 6.6 | Consolider la documentation | Fusionner les AUDIT_*.md redondants, mettre à jour API-INDEX | 3h |
| 6.7 | Nettoyer ~510 hex résiduels (lot final) | Fichiers features — tokeniser ou documenter comme intentionnels | 4h |
| 6.8 | Gestion offline TV client | Cache local + fallback si API down | 3h |

### 9.2 Critères de succès Phase 6

- [ ] WCAG 2.1 AA conforme sur palette default (light + dark)
- [ ] Storybook fonctionnel avec atomes DS
- [ ] Documentation à jour et sans doublons
- [ ] ≤ 100 hex résiduels (documentés comme intentionnels)

---

## 10. DÉPENDANCES ENTRE PHASES

```
Phase 1 ──→ Phase 2 (les tokens/DS doivent être prêts avant refonte composants)
Phase 1 ──→ Phase 3 (BottomSheet DS nécessaire pour mobile)
Phase 2 ──→ Phase 5 (les sous-composants doivent exister avant d'écrire les tests)
Phase 3 ──→ Phase 5 (architecture mobile stable avant tests mobile)
Phase 4 ──→ Phase 5 (format erreur unifié avant tests backend)
Phase 1-5 → Phase 6 (polish en dernier)
```

**Parallélisables** :
- Phase 3 (Mobile) et Phase 4 (Backend) peuvent se chevaucher
- Tâches 5.8 (GitHub Actions) peut démarrer dès Phase 1

---

## 11. CRITÈRES DE VALIDATION

### Par phase — Checklist globale

| Phase | Gate de validation |
|-------|-------------------|
| 1 | 0 route sans Zod · 0 z-index hardcodé · 2 composants DS ajoutés · tests ✅ |
| 2 | 0 fichier > 600L · sous-composants isolés · 0 régression UX · tests ✅ |
| 3 | Router mobile · Skeleton loading · CSS éclaté · tests ✅ |
| 4 | Format erreur unifié · Logger actif · FK ajoutées · tests ✅ |
| 5 | 600+ tests · CI GitHub Actions · 1 E2E · couverture ≥ 25% features |
| 6 | WCAG AA · Storybook · Docs consolidées · ≤ 100 hex |

### Métriques de suivi

| Métrique | Baseline actuel | Cible finale |
|----------|:--:|:--:|
| Score global audit | B- (67%) | **B+ (80%)** |
| Score Design System | A- (85%) | **A (92%)** |
| Tests totaux | 485 | **600+** |
| Fichiers > 500L | 9 | **0** |
| Routes sans Zod | 6 | **0** |
| Hex bruts résiduels | ~510 | **< 100** |
| Z-index hors tokens | 3 | **0** |
| Composants DS | 44 | **46+** |
| GitHub Actions CI | ❌ | ✅ |

---

## 12. RISQUES & MITIGATIONS

| Risque | Probabilité | Impact | Mitigation |
|--------|:-:|:-:|------------|
| Régression UX lors du découpage Phase 2 | Élevée | 🔴 | Tests visuels avant/après, screenshots, review systématique |
| Composant monstre avec état partagé complexe | Moyenne | 🟠 | Extraire l'état dans un hook dédié AVANT de découper l'UI |
| Migration persons/drivers casse des modules | Moyenne | 🔴 | Phase design séparée, migration incrémentale, rollback script |
| Router mobile casse les QR codes existants | Faible | 🟠 | Garder le pattern hash `#/mobile/equipment/EMAG-XXXXX` |
| Format erreur unifié casse le frontend | Moyenne | 🟠 | Adapter le frontend en parallèle, compatibilité ancien format temporaire |
| Storybook alourdit le build | Faible | 🟢 | Config séparée, pas dans le build prod |

---

## 13. CIBLE — SCORES ATTENDUS

### Post-Phase 6 complète

| Domaine | Actuel | Cible | Δ |
|---------|:--:|:--:|:--:|
| Architecture | B+ (78%) | A- (88%) | +10 |
| Backend API | B- (68%) | B+ (80%) | +12 |
| Frontend (code) | C+ (62%) | B+ (78%) | +16 |
| Frontend (composants) | D+ (45%) | B (72%) | +27 |
| Base de données | B (72%) | B+ (80%) | +8 |
| Client TV | B- (65%) | B (72%) | +7 |
| Mobile | C (55%) | B (72%) | +17 |
| Sonos | B (70%) | B+ (78%) | +8 |
| Design System | A- (88%) | A (92%) | +4 |
| CSS | B+ (78%) | A- (88%) | +10 |
| UX/UI | B- (65%) | B+ (78%) | +13 |
| Sécurité | B+ (80%) | A- (88%) | +8 |
| Tests | C- (48%) | B (72%) | +24 |
| CI/CD | C (55%) | B+ (78%) | +23 |
| **GLOBAL** | **B- (67%)** | **B+ (80%)** | **+13** |

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   OBJECTIF :  B- (67/100)  ───→  B+ (80/100)                ║
║                                                              ║
║   Gain net : +13 points sur 14 domaines                      ║
║   Plus fort progrès : Tests (+24), CI/CD (+23),              ║
║                       Composants (+27), Mobile (+17)         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

> ⚠️ Ce plan est une proposition. Chaque phase sera détaillée et validée individuellement avant exécution.

*Plan rédigé le 15 avril 2026 — Branche `feature/sonos-full-gui`*
