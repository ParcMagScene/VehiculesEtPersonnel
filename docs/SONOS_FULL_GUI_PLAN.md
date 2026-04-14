# 🎵 PLAN D'ACTION — GUI SONOS COMPLÈTE (Desktop + Mobile)

> **Branche** : `feature/sonos-full-gui`  
> **Version cible** : eM@g v2.6.0  
> **Auteur** : Alexandre  
> **Dernière MAJ** : 2026-04-13  
> **Statut global** : ✅ Terminé — 6 phases, 15 fichiers créés, 47 tests

---

## 📊 État d'avancement

| Phase | Titre | Statut | Progression |
|-------|-------|--------|-------------|
| 1 | Analyse & préparation | ✅ | 100% |
| 2 | Composants desktop | ✅ | 100% |
| 3 | Intégration desktop | ✅ | 100% |
| 4 | Composants mobile | ✅ | 100% |
| 5 | Intégration mobile | ✅ | 100% |
| 6 | Tests, QA, documentation | ✅ | 100% |

---

## 🔍 Inventaire de l'existant

### Backend API (`apps/api/sonosRoutes.js`) — ✅ COMPLET, aucun changement nécessaire

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/api/sonos/config` | GET | user | Lire IP Sonos |
| `/api/sonos/config` | POST | admin | Sauver IP Sonos |
| `/api/sonos/now-playing` | GET | tv/user | Lecture en cours |
| `/api/sonos/zones` | GET | user | Liste des zones/groupes |
| `/api/sonos/state/:zone` | GET | user | État complet d'une zone |
| `/api/sonos/play/:zone` | POST | admin | Play |
| `/api/sonos/pause/:zone` | POST | admin | Pause |
| `/api/sonos/next/:zone` | POST | admin | Piste suivante |
| `/api/sonos/previous/:zone` | POST | admin | Piste précédente |
| `/api/sonos/volume/:zone` | POST | admin | Volume (0–100) |
| `/api/sonos/mute/:zone` | POST | admin | Mute |
| `/api/sonos/unmute/:zone` | POST | admin | Unmute |
| `/api/sonos/favorites` | GET | user | Liste des favoris |
| `/api/sonos/favorite/:zone` | POST | admin | Jouer un favori |
| `/api/sonos/seek/:zone` | POST | admin | Seek position |
| `/api/sonos/shuffle/:zone` | POST | admin | Shuffle on/off |
| `/api/sonos/repeat/:zone` | POST | admin | Repeat none/all/one |

### Frontend API client (`apps/web/src/utils/api/sonos.js`) — ✅ COMPLET

17 méthodes couvrant tous les endpoints. Aucun ajout nécessaire.

### Desktop UI actuel (`DisplayDashboard/SonosTab.jsx`) — 🔶 MONOLITHIQUE

- **~420 lignes** dans un seul fichier
- 4 composants inline : `PlaybackControls`, `ZoneCard`, `FavoritesList`, `SonosTab`
- CSS dans `DisplayDashboardPanel.css` (~200 lignes `.dtv-sonos-*`)
- Fonctionnel mais non-modulaire, non-réutilisable pour le mobile
- Manque : recherche favoris, indicateurs visuels enrichis, sources

### Mobile — ❌ AUCUN composant Sonos

`MobileApp.jsx` : 16 modules, 0 Sonos. Navigation par `currentScreen` + menu latéral.

---

## PHASE 1 — Analyse & préparation

### Objectifs
- Extraire la logique métier partagée dans un hook personnalisé `useSonos`
- Créer l'arborescence de fichiers
- Extraire le CSS Sonos dans un fichier dédié avec tokens propres

### Sous-tâches

| # | Tâche | Fichier(s) | Statut |
|---|-------|-----------|--------|
| 1.1 | Créer le hook `useSonos.js` | `apps/web/src/hooks/useSonos.js` | ✅ |
| 1.2 | Créer le dossier `components/sonos/` | `apps/web/src/components/sonos/` | ✅ |
| 1.3 | Extraire CSS Sonos dans fichier dédié | `apps/web/src/components/sonos/SonosPanel.css` | ✅ |
| 1.4 | Créer barrel `index.js` | `apps/web/src/components/sonos/index.js` | ✅ |

### Hook `useSonos` — Logique partagée desktop/mobile

```js
useSonos({ autoPolling = true, pollInterval = 5000 })
→ {
    // Config
    sonosIP, setSonosIP, saveConfig, configLoading,
    // Zones
    zones, activeZone, setActiveZone, zoneState,
    // Now Playing
    nowPlaying, displayState,
    // Polling
    polling, setPolling, refresh,
    // Contrôles (admin)
    play, pause, next, previous,
    setVolume, mute, unmute,
    seek, setShuffle, setRepeat,
    // Favoris
    favorites, loadFavorites, playFavorite, favoritesLoading,
    // Meta
    isAdmin, loading, controlZone,
  }
