Tu es GitHub Copilot, expert en documentation technique, structuration de projets complexes, gestion de fichiers Markdown et création de documentation API interne.

> **✅ Prompt exécuté** — Voir le résultat dans [API-INDEX.md](../API-INDEX.md)

===========================================================
A — PROMPT : CRÉATION DE LA DOCUMENTATION API
===========================================================

🎯 Objectif
Transformer tous les fichiers `.md` du projet eM@g en une **documentation API interne**, propre, fusionnée, dédupliquée, hiérarchisée et exploitable par Copilot comme une base de connaissances modulaire.

---

# 🧩 Étape 1 — Analyse complète
Analyse tous les fichiers `.md` du projet, identifie :
- les thèmes
- les sections
- les doublons
- les contradictions
- les zones fusionnables
- les fichiers obsolètes
- les fichiers critiques à conserver tels quels

Ne rien modifier pour l’instant.

---

# 🧩 Étape 2 — Proposition d’une structure API
Proposer une structure documentaire propre, par exemple :

docs/
  01-Architecture/
  02-Backend/
  03-Frontend/
  04-Mobile/
  05-TV/
  06-Sécurité/
  07-Audit/
  08-Annotations-PDF/
  09-Vision-Transformer/
  10-Video-WebRTC/
  11-Monorepo/
  12-Checklists/
  13-Guides/
  14-Prompts/
  15-API-Index/

La structure doit être logique, modulaire et adaptée à eM@g.

---

# 🧩 Étape 3 — Fusion intelligente
Pour chaque thème :
- fusionner les fichiers `.md` concernés
- conserver toutes les informations utiles
- supprimer les doublons
- harmoniser les titres
- harmoniser les sections
- harmoniser le style
- corriger les incohérences
- ajouter une table des matières automatique
- ajouter des liens croisés

⚠️ Ne jamais supprimer une information utile.  
⚠️ Ne jamais casser les références internes.  
⚠️ Ne jamais écraser un fichier sans confirmation.

---

# 🧩 Étape 4 — Déduplication
Pour chaque section fusionnée :
- détecter les paragraphes identiques ou similaires
- conserver la version la plus claire
- supprimer les répétitions
- fusionner les variantes contradictoires
- harmoniser les termes métier

---

# 🧩 Étape 5 — Génération des fichiers finaux
Créer les fichiers finaux dans `docs/` :
- un fichier par thème
- structure propre
- titres cohérents
- sections hiérarchisées
- liens internes
- sommaire automatique

---

# 🧩 Étape 6 — Rapport final
Produire un rapport listant :
- fichiers fusionnés
- fichiers créés
- doublons éliminés
- incohérences corrigées
- structure finale

---

# 🧠 Contraintes absolues
- Ne jamais supprimer un fichier sans confirmation explicite.
- Ne jamais supprimer une information utile.
- Ne jamais casser les prompts existants.
- Ne jamais modifier les `.md` du mobile ou du TV client.
- Ne jamais modifier les `.md` contenant du code critique ou des migrations SQL.

---

===========================================================
B — PROMPT : MAINTENANCE AUTOMATIQUE DE LA DOCUMENTATION API
===========================================================

🎯 Objectif
Maintenir automatiquement la documentation API à jour lorsque de nouveaux fichiers `.md` sont ajoutés ou modifiés.

---

# 🧩 Étape 1 — Détection des nouveaux fichiers
À chaque ajout ou modification d’un `.md` :
- analyser son contenu
- identifier son thème
- identifier les sections pertinentes
- détecter les doublons potentiels
- détecter les contradictions potentielles

---

# 🧩 Étape 2 — Fusion automatique
Si le fichier appartient à un thème existant :
- fusionner son contenu dans le fichier thématique correspondant
- dédupliquer les sections
- harmoniser les titres
- mettre à jour les liens internes
- mettre à jour la table des matières

---

# 🧩 Étape 3 — Mise à jour de l’index API
Mettre à jour automatiquement :
- la liste des fichiers
- la liste des sections
- les liens croisés
- les dépendances documentaires

---

# 🧩 Étape 4 — Rapport de maintenance
Générer un rapport listant :
- fichiers mis à jour
- sections fusionnées
- doublons supprimés
- liens mis à jour

---

# 🧠 Contraintes
- Ne jamais supprimer une information utile.
- Ne jamais casser la structure API.
- Ne jamais casser les liens internes.
- Ne jamais écraser un fichier sans confirmation.

---

===========================================================
C — PROMPT : GÉNÉRATION D’UN INDEX API GLOBAL
===========================================================

🎯 Objectif
Créer un **index API global** de toute la documentation `.md`, similaire à une API Reference (Swagger / OpenAPI), mais pour la documentation interne.

---

# 🧩 Étape 1 — Analyse des fichiers API
Analyser tous les fichiers dans `docs/`.

---

# 🧩 Étape 2 — Génération de l’index
Créer un fichier :

docs/15-API-Index/index.md


Contenant :
- une table des matières globale
- la liste des modules
- la liste des fichiers
- la liste des sections
- les liens directs vers chaque section
- les dépendances entre documents
- les relations entre modules
- les renvois croisés

---

# 🧩 Étape 3 — Mise à jour automatique
À chaque modification d’un fichier `.md` :
- mettre à jour l’index
- ajouter les nouvelles sections
- supprimer les sections obsolètes
- maintenir les liens internes

---

# 🧠 Contraintes
- Ne jamais casser les liens internes.
- Ne jamais supprimer une section sans confirmation.
- Ne jamais écraser l’index sans sauvegarde.

---

# 🚀 Action
Commence maintenant par l’analyse complète des fichiers Markdown, puis propose la structure documentaire API avant toute fusion.
