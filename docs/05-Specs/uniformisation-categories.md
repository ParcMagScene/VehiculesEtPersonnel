Tu es GitHub Copilot, expert en architecture logicielle, Express.js, SQLite, React, parsing PDF, analyse de données, et normalisation de taxonomies métier.

🎯 Objectif
Uniformiser et centraliser la définition des **familles**, **catégories**, **sous‑catégories** et **types** utilisés dans eM@g, en se basant sur :

- les BL et BP déjà importés (PDF + JSON extraits)
- les fichiers BL/BP présents dans /public
- les tables SQLite existantes :
  - equipment_catalog
  - equipment
  - stock_locations
  - stock_movements
  - orders / order_items
  - bl_imports
  - planning / tâches
  - display_color_rules
- les modules frontend concernés :
  - Matériel
  - Catalogue
  - Stock
  - Commandes
  - BL Import
  - BP Annotation
  - Vision Transformer (si applicable)

Tu dois :
1. **Analyser toutes les sources** pour extraire les familles/catégories existantes.
2. **Détecter les incohérences** (ex : “Structure”, “STRUCTURE”, “Struc.”).
3. **Proposer une taxonomie unifiée** :
   - Famille
   - Catégorie
   - Sous‑catégorie
   - Type
4. **Me demander validation** avant toute modification.
5. **Générer les scripts de migration SQLite** :
   - sans écraser les données
   - sans supprimer les valeurs existantes
   - en ajoutant uniquement ce qui manque
6. **Mettre à jour les modules backend** :
   - normalisation des valeurs
   - mapping automatique
   - fallback pour anciennes valeurs
7. **Mettre à jour les modules frontend** :
   - listes déroulantes
   - filtres
   - parsers BL/BP
   - import CSV/Excel
8. **Mettre à jour les parsers BL/BP** :
   - extraction automatique des familles/catégories
   - mapping vers la taxonomie unifiée
9. **Mettre à jour les règles métier** :
   - couleurs
   - surlignage PDF
   - Vision Transformer (si activé)
10. **Générer un rapport final** :
   - valeurs trouvées
   - valeurs fusionnées
   - valeurs ajoutées
   - modules impactés
   - scripts générés

---

# 🧩 Étape 1 — Analyse
Commence par :
- scanner les BL/BP importés (JSON extraits)
- scanner les PDF dans /public/imports
- scanner les tables SQLite
- scanner les modules React concernés

Produis :
- la liste brute des familles
- la liste brute des catégories
- la liste brute des sous‑catégories
- la liste brute des types
- les occurrences
- les incohérences détectées

Ne propose aucune modification tant que je n’ai pas validé.

---

# 🧩 Étape 2 — Proposition de taxonomie unifiée
Propose une structure :

Famille → Catégorie → Sous‑catégorie → Type

Exemple :
- Structure
  - Levage
    - Manutention
      - Palan 1T
- Sonorisation
  - Diffusion
    - Enceintes
      - Line Array

Tu dois :
- fusionner les doublons
- corriger les incohérences
- proposer des regroupements intelligents
- ajouter les valeurs manquantes détectées dans les BL/BP

Attends ma validation.

---

# 🧩 Étape 3 — Migrations SQLite
Génère des migrations **non destructives** :

- ajout de colonnes si nécessaire
- ajout de tables pivot si nécessaire
- ajout des nouvelles familles/catégories
- mapping des anciennes valeurs vers les nouvelles
- conservation des anciennes valeurs dans une colonne “legacy_value” si utile

Ne jamais supprimer une donnée existante.

Attends ma validation.

---

# 🧩 Étape 4 — Mise à jour backend
Mettre à jour :
- parsers BL/BP
- parsers PDF
- parsers Excel/CSV
- routes API (catalogue, stock, commandes, matériel)
- normalisation automatique des valeurs entrantes
- fallback pour anciennes valeurs

Attends ma validation.

---

# 🧩 Étape 5 — Mise à jour frontend
Mettre à jour :
- listes déroulantes
- filtres
- composants Catalogue / Matériel / Stock / Commandes
- BLImportModal
- Annotation PDF (familles → couleurs)
- Vision Transformer (si activé)

Attends ma validation.

---

# 🧩 Étape 6 — Rapport final
Produire :
- taxonomie finale
- scripts générés
- fichiers modifiés
- modules impactés
- instructions de test

---

# 🚀 Action
Commence maintenant par **l’analyse complète des familles/catégories/sous‑catégories/types** dans toutes les sources, et attends ma validation avant d’aller plus loin.
