# Taxonomie Unifiée eM@g — Référence Complète

> **Date** : 20 mars 2026, mis à jour 22 mars 2026  
> **Branche** : `dev`  
> **Auteur** : Migration automatisée (Étapes 1–9 du prompt `UniformisationMarquesSociétés.md`)

---

## 1. Les 13 familles unifiées

| ID  | Famille                 | Icône | Couleur  | Sous-familles |
|-----|-------------------------|-------|----------|---------------|
| 9   | Sonorisation            | 🔊   | #3b82f6  | Enceinte, Console, Micro, Câblages Audio, Amplification, Ear Monitor, Périphérique, Source, 100 V, Intercom / Talky, Réseau audio |
| 13  | Éclairage               | 💡   | #f59e0b  | Asservi, Traditionnel, Consoles, Bloc de puissance, Câblage, Effets / Fumée, Sécurité / Éclairage site, Sous-perches |
| 10  | Structure               | 🏗️   | #ef4444  | Scène, Pont Aluminium, Layher, Praticables, Protente / Crash / Leste, Câblage, [Legacy] Levage |
| 12  | Audiovisuel             | 🎥   | #8b5cf6  | Captation d'image, Captation, Diffusion d'image, Régie Vidéo, Accessoires, Câblage, Réseau vidéo |
| 11  | Distribution Électrique | ⚡   | #f97316  | Armoire de distribution, Passage de câble, Câblage |
| 14  | Backline                | 🎸   | #10b981  | Instruments, Amplis, Batteries, Percussions, Accessoires backline, Pupitres, Câblage |
| 15  | Rideau-Machinerie       | 🎭   | #ec4899  | Rideau, Machinerie |
| 16  | Informatique            | 💻   | #06b6d4  | Ordinateurs |
| 224 | Accroche                | 🔗   | #14b8a6  | Élingues, Accessoires d'accroche |
| 225 | Motorisation            | ⚙️   | #f97316  | Moteurs, Pieds de levage, Télécommandes |
| 226 | Mobilier                | 🪑   | #6b7280  | Mobilier scénique, Podiums |
| 227 | Outillage & EPI         | 🔧   | #f59e0b  | Outillage, Électroportatif, Levage & Manutention, Mesure & Contrôle, EPI, Véhicule annexe |
| 241 | Divers                  | 📋   | #94a3b8  | Sans catégorie |

### 1.1 Conventions de nommage
- **Casse** : Majuscule initiale (ex: `Sonorisation`, pas `SONORISATION`)
- **Accents** : Respectés (ex: `Éclairage`, `Distribution Électrique`)
- **Famille Legacy** : `[Legacy] Levage` (id=19) — conservée pour traçabilité, sous-catégories migrées vers Accroche/Motorisation

### 1.2 Définitions
| Niveau | Description | Exemples |
|--------|-------------|----------|
| **Famille** | Domaine technique principal (13 au total) | Sonorisation, Éclairage, Structure |
| **Sous-famille** | Regroupement fonctionnel au sein d'une famille | Enceinte, Console, Micro |
| **Catégorie** | Type d'équipement le plus précis (feuille de l'arbre) | Console numérique, Console analogique |
| **Marque** (`brands`) | Fabricant canonique, normalisé (87 au total) | L-Acoustics, Shure, Martin |
| **Alias** (`brand_aliases`) | Variante de saisie d'une marque (64 au total) | L-ACOUSTICS → L-Acoustics |
| **Famille unifiée** (`unified_family`) | Famille assignée à un article fournisseur | Champ texte dans `supplier_articles` |

---

## 2. Arbre complet des catégories