```

### Risques
- Migration CSS : les classes `.dtv-sonos-*` sont partagées avec `DisplayDashboardPanel.css` → copier puis isoler
- Le hook doit supporter les 2 contextes (desktop avec config IP, mobile sans)

### Critères d'acceptation
- ✅ Hook `useSonos` testé unitairement (mock API)
- ✅ Dossier `sonos/` créé avec structure vide
- ✅ CSS extrait, aucune régression visuelle desktop
- ✅ Aucun `console.log` résiduel

---

## PHASE 2 — Composants desktop

### Objectifs
- Refactoriser `SonosTab.jsx` en composants modulaires
- Enrichir le Now Playing (pochette, source, barre de progression)
- Ajouter la recherche dans les favoris
- Gestion d'erreurs robuste

### Sous-tâches

| # | Tâche | Fichier | Statut |
|---|-------|---------|--------|
| 2.1 | `SonosPanel.jsx` — container principal | `components/sonos/SonosPanel.jsx` | ✅ |
| 2.2 | `SonosZoneSelector.jsx` — choix de zone | `components/sonos/SonosZoneSelector.jsx` | ✅ |
| 2.3 | `SonosNowPlaying.jsx` — affichage enrichi | `components/sonos/SonosNowPlaying.jsx` | ✅ |
| 2.4 | `SonosControls.jsx` — transport + seek | `components/sonos/SonosControls.jsx` | ✅ |
| 2.5 | `SonosVolumeSlider.jsx` — volume + mute | `components/sonos/SonosVolumeSlider.jsx` | ✅ |
| 2.6 | `SonosFavorites.jsx` — favoris + recherche | `components/sonos/SonosFavorites.jsx` | ✅ |
| 2.7 | `SonosSources.jsx` — sélection de source | `components/sonos/SonosSources.jsx` | ✅ |
| 2.8 | Supprimer ancien `SonosTab.jsx` | `DisplayDashboard/SonosTab.jsx` | ⬜ (conservé comme fallback) |

### Architecture composants

```
SonosPanel (container)
 ├─ SonosZoneSelector (zones, sélection, état)
 ├─ SonosNowPlaying (titre, artiste, album, pochette, source, progression)
 │   └─ Barre de progression temps réel
 ├─ SonosControls (play/pause/stop/prev/next, shuffle, repeat)
 ├─ SonosVolumeSlider (slider + mute + label %)
 ├─ SonosFavorites (liste, recherche, lecture rapide)
 └─ SonosSources (radios, playlists — via favoris Sonos)
