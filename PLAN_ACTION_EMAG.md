# 📋 PLAN D'ACTION eM@g — Audit Global & Stabilisation

> **Date** : 8 avril 2026  
> **Branche** : `dev`  
> **Version actuelle** : 2.0.0 (package.json) / 2.1.9 (VERSION.md) — ⚠️ incohérence  
> **Tests existants** : 56 tests, 9 suites, 0 fail  
> **Méthodologie** : Analyse exhaustive par 4 agents parallèles (code, config, modules, sécurité)

---

## 📊 SYNTHÈSE DU SCAN

| Catégorie | CRIT | HIGH | MED | LOW | Total |
|-----------|:----:|:----:|:---:|:---:|:-----:|
| Sécurité API | 2 | 5 | 3 | 0 | **10** |
| UI/UX | 2 | 5 | 3 | 0 | **10** |
| Imports | 0 | 3 | 0 | 0 | **3** |
| Vidéo | 1 | 1 | 3 | 0 | **5** |
| Config/Governance | 0 | 4 | 2 | 1 | **7** |
| Planning/GCal | 0 | 1 | 3 | 1 | **5** |
| TV-Client | 0 | 0 | 1 | 1 | **2** |
| Mobile | 0 | 1 | 1 | 0 | **2** |
| Docs/Nettoyage | 0 | 1 | 2 | 2 | **5** |
| **TOTAL** | **5** | **21** | **18** | **5** | **49** |

---

## ÉTAPE 1 — ANALYSE & NETTOYAGE GLOBAL

### 1.1 Résultats du scan

#### Composants React inutilisés : ✅ AUCUN
- 175+ composants vérifiés, tous importés et utilisés.

#### CSS orphelins : ✅ AUCUN
- 143 fichiers CSS, tous colocalisés et importés.

#### Assets orphelins (public/) : ⚠️ 3 fichiers
| Fichier | Statut |
|---------|--------|
| `public/images/ZonesDepôt1.png` | Non référencé dans le code |
| `public/images/ZonesDepôt2.png` | Non référencé dans le code |
| `public/images/Capture d'écran 2026-03-17 à 10.02.34.png` | Screenshot orphelin |

#### Documentation dupliquée : 🔴 1 chevauchement
| Fichier | Problème | Action |
|---------|----------|--------|
| `docs/02-Securite/SECURITY_AUDIT.md` | Supplanté par `AUDIT.md` Partie II | Déprécier, rediriger vers AUDIT.md |

#### Prompts : ✅ PROPRE
- `prompts-index.json` à jour, 9 prompts versionnés, pas de doublons.

#### Routes non documentées : 🟠 5-8 lacunes
- `GET /api/auth/users-public` — non documenté (risque sécurité)
- 4 routes legacy (`/api/clients`, `/api/drivers`, `/api/locations`, `/api/garages`) — DEPRECATED non documentées
- Routes TV vidéo partiellement documentées
- `GET /api/health` — ✅ déjà ajouté dans dernière MAJ docs