### Sonorisation (🔊)
- **100 V** : Amplificateur, Projecteur de son
- **Amplification** : Ampli
- **Console** : Console numérique, Console analogique, Console DJ, Accessoire console
- **Câblages Audio** : Multipaires, Câbles speakon, Câbles 2P/4P/8P, Câbles amplifié réseau, Cables module, Câble AES-EBU, Câble RJ45, Câble coax antenne HF, Fibre Optique, Adaptateurs
- **Ear Monitor** : Ear Monitor, Amplificateur casque, Accessoires
- **Enceinte** : Enceinte, Enceintes Amplifiées, Accessoires enceintes ligne, Pied d'enceinte
- **Intercom / Talky** : Intercom filaire, Intercom HF, Talky
- **Micro** : Micro statique, Micro dynamique, Micro miniature, HF, HF Accessoire, Accessoires micro statique, Pieds / Accessoires micro, Boitier de direct
- **Périphérique** : Processeur filtrage, Périphérique, Egalisation, Compresseurs, Gates, Effet, Préampli-Tube, Appareil de mesure
- **Réseau audio** : Dante/AES67, Interface réseau
- **Source** : Lecteur DJ, Lecteur/enregistreur CD-MD

### Éclairage (💡)
- **Asservi** : Wash, Spot, Beam, PAR Led, Blinder Led, Barre LED, Stroboscope, Changeur de couleur, Effet, Architecturaux, Accessoires asservis
- **Bloc de puissance** : Bloc de puissance
- **Consoles** : Consoles projecteurs asservis, Consoles traditionnelles
- **Câblage** : DMX, DMX + POWERCON, SNAKE DMX / RJ45, STRAP POWERCON, Multipaire 8 circuit, Divers
- **Effets / Fumée** : Machine à fumée, Ventilation, Consommables
- **Sous-perches** : Sous-perches
- **Sécurité / Éclairage site** : Sécurité, HQI, Quartz
- **Traditionnel** : Découpe, Plans convexe, Fresnels, Projecteur PAR et AC, Projecteurs poursuites, Molefay, Cycliodes, Basse tension, Accessoire Trad, Projecteur divers

### Structure (🏗️)
- **Câblage** : RS moteur
- **Layher** : Échaffaudage, Kit Tour 2,57m
- **Pont Aluminium** : Série 300 tri, Série 300 carré, Série 500 triangulaire, Série 500 carré, Série S400 carré, Échelle série 300, Cercle série 300 tri, Mono Tube, Accessoire structure
- **Praticables** : praticables
- **Protente / Crash / Leste** : Protentes, Crash barrières, Leste
- **Scène** : Scènes mobiles couvertes, Scènes traditionnelles, Bâche couverture scène et Layher
- **[Legacy] Levage** : _(conservé pour traçabilité, sous-catégories migrées)_

### Audiovisuel (🎥)
- **Accessoires** : Convertisseur, Distributeur, Extender, Selecteur, Shutter, Accroche
- **Captation** : Caméra, Objectif
- **Captation d'image** : Lecteurs - decodeurs, Medias
- **Câblage** : HDMI, SDI, VGA
- **Diffusion d'image** : Vidéoprojecteur, Moniteur, Ecran de projection, Ecran plat, Ecran plein jour
- **Régie Vidéo** : Mélangeur
- **Réseau vidéo** : Encodeur/Décodeur, Switcheur réseau

### Distribution Électrique (⚡)
- **Armoire de distribution** : Armoires 32A, Armoires 63A, Armoires 125A, Armoires 250A, Armoires 400A, CM1, CTA / CT1, Divisionnaire, Rackscan
- **Câblage** : 16A mono, 32A mono, 32A triphasé, 63A triphasé, 125A triphasé, 400A triphasé powerlock, Adaptateurs, Multipries 16A
- **Passage de câble** : 3 canaux

### Backline (🎸)
- **Accessoires backline** : Banquette piano, Stand clavier, Stand guitare, Tabouret haut
- **Amplis** : Ampli GUIT, Ampli BASSE
- **Batteries** : Fûts batterie, Cymbales, Accessoires batteries
- **Câblage** : Jack instruments
- **Instruments** : Claviers, Guitares, Piano numérique, Synthétiseur
- **Percussions** : Congas, Bongos, Timbales, Accessoires percus
- **Pupitres** : Pupitre musiciens

### Rideau-Machinerie (🎭)
- **Machinerie** : Cyclorama, Patience, Pupitres, Tapis de danse
- **Rideau** : Rideau et pendrillon, Frises

