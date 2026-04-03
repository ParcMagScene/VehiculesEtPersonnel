# Refactoring — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Règles et procédures de refactoring pour le projet eM@g — backend Express/SQLite, frontend React/Vite.

---

## Contexte

Le projet eM@g est un monorepo structuré en :
- `apps/api/` — backend Express.js ESM + better-sqlite3
- `apps/web/` — frontend React 18 + Vite
- `apps/tv-client/` — client kiosk dédié

---

## Principes de refactoring

1. **Ne jamais combiner refactoring et nouvelles fonctionnalités** dans le même commit
2. **Un refactoring = un commit dédié** avec le préfixe `refactor:`
3. **Tester avant et après** — le comportement observable ne doit pas changer
4. **Ne pas casser les API existantes** — les routes sont consommées par le frontend ET le tv-client
5. **Ne pas supprimer les routes legacy** sans migration — ajouter des redirections

---

## Conventions de nommage

| Contexte | Convention | Exemple |
|----------|-----------|---------|
| Composants React | PascalCase | `OrdersPanel`, `LocationDialog` |
| Fonctions / état | camelCase | `resolveBrand`, `selectedItem` |
| Classes CSS | kebab-case | `.panel-toolbar`, `.btn-danger` |
| Colonnes DB | snake_case | `brand_id`, `is_active` |
| Routes API | kebab-case | `/api/supplier-articles` |

---

## Patterns à respecter

### Backend
- Routes dans des fichiers dédiés : `{domaine}Routes.js`
- Import ESM : `import x from './y.js'` (extension obligatoire)
- Auth middleware : `authenticateToken` sur toutes les routes
- Erreurs : `try/catch` + `logger.error()` + `res.status(xxx).json({ error })`
- Cache : `listCache.invalidate('key')` après toute mutation

### Frontend
- Un Panel = un fichier principal + un fichier CSS associé
- État local avec `useState`, pas de state manager global
- API via `api.{method}()` (couche centralisée)
- Notifications via `useToast()` hook
- Formulaires dans des modales séparées (Dialog)

---

## Checklist de refactoring

- [ ] Build frontend OK (`npx vite build --mode development`)
- [ ] Serveur démarre sans erreur
- [ ] Aucune régression fonctionnelle visible
- [ ] Aucun `console.log` de debug restant (utiliser `logger`)
- [ ] Aucune dépendance inutilisée ajoutée
- [ ] Commit message clair : `refactor({scope}): {description}`

---

## Opérations interdites

- Modifier la branche `main` directement
- Supprimer des fichiers de migration
- Changer le format de la base de données sans migration
- Écraser des fichiers sans les lire d'abord
- Utiliser `--force` sur git push
- Supprimer des routes API sans période de dépréciation
