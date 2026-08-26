# TV-client — Scaling global (`tvScale`)

Système d’agrandissement global du dashboard TV pour un affichage
confortable sur une TV 65" UHD (3840×2160) à 4–5 m.

## Vue d’ensemble

Le contenu du TV-client est encapsulé dans un container unique
`#tv-root.tv-scale` (voir `apps/tv-client/index.html`).

Sur ce container on applique :

```css
.tv-scale {
  zoom: var(--tv-scale, 1.6);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
}
```

On utilise **CSS `zoom`** (et non `transform: scale`) : `zoom` recalcule
le layout et rasterise directement à la résolution finale. Aucun
compositing GPU, aucune re-rasterisation par frame — indispensable sur
Raspberry Pi (VideoCore) où `transform: scale` saccadait notablement.

`zoom` ne crée pas de containing block, donc les enfants
`position: fixed` (footer, sonos-widget, sneaky-photo, offline-indicator)
restent ancrés au viewport — comportement souhaité.

Aucune compensation `width/height = 100% / scale` n’est nécessaire :
le navigateur gère nativement.

Support : Chromium/Edge/Safari (toujours), Firefox 126+ (mai 2024).

## Configuration

La clé `tvScale` de la table `display_config` pilote le facteur.
Valeur par défaut : **1.6** (déclarée dans
`apps/api/services/display/config.js` → `APPEARANCE_DEFAULTS`).

Elle est renvoyée par l’endpoint agrégé public
`GET /api/display/tv-public-state` sous `config.tvScale`.

Le client (`apps/tv-client/main.js` → `applyConfig` →
`applyTvScale`) lit cette valeur, la valide (`Number`, borne
`[0.5, 3]`), puis écrit **uniquement** la variable CSS `--tv-scale`
sur le container. Les règles `.tv-scale { transform / width / height }`
consomment cette variable via `var(--tv-scale, 1.6)`.

Ce choix (CSS var seule, pas de `style.transform` inline) est
essentiel pour que la media query mobile `@media (max-width: 768px)`
puisse reprendre le contrôle et neutraliser le scaling — un style
inline aurait une spécificité supérieure et casserait le layout
tactile.

En l’absence de valeur en base, le fallback client vaut **1.6**.

### Persister une valeur en base

La clé n’est pas exposée par le POST `/api/display/appearance` actuel
pour ne pas modifier le contrat. Pour la surcharger, insérer
directement en base :

```sql
INSERT INTO display_config (key, value, updated_at)
VALUES ('tvScale', '1.8', datetime('now'))
ON CONFLICT(key) DO UPDATE
  SET value = excluded.value,
      updated_at = datetime('now');
```

## Valeurs recommandées

| Contexte                     | tvScale  |
|------------------------------|----------|
| Écran de bureau / test local | 1.0      |
| TV 55" — 3–4 m               | 1.4      |
| **TV 65" UHD — 4–5 m**       | **1.6**  |
| TV 65" UHD — 5–6 m           | 1.8      |
| TV 75" UHD — 5–7 m           | 2.0      |

Au-delà de 2.0 la mise en page peut commencer à rogner sur les widgets
en position `fixed` (Sonos, footer, sneaky-photo).

## Comportement mobile

Le scaling est **désactivé** sous `@media (max-width: 768px)` :

```css
@media (max-width: 768px) {
  :root { --tv-scale: 1; }
  .tv-scale { zoom: 1; min-height: auto; }
}
```

Le layout mobile (navigation par onglets) reste ainsi utilisable
tel quel sur un smartphone ou un tablette utilisée pour le pilotage.

## Ce qui n’est PAS modifié

- Le polling (`loadTVState`, intervalles) — inchangé.
- Le token TV et `tvFetch` — inchangés.
- Les endpoints `/api/display/*` — aucun contrat modifié.
- La validation `isSafeCSSValue` pour les couleurs — intacte.
- Les assets (`/display-logo/`, `/SNCF.wav`, `/display-media/`).
- Les animations `alarm-flash`, `slideUp`, transitions Sonos, sneaky-photo :
  elles opèrent sur des éléments internes au container scalé, donc
  suivent naturellement le facteur sans code additionnel.

## Tests manuels

Avant tout déploiement production :

1. **Rendu par défaut** :
   ouvrir le TV-client sur la TV cible, vérifier que le layout
   remplit tout l’écran (pas de bande noire à droite ou en bas).
2. **Sonos** : lancer un flux musical, vérifier que le widget
   `#sonos-widget` apparaît centré en bas, animation `slideUp`
   fluide, texte lisible.
3. **Alarme** : déclencher depuis l’admin
   (`/api/display/alarm/test`), vérifier le flash rouge plein écran
   et la surbrillance de l’événement (`alarm-active`).
4. **Message d’accueil** : vérifier la lisibilité du marquee, pas de
   coupure horizontale.
5. **Météo** : vérifier l’icône et la température.
6. **Sneaky photo** : vérifier le défilement horizontal complet.
7. **Overscan** : tester `?overscan=24` sur Raspberry Pi.
8. **Bornes** :
   - `tvScale = 0.4` → doit fallback à 1.6 (hors bornes).
   - `tvScale = "abc"` → doit fallback à 1.6.
   - `tvScale = 2.0` → agrandissement visible, pas de blocage.
9. **Mobile** : ouvrir sur un smartphone (largeur < 768 px), vérifier
   que le scaling est bien neutralisé (`transform: none`).

## Historique

- 2026-08-26 — Introduction du système `tvScale` + container
  `#tv-root.tv-scale`. Valeur par défaut 1.6 pour TV 65" UHD.
- 2026-08-26 — Passage de `transform: scale()` à CSS `zoom`
  pour éliminer les saccades sur Raspberry Pi (VideoCore).
