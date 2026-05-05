Tu es GitHub Copilot, expert en Express.js, React 18, SQLite (better-sqlite3), sécurité JWT, PWA, et gestion de sessions.

🎯 Objectif
Implémenter un système complet de **renouvellement silencieux du token JWT**, afin que les utilisateurs ne soient plus déconnectés trop souvent.

Tu dois appliquer les modifications suivantes **sans casser l’existant**, **sans modifier la logique métier**, **sans casser le mobile**, **sans casser le TV client**, et **sans casser les routes actuelles**.

---

# 🧩 Étape 1 — Backend : endpoint /api/auth/refresh

Créer un endpoint sécurisé :

POST /api/auth/refresh

Fonctionnalités :

- Vérifier le JWT actuel via `authenticateToken`
- Vérifier que la session existe dans `active_sessions`
- Mettre à jour `last_activity = CURRENT_TIMESTAMP`
- Générer un nouveau JWT avec la même payload
- Retourner `{ token: "..." }`
- Ne rien casser dans les routes existantes

Contraintes :

- Ne pas modifier les routes actuelles
- Ne pas modifier la structure de la table active_sessions
- Ne pas modifier le schéma SQLite
- Ne pas invalider les sessions existantes

---

# 🧩 Étape 2 — Backend : mise à jour automatique de last_activity

Dans `middleware/authenticate.js` :

- Ajouter une mise à jour silencieuse de `last_activity` à chaque requête authentifiée
- Utiliser `token_hash` pour identifier la session
- Ne pas ralentir les requêtes (utiliser un UPDATE simple)

---

# 🧩 Étape 3 — Frontend : Hook useSilentRefresh()

Créer un hook global :

src/hooks/useSilentRefresh.js

Fonctionnalités :

- Lire l’expiration du JWT (payload exp)
- Déclencher un refresh silencieux 48h avant expiration
- Déclencher un refresh si l’app reste ouverte longtemps
- Mettre à jour automatiquement `api.setAuth(newToken)`
- Ne jamais afficher de popup
- Ne jamais rediriger l’utilisateur
- Fonctionner sur desktop, mobile, PWA, TV

---

# 🧩 Étape 4 — Frontend : intégration dans App.jsx

Dans `App.jsx` :

- Importer `useSilentRefresh()`
- L’appeler juste après `useAuth()`
- Ne rien casser dans la logique existante
- Ne pas modifier la navigation
- Ne pas modifier les modules

---

# 🧩 Étape 5 — Frontend : persistance du token dans IndexedDB

Dans `src/utils/indexedDB.js` :

- Ajouter un store `auth`
- Stocker `{ token, updatedAt }`
- Charger le token au démarrage si localStorage est vide
- Toujours synchroniser localStorage + IndexedDB

Contraintes :

- Ne pas casser les autres stores
- Ne pas casser la PWA
- Ne pas casser le mobile

---

# 🧩 Étape 6 — TV Client : rafraîchissement périodique

Dans `DisplayDashboard` :

- Ajouter un timer silencieux :
    setInterval(refreshTokenSilently, 6 * 60 * 60 * 1000)
- Ne pas modifier l’UI
- Ne pas modifier les playlists
- Ne pas modifier les écrans

---

# 🧩 Étape 7 — Sécurité

- Conserver SameSite=Lax
- Si HTTPS actif → ajouter Secure=true
- Ne pas modifier CORS
- Ne pas modifier les permissions

---

# 🧩 Étape 8 — Rapport final

À la fin, produire un rapport listant :

- fichiers modifiés
- fichiers créés
- endpoints ajoutés
- hooks ajoutés
- tests manuels recommandés

---

# 🚀 Action
Commence maintenant par créer l’endpoint `/api/auth/refresh`, puis applique les étapes dans l’ordre.
---

## Voir aussi

- [Architecture — section Authentification](../01-Architecture/ARCHITECTURE.md#13-authentification--sécurité)
- [Sécurité](../02-Securite/SECURITY.md)