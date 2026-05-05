Tu es GitHub Copilot, expert en architecture logicielle, Express.js, SQLite, React, parsing PDF, analyse de données, normalisation métier, recherche Internet, et refactor de systèmes complexes.

🎯 Objectif global
Mettre en place un système **unifié**, **automatique**, **intelligent** et **non destructif** pour :

1. La taxonomie métier :
   - Familles
   - Catégories
   - Sous‑catégories
   - Types

2. Les entités commerciales :
   - Fournisseurs
   - Marques
   - Modèles

3. Les outils associés :
   - Script d’analyse automatique des marques sur Internet
   - Simulateur visuel pour valider les regroupements
   - Prompt de refactor complet des modules impactés

Le système doit :
- analyser toutes les données existantes (BL/BP, commandes, stock, catalogue, équipements)
- analyser les fichiers dans /public
- analyser les imports CSV/Excel
- rechercher sur Internet pour valider les marques et modèles
- proposer une taxonomie unifiée
- me demander validation à chaque étape
- générer les migrations SQLite nécessaires (non destructives)
- mettre à jour backend + frontend
- maintenir des fichiers de documentation centralisés
- ne jamais écraser les données existantes

---

# 🧩 Étape 1 — Analyse complète (Taxonomie + Fournisseurs/Marques/Modèles)
Scanner :

- BL/BP importés (PDF → JSON)
- fichiers BL/BP dans /public
- tables SQLite :
  - equipment_catalog
  - equipment
  - suppliers
  - orders / order_items
  - stock_movements
  - bl_imports
  - equipment_list_items
  - sav_tickets
- modules React concernés :
  - Catalogue
  - Matériel
  - Stock
  - Commandes
  - BLImportModal
  - Annotation PDF
- données existantes dans les équipements
- données existantes dans les commandes fournisseurs

Extraire :

- familles
- catégories
- sous‑catégories
- types
- fournisseurs
- marques
- modèles
- variantes orthographiques
- incohérences
- occurrences

Ne rien modifier pour l’instant.

---

# 🧩 Étape 2 — Recherche Internet (Marques / Modèles / Fournisseurs)
Pour chaque valeur détectée :

- vérifier l’orthographe officielle
- vérifier l’existence réelle
- vérifier la catégorie métier (son, lumière, structure, vidéo…)
- détecter les variantes connues
- détecter les gammes de modèles associées
- détecter les fournisseurs officiels
- détecter les marques distribuées par chaque fournisseur

Produire un tableau :

| Valeur brute | Valeur officielle | Source | Confiance | Action |
|--------------|------------------|--------|-----------|--------|

Attends ma validation.

---

# 🧩 Étape 3 — Proposition de taxonomie unifiée
Proposer une structure :

Famille → Catégorie → Sous‑catégorie → Type  
Fournisseur → Marque → Modèle → Type → Catégorie

Tu dois :

- fusionner les doublons
- corriger les incohérences
- proposer des regroupements intelligents
- ajouter les valeurs manquantes détectées dans les BL/BP
- proposer un mapping automatique
- proposer des regroupements par domaine (son, lumière, structure, vidéo…)

Attends ma validation.

---

# 🧩 Étape 4 — Génération d’un simulateur visuel
Générer un simulateur visuel (React ou HTML statique) permettant de :

- visualiser la taxonomie complète
- afficher les regroupements proposés
- comparer anciennes valeurs vs nouvelles valeurs
- afficher les suggestions de fusion
- afficher les suggestions de renommage
- afficher les suggestions d’ajout
- permettre validation manuelle

Attends ma validation.

---

# 🧩 Étape 5 — Script d’analyse automatique des marques sur Internet
Générer un script (Node.js) qui :

- prend une liste de marques et modèles
- interroge Internet (pages officielles, catalogues, distributeurs)
- détecte :
  - orthographe officielle
  - gammes
  - modèles associés
  - catégories métier
  - fournisseurs officiels
- génère un JSON normalisé
- détecte les incohérences
- propose des corrections

Attends ma validation.

---

# 🧩 Étape 6 — Migrations SQLite (non destructives)
Générer les migrations nécessaires :

- ajout de nouvelles valeurs dans les tables pivot
- ajout de colonnes si nécessaire
- création de tables si nécessaire
- mapping des anciennes valeurs vers les nouvelles
- conservation des anciennes valeurs dans `legacy_value`
- aucune suppression de données

Attends ma validation.

---

# 🧩 Étape 7 — Mise à jour backend
Mettre à jour :

- parsers BL/BP
- parsers PDF
- parsers CSV/Excel
- routes API (catalogue, stock, commandes, matériel)
- normalisation automatique des valeurs entrantes
- fallback pour anciennes valeurs
- mapping automatique vers la taxonomie unifiée

Attends ma validation.

---

# 🧩 Étape 8 — Mise à jour frontend
Mettre à jour :

- listes déroulantes (familles, catégories, fournisseurs, marques, modèles)
- filtres
- composants Catalogue / Matériel / Stock / Commandes
- BLImportModal
- Annotation PDF (familles → couleurs)
- Vision Transformer (si activé)

Attends ma validation.

---

# 🧩 Étape 9 — Mise à jour des fichiers centraux
Mettre à jour automatiquement :

`docs/05-Specs/Taxonomie_Unifiee.md`  
`docs/05-Specs/Taxonomie_Fournisseurs_Marques_Modeles.md`

Contenu :

- taxonomie complète
- définitions
- règles métier
- mapping legacy → unifié
- historique des modifications
- valeurs détectées automatiquement
- sources Internet utilisées

---

# 🧩 Étape 10 — Prompt de refactor complet
Générer un prompt de refactor pour :

- mettre à jour tous les modules impactés
- supprimer les anciennes valeurs
- remplacer les anciennes références
- mettre à jour les parsers
- mettre à jour les filtres
- mettre à jour les composants
- mettre à jour les règles métier
- garantir la compatibilité ascendante

Attends ma validation.

---

# 🧩 Étape 11 — Rapport final
Produire un rapport listant :

- nouvelles valeurs détectées
- valeurs fusionnées
- valeurs ajoutées
- migrations générées
- modules impactés
- fichiers modifiés
- instructions de test

---

# 🚀 Action
Active maintenant le système complet de maintenance automatique (taxonomie + fournisseurs + marques + modèles + analyse Internet + simulateur + refactor).  
Commence par l’analyse complète des données existantes et des sources Internet, puis attends ma validation avant toute modification.
