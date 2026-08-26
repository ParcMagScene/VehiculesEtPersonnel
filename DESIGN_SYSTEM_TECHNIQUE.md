# DESIGN SYSTEM TECHNIQUE — eM@g

## 1. Patterns backend (routes, services, middlewares, transactions)

Principes :
- Une route orchestre, un service décide, un repository persiste.
- Les middlewares gèrent authentification, validation, autorisation et observabilité.
- Les transactions encadrent toute mutation multi-étapes.
- Les erreurs métier et techniques sont séparées et normalisées.

Règles :
- Contrats d’entrée explicites et validés.
- Idempotence recherchée pour opérations sensibles.
- Journalisation structurée sur opérations critiques.
- Interdiction des effets secondaires implicites non tracés.

## 2. Patterns DB (FK, PK, index, migrations)

Principes :
- Intégrité référentielle explicite.
- Schémas lisibles et versionnés.
- Index guidés par usages réels.

Règles :
- PK cohérentes par domaine.
- FK obligatoires sauf justification documentée.
- Index ciblés sur requêtes critiques, revus périodiquement.
- Migrations atomiques, réversibles autant que possible, avec vérification post-migration.
- Contrôles d’invariants exécutés en CI.

## 3. Patterns API (naming, payloads, erreurs)

Principes :
- API contractuelle, stable et prédictible.
- Nommage explicite et homogène.
- Réponses structurées pour faciliter exploitation et frontend.

Règles :
- Ressources et actions nommées de façon cohérente.
- Payloads validés et documentés.
- Codes HTTP alignés sur la sémantique réelle.
- Formats d’erreur standardisés avec message métier et contexte exploitable.
- Versionnage appliqué aux changements incompatibles.

## 4. Patterns React (hooks, state, props, DS)

Principes :
- Composants focalisés sur une responsabilité.
- État local minimal, état partagé explicite.
- Props claires, stables et typées selon conventions du projet.

Règles :
- Extraction des composants trop volumineux.
- Réduction des effets de bord en rendu.
- Réutilisation des primitives du Design System avant création de variantes.
- Gestion uniforme des loaders, erreurs et vides.
- Responsive traité dès la conception.

## 5. Patterns modals (structure, a11y, fermeture)

Principes :
- Modal orientée tâche, avec objectif unique et explicite.
- Accessibilité et focus management obligatoires.

Règles :
- Structure standard : en-tête, contenu, actions.
- Fermeture claire via action explicite et mécanismes attendus.
- Restauration du focus à la fermeture.
- États d’erreur lisibles et annoncés.
- Interdiction des modals imbriquées sans justification forte.

## 6. Patterns hooks (naming, logique, side-effects)

Principes :
- Un hook expose un contrat simple et lisible.
- Les effets secondaires sont maîtrisés et localisés.

Règles :
- Nommage explicite et orienté intention.
- Séparation stricte entre calcul pur et effet externe.
- Dépendances d’effets complètes et compréhensibles.
- Annulation/nettoyage systématique des effets asynchrones.
- Réutilisation préférée à la duplication de logique.

## 7. Patterns navigation (desktop/mobile, URL = vérité)

Principes :
- L’URL représente l’état navigable.
- La navigation est cohérente entre desktop et mobile.

Règles :
- États majeurs reflétés dans l’URL.
- Deep-linking préservé pour vues principales.
- Retour arrière prévisible.
- Breadcrumbs et contexte visibles sur parcours complexes.
- Aucun contournement de route qui casse la lisibilité du flux utilisateur.

## 8. Patterns tests (unitaires, intégration, UI, DB)

Principes :
- Tester par niveau selon risque.
- Couvrir prioritairement les invariants métier et zones sensibles.

Règles :
- Tests unitaires pour logique pure et transformations.
- Tests d’intégration pour contrats API et interactions module/DB.
- Tests UI smoke pour parcours critiques.
- Tests DB pour migrations, intégrité et invariants.
- Toute correction critique s’accompagne d’un test de non-régression.

Finalité : disposer d’un référentiel technique unifié qui réduit la variance d’implémentation, accélère les revues et stabilise la production.