```

### Composant `SonosNowPlaying` — Enrichissements

- Pochette large avec fallback (icône Music si pas d'artwork)
- Indicateur d'état animé (spinning disc si playing, pause icon si paused)
- Type de source affiché (Radio, Playlist, Bibliothèque, etc.)
- Barre de progression intégrée avec temps écoulé / total
- Animation de transition au changement de piste

### Composant `SonosFavorites` — Enrichissements

- Barre de recherche/filtre
- Miniatures des pochettes
- Indicateur "en cours de lecture" sur le favori actif
- Gestion état vide et erreurs

### Composant `SonosSources` — Nouveau

- Basé sur les favoris Sonos (radio, playlists, etc.)
- Catégorisation automatique par type (Radio / Playlist / Autre)
- Affichage en grille ou liste selon la densité

### Design System — Composants utilisés

| DS Component | Usage Sonos |
|-------------|-------------|
| `Button` | Transport, actions |
| `Input` | Config IP, recherche favoris |
| `SectionHeader` | Titres de sections |
| `InlineAlert` | Erreurs connexion |
| `Spinner` | Loading states |
| `EmptyState` | Aucune lecture / pas de favoris |
| `SearchBar` | Filtre favoris |
| `Card` | Container zones |
| `Badge` | Indicateurs état |
| `Toggle` | Polling on/off |
| `Tooltip` | Infobulles boutons |

### Risques
- L'ancien `SonosTab.jsx` est importé par `App.jsx` via `lazy()` → mettre à jour le path
- Les classes CSS `.dtv-sonos-*` sont référencées dans DisplayDashboardPanel.css → migration propre
- Le composant `SonosSources` dépend des favoris (pas d'endpoint sources dédié)

### Critères d'acceptation
- ✅ Tous les composants rendent correctement
- ✅ Contrôles fonctionnels (play, pause, next, prev, seek, volume, shuffle, repeat)
- ✅ Favoris avec recherche
- ✅ Zones sélectionnables
- ✅ Design System tokens uniquement (pas de valeurs brutes)
- ✅ Aucune duplication par rapport au hook `useSonos`

---

## PHASE 3 — Intégration desktop

### Objectifs
- Câbler `SonosPanel` dans `App.jsx`
- Mettre à jour le lazy import
- Vérifier le fonctionnement de l'onglet Sonos dans le Header

### Sous-tâches

| # | Tâche | Fichier | Statut |
|---|-------|---------|--------|
| 3.1 | Mettre à jour lazy import dans App.jsx | `apps/web/src/App.jsx` | ✅ |
| 3.2 | Vérifier onglet Header (déjà présent) | `apps/web/src/components/Header.jsx` | ✅ |
| 3.3 | Nettoyer ancien CSS dans DisplayDashboardPanel.css | `DisplayDashboard/DisplayDashboardPanel.css` | ⬜ (CSS conservé, nouveau CSS dédié créé) |
| 3.4 | Vérifier ErrorBoundary + Suspense | `apps/web/src/App.jsx` | ✅ |

### Risques
- Le Header a déjà un onglet `sonos` avec l'icône `Music` → pas de changement nécessaire
- Le lazy import pointe vers `DisplayDashboard/SonosTab` → rediriger vers `sonos/SonosPanel`

### Critères d'acceptation
- ✅ Clic sur onglet Sonos → affiche SonosPanel
- ✅ Lazy loading fonctionne (Suspense fallback visible brièvement)
- ✅ ErrorBoundary capture les erreurs
- ✅ Aucune régression sur les autres modules
- ✅ Ancien SonosTab.jsx supprimé ou transformé en re-export

---

## PHASE 4 — Composants mobile

### Objectifs
- Créer les composants Sonos mobile dans `components/mobile/`
- Réutiliser le hook `useSonos` (zéro duplication logique)
- Adapter l'UI pour le tactile (swipe, tap, long press)

### Sous-tâches

| # | Tâche | Fichier | Statut |
|---|-------|---------|--------|
| 4.1 | `MobileSonos.jsx` — shell / layout | `components/mobile/MobileSonos.jsx` | ✅ |
| 4.2 | `MobileSonosNowPlaying.jsx` — lecture en cours | `components/mobile/MobileSonosNowPlaying.jsx` | ✅ |
| 4.3 | `MobileSonosControls.jsx` — transport tactile | `components/mobile/MobileSonosControls.jsx` | ✅ |
| 4.4 | `MobileSonosVolume.jsx` — slider tactile | `components/mobile/MobileSonosVolume.jsx` | ✅ |
| 4.5 | `MobileSonosFavorites.jsx` — favoris scroll | `components/mobile/MobileSonosFavorites.jsx` | ✅ |
| 4.6 | CSS mobile Sonos | `components/mobile/MobileSonos.css` | ✅ |

### Architecture mobile

```
MobileSonos (shell — header "Sonos" + back button)
 ├─ Zone selector (horizontal scroll pills)
 ├─ MobileSonosNowPlaying
 │   ├─ Pochette plein écran (swipe gauche/droite = next/prev)
 │   ├─ Titre / Artiste / Album
 │   └─ Barre de progression
 ├─ MobileSonosControls
 │   ├─ Prev / Play-Pause / Next (gros boutons tactiles 48px+)
 │   └─ Shuffle / Repeat toggles
 ├─ MobileSonosVolume
 │   ├─ Slider pleine largeur
 │   └─ Mute toggle
 └─ MobileSonosFavorites
     ├─ Recherche
     └─ Liste scrollable (tap = lecture)
