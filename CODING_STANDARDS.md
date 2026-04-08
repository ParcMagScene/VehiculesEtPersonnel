# Conventions de développement — eM@g

> **Version** : 1.0.0  
> **Date** : 7 avril 2026

---

## 1. Structure du projet

```
apps/
  api/          # Backend Express.js (ESM)
  web/          # Frontend React 18 (Vite 5.4)
  tv-client/    # Client affichage TV
docs/           # Documentation technique
prompts/        # Prompts maîtres versionnés
scripts/        # Utilitaires
public/         # Fichiers statiques partagés
```

---

## 2. Backend (apps/api/)

### Langage & modules
- **ESM** obligatoire (`import/export`, jamais `require()`)
- Node.js 18+ LTS
- Express.js avec routage modulaire

### Base de données
- SQLite via `better-sqlite3` (synchrone, WAL mode)
- Migrations SQL idempotentes dans `migrations/`
- Requêtes 100% paramétrisées (prepared statements)
- Noms de tables : `snake_case`
- Convention FK : `<table>_id`

### Routes API
- Fichiers dans `routes/` : `<module>Routes.js`
- Préfixe : `/api/<module>`
- Middleware auth : `verifyToken`, `requireAdmin`, `authorize()`
- Validation entrées au niveau route (pas dans le handler)
- Réponses JSON : `{ success: true, data }` ou `{ error: "message" }`

### Sécurité
- Aucun secret dans le code (tout dans `.env`)
- Sanitisation XSS via middleware global
- Rate limiting sur endpoints sensibles
- Uploads : allowlist MIME stricte, taille limitée, noms sanitisés
- SVG bloqué globalement

---

## 3. Frontend (apps/web/)

### Framework
- React 18 avec hooks uniquement (pas de classes)
- Vite 5.4 en bundler
- Pas de React Router — hash-based routing via `activeModule`

### Composants
- Fonctionnels uniquement (`function Component()` ou `const Component = () =>`)
- Un composant par fichier
- CSS colocalisé : `Component.jsx` + `Component.css`
- Design System obligatoire (import depuis `components/ui/`)

### Design System
- **Atoms** : Button, Input, Select, Checkbox, Badge, etc.
- **Molecules** : FormField, SearchBar, DataTable, etc.
- **Organisms** : Panel, Toolbar, Modal, etc.
- **Tokens CSS** : 380+ variables — utiliser `var(--token)` jamais de valeurs magiques
- **Thèmes** : principal, compact, TV — respecter les tokens

### Hooks & Contextes
- Hooks custom dans `hooks/`
- 3 contextes : `AuthContext`, `NavigationContext`, `ToastProvider`
- Utiliser `useToast()` pour les notifications (jamais `alert()`)

### Services API
- Dans `utils/api/` : un fichier par module
- Instance singleton `api` avec interceptors
- Jamais de `fetch()` direct — toujours via le service

---

## 4. Conventions de nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants React | PascalCase | `VehicleDetailPanel` |
| Fichiers composants | PascalCase.jsx | `VehicleDetailPanel.jsx` |
| Hooks | camelCase avec `use` | `useAppData` |
| Services API | camelCase.js | `vehicles.js` |
| Routes backend | camelCase + Routes | `vehicleRoutes.js` |
| Tables SQLite | snake_case | `equipment_assignments` |
| Colonnes SQLite | snake_case | `created_at` |
| Variables JS | camelCase | `isLoading` |
| Constantes | UPPER_SNAKE | `MAX_FILE_SIZE` |
| CSS classes | kebab-case | `.vehicle-card` |
| CSS tokens | --kebab-case | `--color-primary` |

---

## 5. Commits

[Conventional Commits](https://www.conventionalcommits.org/) obligatoire :

| Préfixe | Usage |
|---------|-------|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `docs:` | Documentation uniquement |
| `style:` | Formatage (pas de changement logique) |
| `refactor:` | Refactorisation sans changement fonctionnel |
| `perf:` | Amélioration performance |
| `security:` | Correctif sécurité |
| `chore:` | Maintenance, dépendances |
| `versioning:` | Mise à jour versions/changelogs |

---

## 6. Interdictions

- ❌ `require()` dans le code applicatif
- ❌ `alert()`, `confirm()`, `prompt()`
- ❌ Valeurs CSS magiques (utiliser tokens)
- ❌ `fetch()` direct (utiliser services API)
- ❌ Secrets/tokens dans le code
- ❌ Fichiers `.db`, `.sqlite3` dans le repo
- ❌ `console.log()` en production (sauf debug intentionnel)
- ❌ SVG uploadé par les utilisateurs
- ❌ Composants classes React
- ❌ `innerHTML` sans DOMPurify
