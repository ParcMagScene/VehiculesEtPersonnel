Tu es GitHub Copilot, expert en taxonomies métier, Express.js, SQLite, React, parsing PDF, analyse de données et maintenance de systèmes complexes.

🎯 Objectif
Mettre en place un système de **maintenance automatique** de la taxonomie eM@g (familles, catégories, sous‑catégories, types) en s’appuyant sur :

- les BL/BP importés (PDF + JSON extraits)
- les fichiers BL/BP dans /public
- les imports CSV/Excel
- les modules Matériel, Catalogue, Stock, Commandes
- les tables SQLite (equipment_catalog, equipment, stock, orders, bl_imports, etc.)

Le système doit :
1. **Détecter automatiquement** toute nouvelle valeur (famille, catégorie, sous‑catégorie, type).
2. **Comparer** avec la taxonomie existante.
3. **Proposer une action** :
   - ajout
   - fusion
   - renommage
   - regroupement
4. **Me demander validation** avant toute modification.
5. **Générer les migrations SQLite** nécessaires (non destructives).
6. **Mettre à jour backend + frontend** :
   - parsers BL/BP
   - parsers PDF
   - parsers CSV/Excel
   - listes déroulantes
   - filtres
   - règles métier (couleurs, surlignage)
7. **Maintenir un fichier central** :  
   `docs/05-Specs/Taxonomie_Unifiee.md`
8. **Ne jamais écraser les données existantes**.

---

# 🧩 Étape 1 — Surveillance automatique
Mettre en place un mécanisme qui, à chaque modification ou ajout de données :

- scanne les nouvelles lignes BL/BP
- scanne les nouveaux imports CSV/Excel
- scanne les nouvelles entrées catalogue/stock/commandes
- extrait les valeurs textuelles candidates :
  - famille
  - catégorie
  - sous‑catégorie
  - type
- normalise (trim, uppercase/lowercase, accents)
- compare avec la taxonomie existante

Produis un rapport :
- valeurs nouvelles détectées
- valeurs proches (similarité > 80%)
- valeurs incohérentes
- propositions de fusion ou ajout

Attends ma validation.

---

# 🧩 Étape 2 — Proposition de mise à jour
Pour chaque nouvelle valeur détectée :

- proposer une classification :
  - Famille → Catégorie → Sous‑catégorie → Type
- proposer un mapping automatique
- proposer une fusion si similaire à une valeur existante
- proposer un ajout si totalement nouvelle
- proposer un renommage si incohérente

Attends ma validation.

---

# 🧩 Étape 3 — Migrations SQLite (non destructives)
Générer les migrations nécessaires :

- ajout de nouvelles valeurs dans les tables pivot
- ajout de colonnes si nécessaire
- création de tables si nécessaire
- mapping des anciennes valeurs vers les nouvelles
- conservation des anciennes valeurs dans `legacy_value` si utile
- aucune suppression de données

Attends ma validation.

---

# 🧩 Étape 4 — Mise à jour backend
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

# 🧩 Étape 6 — Mise à jour du fichier central
Mettre à jour automatiquement :

`docs/05-Specs/Taxonomie_Unifiee.md`

Contenu :
- taxonomie complète
- définitions
- règles métier
- mapping legacy → unifié
- historique des modifications
- valeurs détectées automatiquement

---

# 🧩 Étape 7 — Rapport final
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
Active maintenant le système de maintenance automatique de la taxonomie, commence par analyser les données existantes, et attends ma validation avant toute modification.
