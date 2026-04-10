# AUDIT SONOS — eM@g

> **Date** : 9 avril 2026  
> **Version** : 2.3.0  
> **Branche** : `dev`  
> **Auteur** : GitHub Copilot  

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [État de l'existant](#2-état-de-lexistant)
3. [Inventaire des fichiers](#3-inventaire-des-fichiers)
4. [Endpoints actuels](#4-endpoints-actuels)
5. [Problèmes identifiés](#5-problèmes-identifiés)
6. [Ce qui peut être réutilisé](#6-ce-qui-peut-être-réutilisé)
7. [Ce qui doit être refactorisé](#7-ce-qui-doit-être-refactorisé)
8. [Ce qui doit être créé](#8-ce-qui-doit-être-créé)
9. [Architecture cible](#9-architecture-cible)
10. [Plan d'action](#10-plan-daction)
11. [Suivi des étapes](#11-suivi-des-étapes)

---

## 1. Résumé exécutif

### État actuel
L'intégration Sonos dans eM@g est **partielle** : seul le **Now Playing** (lecture seule) est implémenté, sans aucun contrôle de lecture. Le code est réparti entre `displayRoutes.js` (backend), le TV-client vanilla JS, et un onglet `SonosTab` dans le Dashboard Écrans (admin web).

### Technologie actuelle
- **Package npm** : `sonos@1.14.3` (communication directe LAN via UPnP/SOAP)
- **Pas de Sonos HTTP API** : le code utilise la lib `sonos` Node.js, pas un bridge HTTP externe
- **Stockage config** : IP Sonos en BDD (`display_config`, clé `sonosIP`)
- **Aucune variable d'env** pour Sonos

### Ce qui manque
- ❌ Contrôles de lecture (play, pause, next, previous)
- ❌ Contrôle du volume
- ❌ Mute / unmute
- ❌ Sélection de zone / multiroom
- ❌ Favoris / presets / playlists
- ❌ Seek / shuffle / repeat
- ❌ Module Sonos autonome (tout est dans `displayRoutes.js`)
- ❌ Routes dédiées (`sonosRoutes.js`)
- ❌ API client dédiée (`api/sonos.js`)
- ❌ Composants frontend dédiés (`components/sonos/`)
- ❌ Rate limiting sur les commandes Sonos
- ❌ Intégration mobile

---

## 2. État de l'existant

| Couche | Fichier | État | Fonctionnalité |
|--------|---------|------|----------------|
| Backend | `displayRoutes.js` L1265-1510 | ✅ Fonctionnel | Config IP + Now Playing (lecture seule) |
| Backend | `displayRoutes.js` L2107-2115 | ⚠️ Legacy | Endpoint compat sans auth |
| TV-client | `index.html` L73-79 | ✅ Fonctionnel | Widget HTML Sonos |
| TV-client | `main.js` L452-506 | ✅ Fonctionnel | Polling now playing 5s + affichage |
| TV-client | `styles.css` L328-378 | ✅ Fonctionnel | Styles widget Sonos |
| Web admin | `SonosTab.jsx` | ✅ Fonctionnel | Config IP + monitoring now playing |
| Web admin | `AppearanceTab.jsx` L36-186 | ⚠️ Dupliqué | Config IP Sonos (doublon) |
| Web admin | `TVScreenMini.jsx` L138-214 | ✅ Fonctionnel | Aperçu miniature now playing |
| Web admin | `DisplayDashboardPanel.jsx` | ✅ Fonctionnel | Onglet Sonos dans Dashboard |
| Web admin | `DisplayDashboardPanel.css` | ✅ Fonctionnel | Styles SonosTab + mini preview |
| API client | `api/display.js` L199-210 | ✅ Fonctionnel | 3 méthodes API |
| Config | `config/helmet.js` L29 | ✅ Requis | CSP `imgSrc: '*'` pour album art |

---

## 3. Inventaire des fichiers

### 3.1 Backend — `apps/api/displayRoutes.js`

#### Sections Sonos (≈250 lignes sur 2160 au total)

| Lignes | Fonction/Route | Description |
|--------|----------------|-------------|
| 1265-1273 | `GET /api/display/sonos-config` | Lecture IP depuis SQLite (`authenticateToken`) |
| 1276-1288 | `POST /api/display/sonos-config` | Sauvegarde IP (`requireAdmin`) |
| 1290-1400 | `getRadioFavicon()` | Helper: résolution favicon radio via ICY headers + curl |
| 1402-1495 | `getSonosNowPlaying()` | Helper principal: connexion lib Sonos, groupes, radios, artwork |
| 1497-1504 | `GET /api/display/sonos-now-playing` | Endpoint public (`optionalTvToken`) |
| 2107-2115 | `GET /api/sonos-now-playing` | Endpoint legacy **sans auth** |

#### Dépendances
- `sonos@^1.14.3` (import dynamique `await import('sonos')`)
- `child_process.execFile` → `curl` (favicon radio)
- Table `display_config` (clé `sonosIP`)

#### Logique notable
- **Détection de groupe** : parcourt `getAllGroups()`, identifie le coordinateur
- **Radios** : détecte `x-rincon-mp3radio://`, `x-sonosapi-stream:`, `aac://`, etc.
- **Favicon** : headers ICY → `icy-url` → test apple-touch-icon.png / favicon.ico
- **Cache** : `radioFaviconCache` en mémoire (Map)
- **SSRF** : blocage IPs privées dans `getRadioFavicon()`

### 3.2 TV-Client — `apps/tv-client/`

| Fichier | Lignes | Sonos |
|---------|--------|-------|
| `index.html` | 98 | Widget HTML `#sonos-widget` (L73-79) |
| `main.js` | 637 | `loadSonosNowPlaying()` L452, `updateSonosWidget()` L464, polling 5s |
| `styles.css` | 579 | Widget fixe bas d'écran (L328-378), responsive (L499) |

#### Points d'attention
- App vanilla JS (pas de framework, pas de bundler)
- Polling dédié 5s + refresh via tv-state 30s
- Fallback album art : `data.albumArtURI || '/display-logo/logo.png'`
- Parsing radio "Artiste - Titre" (logique dupliquée avec TVScreenMini)
- Cache URLs en 404 (`albumArt._failedUrls = new Set()`)

### 3.3 Frontend Web — `apps/web/src/components/DisplayDashboard/`

| Fichier | Lignes | Sonos |
|---------|--------|-------|
| `SonosTab.jsx` | 139 | Config IP + monitoring now playing (polling 5s optionnel) |
| `AppearanceTab.jsx` | 213 | Config IP Sonos **dupliquée** (L36, L179-186) |
| `TVScreenMini.jsx` | 219 | Aperçu widget Sonos dans miniature TV (L138-214) |
| `DisplayDashboardPanel.jsx` | 186 | Lazy import SonosTab, onglet `sonos` |
| `DisplayDashboardPanel.css` | 3179 | Styles `.dtv-sonos-*` (L1861-1960), `.tv-mini-sonos-*` (L2552-2615) |

### 3.4 API Client — `apps/web/src/utils/api/display.js`

```javascript
getDisplaySonosConfig()        // GET  /display/sonos-config
saveDisplaySonosConfig(ip)     // POST /display/sonos-config
getDisplaySonosNowPlaying()    // GET  /display/sonos-now-playing
```

---

## 4. Endpoints actuels

| Endpoint | Méthode | Auth | Utilisé par |
|----------|---------|------|-------------|
| `/api/display/sonos-config` | GET | `authenticateToken` | SonosTab, AppearanceTab |
| `/api/display/sonos-config` | POST | `authenticateToken` + `requireAdmin` | SonosTab, AppearanceTab |
| `/api/display/sonos-now-playing` | GET | `optionalTvToken` | TV-client, SonosTab |
| `/api/display/tv-state` | GET | `authenticateToken` | TVPreviewPanel |
| `/api/display/tv-public-state` | GET | `optionalTvToken` | TV-client |
| `/api/sonos-now-playing` | GET | **aucune** ⚠️ | Legacy (compat) |

---

## 5. Problèmes identifiés

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| P1 | 🔴 Haute | **Endpoint legacy sans auth** : `GET /api/sonos-now-playing` n'a aucun middleware | Fuite d'info (titre en cours) si réseau exposé |
| P2 | 🟠 Moyenne | **Duplication config IP** : éditable dans AppearanceTab ET SonosTab | Confusion UX, code dupliqué |
| P3 | 🟠 Moyenne | **Code Sonos dans displayRoutes** : 250 lignes dans un fichier de 2160 | Couplage module Display ↔ Sonos |
| P4 | 🟠 Moyenne | **Vulnérabilité dépendance** : `sonos@1.14.3` → `ip@*` (GHSA-2p57-rm9w-gvfp, HIGH) | Protection SSRF applicative en place mais risque résiduel |
| P5 | 🔵 Info | **Pas de rate limiting** sur les endpoints Sonos | Risque de spam (surtout pour les futures commandes) |
| P6 | 🔵 Info | **Logique parsing radio dupliquée** : TV-client, TVScreenMini, SonosTab | Maintenance difficile si le format change |
| P7 | 🔵 Info | **Pas de contrôle** : uniquement lecture seule (now playing) | Feature gap majeur vs. spécification |
| P8 | 🔵 Info | **Architecture Sonos HTTP API non requise** : la lib `sonos` communique directement en UPnP | Pas besoin d'un bridge HTTP externe (contrairement à la spec initiale) |

---

## 6. Ce qui peut être réutilisé

| Élément | Fichier source | Réutilisation |
|---------|---------------|---------------|
| `getSonosNowPlaying()` | displayRoutes.js L1402-1495 | Extraire dans `sonosRoutes.js` |
| `getRadioFavicon()` | displayRoutes.js L1290-1400 | Extraire dans `sonosRoutes.js` |
| Widget Now Playing HTML | tv-client/index.html L73-79 | Conserver tel quel |
| Widget Now Playing JS | tv-client/main.js L452-506 | Adapter pour utiliser les nouveaux endpoints |
| Widget Now Playing CSS | tv-client/styles.css L328-378 | Conserver tel quel |
| SonosTab monitoring | SonosTab.jsx | Extraire la partie Now Playing → `SonosNowPlaying.jsx` |
| Mini preview Sonos | TVScreenMini.jsx L138-214 | Conserver, pointer vers nouveau composant |
| API methods | api/display.js L199-210 | Migrer vers `api/sonos.js` |
| Styles Sonos admin | DisplayDashboardPanel.css | Migrer vers `SonosPanel.css` |
| SSRF protection | getRadioFavicon() | Conserver dans nouveau module |

---

## 7. Ce qui doit être refactorisé

| Élément | Action |
|---------|--------|
| Code Sonos dans `displayRoutes.js` | Extraire vers `sonosRoutes.js` dédié |
| Config IP dans AppearanceTab | Supprimer la duplication, garder uniquement dans SonosPanel |
| Endpoint legacy `/api/sonos-now-playing` | Ajouter auth ou supprimer |
| API client `api/display.js` | Migrer les 3 méthodes vers `api/sonos.js` |
| SonosTab dans DisplayDashboard | Transformer en redirection vers le module Sonos autonome |
| Logique parse radio | Centraliser côté backend (pas de parsing côté client) |

---

## 8. Ce qui doit être créé

### Backend (`apps/api/sonosRoutes.js`)

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `GET /api/sonos/config` | GET | admin | Config Sonos (IP, options) |
| `POST /api/sonos/config` | POST | admin | Sauver config Sonos |
| `GET /api/sonos/zones` | GET | user | Liste des zones/rooms |
| `GET /api/sonos/state/:zone` | GET | user | État complet d'une zone |
| `GET /api/sonos/now-playing` | GET | optionalTvToken | Now playing (compat TV) |
| `POST /api/sonos/play/:zone` | POST | admin | Lancer la lecture |
| `POST /api/sonos/pause/:zone` | POST | admin | Mettre en pause |
| `POST /api/sonos/next/:zone` | POST | admin | Piste suivante |
| `POST /api/sonos/previous/:zone` | POST | admin | Piste précédente |
| `POST /api/sonos/volume/:zone` | POST | admin | Régler le volume |
| `POST /api/sonos/mute/:zone` | POST | admin | Muter |
| `POST /api/sonos/unmute/:zone` | POST | admin | Démuter |
| `POST /api/sonos/favorite/:zone` | POST | admin | Jouer un favori |
| `GET /api/sonos/favorites` | GET | user | Liste des favoris Sonos |

### Frontend (`apps/web/src/components/sonos/`)

| Composant | Description |
|-----------|-------------|
| `SonosPanel.jsx` | Panel principal (onglet header ou sous-module) |
| `SonosPanel.css` | Styles dédiés |
| `SonosZoneSelector.jsx` | Sélection de zone / multiroom |
| `SonosNowPlaying.jsx` | Affichage Now Playing réutilisable |
| `SonosControls.jsx` | Play/pause/next/prev/volume/mute |
| `SonosPresets.jsx` | Favoris, radios, playlists |

### API Client (`apps/web/src/utils/api/sonos.js`)

| Méthode | Endpoint |
|---------|----------|
| `getSonosConfig()` | GET /sonos/config |
| `saveSonosConfig(data)` | POST /sonos/config |
| `getSonosZones()` | GET /sonos/zones |
| `getSonosState(zone)` | GET /sonos/state/:zone |
| `getSonosNowPlaying()` | GET /sonos/now-playing |
| `sonosPlay(zone)` | POST /sonos/play/:zone |
| `sonosPause(zone)` | POST /sonos/pause/:zone |
| `sonosNext(zone)` | POST /sonos/next/:zone |
| `sonosPrevious(zone)` | POST /sonos/previous/:zone |
| `sonosVolume(zone, value)` | POST /sonos/volume/:zone |
| `sonosMute(zone)` | POST /sonos/mute/:zone |
| `sonosUnmute(zone)` | POST /sonos/unmute/:zone |
| `sonosPlayFavorite(zone, name)` | POST /sonos/favorite/:zone |
| `getSonosFavorites()` | GET /sonos/favorites |

### TV-Client

| Élément | Action |
|---------|--------|
| Widget Now Playing | Adapter les endpoints polling (`/api/sonos/now-playing`) |
| Widget Volume (optionnel) | Petit indicateur volume dans le widget existant |

### Header / App.jsx

| Élément | Action |
|---------|--------|
| Onglet Sonos | Ajouter dans `allTabs` de Header.jsx (icône `Music`) |
| Route module | Ajouter `activeModule === 'sonos'` dans App.jsx |

---

## 9. Architecture cible

```
apps/api/
  sonosRoutes.js          ← NOUVEAU (routes + helpers extraits de displayRoutes)
  displayRoutes.js        ← MODIFIÉ (suppression code Sonos, redirect compat)

apps/web/src/
  components/sonos/       ← NOUVEAU
    SonosPanel.jsx
    SonosPanel.css
    SonosZoneSelector.jsx
    SonosNowPlaying.jsx
    SonosControls.jsx
    SonosPresets.jsx
  components/DisplayDashboard/
    SonosTab.jsx          ← MODIFIÉ (simplifié → redirection ou embed SonosNowPlaying)
    AppearanceTab.jsx     ← MODIFIÉ (suppression config IP dupliquée)
  utils/api/
    sonos.js              ← NOUVEAU
    display.js            ← MODIFIÉ (suppression méthodes Sonos migrées)
    index.js              ← MODIFIÉ (enregistrement registerSonosMethods)

apps/tv-client/
  main.js                 ← MODIFIÉ (nouvel endpoint /api/sonos/now-playing)

Header.jsx                ← MODIFIÉ (ajout onglet Sonos)
App.jsx                   ← MODIFIÉ (ajout route module Sonos)
```

### Flux de données

```
┌──────────────┐     UPnP/SOAP      ┌──────────────┐
│ Enceinte(s)  │◄──────────────────►│  sonosRoutes  │
│   Sonos LAN  │   lib sonos npm    │  (backend)    │
└──────────────┘                    └──────┬───────┘
                                          │ REST API
                    ┌─────────────────────┼─────────────────┐
                    │                     │                  │
              ┌─────▼─────┐        ┌─────▼─────┐    ┌──────▼──────┐
              │ TV-client  │        │ Web admin  │    │   Mobile    │
              │ (polling)  │        │ (SonosPanel│    │ (futur)     │
              └────────────┘        └────────────┘    └─────────────┘
```

---

## 10. Plan d'action

### Phase A — Extraction & refactoring backend
- [ ] A1. Créer `apps/api/sonosRoutes.js` avec les helpers et routes extraits
- [ ] A2. Ajouter les nouveaux endpoints de contrôle (play, pause, next, prev, volume, mute, favorites, zones)
- [ ] A3. Ajouter rate limiting sur les endpoints de commande
- [ ] A4. Supprimer le code Sonos de `displayRoutes.js` (garder redirect compat)
- [ ] A5. Enregistrer `sonosRoutes.js` dans `server.js`
- [ ] A6. Ajouter/mettre à jour tests smoke pour les endpoints Sonos

### Phase B — API client frontend
- [ ] B1. Créer `apps/web/src/utils/api/sonos.js` avec toutes les méthodes
- [ ] B2. Enregistrer dans `api/index.js`
- [ ] B3. Migrer les appels Sonos de `api/display.js` vers `api/sonos.js` (garder compat)

### Phase C — Module frontend complet
- [ ] C1. Créer `SonosNowPlaying.jsx` (composant réutilisable)
- [ ] C2. Créer `SonosControls.jsx` (play/pause/next/prev/volume)
- [ ] C3. Créer `SonosZoneSelector.jsx` (liste zones, sélection)
- [ ] C4. Créer `SonosPresets.jsx` (favoris, radios)
- [ ] C5. Créer `SonosPanel.jsx` (assemblage)
- [ ] C6. Créer `SonosPanel.css` (Design System tokens)
- [ ] C7. Ajouter onglet Sonos dans Header.jsx
- [ ] C8. Ajouter route module dans App.jsx

### Phase D — Intégration Display Dashboard & TV-client
- [ ] D1. Simplifier `SonosTab.jsx` → embed `SonosNowPlaying` + lien vers panel
- [ ] D2. Supprimer config IP de `AppearanceTab.jsx`
- [ ] D3. Adapter `tv-client/main.js` → nouvel endpoint `/api/sonos/now-playing`
- [ ] D4. Optionnel : ajouter indicateur volume dans widget TV

### Phase E — Sécurité & robustesse
- [ ] E1. Supprimer ou sécuriser endpoint legacy `/api/sonos-now-playing`
- [ ] E2. Centraliser le parsing radio côté backend
- [ ] E3. Valider les entrées (zone, volume, nom favori)
- [ ] E4. Gestion erreurs : timeout Sonos, device offline, zone inconnue
- [ ] E5. Logs structurés pour toutes les commandes

### Phase F — Documentation & versioning
- [ ] F1. Incrémenter version → `2.4.0`
- [ ] F2. Mettre à jour CHANGELOG.md
- [ ] F3. Créer `docs/03-Guides/GUIDE_SONOS.md`
- [ ] F4. Mettre à jour `docs/01-Architecture/ARCHITECTURE.md`
- [ ] F5. Mettre à jour prompts-index.json
- [ ] F6. Build validation

---

## 11. Suivi des étapes

| Phase | Étape | Statut | Date |
|-------|-------|--------|------|
| A | A1. Créer sonosRoutes.js | ✅ | 2026-04-09 |
| A | A2. Endpoints de contrôle | ✅ | 2026-04-09 |
| A | A3. Rate limiting | ✅ | 2026-04-09 |
| A | A4. Nettoyage displayRoutes | ✅ | 2026-04-09 |
| A | A5. Enregistrement server.js | ✅ | 2026-04-09 |
| A | A6. Tests smoke | ✅ | 2026-04-09 |
| B | B1. API client sonos.js | ✅ | 2026-04-09 |
| B | B2. Enregistrement index.js | ✅ | 2026-04-09 |
| B | B3. Migration display.js | ✅ | 2026-04-09 |
| C | C1. SonosTab refonte complète | ✅ | 2026-04-09 |
| C | C2. PlaybackControls | ✅ | 2026-04-09 |
| C | C3. ZoneCard + FavoritesList | ✅ | 2026-04-09 |
| C | C4. CSS contrôles/zones/favoris | ✅ | 2026-04-09 |
| D | D1. SonosTab simplifié | ✅ | 2026-04-09 |
| D | D2. Nettoyage AppearanceTab | ✅ | 2026-04-09 |
| D | D3. TV-client migration | ✅ | 2026-04-09 |
| D | D4. Widget TV volume | ✅ | 2026-04-09 |
| D | D5. DashboardTasksSidebar migration | ✅ | 2026-04-09 |
| D | D6. Nettoyage display.js legacy | ✅ | 2026-04-09 |
| E | E1. Dépréciation routes compat | ✅ | 2026-04-09 |
| E | E2. Centraliser parse radio | ✅ | 2026-04-09 |
| E | E3. Validation IPv4 stricte + entrées | ✅ | 2026-04-09 |
| E | E4. Timeout UPnP 8s | ✅ | 2026-04-09 |
| E | E5. Logs structurés enrichis | ✅ | 2026-04-09 |
| F | F1. Version 2.4.0 | ✅ | 2026-04-09 |
| F | F2. CHANGELOG.md | ✅ | 2026-04-09 |
| F | F3. GUIDE_SONOS.md | ✅ | 2026-04-09 |
| F | F4. ARCHITECTURE.md | ✅ | 2026-04-09 |
| F | F5. Build validation | ✅ | 2026-04-09 |
