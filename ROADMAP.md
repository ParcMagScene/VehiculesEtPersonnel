# Roadmap — eM@g

> **Version** : 1.0.0  
> **Dernière MÀJ** : 7 avril 2026

---

## Légende

- ✅ Terminé
- 🔄 En cours
- 📋 Planifié
- 💡 Idée / à prioriser

---

## v2.0.0 — Fondations Open-Source (actuel)

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

## v2.1.0 — Qualité & CI/CD 📋

### Tests
- [ ] Setup vitest (frontend)
- [ ] Tests unitaires composants critiques
- [ ] Tests API (supertest)
- [ ] Coverage > 60%

### CI/CD
- [ ] GitHub Actions : lint + build + test sur PR
- [ ] GitHub Actions : deploy automatique main → production
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Vérification Conventional Commits

### Qualité
- [ ] ESLint config unifiée (monorepo)
- [ ] Prettier config partagée
- [ ] Import sorting automatique

---

## v2.2.0 — Améliorations fonctionnelles 📋

### Planning
- [ ] Vue Gantt améliorée
- [ ] Drag & drop tâches
- [ ] Notifications push (WebSocket)

### Matériel
- [ ] QR codes pour inventaire
- [ ] Scan mobile natif
- [ ] Photos multi-angles

### Congés
- [ ] Calendrier équipe visuel
- [ ] Export comptable

---

## v3.0.0 — Architecture 💡

### Phase 3 frontend (du plan 12 phases)
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
- [ ] Mode multi-tenant
- [ ] App mobile React Native
- [ ] Dashboard analytics

---

## Comment proposer une feature

1. Ouvrir une issue avec le label `enhancement`
2. Décrire le besoin utilisateur
3. Discuter dans l'issue
4. Si validé → ajout à la roadmap + milestone