### Informatique (💻)
- **Ordinateurs** : Ordinateurs

### Accroche (🔗)
- **Accessoires d'accroche** : Accessoires levage
- **Élingues** : Elingues acier, Elingues tissu

### Motorisation (⚙️)
- **Moteurs** : Moteurs de levage
- **Pieds de levage** : Pied de levage
- **Télécommandes** : Télécommandes moteurs

### Mobilier (🪑)
- **Mobilier scénique**
- **Podiums**

### Outillage & EPI (🔧)
- **EPI**
- **Levage & Manutention**
- **Mesure & Contrôle**
- **Outillage**
- **Véhicule annexe**
- **Électroportatif**

### Divers (📋)
- **Sans catégorie**

---

## 3. Règles de mapping `taxonomy_family_mapping` (58 règles)

### Priorité 15 — Détection par marque connue
| Pattern (regex) | Famille cible |
|-----------------|---------------|
| `l.acoustics\|shure\|sennheiser\|dpa\|yamaha\|nexo\|qsc\|allen.+heath\|lab.gruppen` | Sonorisation |
| `martin\|robe\|clay.paky\|avolites\|showtec\|chauvet\|glp\|ayrton\|starway\|juliat\|ma.lighting` | Éclairage |
| `prolyte\|asd\|layher\|doughty\|stagedex\|europodium\|stacco` | Structure |
| `blackmagic\|extron\|barco\|panasonic\|sony\|samsung\|lg\|unilumin\|novastar\|christie` | Audiovisuel |
| `neutrik\|sommer\|procab\|klotz` | Divers |

### Priorité 10 — Détection par mot-clé catégorie
| Pattern (regex) | Famille cible |
|-----------------|---------------|
| `enceinte\|haut.parleur\|systèmes compacts\|line.array\|line array` | Sonorisation |
| `micro\|casque\|ear.monitor\|oreillette` | Sonorisation |
| `console.*mix\|table.*mix\|ampli.*puissance\|amplificateur` | Sonorisation |
| `intercommunication\|talkie` | Sonorisation |
| `traitement\|splitter\|distributeur audio\|sommateur\|préampli` | Sonorisation |
| `dlive\|série dlive` | Sonorisation |
| `boîtier.*scène\|cordon micro` | Sonorisation |
| `carte.*son\|surface.*contrôle\|mixage` | Sonorisation |
| `projecteur.*scén\|asservi\|lyre\|led.*changeur\|blinder\|stroboscope` | Éclairage |
| `lampe\|bague.*filtre\|bloc.*puissance\|lighting\|projecteur.*architect` | Éclairage |
| `éclairage.*gén\|éclairage général\|livré avec coupe` | Éclairage |
| `accessoires.*projecteur\|pieds.*projecteur\|colonnes?.*télescopique\|trépieds?` | Éclairage |
| `contrôleur\|ledpanel\|barres?.*led\|cordon.*lumineux\|guirlande` | Éclairage |
| `filtre.*optique\|kit.*gélatine\|compléments?.*optique` | Éclairage |
| `structure.*scén\|cercle\|angle.*livr\|gladiator\|hauteur\|tableau.*charge` | Structure |
| `mvccs` (exact) | Structure |
| `support.*fixation\|pointe.*haut` | Structure |
| `vidéoprojecteur\|écran\|caméscope\|apn\|cadr\|convertisseur.*scaler\|lcd` | Audiovisuel |
| `accessoires pour apn\|accessoires.*prise.*vue\|appareils photo` | Audiovisuel |
| `adaptateur.*vidéo\|vidéo et data\|support.*moniteur\|support.*écran` | Audiovisuel |
| `matériel.*électr\|électricité\|schuko\|tableau.*électr` | Distribution Électrique |
| `bandeau.*rail\|disjoncteur\|cosse` | Distribution Électrique |
| `élingue\|sangle.*textile\|stopchute\|pince.*manchon` | Accroche |
| `tissu\|décor\|coton\|jupe.*scène\|rideau\|pendrillon` | Rideau-Machinerie |
| `chanvre\|toile.*polyester\|toile.*incrustation\|cinemat` | Rideau-Machinerie |
| `outillage\|électroportatif\|chariot` | Outillage & EPI |
| `epi\|équipement.*protection\|sécurité.*incendie\|lampe.*frontale` | Outillage & EPI |
| `moteur\|palan\|treuil\|liftket\|chainmaster\|stagemaker` | Motorisation |
| `backline\|batterie\|guitare\|clavier\|ampli.guit\|piano.num\|synthé` | Backline |

