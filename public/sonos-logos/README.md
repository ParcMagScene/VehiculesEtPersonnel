# Logos des services musicaux Sonos

Ce dossier contient les logos affichés en badge du widget Sonos (TV client
et Preview admin), correspondant à la source de lecture détectée par le
backend (`detectSonosService()` dans `apps/api/sonosRoutes.js`).

## Fichiers attendus

Servis publiquement via `/sonos-logos/<fichier>.svg` (montage dans
`apps/api/server.js`). Les placeholders livrés sont minimalistes ; **il
est recommandé de les remplacer par les SVG officiels des marques**
(brand guidelines : chercher « <marque> brand assets »).

| Fichier | Service détecté | Source URI Sonos |
|---|---|---|
| `spotify.svg` | Spotify | `x-sonos-spotify:` |
| `deezer.svg` | Deezer | uri contient `deezer` |
| `applemusic.svg` | Apple Music | `x-sonosprog-http:`, contient `applemusic` |
| `amazonmusic.svg` | Amazon Music | `x-sonos-hls-amazon:` |
| `youtubemusic.svg` | YouTube Music | contient `music.youtube` |
| `tidal.svg` | Tidal | uri contient `tidal` |
| `soundcloud.svg` | SoundCloud | uri contient `soundcloud` |
| `qobuz.svg` | Qobuz | uri contient `qobuz` |
| `tunein.svg` | TuneIn | `x-sonosapi-stream:` |
| `radio.svg` | Radio générique | `x-rincon-mp3radio://`, `aac:` |
| `library.svg` | Bibliothèque locale | `x-file-cifs:`, `file:` |
| `queue.svg` | File d'attente | `x-rincon-queue:` |
| `sonos.svg` | Groupe Sonos | `x-rincon:` |

## Format

- **SVG** vectoriel de préférence (badge affiché à taille variable).
- Ratio carré 1:1 conseillé (le badge est un cercle en overlay du widget).
- Fond transparent.
- Taille cible : ~28-48 px de côté selon le viewport.

## Fallback

Si un fichier est manquant, le widget masque simplement le badge (aucune
image 404 visible côté client — `onerror` intercepté dans `main.js`).

## Ajouter un nouveau service

1. Créer le SVG dans ce dossier.
2. Ajouter la détection dans `detectSonosService()` (`apps/api/sonosRoutes.js`).
3. La table ci-dessus doit rester à jour.
