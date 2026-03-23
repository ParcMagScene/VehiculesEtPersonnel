# Étape 9 — Plan de Migration vers le Design System

## 1. Composants à Refactorer

### 1.1 Modales & Confirmations (Priorité critique)
| Pattern legacy | Occurrences | Fichiers | Cible DS |
|---|---|---|---|
| `window.confirm()` | 29 | 14 fichiers (vehicleRoutes, ordersRoutes, personnelRoutes, etc.) | `<Dialog variant="confirm">` |
| `ConfirmDialog` custom | 10+ | Modules véhicules, personnel, commandes | `<Dialog>` |
| Overlays ad-hoc (`.modal-overlay`, `.popup-overlay`) | 20+ | Répartis dans 8 modules | `<Modal>` |
| Modales inline avec état local | 25+ | Quasiment tous les modules | `<Modal>` + `<ModalHeader/Body/Footer>` |

### 1.2 Panneaux coulissants
| Pattern legacy | Occurrences | Cible DS |
|---|---|---|
| `SlidePanel` Personnel | 1 | `<Drawer>` |
| `SlidePanel` Affaires | 1 | `<Drawer>` |
| `SlidePanel` Véhicules | 1 | `<Drawer>` |
| `SlidePanel` Stock | 1 | `<Drawer>` |
| `SlidePanel` Commandes | 1 | `<Drawer>` |

### 1.3 Boutons
| Pattern legacy | Occurrences | Cible DS |
|---|---|---|
| `.theme-btn-*` classes | 100+ | `<Button variant="...">` |
| `<button>` sans classe DS | 500+ | `<Button>` |
| Boutons icône custom | 50+ | `<Button variant="ghost" size="icon">` |

### 1.4 Champs de formulaire
| Pattern legacy | Occurrences | Cible DS |
|---|---|---|
| `<input>` brut | 150+ | `<Input>` |
| `<textarea>` brut | 30+ | `<Input as="textarea">` |
| `<select>` brut | 40+ | `<Input as="select">` ou `<DropdownMenu>` |
| label+input manuels | 111+ | `<FormField>` |

### 1.5 En-têtes & Structure
| Pattern legacy | Occurrences | Cible DS |
|---|---|---|
| `<h1>`-`<h4>` directs | 200+ | `<PageHeader>` / `<SectionHeader>` |
| Layouts de page manuels | 20+ | `<ModuleLayout>` + `<ModuleToolbar/Content/Footer>` |
| Structures split manuelles | 5+ | `<SplitLayout>` |

---

## 2. Composants à Fusionner