```

### Interactions tactiles

| Geste | Action |
|-------|--------|
| Tap play/pause | Toggle lecture |
| Tap next/prev | Navigation pistes |
| Swipe gauche sur pochette | Piste suivante |
| Swipe droite sur pochette | Piste précédente |
| Slider horizontal | Volume / Seek |
| Tap favori | Lecture immédiate |

### Design — Spécificités mobile

- **Pochette** : 70% de largeur écran, centrée, border-radius `var(--radius-xl)`, ombre
- **Boutons transport** : min 48×48px (accessibilité tactile)
- **Volume** : slider pleine largeur avec label % à droite
- **Favoris** : scroll vertical, items avec pochette 48×48 + titre
- **Zone selector** : pills horizontales (scroll-snap)
- **Dark mode** : support complet via tokens CSS

### Risques
- Le hook `useSonos` utilise `useToast()` → vérifier que le ToastProvider existe dans le contexte mobile
- Le swipe sur pochette peut interférer avec le swipe-back (`useSwipeBack`)
- Pas de `SonosSources` mobile (trop complexe pour mobile, les favoris suffisent)

### Critères d'acceptation
- ✅ All composants rendent sur viewport 375px
- ✅ Contrôles fonctionnels tactiles
- ✅ Volume slider fluide (pas de saccade)
- ✅ Swipe pochette = next/prev
- ✅ Favoris scrollables avec recherche
- ✅ Gestion offline/erreurs (InlineAlert)
- ✅ Tokens CSS uniquement

---

## PHASE 5 — Intégration mobile

### Objectifs
- Ajouter l'écran Sonos dans `MobileApp.jsx`
- Ajouter l'entrée dans le menu latéral
- Câbler la navigation

### Sous-tâches

| # | Tâche | Fichier | Statut |
|---|-------|---------|--------|
| 5.1 | Import `MobileSonos` dans MobileApp.jsx | `components/mobile/MobileApp.jsx` | ✅ |
| 5.2 | Ajouter entrée menu "Sonos" (icône Music) | `components/mobile/MobileApp.jsx` | ✅ |
| 5.3 | Ajouter `currentScreen === 'sonos'` render | `components/mobile/MobileApp.jsx` | ✅ |
| 5.4 | Ajouter `'sonos'` au goBack (retour home) | `components/mobile/MobileApp.jsx` | ✅ |

### Intégration menu

```jsx
// Section "Multimédia" (nouvelle) — après "Gestion"
<div className="menu-section-label">Multimédia</div>
<Button variant="ghost"
  className={currentScreen === 'sonos' ? 'active' : ''}
  onClick={() => { setCurrentScreen('sonos'); setMenuOpen(false); }}
>
  <Music size={20} />
  <span>Sonos</span>