### Priorité 5 — Détection large / fallback
| Pattern (regex) | Famille cible |
|-----------------|---------------|
| `sources\|matériel dj` | Sonorisation |
| `projecteur.*led\|projecteur.*photo` | Éclairage |
| `pièces détachées pour projecteurs` | Éclairage |
| `effet.*fumée\|fanfogger\|hurricane` | Éclairage |
| `série.*blx\|émetteur.*récepteur\|slantmixer` | Sonorisation |
| `câble\|cable\|connectique\|adaptateur.*audio.*lumi\|speakerlink` | Distribution Électrique |
| `analogique polywire` | Distribution Électrique |
| `boîtier.*scène.*enrouleur\|enrouleur.*vierge` | Distribution Électrique |
| `gaine` | Distribution Électrique |
| `ambiance.*décoration\|guidage.*public` | Rideau-Machinerie |
| `poulie\|doughty` | Rideau-Machinerie |
| `informatique\|accessoires informatiques` | Informatique |
| `informatique\|ordinateur\|switch.réseau\|nas\|serveur` | Informatique |
| `disque.*dur` | Informatique |
| `rack\|flight.case\|valise.*transport\|sac.*housse` | Divers |
| `gaffer\|adhésif\|marquage\|velcro\|balisage\|signalisation` | Divers |
| `pile\|accumulateur` | Divers |
| `fabrication.*flight` | Divers |
| `comptage.*public\|identification` | Divers |
| `ventilat` | Divers |
| `oray` | Audiovisuel |
| `caméra` | Audiovisuel |
| `^sécurité$` | Outillage & EPI |
| `mobilier\|table\|chaise\|praticable.roulant\|podium` | Mobilier |

### Fonctionnement du mapping
1. Les articles fournisseurs (`supplier_articles`) sont analysés par leur champ `main_category` + `sub_category`.
2. Les règles sont appliquées **par priorité décroissante** (15 → 10 → 5).
3. La **première correspondance** remporte et écrit `unified_family`.
4. Les règles de priorité 15 (détection par marque) sont prioritaires car sans ambiguïté.
5. Les articles artefacts PDF (SOMMAIRE, TITRE, etc.) sont exclus du mapping.

---

## 4. Mapping legacy → unifié

| Ancien nom (legacy) | Nouveau nom (unifié) | Action |
|---------------------|---------------------|--------|
| SONORISATION | Sonorisation | Renommé (casse) |
| ECLAIRAGE | Éclairage | Renommé (casse + accent) |
| STRUCTURE | Structure | Renommé (casse) |
| VIDEO | Audiovisuel | Renommé (terme + casse) |
| ELECTRICITE | Distribution Électrique | Renommé |
| BACKLINE | Backline | Renommé (casse) |
| DECORATION | Rideau-Machinerie | Renommé |
| INFORMATIQUE | Informatique | Renommé (casse) |
| Levage (id=19) | Accroche + Motorisation | Éclaté en 2 familles |
| Mécanique & Outillage (stock) | Outillage & EPI | Renommé |
| _(nouveau)_ | Divers (id=241) | Créé |
| _(nouveau)_ | Mobilier (id=226) | Créé |

---

## 5. Historique des modifications

