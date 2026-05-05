Tu es GitHub Copilot, expert en UX/UI, design system, ergonomie, React, CSS moderne, atomic design, et refactor d’interfaces complexes.

🎯 Objectif
Générer automatiquement un **design system complet**, cohérent, modulaire et épuré pour eM@g, en s’appuyant sur :

- l’analyse des interfaces existantes
- l’analyse des workflows
- l’analyse des composants React
- l’analyse des styles CSS actuels
- l’analyse des modals, dialogs, panels, formulaires
- l’analyse des modules métier (véhicules, personnel, affaires, stock, commandes, catalogue, matériel, BL/BP, TV, mobile)
- les contraintes de densité (mode compact)
- les contraintes de lisibilité (mode clair/sombre)
- les contraintes de performance (DOM minimal)
- les contraintes de cohérence (atomic design)

Le design system doit être :
- **non destructif**
- **compatible avec l’existant**
- **validé étape par étape**
- **documenté automatiquement**
- **intégrable progressivement**
- **adapté desktop / mobile / TV**
- **compatible avec un futur mode “VS Code”**

---

# 🧩 Étape 1 — Analyse complète de l’interface
Analyser :

- tous les composants React (131 desktop, 16 mobile, 21 TV)
- tous les modals
- tous les dialogs
- tous les panels
- tous les formulaires
- toutes les tables
- toutes les listes
- tous les boutons
- tous les champs
- tous les headers
- tous les layouts
- tous les CSS (globaux + composants)

Produire :

- les patterns visuels existants
- les incohérences
- les doublons
- les composants trop gros
- les composants trop similaires
- les composants inutilisés
- les styles redondants
- les styles contradictoires

Ne rien modifier pour l’instant.

---

# 🧩 Étape 2 — Proposition de tokens de design
Proposer une base de tokens :

### 🎨 Couleurs
- palette principale
- palette secondaire
- états (success, warning, error)
- surfaces (background, panels, cards)
- bordures
- hover / active / focus
- mode clair / mode sombre

### 🔠 Typographie
- hiérarchie complète (H1 → H6, body, caption)
- interlignage
- espacement vertical
- tailles standardisées

### 📏 Espacements
- échelle 4 / 8 / 12 / 16 / 24 / 32 px
- marges internes / externes
- grille de mise en page

### 🧱 Radius / ombres
- border-radius unifié
- ombres légères ou style “flat VS Code”

### 🖼️ Icônes
- set unique (Lucide React)
- tailles standardisées

Attends ma validation.

---

# 🧩 Étape 3 — Composants atomiques (Atomic Design — Atoms)
Générer les spécifications pour :

- boutons (primary, secondary, ghost, danger)
- inputs (text, number, date, select)
- checkbox / radio
- tags / badges
- avatars
- tooltips
- loaders
- icônes

Pour chaque composant :

- structure
- variantes
- états
- interactions
- accessibilité
- tokens utilisés

Attends ma validation.

---

# 🧩 Étape 4 — Composants moléculaires (Molecules)
Générer les spécifications pour :

- form fields (label + input + help text)
- cards
- tables (header + rows + pagination)
- list items
- dropdown menus
- tabs
- accordions
- search bars
- filtres

Attends ma validation.

---

# 🧩 Étape 5 — Organisms & Templates
Générer les spécifications pour :

- panels
- modals
- dialogs
- sidebars
- headers
- footers
- layouts de modules
- layouts de formulaires
- layouts de modals
- layouts de panneaux latéraux

Attends ma validation.

---

# 🧩 Étape 6 — Règles UX (comportements)
Définir :

- ouverture/fermeture modals
- transitions
- focus management
- validation formulaires
- erreurs
- désactivation
- loaders
- toasts
- raccourcis clavier
- comportements tactiles (mobile)
- comportements TV (affichage)

Attends ma validation.

---

# 🧩 Étape 7 — Thèmes
Générer :

- thème clair
- thème sombre
- thème compact (densité réduite)
- thème “VS Code mode” (flat, dense, productif)
- thème TV (contraste élevé, lisibilité)

Attends ma validation.

---

# 🧩 Étape 8 — Documentation automatique
Générer automatiquement :

`docs/DesignSystem/DesignSystem.md`

Contenu :

- tokens
- composants
- règles UX
- thèmes
- exemples
- bonnes pratiques
- anti‑patterns
- roadmap d’intégration

Attends ma validation.

---

# 🧩 Étape 9 — Plan de migration
Générer un plan de migration :

- composants à refactor
- composants à fusionner
- composants à supprimer
- composants à créer
- CSS à supprimer
- CSS à migrer
- modules impactés
- ordre de migration
- risques
- tests à effectuer

Attends ma validation.

---

# 🧩 Étape 10 — Rapport final
Produire :

- design system complet
- documentation
- plan de migration
- risques
- recommandations finales

---

# 🚀 Action
Commence maintenant par l’analyse complète de l’interface (Étape 1), puis attends ma validation avant toute proposition de tokens ou de composants.
