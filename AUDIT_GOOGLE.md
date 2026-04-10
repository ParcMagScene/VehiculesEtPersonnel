# AUDIT GOOGLE — Intégration Google Calendar dans eM@g

> **Date** : 9 avril 2026  
> **Version analysée** : eM@g v2.2.0  
> **Branche** : `dev`  
> **Auditeur** : GitHub Copilot (Claude Opus 4.6)  
> **Statut** : ✅ **TOUTES LES PHASES TERMINÉES** — v2.3.0 (9 avril 2026)

---

## TABLE DES MATIÈRES

1. [Inventaire des fichiers](#1-inventaire-des-fichiers)
2. [Architecture actuelle](#2-architecture-actuelle)
3. [Flux OAuth actuel](#3-flux-oauth-actuel)
4. [Problèmes identifiés](#4-problèmes-identifiés)
5. [Causes des reconnections intempestives](#5-causes-des-reconnections-intempestives)
6. [Architecture cible](#6-architecture-cible)
7. [Plan d'action](#7-plan-daction)
8. [Estimation d'impact](#8-estimation-dimpact)

---

## 1. INVENTAIRE DES FICHIERS

### Frontend (apps/web/)

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/hooks/useGoogleCalendar.js` | Hook sync événements → affaires | ~55 |
| `src/components/vehicles/GoogleCalendarBanner.jsx` | Composant principal OAuth + UI | ~1100 |
| `src/components/vehicles/GoogleCalendarBanner.css` | Styles du banner | ~600 |
| `src/components/vehicles/GoogleCalendarConfig.jsx` | Configuration admin (Client ID, Calendar ID) | ~250 |
| `src/components/vehicles/GoogleEventFormModal.jsx` | Création/édition événements | ~200 |
| `src/utils/api/admin.js` | Méthodes API (token, events, config) | section |
| `src/utils/api/affaires.js` | `syncGoogleEventsToAffaires()` | section |
| `src/utils/indexedDB.js` | Cache config Maps API key | ~50 |
| `src/utils/logger.js` | `oauthLogger` | section |
| `src/constants/index.js` | `TIMING` constants | section |

### Backend (apps/api/)

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `googleCalendarRoutes.js` | Proxy Google Calendar API + stockage tokens | ~290 |
| `routes.js` (section config) | Config Google (client-id, calendar-id, maps-api-key) | ~100 |
| `affairesRoutes.js` (section sync) | POST `/affaires/sync-google-events` | ~80 |
| `planningRoutes.js` (task_assignments) | Support `source_type='google_event'` | section |
| `migrations.js` | Tables `google_tokens`, colonnes Google sur `affaires`, `task_assignments` | section |

### Non concernés

| Module | Google ? |
|--------|----------|
| `apps/tv-client/` | ❌ Aucune intégration |
| `src/components/mobile/` | ❌ Consomme `googleEvents` depuis App mais ne gère pas OAuth |

---

## 2. ARCHITECTURE ACTUELLE

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                          │
│                                                               │
│  GoogleCalendarBanner.jsx                                     │
│  ├── Charge GIS script (accounts.google.com/gsi/client)       │
│  ├── initTokenClient() → window.google.accounts.oauth2       │
│  ├── requestAccessToken() → popup Google                      │
│  ├── Reçoit access_token + expires_in                         │
│  ├── Envoie token au backend (POST /google-calendar/token)    │
│  ├── Timer renouvellement 15 min avant expiration             │
│  └── fetchEvents() via proxy backend                          │
│                                                               │
│  useGoogleCalendar.js                                         │
│  └── Sync auto affaires (détection AF### dans titres)         │
│                                                               │
│  App.jsx                                                      │
│  └── Wires googleEvents → GoogleCalendarBanner + Planning     │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Express)                          │
│                                                               │
│  googleCalendarRoutes.js                                      │
│  ├── Table: google_tokens (user_id, access_token, expires_at) │
│  ├── POST /token → stocke access_token en DB                  │
│  ├── GET /token-status → vérifie validité                     │
│  ├── DELETE /token → supprime (déconnexion)                   │
│  ├── GET /events → proxy Google Calendar API                  │
│  ├── POST/PATCH/DELETE /events → CRUD proxy                   │
│  └── Retry 2x sur 502/503/504, timeout 10s                   │
│                                                               │
│  Sécurité :                                                   │
│  ├── Token = access_token seulement (PAS de refresh_token)    │
│  ├── Suppression auto si 401 (expiré côté Google)             │
│  └── Aucun chiffrement des tokens en DB                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. FLUX OAUTH ACTUEL

### 3.1 Première connexion

```
1. Admin configure Client ID + Calendar ID dans GoogleCalendarConfig
2. Utilisateur ouvre le module Planning/Véhicules
3. GoogleCalendarBanner monte → charge GIS script
4. Vérifie token-status backend → hasToken: false
5. Utilisateur clique "Se connecter" → requestAccessToken(prompt='consent')
6. Popup Google → consentement → callback reçoit access_token (durée ~1h)
7. Token envoyé au backend → stocké en DB → localStorage['google_auto_signin'] = 'true'
8. fetchEvents() déclenché
```

### 3.2 Reconnexion automatique (session suivante)

```
1. GoogleCalendarBanner monte → charge GIS script
2. Vérifie token-status backend → hasToken: true/false
3. Si hasToken=true → fetchEvents() directement
4. Si hasToken=false → tente requestAccessToken(prompt='') (silencieux)
   → Si échoue (immediate_failed) → incrémente silentFailCountRef
   → Pas de popup sauf si l'utilisateur clique manuellement
```

### 3.3 Renouvellement token

```
1. Token reçu → tokenExpiryRef stocke le timestamp d'expiration
2. Timer programmé : renouveler 15 min avant expiration
3. renewAccessToken() → tokenClient.requestAccessToken(prompt='')
4. Si succès → nouveau token stocké backend + fetchEvents()
5. Si échec (immediate_failed) → silentFailCountRef++ → pas de popup
6. Si 401 sur un appel API → tente renewal → retry une fois
```

---

## 4. PROBLÈMES IDENTIFIÉS

### 🔴 CRITIQUE — Pas de refresh_token

**Problème** : Le système utilise uniquement des **access_tokens** (durée ~1h). Google Identity Services (GIS) avec `initTokenClient()` ne fournit PAS de refresh_token. Le renouvellement dépend d'un flux implicite (prompt='') qui :

- Peut échouer silencieusement (`immediate_failed`)
- Nécessite que l'utilisateur ait une session Google active dans le navigateur
- Ne fonctionne pas si les cookies tiers sont bloqués
- Ne fonctionne plus après fermeture du navigateur

**Impact** : L'utilisateur doit **re-consentir régulièrement**, typiquement à chaque nouvelle session de navigateur.

**Cause racine** : GIS Token Model (implicit) ne supporte pas les refresh tokens. Il faut migrer vers le **Authorization Code Flow** côté serveur.

### 🔴 CRITIQUE — Token non chiffré en DB

**Problème** : `access_token` stocké en clair dans SQLite (`google_tokens` table).

**Impact** : Un accès à la DB expose les tokens Google de tous les utilisateurs.

### 🟠 MAJEUR — Reconnections intempestives

**Causes multiples identifiées** (voir §5 en détail) :

1. Token expire après ~1h, GIS silent refresh échoue fréquemment
2. Le composant se remonte à chaque navigation (chargement GIS script à chaque fois)
3. Pas de cache persistant (IndexedDB) pour les événements
4. Chaque changement de vue/date déclenche `fetchEvents()` qui peut échouer en 401

### 🟠 MAJEUR — Pas de synchronisation multi-onglets

**Problème** : Aucun `BroadcastChannel` ou `SharedWorker`. Si 2 onglets sont ouverts :

- Chacun charge GIS indépendamment
- Chacun peut déclencher des popups OAuth
- Chacun fait ses propres appels API (doublement des requêtes)
- Les événements ne se synchronisent pas entre onglets

### 🟠 MAJEUR — fetchEvents() trop fréquent

**Problème** : `fetchEvents()` est déclenché à chaque :
- Changement de vue (`view`) — normal
- Changement de date (`currentDate`) — normal mais fréquent
- Succès de `renewAccessToken()` — redondant avec le déclencheur view/date
- Callback OAuth (chaque renouvellement) — doublon
- Retry après 401 — OK mais cumulatif

Le debounce de 300ms est insuffisant si l'utilisateur navigue rapidement.

### 🟡 MOYEN — Pas de rate limiting sur les endpoints Google

**Problème** : Aucun rate limiter sur les routes `/api/google-calendar/*`. Un client malveillant ou un bug frontend pourrait :
- Épuiser le quota Google Calendar API
- Saturer le backend avec des requêtes proxy

### 🟡 MOYEN — GIS script rechargé à chaque mount

**Problème** : Le `useEffect` qui charge le script GIS crée un nouveau `<script>` à chaque montage du composant et le supprime au démontage :

```javascript
const script = document.createElement('script');
script.src = 'https://accounts.google.com/gsi/client';
// ... 
return () => { script.parentNode.removeChild(script); };
```

Cela signifie :
- Rechargement réseau inutile (même si mis en cache navigateur)
- Possible état incohérent si le composant est monté/démonté rapidement
- `initializeGIS()` rappelé à chaque fois → nouveau `tokenClient`

### 🟡 MOYEN — Cache événements non persistant

**Problème** : `eventsCache` est un `useRef({})` en mémoire. Il est perdu :
- Au refresh de la page
- Au changement de composant parent
- À la fermeture d'onglet

Aucune utilisation d'IndexedDB pour les événements (seulement pour la config Maps API key).

### 🟡 MOYEN — Client ID exposé côté client

**Problème** : Le `googleClientId` est chargé depuis la config backend et transmis côté client pour initialiser GIS. C'est normal pour OAuth2, mais combiné avec l'absence de refresh token, cela signifie que tout le flux d'authentification est côté client.

### 🟢 MINEUR — localStorage utilisé pour un flag UX

**Problème** : `google_auto_signin` dans `localStorage` est un flag de commodité, pas un token. Risque faible mais devrait être dans un cookie HttpOnly ou supprimé au profit du backend.

### 🟢 MINEUR — Absence de logs structurés côté backend

**Problème** : Les erreurs Google Calendar côté backend sont loguées avec `logger.error()` mais sans structure exploitable (pas de code erreur Google, pas d'ID utilisateur dans le log).

---

## 5. CAUSES DES RECONNECTIONS INTEMPESTIVES

### Cause 1 : Token éphémère sans refresh_token

Le token GIS dure ~1h. Le renouvellement silencieux (prompt='') échoue souvent car :
- Cookies tiers bloqués (Firefox, Brave, Safari)
- Session Google expirée dans le navigateur
- Consentement « granulaire » récent de Google (2024)

**Résultat** : L'utilisateur voit « Session expirée » et doit re-cliquer.

### Cause 2 : GIS script rechargé à chaque navigation

Le composant `GoogleCalendarBanner` est monté dans la page Planning. À chaque navigation vers/depuis le Planning, le script GIS est :
1. Supprimé du DOM (cleanup useEffect)
2. Re-créé et re-chargé
3. `initializeGIS()` re-exécuté → nouveau `tokenClient`

L'ancien timer de renouvellement est perdu (nettoyé par le cleanup useEffect).

### Cause 3 : 401 cascade

Quand le token expire côté Google :
1. `fetchEvents()` → backend renvoie 401 + supprime le token de DB
2. Frontend tente `renewAccessToken()` → GIS popup (si silent échoue)
3. Si l'utilisateur ne réagit pas → `isSignedIn = false` → UI « Déconnecté »
4. Le prochain changement de vue/date relance le cycle

### Cause 4 : Pas de coordination multi-onglets

Deux onglets peuvent déclencher simultanément :
- Deux popups OAuth (bloquées par le navigateur)
- Deux renouvellements concurrents
- Des 401 en cascade car un onglet supprime le token que l'autre utilise

### Cause 5 : fetchEvents() en boucle sur erreur

Si `fetchEvents()` échoue avec une erreur non-401 (ex: réseau), pas de backoff. Le prochain changement de `view`/`currentDate` retente immédiatement.

---

## 6. ARCHITECTURE CIBLE

### 6.1 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                          │
│                                                               │
│  GoogleCalendarBanner.jsx (simplifié)                         │
│  ├── Bouton "Se connecter" → redirige vers /api/google/auth   │
│  ├── JAMAIS de token Google                                   │
│  ├── JAMAIS d'appel direct Google API                         │
│  ├── Cache IndexedDB pour événements                          │
│  └── BroadcastChannel pour coordination multi-onglets         │
│                                                               │
│  useGoogleSync.js (nouveau hook)                              │
│  ├── Timer sync toutes les 10 min (onglet principal)          │
│  ├── Sync sur action utilisateur (CRUD événement)             │
│  ├── BroadcastChannel leader election                         │
│  └── Diff intelligent Google ↔ local                          │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Express)                          │
│                                                               │
│  googleRoutes.js (refactorisé)                                │
│  ├── GET /api/google/auth → redirige vers Google OAuth2       │
│  ├── GET /api/google/callback → reçoit authorization_code     │
│  │   └── Échange code → access_token + refresh_token          │
│  │   └── Stocke refresh_token chiffré en DB                   │
│  │   └── Redirige vers frontend                               │
│  ├── GET /api/google/status → connecté ? token valide ?       │
│  ├── GET /api/google/events → fetch + cache                   │
│  ├── POST /api/google/events → créer événement                │
│  ├── PATCH /api/google/events/:id → modifier                  │
│  ├── DELETE /api/google/events/:id → supprimer                │
│  ├── POST /api/google/sync → sync manuelle                    │
│  ├── DELETE /api/google/disconnect → révoquer tokens          │
│  └── Rate limiter : 60 req/min/user                           │
│                                                               │
│  googleTokenManager.js (nouveau)                              │
│  ├── Stocke refresh_token chiffré (AES-256-GCM)              │
│  ├── Génère access_token à la demande via refresh_token       │
│  ├── Cache access_token en mémoire (1h)                       │
│  ├── Retry automatique si refresh échoue                      │
│  └── Jamais d'exposition du refresh_token                     │
│                                                               │
│  Table google_tokens (refactorisée) :                         │
│  ├── user_id INTEGER PRIMARY KEY                              │
│  ├── refresh_token_encrypted TEXT NOT NULL                     │
│  ├── refresh_token_iv TEXT NOT NULL                            │
│  ├── access_token_cached TEXT                                 │
│  ├── access_token_expires_at INTEGER                          │
│  ├── google_email TEXT                                        │
│  ├── scopes TEXT                                              │
│  ├── connected_at INTEGER                                     │
│  └── last_sync_at INTEGER                                     │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Flux OAuth2 cible (Authorization Code Flow)

```
1. Utilisateur clique "Connecter Google" (une seule fois)
2. Frontend redirige vers GET /api/google/auth
3. Backend génère l'URL Google OAuth2 :
   - response_type=code
   - access_type=offline (← CRITICAL pour refresh_token)
   - prompt=consent
   - redirect_uri=/api/google/callback
4. Utilisateur consent sur accounts.google.com
5. Google redirige vers /api/google/callback?code=XXX
6. Backend échange le code :
   - POST https://oauth2.googleapis.com/token
   - Reçoit : access_token + refresh_token + expires_in
7. Backend stocke :
   - refresh_token chiffré en DB (permanent)
   - access_token en mémoire (cache 1h)
8. Backend redirige vers frontend avec ?google=connected
9. Frontend affiche "Google Calendar connecté ✅"
10. PLUS JAMAIS de popup Google (sauf révocation manuelle)
```

### 6.3 Endpoints cibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/google/auth` | GET | Redirige vers OAuth2 Google |
| `/api/google/callback` | GET | Reçoit le code, échange tokens |
| `/api/google/status` | GET | État connexion + dernière sync |
| `/api/google/disconnect` | DELETE | Révoque tokens + supprime DB |
| `/api/google/events` | GET | Liste événements (proxy) |
| `/api/google/events` | POST | Créer événement |
| `/api/google/events/:id` | PATCH | Modifier événement |
| `/api/google/events/:id` | DELETE | Supprimer événement |
| `/api/google/sync` | POST | Force une synchronisation |
| `/api/google/calendars` | GET | Liste calendriers disponibles |

### 6.4 Synchronisation silencieuse

```
Déclencheurs AUTORISÉS :
  ✅ Login utilisateur → sync initiale (1 fois)
  ✅ Timer toutes les 10 min (onglet principal seulement)
  ✅ CRUD événement depuis eM@g
  ✅ Push Google webhook (futur)
  ✅ BroadcastChannel → notification aux autres onglets

Déclencheurs INTERDITS :
  ❌ Refresh page
  ❌ Navigation entre vues
  ❌ Reconnexion WebSocket
  ❌ Ouverture de modal
  ❌ Chaque onglet ouvert (leader election)

Comportement silencieux :
  → Aucune popup
  → Aucune demande utilisateur
  → Aucune déconnexion (même si Google temporairement indisponible)
  → Fallback sur cache IndexedDB si hors-ligne
```

### 6.5 Diff intelligent

```
Algorithme de sync :
1. Fetch événements Google (timeMin, timeMax)
2. Fetch événements locaux (cache IndexedDB + DB backend)
3. Pour chaque événement :
   a. Si Google uniquement → ajouter au cache local
   b. Si local uniquement → vérifier si supprimé côté Google
   c. Si les deux → comparer updated (dernière modification)
      - Si Google plus récent → mettre à jour local
      - Si local plus récent → pousser vers Google
      - Si identique → skip
4. Mettre à jour IndexedDB + notifier via BroadcastChannel
5. Logger le résultat de la sync
```

---

## 7. PLAN D'ACTION

### Phase A — Préparation (pas de breaking change) — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| A1 | Installer `googleapis` côté backend | `package.json` (api) | Nul | ✅ |
| A2 | Ajouter variable `GOOGLE_CLIENT_SECRET` au `.env` | `.env.development`, `.env.production` | Nul | ✅ |
| A3 | Créer `googleTokenManager.js` (chiffrement + refresh) | nouveau fichier | Nul | ✅ |
| A4 | Créer table `google_oauth_tokens` (avec refresh_token chiffré) | `migrations.js` | Nul | ✅ |
| A5 | Ajouter rate limiter sur routes Google | `config/rateLimiter.js` | Faible | ✅ |

### Phase B — Backend Authorization Code Flow — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| B1 | Créer `GET /api/google/auth` (génération URL OAuth2) | `googleRoutes.js` (nouveau) | Nul | ✅ |
| B2 | Créer `GET /api/google/callback` (échange code → tokens) | `googleRoutes.js` | Nul | ✅ |
| B3 | Créer `GET /api/google/status` (état connexion) | `googleRoutes.js` | Nul | ✅ |
| B4 | Créer `DELETE /api/google/disconnect` | `googleRoutes.js` | Nul | ✅ |
| B5 | Migrer proxy events vers refresh_token backend | `googleRoutes.js` | Moyen | ✅ |
| B6 | Conserver anciennes routes en parallèle (compatibilité) | `googleCalendarRoutes.js` | Nul | ✅ |

### Phase C — Frontend (simplification) — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| C1 | Méthodes API v2 dans `admin.js` | `admin.js` | Nul | ✅ |
| C2 | Simplifier `GoogleCalendarBanner.jsx` (supprimer GIS) | `GoogleCalendarBanner.jsx` | Moyen | ✅ |
| C3 | Supprimer chargement script GIS | `GoogleCalendarBanner.jsx` | Moyen | ✅ |
| C4 | Nouveau bouton connexion → redirige API `/api/google/auth` | `GoogleCalendarBanner.jsx` | Faible | ✅ |
| C5 | Adapter `GoogleCalendarConfig.jsx` (v2 disconnect) | `GoogleCalendarConfig.jsx` | Faible | ✅ |

### Phase D — Synchronisation intelligente — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| D1 | Créer `useGoogleSync.js` (leader election + BroadcastChannel + IndexedDB) | nouveau hook | Moyen | ✅ |
| D2 | Implémenter diff intelligent (Google ↔ local) | `useGoogleSync.js` | Moyen | ✅ |
| D3 | Cache IndexedDB pour événements Google | `useGoogleSync.js` (IDB intégré) | Faible | ✅ |
| D4 | Intégrer dans `GoogleCalendarBanner.jsx` | `GoogleCalendarBanner.jsx` | Faible | ✅ |

### Phase E — Stabilisation & Sécurité — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| E1 | Migrer 4 consommateurs vers API v2 | `PeriodCalendarModal`, `AffairesPanel`, `AffaireDetailPanel`, `GoogleCalendarConfig` | Moyen | ✅ |
| E2 | Supprimer 11 méthodes legacy dans `admin.js` | `admin.js` | Moyen | ✅ |
| E3 | Archiver `googleCalendarRoutes.js` → `.legacy.js` | `googleCalendarRoutes.legacy.js` | Faible | ✅ |
| E4 | Drop table `google_tokens` (legacy) | `migrations.js` | Moyen | ✅ |
| E5 | Hardening (calendarId sanitization, eventId validation, CSRF cleanup) | `googleRoutes.js` | Faible | ✅ |

### Phase F — Documentation & Versioning — ✅ Terminée (9 avril 2026)

| # | Tâche | Fichiers | Risque | Statut |
|---|-------|----------|--------|--------|
| F1 | Incrémenter version → 2.3.0 | `VERSION.md`, `package.json`, `versions.json` | Nul | ✅ |
| F2 | Mettre à jour CHANGELOG.md | `CHANGELOG.md` | Nul | ✅ |
| F3 | Créer guide setup Google OAuth2 | `docs/03-Guides/GUIDE_GOOGLE_OAUTH2.md` | Nul | ✅ |
| F4 | Mettre à jour architecture docs | `docs/01-Architecture/ARCHITECTURE.md` | Nul | ✅ |
| F5 | Mettre à jour statuts AUDIT_GOOGLE.md | `AUDIT_GOOGLE.md` | Nul | ✅ |

---

## 8. ESTIMATION D'IMPACT

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `apps/api/googleRoutes.js` | Nouveau système OAuth2 Authorization Code |
| `apps/api/googleTokenManager.js` | Gestion tokens (chiffrement, refresh, cache) |
| `apps/web/src/hooks/useGoogleSync.js` | Sync silencieuse + BroadcastChannel + timer |

### Fichiers à modifier significativement

| Fichier | Nature du changement |
|---------|---------------------|
| `apps/web/src/components/vehicles/GoogleCalendarBanner.jsx` | Retirer ~500 lignes (GIS, token, renewal) |
| `apps/web/src/components/vehicles/GoogleCalendarConfig.jsx` | Simplifier (pas de Client ID frontend) |
| `apps/web/src/hooks/useGoogleCalendar.js` | Adapter vers nouveau hook sync |
| `apps/web/src/utils/indexedDB.js` | Ajouter store `googleEvents` |
| `apps/api/googleCalendarRoutes.js` | Déprécier puis supprimer |
| `apps/api/migrations.js` | Nouvelle table google_tokens_v2 |
| `apps/api/server.js` | Monter nouvelles routes |

### Fichiers non impactés

- `GoogleEventFormModal.jsx` — Fonctionne déjà via API proxy
- `apps/tv-client/` — Pas d'intégration Google
- `apps/web/src/components/mobile/` — Consomme les events, pas l'auth
- Tout le reste du frontend et backend

### Prérequis

| Élément | Statut | Action requise |
|---------|--------|----------------|
| `GOOGLE_CLIENT_SECRET` | ✅ Implémenté | Variable `.env` backend |
| `GOOGLE_CLIENT_ID` | ✅ Migré vers `.env` | Variable `.env` backend |
| `googleapis` npm | ✅ Installé | `apps/api/package.json` |
| `GOOGLE_ENCRYPTION_KEY` (AES-256) | ✅ Implémenté | Variable `.env` backend |
| Authorized redirect URI | ✅ Documenté | Voir `GUIDE_GOOGLE_OAUTH2.md` |

---

## RÉSUMÉ DES PRIORITÉS

| Priorité | Problème | Solution |
|----------|----------|---------|
| 🔴 P0 | Pas de refresh_token → reconnections | Authorization Code Flow backend |
| 🔴 P0 | Token non chiffré en DB | AES-256-GCM + clé dans .env |
| 🟠 P1 | Reconnections intempestives | Supprimer GIS frontend, tout côté serveur |
| 🟠 P1 | Pas de multi-onglets | BroadcastChannel + leader election |
| 🟠 P1 | fetchEvents() trop fréquent | Timer 10min + cache IndexedDB |
| 🟡 P2 | Pas de rate limiting | express-rate-limit sur /api/google/* |
| 🟡 P2 | GIS script rechargé | Supprimé (migration backend) |
| 🟡 P2 | Cache non persistant | IndexedDB pour événements |
| 🟢 P3 | Logs non structurés | Logger enrichi côté backend |

---

> **⚠️ ATTENTION** : Aucune modification de code n'a été effectuée.  
> Ce document est un audit + plan d'action à valider avant implémentation.  
> **Prochaine étape** : Validation du plan par l'utilisateur → Phase A.
