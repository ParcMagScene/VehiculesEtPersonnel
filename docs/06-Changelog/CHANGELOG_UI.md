# Changelog UI / Frontend — eM@g

Toutes les modifications de l'interface utilisateur et des composants React.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [2.1.6] — 2026-04-08

### Changed
- **Phase H** : 3 `<input>` natifs → `<Input>` DS dans ChangePassword.jsx (champs password avec toggle show/hide)
  - 60 `<input>` natifs restants sont date/time/file/color/radio/range (pas d'équivalent DS)
- **Phase I** : Nettoyage console.log — 2 `console.log` de debug supprimés dans EquipmentPanel.jsx
  - 213 `console.error` + 16 `console.warn` conservés (gestion d'erreurs légitime)

---

## [2.1.5] — 2026-04-07

### Changed
- **Phase G** : 902 `<button>` natifs → `<Button variant="ghost">` dans 112 fichiers
  - Adoption DS Button : 26% → 100%
  - Vérification visuelle recommandée (les styles CSS existants via className sont préservés)

---

## [2.1.4] — 2026-04-07

### Changed
- **Phase F** : 252 magic strings → constantes centralisées dans 57 fichiers
  - `=== 'pending'` / `'active'` / `'completed'` etc. → `STATUS.PENDING` / `STATUS.ACTIVE` / `STATUS.COMPLETED`
  - `=== 'admin'` / `'manager'` → `ROLES.ADMIN` / `ROLES.MANAGER`
  - `setTimeout(fn, 350)` → `setTimeout(fn, TIMING.PANEL_CLOSE)`

---

## [2.1.3] — 2026-04-07

### Changed
- **Phase E** : Validation formulaires + alignement password policy
  - maxLength ajouté sur 31 champs : AnnuairePanel (20), PersonnelPanel (6), AccessRequestModal (3), InterventionModal (2)
  - Password minLength aligné sur backend policy (10 chars + 1 maj + 1 chiffre + 1 spécial)
  - InterventionModal : min="0" sur coût

### Added
- `constants/index.js` : constantes centralisées (STATUS, ROLES, TIMING, VALIDATION)

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