| Date | Phase | Description |
|------|-------|-------------|
| 20/03/2026 | Phase 1 — Étapes 1-6 | Migration taxonomie catégories : 13 familles créées, 9 migrations, 31 règles regex, 38,5% articles mappés |
| 20/03/2026 | Phase 2 — Maintenance | 18 nouvelles règles regex (49 total), 594 artefacts nettoyés, taux mapping 38,5% → 45% |
| 22/03/2026 | Phase 3 — Étapes 1-6 | Migration marques/fournisseurs : 87 marques canoniques, 64 alias, 87 brand↔family mappings, 9 nouvelles règles regex (58 total) |
| 22/03/2026 | Phase 3 — Étape 7 | Backend : brandHelpers.js, endpoints API marques, normalisation brand_id sur equipment/supplier_articles/planning |
| 22/03/2026 | Phase 3 — Étape 8 | Frontend : filtres brand_id, datalist autocomplete, affichage brand_canonical, parsers mis à jour |

---

## 6. Tables de migration

### `taxonomy-v1.js` — 9 migrations (Phase 1)
| # | Clé | Description |
|---|-----|-------------|
| 1 | `taxonomy_normalize_family_case_v1` | 8 familles MAJUSCULES → Majuscule initiale |
| 2 | `taxonomy_normalize_subfamily_case_v1` | praticables→Praticables, Cablages→Câblages, Intercomm→Intercom |
| 3 | `taxonomy_add_new_families_v1` | Crée Accroche, Motorisation, Mobilier, Outillage & EPI + sous-familles |
| 4 | `taxonomy_reclassify_levage_v1` | 6 sous-catégories Levage → Accroche / Motorisation |
| 5 | `taxonomy_adopt_orphan_categories_v1` | 6 orphelines supprimées, id=7 → Informatique, id=8 → Divers |
| 6 | `taxonomy_supplier_unified_family_v1` | Colonne `unified_family` + table `taxonomy_family_mapping` (31 règles) |
| 7 | `taxonomy_apply_supplier_mapping_v1` | 8 459 articles mappés (38,5%) |
| 8 | `taxonomy_equipment_catalog_unified_v1` | Colonne `unified_family` dans `equipment_catalog` |
| 9 | `taxonomy_add_divers_family_v1` | Famille Divers créée |

### `taxonomy-maintenance-v1.js` — 5 migrations (Phase 2)
| # | Clé | Description |
|---|-----|-------------|
| 1 | `taxonomy_maint_new_rules_v1` | +18 règles regex (49 total) |
| 2 | `taxonomy_maint_clean_artefacts_v1` | 594 artefacts PDF nettoyés |
| 3 | `taxonomy_maint_remap_v1` | Remapping complet → +1 385 articles |
| 4 | `taxonomy_maint_stock_rename_v1` | `Mécanique & Outillage` → `Outillage & EPI` dans stock |
| 5 | `taxonomy_maint_stock_add_roots_v1` | +5 racines stock |

### `taxonomy-brands-v1.js` — 13 migrations (Phase 3)
| # | Clé | Description |
|---|-----|-------------|
| 1 | `brands_create_tables_v1` | Tables `brands`, `brand_aliases`, `brand_family_mapping` |
| 2 | `brands_seed_son_v1` | 34 marques domaine son |
| 3 | `brands_seed_lumiere_v1` | 18 marques domaine lumière |
| 4 | `brands_seed_structure_v1` | 14 marques domaine structure |
| 5 | `brands_seed_video_v1` | 12 marques domaine vidéo |
| 6 | `brands_seed_backline_v1` | 5 marques domaine backline |
| 7 | `brands_seed_cables_v1` | 4 marques domaine câbles |
| 8 | `brands_add_columns_v1` | Colonnes `brand_id` + `brand_canonical` dans equipment/supplier_articles |
| 9 | `brands_link_equipment_v1` | 1 798 equipment liés par brand_id |
| 10 | `brands_link_articles_v1` | 3 063 articles liés par brand_id |
| 11 | `brands_family_mapping_v1` | 87 brand↔family mappings |
| 12 | `brands_mapping_rules_v1` | +9 règles taxonomy_family_mapping (58 total) |
| 13 | `brands_apply_unified_family_v1` | Mise à jour unified_family via brand detections |