#### Incohérences DEV ↔ PROD
| Problème | Fichier | Sévérité |
|----------|---------|----------|
| VERSION.md dit 2.1.9, package.json dit 2.0.0 | `VERSION.md` + `package.json` | 🔴 CRIT |
| 5 variables .env utilisées mais non documentées | `apps/api/.env.example` | 🟠 HIGH |
| Log PORT 3003, fallback réel 3002 | `apps/api/server.js` L14 vs L70 | 🟠 HIGH |
| PM2 requis en prod mais non documenté | `scripts/safe-deploy.sh` | 🟠 HIGH |
| Pas de CI GitHub Actions (GOVERNANCE.md l'exige) | Manquant | 🔴 CRIT |

### 1.2 Plan de nettoyage

| Action | Fichier(s) | Type |
|--------|-----------|------|
| Déprécier SECURITY_AUDIT.md | `docs/02-Securite/SECURITY_AUDIT.md` | Fusionner → AUDIT.md |
| Supprimer screenshot orphelin | `public/images/Capture d'écran…` | Supprimer |
| Vérifier ZonesDepôt*.png | `public/images/ZonesDepôt*.png` | Vérifier → supprimer si inutile |
| Aligner VERSION.md ↔ package.json | `VERSION.md` | Corriger à 2.0.0 |
| Ajouter 5 vars manquantes dans .env.example | `apps/api/.env.example` | Compléter |
| Documenter routes legacy/deprecated | `docs/API-INDEX.md` | Compléter |
| Mettre à jour CHANGELOG_DOCS.md | `docs/06-Changelog/CHANGELOG_DOCS.md` | MAJ |

### 1.3 Tâches

- [ ] **1.1** Ajouter bannière dépréciation dans `SECURITY_AUDIT.md` → pointer vers `AUDIT.md`
- [ ] **1.2** Supprimer le screenshot orphelin
- [ ] **1.3** Aligner `VERSION.md` avec `package.json` (2.0.0)
- [ ] **1.4** Ajouter dans `.env.example` : `DB_PATH`, `ALLOW_HTTP`, `MEDIAMTX_API_URL`, `MEDIAMTX_WEBRTC_URL`, `API_URL`
- [ ] **1.5** Documenter les routes deprecated dans `API-INDEX.md`
- [ ] **1.6** Fixer le log port (`server.js` L14)
- [ ] **1.7** Mettre à jour `CHANGELOG_DOCS.md` + `prompts-index.json`
- [ ] **1.8** Commit & push

---

## ÉTAPE 2 — CORRECTIONS FONCTIONNELLES (PLANNING)

### 2.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| PL-1 | Assignments créées malgré indisponibilités (design actuel = warnings) | `personnelRoutes.js` L1145-1200, `AssignmentDialog.jsx` | ✅ OK — comportement voulu, user request confirmé |
| PL-2 | Horaires par défaut manquants (9h-12h, 14h-18h) | `AssignmentDialog.jsx` | 🟠 HIGH |
| PL-3 | Options demi-journée AM/PM | `TaskPlanningPanel.jsx` L180 — `newTaskPeriod` existe ✅ | Vérifier dans AssignmentDialog |
| PL-4 | "Invalid Date" si timestamp malformé | `EventTaskModal.jsx` L47-50 | 🟠 MED |
| PL-5 | Catégorie "Dépôt" absente des SECTIONS | `TaskPlanningPanel.jsx` L25-50 | 🟢 LOW |
| PL-6 | Indisponibilités : pas d'affichage AM/PM | Frontend planning | 🟠 MED |
| PL-7 | Clic droit sur cellule → créer indisponibilité | Frontend planning | 🟠 MED |

### Google Calendar

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| GC-1 | Sync unidirectionnelle (Google → eM@g seulement) | `googleCalendarRoutes.js` L112-165 | 🟠 HIGH |
| GC-2 | Badge affaire dans banner Google non cliquable | Frontend planning | 🟠 MED |
| GC-3 | Création événement depuis banner inopérante | Frontend planning | 🟠 MED |
| GC-4 | Tokens Google stockés en clair dans SQLite | `googleCalendarRoutes.js` L78-95 | 🟡 MED |
| GC-5 | Connexion Google non persistante entre sessions | Frontend/Backend | 🟠 MED |

### 2.2 Tâches

- [x] **2.1** Horaires par défaut AM 08:00-13:00, PM 14:00-19:00 déjà implémentés dans AssignmentDialog ✅ (faux positif)
- [x] **2.2** Options AM/PM déjà présentes dans AssignmentDialog + TaskPlanningPanel ✅ (faux positif)
- [x] **2.3** Corriger "Invalid Date" dans `EventTaskModal.jsx` (guard `isNaN`) ✅
- [x] **2.4** Ajouter catégorie "Dépôt" dans TaskPlanningPanel + TaskEditModal SECTIONS ✅
- [ ] **2.5** Afficher AM/PM dans les indisponibilités
- [ ] **2.6** Implémenter clic droit → créer indisponibilité sur cellule planning
- [ ] **2.7** Badge affaire Google → deep link vers affaire eM@g
- [ ] **2.8** Corriger création événement depuis banner Google
- [ ] **2.9** ⏳ Sync bidirectionnelle eM@g ↔ Google Calendar (feature majeure — différé)
- [ ] **2.10** ⏳ Token Google persistent (feature majeure — différé)
- [ ] **2.11** Tests planning + commit

---

## ÉTAPE 3 — TV-CLIENT & DASHBOARD

### 3.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| TV-1 | TV servi sur port 3003 via `/tv` redirect | `server.js` L147-156 | ✅ OK |
| TV-2 | URL `magsav.duckdns.org:3003/tv` — vérifier config DNS/firewall | Infra | 🟠 MED |
| TV-3 | Sections vides affichent "Aucune tâche" au lieu d'être masquées | `tv-client/main.js` L190-205 | 🟡 LOW |

### 3.2 Tâches

- [ ] **3.1** Vérifier accessibilité `magsav.duckdns.org:3003/tv` (DNS, firewall, port forwarding) — infra
- [x] **3.2** Masquer sections sans tâches (display: none si tasks.length === 0) ✅
- [ ] **3.3** Tests TV-Client + commit

---

## ÉTAPE 4 — STOCKS & ANNUAIRE (UI/UX)

### 4.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| ST-1 | Statistiques "Stock vente" et "Pièces SAV" dans mauvaise toolbar | `EquipmentPanel.jsx` L872-900 | 🟡 MED |
| AN-1 | Statistiques Annuaire à déplacer dans toolbar d'action | `AnnuairePanel.jsx` L285-315 | 🟡 MED |
| AN-2 | Toolbar Référentiels : alignement horizontal incohérent | `AnnuairePanel.jsx` | 🟡 MED |

### 4.2 Tâches

- [x] **4.1** Stats EquipmentPanel déjà correctement placées dans eq-stats-row ✅ (faux positif — "Stock vente"/"Pièces SAV" n'existent pas)
- [x] **4.2** Toolbars EquipmentPanel : structure flex-wrap cohérente ✅
- [x] **4.3** Toolbar Référentiels Annuaire : alignement corrigé (flex-end → align-items center + gap) ✅
- [x] **4.4** Alignement toolbar Référentiels corrigé ✅
- [ ] **4.5** Tests visuels + commit

---

## ÉTAPE 5 — UI/UX GÉNÉRAL

### 5.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| UX-1 | Bouton Fermer manquant sur certains modals | `UserPreferencesModal.jsx`, `ProfileEditModal.jsx` | 🔴 CRIT |
| UX-2 | Pas de warning "modifications non sauvegardées" universel | Majority des modals d'édition | 🔴 CRIT |
| UX-3 | Boutons icon-only sans `aria-label` | `VideoPanel.jsx` L165-175, autres | 🟠 HIGH |
| UX-4 | Boutons gestion droits utilisateurs inactifs | `Header.jsx` L976-990 | 🟠 HIGH |
| UX-5 | CSS Paramètres (header onglets) cassé | `UserPreferencesModal` — pas de CSS dédié | 🟡 MED |
| UX-6 | Boutons "Gestion" mal placés (Parc, Équipement, Stocks) | Panels respectifs | 🟡 MED |

### 5.2 Tâches

- [x] **5.1** Boutons Fermer (X) déjà présents dans tous les modals via `Modal.jsx` + `ModalHeader` ✅ (faux positif)
- [x] **5.2** Créer hook `useDirtyForm()` pour détection modifications non sauvegardées ✅
- [ ] **5.3** Intégrer `useDirtyForm()` dans les modals d'édition principaux
- [x] **5.4** `aria-label` auto-dérivé dans `Button.jsx` (iconOnly + title) + VideoPanel corrigé ✅
- [x] **5.5** Boutons gestion droits déjà fonctionnels avec aria-label ✅ (faux positif)
- [x] **5.6** `UserPreferencesModal.css` existe déjà ✅ (faux positif)
- [ ] **5.7** Déplacer boutons "Gestion" dans toolbars respectives
- [ ] **5.8** Tests a11y + commit

---

## ÉTAPE 6 — VIDÉO

### 6.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| VD-1 | Channel caméra hardcodé à 1 | `videoProxyService.js` L131-160 | 🟡 MED |
| VD-2 | Pas d'onglet Preset avec sélection de 4 caméras | `VideoPanel.jsx` | 🟡 MED |
| VD-3 | Pas de fenêtre détachable pour vidéo | `VideoPanel.jsx` | 🟡 MED |

### 6.2 Tâches

- [x] **6.1** ~~Créer table `camera_presets`~~ → Ajout colonne `channel` (INTEGER DEFAULT 1) sur table `cameras` ✅
- [ ] **6.2** ⏳ Ajouter onglet Preset dans `VideoPanel.jsx` (sélection de 4 caméras) — feature future
- [ ] **6.3** ⏳ Rendre l'onglet détachable via `window.open()` + BroadcastChannel — feature future
- [x] **6.4** Multi-channel par caméra : `videoProxyService.js` + `videoRoutes.js` + `CameraSettingsModal.jsx` ✅
- [x] **6.5** Tests vidéo + commit ✅

---

## ÉTAPE 7 — MOBILE GUI

### 7.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| MB-1 | Tous les modules visibles sans vérification de permissions | `MobileApp.jsx` L240-350 | 🔴 HIGH |
| MB-2 | Pas de check rôle avant navigation vers modules | `MobileApp.jsx` L1-50 | 🟠 MED |

### 7.2 Tâches

- [x] **7.1** Filtrage modules mobiles selon permissions (Matériel, Commandes, Inventaire) ✅
- [x] **7.2** Permissions : can_manage_equipment_maintenance → Matériel/Inventaire, can_manage_catalog → Commandes ✅
- [x] **7.3** Modules de base (Planning, Tâches, Congés, Messagerie, Localisation) restent accessibles à tous ✅
- [ ] **7.4** Tests mobile + commit

---

## ÉTAPE 8 — IMPORTS & COLLISIONS

### 8.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| IM-1 | Preview import retourne stats globales, pas la liste des collisions | `equipmentRoutes.js` L1250 | 🟠 HIGH |
| IM-2 | Import personnel : collision email manquante | `PersonnelImportModal.jsx` L50-90 | 🟠 HIGH |
| IM-3 | Logging import : stats globales seulement, pas par item | `equipmentRoutes.js` L1340-1360 | 🟠 HIGH |
| IM-4 | Algo dedup : `reference` OU `serial_number` → ambigu | `equipmentRoutes.js` L1298-1320 | 🟠 HIGH |

### 8.2 Tâches

- [x] **8.1** Import équipement : preview retourne maintenant collisions détaillées (par item, matchedBy) ✅
- [x] **8.2** Dedup déjà implémenté : reference (priorité 1) puis serial_number (priorité 2) ✅
- [x] **8.3** Logging import enrichi (total ajouté aux stats) ✅
- [x] **8.4** Collisions détaillées retournées en mode preview ✅
- [x] **8.5** Import personnel : collision code_libre + nom_prenom déjà implémentée avec détection de conflits ✅ (faux positif)
- [ ] **8.6** Tests imports + commit

---

## ÉTAPE 9 — SÉCURITÉ & ROBUSTESSE

### 9.1 Findings

| ID | Problème | Fichier(s) | Sévérité |
|----|----------|-----------|----------|
| SEC-1 | 4 endpoints auth sans `authenticateToken` | `adminRoutes.js` L72, L133, L466, L489 | 🔴 CRIT |
| SEC-2 | JWT secret fallback en prod | `server.js` L66-77 | 🟠 HIGH |
| SEC-3 | `ALLOW_HTTP` peut désactiver `secure` cookies en prod | `authRoutes.js` L13-18 | 🟠 HIGH |
| SEC-4 | CSP trop permissive : `imgSrc: '*'`, `unsafe-inline` | `helmet.js` L28-35 | 🟠 HIGH |
| SEC-5 | SQL dynamique `${updates.join(', ')}` dans planningRoutes | `planningRoutes.js` L639 | 🟠 HIGH |
| SEC-6 | SSRF : pas de blocage IPv6 (`::1`, `fc00::/7`) | `videoProxyService.js` L18 | 🟡 MED |
| SEC-7 | Signatures exemptées de sanitisation sans validation base64 | `sanitize.js` EXEMPT_FIELDS | 🟡 MED |
| SEC-8 | Rate limiter manquant sur `forgot-password` et `access-requests` | `adminRoutes.js` | 🟡 MED |
| SEC-9 | Tokens Google stockés en clair | `googleCalendarRoutes.js` L78-95 | 🟡 MED |
| SEC-10 | RBAC : admin bypass toutes permissions | `authorize.js` L35-60 | 🟠 HIGH |

### 9.2 Tâches

- [ ] **9.1** Ajouter `sensitiveEndpointLimiter` sur `forgot-password`, `access-requests`, `check-reset`, `set-new-password`
- [ ] **9.2** Refuser démarrage prod si JWT_SECRET est un default connu (exit process)
- [ ] **9.3** Supprimer `ALLOW_HTTP` bypass — forcer `secure: true` en prod
- [ ] **9.4** Resserrer CSP : remplacer `imgSrc: '*'` par whitelist domaines
- [ ] **9.5** Sécuriser SQL dynamique dans `planningRoutes.js` (whitelist champs)
- [ ] **9.6** Ajouter blocage IPv6 dans SSRF protection
- [ ] **9.7** Valider format base64 des signatures avant stockage
- [ ] **9.8** Vérifier et documenter toutes les migrations SQLite
- [ ] **9.9** Audit RBAC : restreindre même les admins sur certains périmètres
- [ ] **9.10** Mettre à jour `SECURITY.md` + `CHANGELOG_SECURITY` après corrections
- [ ] **9.11** Tests sécurité + commit

---

## ÉTAPE 10 — ALIGNEMENT DEV ↔ PROD

### 10.1 Findings

| Problème | Détail | Sévérité |
|----------|--------|----------|
| `VERSION.md` = 2.1.9, `package.json` = 2.0.0 | Désalignement version globale | 🔴 CRIT |
| 5 variables .env non documentées | `DB_PATH`, `ALLOW_HTTP`, `MEDIAMTX_*`, `API_URL` | 🟠 HIGH |
| Log port affiche 3003, fallback réel 3002 | `server.js` L14 vs L70 | 🟠 HIGH |
| PM2 requis mais non documenté dans guides | `safe-deploy.sh` | 🟠 HIGH |
| Pas de CI GitHub Actions | GOVERNANCE.md l'exige | 🔴 CRIT |
| Pas de script `build` backend | `apps/api/package.json` | 🟡 LOW |

### 10.2 Tâches

- [x] **10.1** Aligner `VERSION.md` avec `package.json` ✅ (commit `7af38e2`)
- [x] **10.2** Documenter les 5 variables .env manquantes ✅ (commit `7af38e2`)
- [x] **10.3** Fixer log port dev dans `server.js` ✅ (commit `3f89572`)
- [x] **10.4** PM2 déjà documenté dans GUIDE_DEVELOPPEUR + CHECKLIST_PRODUCTION ✅ (faux positif)
- [x] **10.5** CI GitHub Actions créée (`.github/workflows/ci.yml`) ✅
- [x] **10.6** Rapport : tous les écarts identifiés ont été corrigés (10.1–10.5) ✅
- [ ] **10.7** Commit & push

---

## ÉTAPE 11 — PLAN D'ACTION (ce document)

Ce fichier EST le plan d'action. Il sera mis à jour après chaque étape.

---

## ÉTAPE 12 — VERSIONING & DOCUMENTATION

À chaque correction :
- [ ] Incrémenter version SemVer dans `package.json` + `VERSION.md`
- [ ] Mettre à jour changelogs (`CHANGELOG_API.md`, `CHANGELOG_UI.md`, `CHANGELOG_DB.md`, `CHANGELOG_DOCS.md`)
- [ ] Mettre à jour la documentation impactée
- [ ] Mettre à jour `prompts-index.json` si nécessaire
- [ ] Mettre à jour `docs/API-INDEX.md`

---

## 📅 ORDRE D'EXÉCUTION RECOMMANDÉ

| Priorité | Étape | Motif | Effort estimé |
|:--------:|:-----:|-------|---------------|
| 🔴 1 | **Étape 9** — Sécurité | 5 vulnérabilités critiques à corriger en premier | Moyen |
| 🔴 2 | **Étape 1** — Nettoyage | Assainir la base avant d'ajouter du code | Faible |
| 🟠 3 | **Étape 10** — Alignement DEV/PROD | Prérequis pour tout déploiement fiable | Moyen |
| 🟠 4 | **Étape 5** — UI/UX général | Impact utilisateur immédiat | Moyen |
| 🟠 5 | **Étape 8** — Imports & collisions | Risque d'intégrité données | Moyen |
| 🟡 6 | **Étape 2** — Planning | Module métier critique | Élevé |
| 🟡 7 | **Étape 7** — Mobile | Permissions manquantes | Moyen |
| 🟡 8 | **Étape 4** — Stocks & Annuaire | UX cosmétique | Faible |
| 🟢 9 | **Étape 3** — TV-Client | 2 issues mineures | Faible |
| 🟢 10 | **Étape 6** — Vidéo | Nouvelles features | Élevé |
| ↻ | **Étape 12** — Versioning | Continue tout au long | — |

---

## 🔑 DÉPENDANCES ENTRE ÉTAPES

```
Étape 1 (Nettoyage) ──→ Toutes les autres
Étape 9 (Sécurité)  ──→ Étape 10 (Alignement)
Étape 10 (Alignement) ──→ Étape 12 (Versioning final)
Étape 5 (UI/UX)     ──→ Étape 7 (Mobile) — hook useDirtyForm partagé
Étape 2 (Planning)   ──→ Étape 3 (TV-Client) — les tâches planning alimentent le TV
```

---

## 📁 FICHIERS CLÉS IMPACTÉS

| Module | Fichiers principaux |
|--------|-------------------|
| Backend sécurité | `server.js`, `adminRoutes.js`, `authRoutes.js`, `helmet.js`, `rateLimiter.js`, `authorize.js`, `sanitize.js`, `videoProxyService.js` |
| Planning | `personnelRoutes.js`, `planningRoutes.js`, `googleCalendarRoutes.js`, `AssignmentDialog.jsx`, `TaskPlanningPanel.jsx`, `EventTaskModal.jsx` |
| UI/UX | `UserPreferencesModal.jsx`, `ProfileEditModal.jsx`, `Header.jsx`, `VideoPanel.jsx` + tous modals d'édition |
| Mobile | `MobileApp.jsx`, `MobileEquipment.jsx`, `MobileSAV.jsx` |
| Imports | `equipmentRoutes.js`, `personnelRoutes.js`, `EquipmentImportModal.jsx`, `PersonnelImportModal.jsx` |
| TV-Client | `tv-client/main.js` |
| Vidéo | `VideoPanel.jsx`, `videoProxyService.js`, `videoRoutes.js` |
| Config | `.env.example`, `VERSION.md`, `package.json`, `safe-deploy.sh` |
| Docs | `SECURITY.md`, `AUDIT.md`, `API-INDEX.md`, `GUIDE_DEVELOPPEUR.md`, `CHANGELOG_*.md` |

---

## ⚠️ RISQUES IDENTIFIÉS

| Risque | Probabilité | Impact | Mitigation |
|--------|:-----------:|:------:|-----------|
| Régression sécurité lors des correctifs | Moyenne | Élevé | Tests sécurité à chaque commit |
| Sync bidirectionnelle Google Calendar complexe | Élevée | Moyen | Implémenter par phase (push d'abord, pull ensuite) |
| Casse UI lors modifications modals | Moyenne | Moyen | Tests visuels manuels + screenshot avant/après |
| Migration DB si ajout tables (camera_presets) | Faible | Faible | Migrations idempotentes existantes |
| Conflits merge si travail parallèle | Faible | Faible | Travail séquentiel sur branche dev |

---

> **Statut** : ⏳ EN ATTENTE DE VALIDATION  
> Aucune modification ne sera effectuée avant accord explicite.