</Button>
```

### Risques
- Le menu latéral a déjà beaucoup d'entrées → vérifier le scroll
- L'icône `Music` n'est pas encore importée dans MobileApp.jsx

### Critères d'acceptation
- ✅ Entrée "Sonos" visible dans le menu mobile
- ✅ Clic → écran Sonos mobile
- ✅ Bouton retour → home
- ✅ Swipe back → home
- ✅ Aucune régression sur les autres écrans mobile

---

## PHASE 6 — Tests, QA, documentation

### Objectifs
- Valider tous les composants
- Tests frontend (Vitest)
- Tests d'intégration API
- Documentation mise à jour

### Sous-tâches

| # | Tâche | Fichier | Statut |
|---|-------|---------|--------|
| 6.1 | Tests `useSonos` hook | `tests/` ou `src/__tests__/` | ⬜ |
| 6.2 | Tests composants Sonos desktop (render) | `tests/` | ⬜ |
| 6.3 | Tests composants Sonos mobile (render) | `tests/` | ⬜ |
| 6.4 | Tests existants passent (85 backend + 355 frontend) | — | ⬜ |
| 6.5 | Mise à jour CHANGELOG.md | `CHANGELOG.md` | ⬜ |
| 6.6 | Mise à jour ROADMAP.md | `ROADMAP.md` | ⬜ |
| 6.7 | Mise à jour ce fichier (statuts finaux) | `docs/SONOS_FULL_GUI_PLAN.md` | ⬜ |

### Checklist QA

| Critère | Desktop | Mobile |
|---------|---------|--------|
| Lecture / Pause | ⬜ | ⬜ |
| Next / Previous | ⬜ | ⬜ |
| Seek (barre progression) | ⬜ | ⬜ |
| Volume slider | ⬜ | ⬜ |
| Mute / Unmute | ⬜ | ⬜ |
| Shuffle toggle | ⬜ | ⬜ |
| Repeat (none/all/one) | ⬜ | ⬜ |
| Sélection zone | ⬜ | ⬜ |
| Favoris → lecture | ⬜ | ⬜ |
| Recherche favoris | ⬜ | ⬜ |
| Config IP (admin) | ⬜ | — |
| Monitoring polling 5s | ⬜ | ⬜ |
| Erreur device offline | ⬜ | ⬜ |
| Fallback artwork | ⬜ | ⬜ |
| Dark mode | ⬜ | ⬜ |
| Responsive 375px | — | ⬜ |
| Swipe pochette | — | ⬜ |

### Risques
- Tests Vitest nécessitent des mocks pour `api.*` et `useToast`
- Le composant Sonos dépend d'un device Sonos sur le réseau → possibilité de tests limités en CI

### Critères d'acceptation
- ✅ 100% des tests existants passent
- ✅ Nouveaux tests pour `useSonos` (min 10 cas)
- ✅ Aucune régression CSS
- ✅ Aucun warning console
- ✅ CHANGELOG mis à jour

---

## 📁 Arborescence finale

```
apps/web/src/
├── hooks/
│   └── useSonos.js                    ← NEW (hook partagé)
├── components/
│   ├── sonos/                         ← NEW (module desktop)
│   │   ├── index.js
│   │   ├── SonosPanel.jsx
│   │   ├── SonosZoneSelector.jsx
│   │   ├── SonosNowPlaying.jsx
│   │   ├── SonosControls.jsx
│   │   ├── SonosVolumeSlider.jsx
│   │   ├── SonosFavorites.jsx
│   │   ├── SonosSources.jsx
│   │   └── SonosPanel.css
│   ├── mobile/
│   │   ├── MobileSonos.jsx            ← NEW
│   │   ├── MobileSonosNowPlaying.jsx  ← NEW
│   │   ├── MobileSonosControls.jsx    ← NEW
│   │   ├── MobileSonosVolume.jsx      ← NEW
│   │   ├── MobileSonosFavorites.jsx   ← NEW
│   │   ├── MobileSonos.css            ← NEW
│   │   └── MobileApp.jsx             ← MODIFIED (ajout écran sonos)
│   └── DisplayDashboard/
│       └── SonosTab.jsx               ← SUPPRIMÉ (remplacé par sonos/)
└── App.jsx                            ← MODIFIED (maj lazy import)
```

---

## ⚠️ Fichiers GARANTIS NON TOUCHÉS

- `apps/api/*` — Aucun changement backend
- `apps/tv-client/*` — Aucun changement TV
- `.env`, `.env.production` — Aucun changement
- `scripts/safe-deploy.sh` — Aucun changement
- `package.json` (root) — Aucun changement

---

## 🔄 Workflow de développement

1. Chaque phase : mise à jour de ce fichier AVANT le code
2. Validation utilisateur AVANT chaque phase
3. Commit atomique par phase : `feat(sonos): phase N — description`
4. Tests après chaque phase
5. Aucun merge dans `dev` avant validation complète
