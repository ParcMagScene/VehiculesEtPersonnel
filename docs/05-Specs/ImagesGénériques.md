Tu es GitHub Copilot, expert en gestion d’assets, UX, React, Express.js, SQLite et intégration d’images dans des systèmes complexes.

🎯 Objectif global
Mettre en place un système complet d’images génériques pour les équipements qui n’ont pas de photo réelle, basé sur la taxonomie unifiée (famille → catégorie → sous-catégorie → type), en utilisant :

- les photos existantes dans /public/Photos
- des images génériques propres pour les catégories manquantes
- un fallback automatique
- un sélecteur d’image générique dans l’interface
- un mapping automatique backend + frontend

Le tout **sans écraser les photos existantes** et **avec validation obligatoire**.

===========================================================
A — LISTE COMPLÈTE DES IMAGES GÉNÉRIQUES NÉCESSAIRES
===========================================================

# 🏗️ 1. Structure
- structure_carre_30.png
- structure_carre_40.png
- structure_carre_50.png
- structure_triangle.png
- structure_embase.png
- structure_manchon.png
- structure_elingue_acier.png
- structure_elingue_ronde.png
- structure_manille.png
- structure_chaine.png

# 🎛️ 2. Levage / Ponts
- moteur_250kg.png
- moteur_500kg.png
- moteur_1t.png
- palan_chaine.png
- poutre_levage.png
- cable_moteur.png

# 🎤 3. Son
- enceinte_generique.png
- sub_generique.png
- line_array_generique.png
- console_generique.png
- micro_hf.png
- micro_filaire.png
- di_box.png
- cable_xlr.png
- cable_speakon.png
- multipaire.png

# 💡 4. Lumière
- par_led.png
- projecteur_led.png
- lyre_spot.png
- lyre_wash.png
- barre_led.png
- gradateur.png
- cable_dmx.png
- cable_powercon.png

# 🎥 5. Vidéo
- videoprojecteur.png
- module_led.png
- convertisseur_video.png
- cable_hdmi.png
- cable_sdi.png
- cable_rj45.png

# 🎭 6. Scène / Praticables
- praticable_1x1.png
- praticable_2x1.png
- praticable_2x2.png
- pied_reglable.png
- garde_corps.png
- escalier_scene.png

# 📦 7. Flightcases & Accessoires
- flightcase_generique.png
- flightcase_double.png
- flightcase_console.png
- outillage.png
- securite.png
- coffret_electrique.png
- rallonge_enrouleur.png

===========================================================
B — PROMPT D’INTÉGRATION AUTOMATIQUE DES IMAGES GÉNÉRIQUES
===========================================================

# 🧩 Étape 1 — Création de l’arborescence
Créer dans `public/Photos/Generic/` :

structure/
levage/
praticables/
son/
lumiere/
video/
accessoires/
divers/

Ne rien écraser si les dossiers existent.

---

# 🧩 Étape 2 — Ajout des images génériques
Pour chaque catégorie listée dans la section A, ajouter une image générique dans le dossier correspondant.

Ne jamais remplacer une image existante sans confirmation.

---

# 🧩 Étape 3 — Mapping automatique
Créer le fichier :

`src/utils/genericImages.js`

Contenant :

```js
export const GENERIC_IMAGES = {
  structure: {
    carre30: '/Photos/Generic/structure/structure_carre_30.png',
    carre40: '/Photos/Generic/structure/structure_carre_40.png',
    carre50: '/Photos/Generic/structure/structure_carre_50.png',
    triangle: '/Photos/Generic/structure/structure_triangle.png',
    embase: '/Photos/Generic/structure/structure_embase.png',
    manchon: '/Photos/Generic/structure/structure_manchon.png',
    elingueAcier: '/Photos/Generic/structure/structure_elingue_acier.png',
    elingueRonde: '/Photos/Generic/structure/structure_elingue_ronde.png',
    manille: '/Photos/Generic/structure/structure_manille.png',
    chaine: '/Photos/Generic/structure/structure_chaine.png',
  },
  son: {
    enceinte: '/Photos/Generic/son/enceinte_generique.png',
    sub: '/Photos/Generic/son/sub_generique.png',
    lineArray: '/Photos/Generic/son/line_array_generique.png',
    console: '/Photos/Generic/son/console_generique.png',
    microHF: '/Photos/Generic/son/micro_hf.png',
    microFilaire: '/Photos/Generic/son/micro_filaire.png',
    diBox: '/Photos/Generic/son/di_box.png',
    xlr: '/Photos/Generic/son/cable_xlr.png',
    speakon: '/Photos/Generic/son/cable_speakon.png',
    multipaire: '/Photos/Generic/son/multipaire.png',
  },
  // ... compléter pour lumière, vidéo, praticables, accessoires
};
