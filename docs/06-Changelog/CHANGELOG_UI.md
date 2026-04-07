# Changelog UI / Frontend — eM@g

Toutes les modifications de l'interface utilisateur et des composants React.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [2.1.2] — 2026-04-07

### Changed
- **Phase D** : Migration de 2 355 valeurs CSS hardcodées → design tokens (109 fichiers)
  - border-radius : 4/6/8/10/12/16/20px → var(--radius-*)
  - font-size : 10-24px et 0.8-1rem → var(--font-*)
  - z-index : 2000/3001 → var(--z-modal/popover)
  - Nouveau token : --radius-md-lg: 10px

---

## [2.1.1] — 2026-04-07

### Changed
- **Phase C** : Extraction de 155 styles inline → classes CSS dans 6 composants
  - 3 nouveaux fichiers CSS : BLBatchAnalysis.css, SavImportModal.css, ProfileEditModal.css
  - 3 fichiers CSS enrichis : LoginForm.css (+17 classes), ReservationModal.css (+25), SupplierCatalogPanel.css (+8)
  - Handlers hover JS (onMouseEnter/onMouseLeave) remplacés par CSS :hover
  - Pseudo-classe :disabled utilisée pour remplacer les ternaires cursor/opacity

---

## [2.0.0] — 2026-04-07

### Security
- DOMPurify intégré pour sanitisation HTML (Phase 3)
- IndexedDB nettoyé au logout (Phase 3)
- Politique mot de passe renforcée : ≥10 chars, maj, chiffre, symbole (Phase 2)

### Changed
- Migration monorepo : frontend déplacé dans `apps/web/`
- Design System : 43 composants (10 atomes, 11 molécules, 16 organismes)
- 3 thèmes (principal, compact, TV) avec 380+ tokens CSS

---

## [1.0.0] — 2025

### Added
- Interface initiale React 18 + Vite 5.4
- 16 modules fonctionnels (panels, modals, hooks, services)
- Hash-based routing (activeModule)
- 3 contextes (Auth, Navigation, Toast)