| Composant(s) legacy | → Composant DS | Justification |
|---|---|---|
| `ConfirmDialog.jsx` + `window.confirm()` | `Dialog` | API unifiée, accessible, thémable |
| Overlays custom (5+ implémentations) | `Modal` | Gestion focus trap, ESC, backdrop unifiée |
| 5 × `SlidePanel` spécialisés | `Drawer` | Un seul composant paramétrable (side, size) |
| `HelpModal.jsx`, `QRCodeModal.jsx` | `Modal` + contenu spécifique | Réutiliser le shell Modal DS |
| `ToastContainer.jsx` custom | Garder (hors DS pour l'instant) | Système toast déjà fonctionnel, migration future |
| Spinners/loaders ad-hoc | `Spinner` / `LoadingOverlay` | Unification visuelle |

---

## 3. Composants à Supprimer (après migration)

| Fichier / Pattern | Raison |
|---|---|
| `ConfirmDialog.jsx` + `ConfirmDialog.css` | Remplacé par `<Dialog>` |
| `HelpModal.jsx` (si wrapper pur) | Remplacé par `<Modal>` |
| `QRCodeModal.jsx` (shell uniquement) | Shell remplacé par `<Modal>`, contenu conservé |
| Modales inline dupliquées (25+) | Chaque module définit ses propres overlays |
| Spinners custom éparpillés | Remplacés par `<Spinner>` / `<LoadingOverlay>` |
| Classes `.slide-panel-*` dans CSS modules | Remplacées par `<Drawer>` |

---

## 4. Composants à Créer

**Aucun nouveau composant nécessaire.** Les 43 composants DS existants couvrent tous les patterns identifiés :
- Atomes (10) : Button, Input, Checkbox, Toggle, Tag, Badge, Avatar, Tooltip, Spinner, LoadingOverlay
- Molécules (11) : DropdownMenu, DropdownItem, DropdownDivider, Tabs, TabList, Tab, TabPanel, Accordion, SearchBar, FilterBar, ListItem
- Organismes (16) : Modal, ModalHeader/Body/Footer, Dialog, Drawer, PageHeader, FormLayout/Section/Row/Actions, ModuleLayout/Toolbar/Content/Footer, SplitLayout
- Existants (6) : Card, Panel, SectionHeader, Table, ScrollArea, FormField

---

## 5. CSS à Supprimer

### Estimation : 3 000 – 4 000 lignes supprimables

| Catégorie | Lignes estimées | Exemples |
|---|---|---|
| Styles de modales dupliqués | ~800 | `.modal-overlay`, `.popup-backdrop`, `.confirm-dialog` |
| Styles de boutons theme-btn | ~500 | `.theme-btn-primary`, `.theme-btn-danger`, `.theme-btn-icon` |
| Styles de formulaires dupliqués | ~600 | `.form-group`, `.input-field`, `.form-label` |
| Styles de slide panels | ~400 | `.slide-panel`, `.panel-overlay`, `.slide-enter` |
| Styles de headers dupliqués | ~300 | `.page-title`, `.section-title`, `.module-header` |
| Styles de spinners/loaders | ~200 | `.spinner`, `.loading-overlay`, `.loader-container` |
| Utilitaires redondants avec tokens | ~400 | Couleurs hardcodées, espacements manuels, z-index arbitraires |

### Top 9 fichiers CSS les plus volumineux (8 350+ lignes combinées)
Ces fichiers contiennent le plus de styles legacy à nettoyer en priorité.

---

## 6. CSS à Migrer (hardcodé → tokens)

| Pattern hardcodé | Occurrences est. | Token DS cible |
|---|---|---|
| Couleurs hex/rgb directes | 300+ | `var(--color-*)` |
| `box-shadow` manuels | 50+ | `var(--shadow-*)` |
| `z-index` arbitraires | 40+ | `var(--z-*)` (échelle 10-90) |
| `border-radius` manuels | 80+ | `var(--radius-*)` |
| `font-size` en px | 100+ | `var(--text-*)` |
| `padding`/`margin` en px | 200+ | `var(--space-*)` |
| `transition` manuels | 60+ | `var(--transition-*)` |
| Media queries dupliquées | 30+ | Breakpoints centralisés |

---

## 7. Modules Impactés

| Module | Fichiers estimés | Complexité | Principaux refactors |
|---|---|---|---|
| **Véhicules** | 15+ | 🔴 Haute | Modales, SlidePanel, formulaires, boutons |
| **Personnel** | 12+ | 🔴 Haute | SlidePanel, confirmations, formulaires |
| **Commandes** | 10+ | 🟠 Moyenne | Modales, boutons, formulaires, listes |
| **Affaires** | 10+ | 🟠 Moyenne | SlidePanel, modales, formulaires |
| **Stock / Inventaire** | 8+ | 🟠 Moyenne | SlidePanel, formulaires, listes |
| **Équipement** | 6+ | 🟡 Faible | Boutons, formulaires |
| **Mailing** | 4+ | 🟡 Faible | Modales, formulaires |
| **Affichage dynamique** | 5+ | 🟡 Faible | Boutons, structure page |
| **Planning / Congés** | 5+ | 🟡 Faible | Formulaires, modales |
| **Administration** | 3+ | 🟢 Très faible | Formulaires, boutons |

---

## 8. Ordre de Migration Recommandé

### Phase 0 — Fondations (préalable)
- ✅ Déjà fait : tokens, composants DS, thèmes, documentation

### Phase 1 — Modales & Confirmations 🔴
**Durée estimée : 12-15h**
1. Remplacer les 29 `window.confirm()` → `<Dialog>`
2. Migrer `ConfirmDialog.jsx` → `<Dialog>`
3. Migrer les 25+ modales ad-hoc → `<Modal>` composé
4. Supprimer `ConfirmDialog.jsx` + CSS associé
5. **Test** : Vérifier chaque flux de confirmation dans chaque module

### Phase 2 — Panneaux coulissants & Boutons 🟠
**Durée estimée : 10-12h**
1. Remplacer les 5 SlidePanel → `<Drawer>`
2. Migrer les 100+ `.theme-btn-*` → `<Button variant>`
3. Migrer les boutons icône → `<Button variant="ghost" size="icon">`
4. Supprimer CSS slide-panel + theme-btn
5. **Test** : Navigation modules, ouverture/fermeture panneaux

### Phase 3 — En-têtes & Formulaires 🟠
**Durée estimée : 12-15h**
1. Migrer les 200+ headings → `<PageHeader>` / `<SectionHeader>`
2. Migrer les 111+ label+input → `<FormField>`
3. Structurer formulaires → `<FormLayout>` / `<FormSection>` / `<FormRow>`
4. Supprimer CSS headers + form legacy
5. **Test** : Tous les formulaires, validation, soumission

### Phase 4 — Layouts & Structures 🟡
**Durée estimée : 8-10h**
1. Migrer pages → `<ModuleLayout>` + `<ModuleToolbar/Content/Footer>`
2. Migrer vues split → `<SplitLayout>`
3. Migrer listes → `<ListItem>`, tables → `<Table>` DS
4. **Test** : Responsive, compact mode, dark mode

### Phase 5 — Inputs avancés & Nettoyage final 🟢
**Durée estimée : 8-10h**
1. Migrer les `<input>` restants → `<Input>`
2. Migrer les `<select>` → `<DropdownMenu>` ou `<Input as="select">`
3. Migrer checkboxes/toggles → `<Checkbox>` / `<Toggle>`
4. Supprimer tous les CSS redondants identifiés (3 000-4 000 lignes)
5. **Test** : Validation complète tous modules

### Phase 6 — Tokens CSS & Polish 🟢
**Durée estimée : 5-10h**
1. Remplacer couleurs hardcodées → `var(--color-*)`
2. Remplacer shadows/radius/spacing → tokens
3. Unifier z-index sur l'échelle DS
4. Nettoyer media queries dupliquées
5. **Test** : Thèmes (light, dark, compact, VS Code, TV)

---

## 9. Risques & Mitigations

| Risque | Impact | Probabilité | Mitigation |
|---|---|---|---|
| **Régression fonctionnelle** | 🔴 Haut | Moyenne | Migrer module par module, tester après chaque migration |
| **Casse du dark mode** | 🟠 Moyen | Haute | Vérifier chaque composant migré dans les 5 thèmes |
| **Conflits de spécificité CSS** | 🟠 Moyen | Haute | Supprimer l'ancien CSS immédiatement après migration |
| **Perte de comportement custom** | 🟠 Moyen | Faible | Auditer les props/callbacks avant remplacement |
| **Performance pendant transition** | 🟡 Faible | Faible | CSS ancien + nouveau coexistent temporairement |
| **Temps de migration sous-estimé** | 🟠 Moyen | Moyenne | Prévoir buffer de 20%, migrer par ordre de priorité |
| **Régressions mobile/responsive** | 🟠 Moyen | Moyenne | Tester chaque phase sur mobile + tablette |
| **Accessibilité rompue** | 🔴 Haut | Faible | Les composants DS sont déjà accessibles (ARIA, focus trap) |

---

## 10. Tests à Effectuer

### Par phase de migration
- [ ] **Smoke test** : L'app démarre sans erreur console
- [ ] **Navigation** : Tous les modules sont accessibles
- [ ] **CRUD** : Créer, lire, modifier, supprimer dans chaque module migré
- [ ] **Confirmations** : Chaque `window.confirm` remplacé fonctionne (annuler + confirmer)
- [ ] **Modales** : Ouverture, fermeture (ESC, clic backdrop, bouton), contenu correct
- [ ] **Drawers** : Ouverture, fermeture, contenu, animation
- [ ] **Formulaires** : Saisie, validation, soumission, messages d'erreur

### Tests transversaux (après chaque phase)
- [ ] **Thème Light** : Contraste, lisibilité, couleurs correctes
- [ ] **Thème Dark** : Pas de texte invisible, bordures visibles, contraste WCAG AA
- [ ] **Thème Compact** : Espacement réduit, pas de chevauchement, tout cliquable
- [ ] **Thème VS Code** : Cohérence palette, pas de zones non thémées
- [ ] **Thème TV** : Contraste WCAG AAA, éléments agrandis, pas de overflow
- [ ] **Mobile (< 768px)** : Layouts responsive, modales plein écran, scroll correct
- [ ] **Tablette (768-1024px)** : Drawers adaptés, grilles correctes
- [ ] **Clavier** : Tab, Shift+Tab, Entrée, Échap fonctionnent partout
- [ ] **Performance** : Pas de layout shift, animations fluides (60fps)

### Critères de fin de migration
1. Zéro `window.confirm()` dans le code
2. Zéro composant modal/panel custom (hors DS)
3. Zéro classe `.theme-btn-*` dans les templates
4. Tous les formulaires utilisent `<FormField>` / `<FormLayout>`
5. CSS réduit de 3 000+ lignes par rapport à l'état initial
6. Les 5 thèmes fonctionnent sur tous les composants migrés
7. Tous les tests transversaux passent

---

## Résumé Effort Total

| Phase | Heures | % du total |
|---|---|---|
| Phase 1 — Modales & Confirmations | 12-15h | 22% |
| Phase 2 — Panels & Boutons | 10-12h | 18% |
| Phase 3 — Headers & Formulaires | 12-15h | 22% |
| Phase 4 — Layouts & Structures | 8-10h | 15% |
| Phase 5 — Inputs & Nettoyage | 8-10h | 15% |
| Phase 6 — Tokens & Polish | 5-10h | 8% |
| **Total** | **55-72h** | **100%** |

Recommandation : migrer en sprints d'1 module à la fois, en suivant l'ordre des phases. Commencer par le module **Administration** (le plus simple) comme pilote, puis enchaîner par complexité croissante.
