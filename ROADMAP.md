# Roadmap — eM@g

> **Version** : 2.5.0  
> **Dernière MÀJ** : 11 avril 2026

---

## Légende

- ✅ Terminé
- 🔄 En cours
- 📋 Planifié
- 💡 Idée / à prioriser

---

## v2.0.0 — Fondations Open-Source ✅

### Sécurité ✅
- [x] Audit sécurité complet (88 findings)
- [x] Phase 1 — Correctifs critiques (TV auth, JWT, SMTP, self-approval)
- [x] Phase 2 — Correctifs élevés (PII, password policy, conflicts, bcrypt)
- [x] Phase 3 — Correctifs moyens (DOMPurify, rate limiters, SAV state machine)
- [x] Phase 4 — Correctifs bas + stabilisation (SVG, uploads, LIMIT)

### Documentation ✅
- [x] Documentation Continue — 41 fichiers (API, DB, modules, workflows, règles)
- [x] Versioning Continu — SemVer + 7 changelogs + versions.json

### Gouvernance ✅
- [x] GOVERNANCE.md — Modèle BDFL, processus, branches
- [x] CODE_OF_CONDUCT.md — Contributor Covenant 2.1
- [x] CODING_STANDARDS.md — Conventions complètes
- [x] Templates GitHub (issues, PRs, CODEOWNERS)
- [x] ROADMAP.md — Ce fichier

---

## v2.1.0 — Qualité & Nettoyage ✅

### Qualité de code ✅
- [x] Nettoyage dead code — 523 warnings `no-unused-vars` → 0
- [x] Tests frontend Vitest — 355 tests, 0 fail
- [x] Tests backend node:test — 63 tests, 0 fail
- [x] Pre-commit hooks — tests auto avant chaque commit
- [x] Script `safe-deploy.sh` — build + PM2 restart + smoke test

---

## v2.2.0 — Cartographie & UI ✅

- [x] Module cartographie des lieux (Leaflet) — carte générale + locale
- [x] Impression A4/A3, marqueurs SVG stylisés Design System
- [x] Hook `useDirtyForm` — détection modifications non sauvegardées
- [x] Catégorie « Dépôt » dans le planning
- [x] RBAC mobile — filtrage modules selon permissions

---

## v2.3.0 — Google Calendar OAuth2 ✅

- [x] Migration vers Authorization Code Flow (remplacement implicit)
- [x] Refresh token chiffré AES-256-GCM en SQLite
- [x] Sync intelligente multi-tab (IndexedDB + BroadcastChannel + leader election)
- [x] Auto-refresh access_token côté backend

---

## v2.4.0 — Module Sonos ✅

- [x] Module autonome extrait de `displayRoutes.js` — 18 endpoints `/api/sonos/*`
- [x] Contrôles lecture/pause/next/prev, volume, mute, shuffle, repeat
- [x] Gestion multi-zone, favoris 1-click
- [x] Widget TV enrichi (barre de volume animée)
- [x] Validation IPv4 stricte, timeout UPnP 8s

---

## v2.5.0 — Sync bidirectionnelle Google Calendar (actuel) ✅

- [x] Push eM@g → Google Calendar (create/update/delete réservations)
- [x] Pull Google → eM@g (réconciliation, Google-wins, nettoyage orphelins)
- [x] Feature flag `GOOGLE_BIDIRECTIONAL_SYNC` pour activation contrôlée
- [x] Session Google persistante via localStorage (suppression flash UI)
- [x] Audit global 12 étapes / 49 findings — 100% terminé

---

## v2.6.0 — GUI Sonos complète + CI/CD 🔄

### GUI Sonos complète ✅
- [x] Hook partagé `useSonos` (config, zones, polling, contrôles, favoris, busy-lock)
- [x] 7 composants desktop modulaires (Panel, ZoneSelector, NowPlaying, Controls, VolumeSlider, Favorites, Sources)
- [x] 5 composants mobile tactiles (Shell, NowPlaying swipe, Controls 64px, Volume, Favorites)
- [x] Intégration App.jsx + DisplayDashboardPanel + MobileApp (lazy loading)
- [x] CSS dédié desktop + mobile (touch targets 48px+, scroll-snap zones)
- [x] 47 tests Vitest (hook + composants desktop + mobile)

### CI/CD 📋
- [ ] GitHub Actions : lint + build + test sur PR
- [ ] GitHub Actions : deploy automatique main → production
- [ ] Vérification Conventional Commits
- [ ] Coverage reporting (> 60%)

### Qualité
- [ ] ESLint config unifiée (monorepo)
- [ ] Prettier config partagée
- [ ] Import sorting automatique

---

## v3.0.0 — Architecture 💡

### Frontend
- [ ] Migration composants → Design System complet
- [ ] Responsive mobile-first
- [ ] PWA offline-first (Service Worker avancé)
- [ ] i18n (français par défaut + anglais)

### API
- [ ] Pagination cursor-based universelle
- [ ] WebSocket pour temps réel (remplacer polling)
- [ ] API versionnée (`/api/v2/`)

### Performance
- [ ] Lazy loading modules React
- [ ] SQLite optimisation (index, query plans)
- [ ] CDN pour assets statiques

---

## Backlog — À prioriser 💡

- [ ] Annotations PDF + Vision Transformer (spec existante)
- [ ] Module vidéo WebRTC complet (spec existante)
- [ ] Export PDF avancé (rapports, factures)
- [ ] Intégration comptabilité (API externe)
- [ ] QR codes pour inventaire + scan mobile natif
- [ ] Vue Gantt améliorée + drag & drop tâches
- [ ] Notifications push (WebSocket)
- [ ] Calendrier congés équipe visuel + export comptable
- [ ] Mode multi-tenant
- [ ] App mobile React Native
- [ ] Dashboard analytics

---

## Comment proposer une feature

1. Ouvrir une issue avec le label `enhancement`
2. Décrire le besoin utilisateur
3. Discuter dans l'issue
4. Si validé → ajout à la roadmap + milestone
