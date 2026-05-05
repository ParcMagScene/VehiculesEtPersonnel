# Guide Sonos — eM@g

> **Version** : 2.4.0 — **Date** : 9 avril 2026

---

## 1. Présentation

Le module Sonos permet de contrôler les enceintes Sonos du réseau local directement depuis eM@g :
- **Now Playing** affiché sur l'écran TV et dans le Dashboard admin
- **Contrôles** : play, pause, next, previous, volume, mute
- **Zones** : sélection multi-room (groupes de speakers)
- **Favoris** : lecture en 1 clic depuis la liste Sonos
- **Seek, shuffle, repeat** pour la gestion avancée

### Technologie

Communication directe UPnP/SOAP via le package `sonos@1.14.3` (pas de bridge HTTP externe). L'IP de l'enceinte principale est stockée en base SQLite (`display_config`, clé `sonosIP`).

---

## 2. Configuration

### Prérequis
- Au moins une enceinte Sonos accessible sur le réseau local du serveur eM@g
- L'IP de l'enceinte doit être fixe (réservation DHCP recommandée)

### Configurer l'IP Sonos

1. Ouvrir le **Dashboard Écrans** → onglet **🎵 Sonos**
2. Saisir l'IP de l'enceinte dans le champ « Adresse IP Sonos »
3. Cliquer **Sauvegarder**

Le système résout automatiquement le coordinateur de groupe si l'enceinte fait partie d'un groupe Sonos.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (React)                           │
│  SonosTab.jsx — contrôles, zones, favoris   │
│  api/sonos.js — 20 méthodes client          │
├─────────────────────────────────────────────┤
│  Backend (Express)                          │
│  sonosRoutes.js — 18 endpoints /api/sonos/* │
│  Rate limiting : 120/min lecture, 60/min cmd│
├─────────────────────────────────────────────┤
│  Sonos UPnP (LAN)                           │
│  lib sonos npm → SOAP direct vers enceinte  │
│  Timeout 8s par requête                     │
└─────────────────────────────────────────────┘
```

### Fichiers

| Fichier | Rôle |
|---------|------|
| `apps/api/sonosRoutes.js` | Routes backend (~730 lignes) |
| `apps/web/src/utils/api/sonos.js` | Client API (20 méthodes) |
| `apps/web/src/components/DisplayDashboard/SonosTab.jsx` | Composant admin (~290 lignes) |
| `apps/tv-client/main.js` | Widget now-playing + volume (TV) |

---

## 4. Endpoints API

### Lecture seule (TV + users)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/sonos/config` | Token | IP configurée |
| GET | `/api/sonos/now-playing` | TV/Token | Titre, artiste, album art, volume |
| GET | `/api/sonos/zones` | Token | Liste des zones/rooms |
| GET | `/api/sonos/state/:zone` | Token | État complet d'une zone |
| GET | `/api/sonos/favorites` | Token | Favoris Sonos |

### Commandes (admin uniquement)

| Méthode | Route | Body | Description |
|---------|-------|------|-------------|
| POST | `/api/sonos/config` | `{ sonosIP }` | Sauver IP |
| POST | `/api/sonos/play/:zone` | — | Lecture |
| POST | `/api/sonos/pause/:zone` | — | Pause |
| POST | `/api/sonos/next/:zone` | — | Piste suivante |
| POST | `/api/sonos/previous/:zone` | — | Piste précédente |
| POST | `/api/sonos/volume/:zone` | `{ value: 0-100 }` | Volume |
| POST | `/api/sonos/mute/:zone` | — | Couper le son |
| POST | `/api/sonos/unmute/:zone` | — | Rétablir le son |
| POST | `/api/sonos/seek/:zone` | `{ position }` | Seek (secondes) |
| POST | `/api/sonos/shuffle/:zone` | `{ enabled }` | Shuffle on/off |
| POST | `/api/sonos/repeat/:zone` | `{ mode }` | none / all / one |
| POST | `/api/sonos/favorite/:zone` | `{ uri, title? }` | Jouer un favori |

> Le paramètre `:zone` est l'IP de la zone cible (ex: `192.168.1.42`).

### Routes dépréciées (Sunset: 2026-07-01)

| Route | Remplacée par |
|-------|---------------|
| `/api/display/sonos-config` | `/api/sonos/config` |
| `/api/display/sonos-now-playing` | `/api/sonos/now-playing` |
| `/api/sonos-now-playing` | `/api/sonos/now-playing` |

---

## 5. Sécurité

- **Authentification** : Token JWT pour config/zones/favorites, `optionalTvToken` pour now-playing
- **Autorisation** : `requireAdmin` pour toutes les commandes de contrôle
- **Rate limiting** : 120 req/min lecture, 60 req/min commandes
- **Validation** : IPv4 stricte, URI max 2048 car., volume 0-100, seek 0-86400s
- **Timeout** : 8s sur tous les appels UPnP (évite les hangs)
- **SSRF** : IP privées et localhost bloquées dans `getRadioFavicon()`
- **Parsing radio** : centralisé côté backend (pas de logique dupliquée côté client)

---

## 6. Widget TV

L'écran TV (`tv-client`) affiche un widget Sonos en bas de l'écran quand de la musique joue :
- Album art, titre, artiste
- Barre de volume verticale (ajoutée v2.4.0)
- Polling toutes les 5 secondes via `/api/sonos/now-playing`
- Animation slide-up à l'apparition

---

## 7. Dépannage

| Problème | Solution |
|----------|----------|
| « IP Sonos non configurée » | Configurer l'IP dans l'onglet Sonos |
| « Package sonos non installé » | `npm install sonos` dans le répertoire racine |
| « Sonos timeout — appareil injoignable » | Vérifier que l'enceinte est allumée et sur le même réseau |
| Widget TV ne s'affiche pas | Vérifier que la musique joue effectivement sur Sonos |
| Album art manquant | Normal pour certaines radios — le système tente de résoudre le favicon |
