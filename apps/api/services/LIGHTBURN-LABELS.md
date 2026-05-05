# LightBurn — Étiquettes gravure laser (alu anodisé noir)

> Service `apps/api/services/lightburnLabelGenerator.js`
> Routes `POST /api/labels/lightburn/plate` et `POST /api/labels/lightburn/one`

Générateur SVG **strictement** compatible LightBurn pour gravure sur plaques
aluminium anodisé noir. Conserve le module legacy `labelGenerator.js` intact
(routes `/api/labels/generate` et `/api/labels/generate-one` inchangées).

## Convention couleurs

Sur anodisé noir, le laser **enlève** la couche colorée pour révéler
l'aluminium clair en dessous :

| Couleur SVG | Effet gravure                      | Usage                |
| ----------- | ---------------------------------- | -------------------- |
| `#000000`   | Couche conservée (rien n'est fait) | Fond, modules QR     |
| `#FFFFFF`   | Laser grave (alu apparent)         | Modules clairs du QR |

> Le QR est exporté **noir/blanc standard** (pas inversé). La lecture par
> smartphone reste correcte ET la gravure produit un contraste optimal.

## Structure SVG (3 calques nommés)

Chaque étiquette contient exactement **trois groupes** Inkscape, mappables
1-pour-1 sur les couches LightBurn :

| Groupe SVG `id` / `inkscape:label` | Contenu             | Mode LightBurn |
| ---------------------------------- | ------------------- | -------------- |
| `QR_IMAGE`                         | `<image>` PNG raster | **Image**      |
| `TEXT_FILL`                        | `<text>` noirs       | **Fill**       |
| `FRAME_LINE`                       | `<rect>` stroke 0.1mm | **Line**       |

Sur la plaque (32 étiquettes), les `id` sont suffixés par l'index :
`QR_IMAGE_0` … `QR_IMAGE_31`, etc.

## Contraintes strictes (toutes vérifiées par les tests)

- ❌ Aucun `<filter>`, `<mask>`, `<clipPath>`, `<defs>` complexe
- ❌ Aucune transparence, aucun `opacity`, aucun gradient
- ❌ Aucun blend-mode, ni `filter:`, ni `mix-blend-mode`
- ✅ Couleurs uniquement `#000000` et `#FFFFFF`
- ✅ Police sans-serif (`Liberation Sans` / `DejaVu Sans` / Arial)
- ✅ Coordonnées en **mm** (`viewBox` = mm), `width="200mm" height="200mm"`
- ✅ QR + logo **fusionnés** dans un seul PNG raster (base64 inline)
- ✅ `image-rendering: pixelated` pour conserver les modules nets

## Géométrie plaque (par défaut)

```
plaque   : 200 × 200 mm
marge    : 5 mm (tous bords)
grille   : 4 colonnes × 8 lignes = 32 étiquettes
gaps     : 1 mm horizontal et vertical
étiquette: 50 × 25 mm
QR       : 25 × 25 mm (à gauche, pleine hauteur)
quiet    : 2.5 mm (intégrée au PNG QR)
texte    : zone droite ~22 mm large
cadre    : stroke 0.1 mm
```

Variante 4×6 (étiquettes plus hautes) : passer `labelH: 33.33` dans le body.

## Layout étiquette (50 × 25 mm)

```
┌─────────────────────────┬──────────────────┐
│                         │ UID: EMAG-S00882 │
│                         │ SN:  002203R…    │
│   ░░░░ QR + logo ░░░░   │                  │
│      (25 × 25 mm)       │                  │
│                         │  MAG: T01        │
└─────────────────────────┴──────────────────┘
                          ↑ shrink-to-fit auto sur largeur
```

Le texte est auto-réduit (taille de police) si trop long, **sans dépendre de
`textLength`** (que rsvg ou LightBurn peuvent ignorer).

## QR + logo composite (PNG raster)

- Source logo : `public/Logos/Logo_MAGSCENE_Noir_Crop.png`
- Résolution : 600 × 600 px (≈ 600 dpi pour un QR de 25 mm)
- Encodage QR : niveau **H** (30 % redondance) pour absorber le carré logo
- Carré logo central : 22 % du PNG, **fond noir** (couche conservée)
- Pixels logo : binarisés depuis la source — pixels sombres → **blanc gravé**
  (motif clair sur carré noir, parfaitement visible après gravure)
- Pixels transparents de la source : ignorés (gardent le fond noir)

## Routes API

### `POST /api/labels/lightburn/plate`

Génère une plaque SVG complète (jusqu'à 32 étiquettes).

**Body** (auth requis) :

```json
{
  "serialIds": [12, 18, 27, 31],
  "filename": "lightburn-lot-2026-01.svg",
  "labelH": 25
}
```

- `serialIds` : ids de `equipment_serials` (≤ 32)
- `filename` : nom de fichier de download (optionnel)
- `labelH` : hauteur étiquette en mm (optionnel, défaut 25)

**Réponse** : `Content-Type: image/svg+xml`, body = SVG.

```bash
curl -X POST http://localhost:3003/api/labels/lightburn/plate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serialIds":[101,102,103,104]}' \
  -o /tmp/plaque.svg
```

### `POST /api/labels/lightburn/one`

Preview / génération d'une seule étiquette (50 × 25 mm).

**Body** :

```json
{
  "uid": "EMAG-S00882",
  "serial": "002203R E00D315",
  "magNumber": "T01",
  "qrPayload": "https://emag.local/equipment/EMAG-S00882"
}
```

`qrPayload` est optionnel — si absent, dérivé via `buildEquipmentQrPayload(uid)`.

## Procédure LightBurn (côté opérateur)

1. **Fichier → Importer** la plaque SVG. Choisir « mm » comme unité.
2. Vérifier les 3 calques dans le panneau **Cuts / Layers** :
   - `QR_IMAGE_*` → mode **Image** (paramètres : Pass-through ou Threshold,
     Dither = Jarvis, Power adapté à l'anodisé)
   - `TEXT_FILL_*` → mode **Fill** (Power 90 %, Speed selon test)
   - `FRAME_LINE_*` → mode **Line** (Power faible, juste pour repérage si besoin)
3. **Calibrer** sur une chute avant la plaque pleine (1 étiquette test).
4. Origine : coin haut-gauche de la plaque (5 mm de marge → première étiquette).

## Tests

`tests/lightburn-label-generator.test.js` couvre :

- Génération du PNG QR + logo (taille, format)
- Présence des 3 calques nommés (id + `inkscape:label`)
- Absence stricte des éléments interdits (clipPath, filter, mask, opacity)
- Validation des couleurs (uniquement `#000000` / `#FFFFFF`)
- Comptage 32 calques de chaque type sur une plaque pleine
- Positions des étiquettes (translate exact)

```bash
node --test tests/lightburn-label-generator.test.js
```

## Dépendances

- [`qrcode`](https://www.npmjs.com/package/qrcode) ^1.5.4 — génération matrice QR
- [`pngjs`](https://www.npmjs.com/package/pngjs) ^7.0.0 — composition PNG raster (pure JS)

Aucune dépendance native (pas de `canvas` / `sharp`), portable Linux/macOS/Windows.