---

## 7. Statistiques actuelles

| Métrique | Valeur |
|----------|--------|
| Familles | 13 |
| Sous-familles | 61 |
| Catégories (feuilles) | ~160 |
| Marques canoniques | 87 |
| Alias de marques | 64 |
| Brand↔Family mappings | 87 |
| Règles taxonomy_family_mapping | 58 |
| Equipment total | 2 556 |
| Equipment avec brand_id | 1 798 (70,3%) |
| Articles fournisseurs total | 21 944 |
| Articles avec brand_id | 3 063 (14,0%) |
| Articles avec unified_family | 10 029 (45,7%) |

---

## 8. Modules impactés

| Module | Tables | Fichiers backend | Fichiers frontend |
|--------|--------|-------------------|-------------------|
| Matériel | `equipment`, `equipment_categories` | `equipmentRoutes.js`, `database.js` | `EquipmentPanel.jsx` |
| Catalogue fournisseurs | `supplier_articles`, `taxonomy_family_mapping` | `supplierCatalogRoutes.js` | `SupplierCatalogPanel.jsx`, `catalogParsers.js` |
| Commandes | `orders` | `ordersRoutes.js` | `OrdersPanel.jsx` |
| Planning | `bp_items` | `planningRoutes.js` | — |
| Marques | `brands`, `brand_aliases`, `brand_family_mapping` | `brandHelpers.js` | `orders.js` (API) |
| Stock | `stock_categories` | — | — |
| Import BL | — | — | `BLMultiImportModal.jsx`, `BLImportLocPrestaModal.jsx` |
| Annotation PDF | — | — | `bpAnnotationEngine.js`, `pdfParser.js` |

---

## 9. Instructions de test

### Test 1 — Familles en base
```bash
cd apps/api && node -e "const db=require('better-sqlite3')('./vehicules-dev.db'); \
  db.prepare(\"SELECT id,name FROM equipment_categories WHERE level='family' ORDER BY name\").all() \
  .forEach(f=>console.log(f.id,f.name))"
```
**Attendu** : 13 familles (Accroche → Éclairage).

### Test 2 — Marques en base
```bash
cd apps/api && node -e "const db=require('better-sqlite3')('./vehicules-dev.db'); \
  console.log(db.prepare('SELECT COUNT(*) as c FROM brands').get()); \
  console.log(db.prepare('SELECT COUNT(*) as c FROM brand_aliases').get()); \
  console.log(db.prepare('SELECT COUNT(*) as c FROM brand_family_mapping').get())"
```
**Attendu** : 87 brands, 64 aliases, 87 mappings.

### Test 3 — Mapping fournisseurs
```bash
cd apps/api && node -e "const db=require('better-sqlite3')('./vehicules-dev.db'); \
  db.prepare('SELECT unified_family, COUNT(*) as c FROM supplier_articles GROUP BY unified_family ORDER BY c DESC').all() \
  .forEach(r=>console.log(r.unified_family||'(non mappé)',r.c))"
```
**Attendu** : ~10 029 articles mappés, ~11 915 non mappés.

### Test 4 — API marques
```bash
curl -s http://localhost:3003/api/brands | head -c 500
```
**Attendu** : JSON avec 87 marques.

### Test 5 — Idempotence des migrations
Relancer le serveur → aucune migration ré-exécutée, toutes skippées.

---

## 10. Points d'attention

- **55% des articles fournisseurs** restent non mappés : principalement des noms de fabricants (DARAC, AUDAC) ou catégories trop génériques. Enrichissement via `taxonomy_family_mapping`.
- **70,3% des équipements** ont un `brand_id` lié. Les 29,7% restants n'ont pas de champ `brand` exploitable.
- **[Legacy] Levage** (id=19) conservé pour traçabilité. Peut être supprimé manuellement si aucun composant ne le référence.
- **Câbles** : Les marques câblerie (Neutrik, Sommer, Procab, Klotz) sont mappées à la famille "Divers" car elles produisent du câblage transversal (audio, vidéo, éclairage).
