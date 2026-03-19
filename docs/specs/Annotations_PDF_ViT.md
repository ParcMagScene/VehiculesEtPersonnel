# Spécifications — Annotations PDF & Vision Transformer

> *Document fusionné depuis : Module_Annotations_BP.md, Algorithme Structurel d'Annotation PDF.md, VisionTransformer.md*
> **Statut** : Spécifications non implémentées — en attente

---

## Partie 1 — Module d'annotation des BP (base)

Tu es Copilot, expert en architecture logicielle, React, Express.js, SQLite, PDF processing, parsing de documents, et intégration dans un système existant complexe.
Tu dois générer le module complet d’annotation des BP (Locations & Prestations) pour l’application eM@g, en respectant strictement les contraintes suivantes :

🎯 Objectif général
Implémenter un système d’annotation automatique des BP importés (bons de prestations / locations) dans eM@g, avec :

Surlignage automatique des lignes d’articles selon leur famille métier

Bleu : Sonorisation

Rouge : Distribution électrique

Jaune : Lumière / Éclairage

Rose : Vidéo

Vert fluo : Structure

Encadrement automatique des Kits

Les kits sont détectés car groupés et affichés en italique dans le BP

Le cadre doit utiliser la couleur de la famille dans laquelle le kit se trouve

Bloc d’informations d’affaire

Dans le cadre vide en haut à droite du BP, afficher automatiquement :

Réservations liées

Personnel affecté

Tâches programmées

Notes internes

Ces informations doivent se mettre à jour automatiquement si l’affaire est modifiée

Bouton “Imprimer”

Dans la section Documents / BP liés

Génère un PDF annoté (avec les couleurs, cadres, infos affaire)

🧩 Contraintes techniques
🔧 Backend
Express.js (routes modulaires)

SQLite (better-sqlite3)

Système existant de parsing PDF déjà en place (pdfjs-dist côté client)

Ne pas casser les routes existantes

Ajouter un endpoint dédié :
POST /api/affaires/:id/bp/annotate

🎨 Frontend
React 18 + Vite

Architecture modulaire (131 composants)

Intégration dans :

AffaireDetailPanel

BLImportModal

CommunicationPanel (si nécessaire)

Ajouter un bouton “Annoter & Imprimer”

Générer un PDF annoté côté client (canvas → PDF)

🗂️ Structure attendue
Copilot doit produire :

Plan d’architecture complet

Nouvelles routes backend

Nouveaux composants React

Hooks nécessaires

Algorithme de détection des familles

Algorithme de détection des kits

Algorithme d’injection des infos d’affaire

Génération PDF annoté

Intégration dans l’UI existante

Tests manuels + cas limites

🧠 Règles métier
Détection des familles
Copilot doit proposer une fonction robuste basée sur :

mots‑clés

catégories catalogue

correspondances UID

fallback par regex

Détection des kits
Un kit est :

un groupe d’articles indentés OU

un bloc en italique OU

un ensemble précédé d’un titre de kit

Bloc d’informations d’affaire
Copilot doit générer une fonction qui récupère :

/api/reservations?affaireId=…

/api/personnel/assignments?affaireId=…

/api/communication/tasks?affaireId=…

/api/communication/notes?affaireId=…

Et formate un bloc synthétique.

🖨️ PDF annoté
Copilot doit produire :

un canvas annoté

un export PDF (A4 portrait ou paysage selon BP)

couleurs respectées

cadres autour des kits

bloc affaire en haut à droite

📱 Compatibilité Desktop & Mobile
Le module doit être :

utilisable dans l’interface desktop

utilisable dans l’interface mobile (PWA)

avec un bouton “Imprimer” adapté mobile (print / share)

🧪 Livrables attendus
Copilot doit fournir :

Code backend complet

Code frontend complet

Fonctions utilitaires

Documentation d’intégration

Tests manuels

Cas limites

Optimisations performance

Vérifications sécurité

🧭 Style attendu
Code clair, modulaire, commenté

Respect total de l’architecture eM@g

Pas de régression

Pas de duplication

Utilisation des patterns existants (ApiClient, hooks, modals, panels)

🚀 Action
Génère maintenant tout le module d’annotation des BP, complet, propre, prêt à intégrer dans eM@g.
---

## Partie 2 — Algorithme Structurel d'Annotation PDF

Tu es Copilot, expert en PDF, pdf.js, pdf-lib, OCR structurel, clustering géométrique, analyse de documents, et rendu vectoriel.
Ta mission : réécrire entièrement le moteur d’annotation PDF d’eM@g, en intégrant :

un algorithme structurel avancé

un mode d’annotation intelligent (détection automatique des familles)

un simulateur visuel pour tester l’algorithme en temps réel

L’objectif est de corriger définitivement les problèmes de surlignage trop bas, d’espacement trop grand, de décalage vertical, et de mauvaise détection des lignes.

🎯 Objectifs
Détecter catégories, articles, kits, sous‑lignes, colonnes.

Reconstruire une grille virtuelle parfaitement alignée.

Appliquer un surlignage pixel‑perfect, sans décalage.

Encadrer les kits avec précision.

Détecter automatiquement la famille métier (Structure, Sonorisation, Lumière, Vidéo, Distribution).

Fournir un simulateur visuel pour tester l’algorithme.

Rendre l’annotation stable, reproductible et compatible impression.

🧩 1. Algorithme Structurel Obligatoire
✔ Étape 1 — Clustering vertical (anti‑décalage)
Regrouper les lignes par proximité verticale (±2 px).
Pour chaque cluster :

calculer la médiane Y

remplacer toutes les Y par cette médiane

→ Élimine 100 % des décalages verticaux.

✔ Étape 2 — Détection des colonnes
Analyser les X des mots pour détecter :

colonne Nom

colonne Référence

colonne Qté

colonne Poids

colonne Volume

Reconstruire une grille à colonnes fixes, même si le PDF est irrégulier.

✔ Étape 3 — Détection des catégories
Une catégorie est détectée si :

police plus grande

texte en majuscules

indentation nulle

pas de référence

pas de quantité

alignement à gauche

Marquer la ligne comme début de bloc.

✔ Étape 4 — Détection des articles
Un article est détecté si :

présence d’une référence valide ([A-Z0-9]{3,})

présence d’une quantité numérique

indentation faible

police standard

✔ Étape 5 — Détection des kits
Un kit est détecté si :

indentation > 20 px

police italique

texte contient “KIT” ou “COMPRENANT”

suivi de sous‑lignes indentées

Calculer un rectangle englobant pour le kit.

✔ Étape 6 — Correction de hauteur de ligne
Ne jamais utiliser bbox.height.
Utiliser :

Code
lineHeight = medianLineHeight * 1.05
lineTop = clusterMedianY - (lineHeight * 0.75)
→ Surlignage parfaitement centré.

✔ Étape 7 — Surlignage overlay
Code
padding: 2px
opacity: 0.30
blendMode: multiply
🎨 2. Mode d’Annotation Intelligent (obligatoire)
Copilot doit implémenter un mode intelligent qui :

✔ Détecte automatiquement la famille métier
Basé sur :

mots‑clés

référence catalogue

catégorie détectée

indentation

contexte (STRUCTURE, SONO, etc.)

✔ Applique automatiquement la couleur
Structure → vert fluo

Sonorisation → bleu

Distribution → rouge

Lumière → jaune

Vidéo → rose

✔ Détecte les incohérences
Exemples :

article dans mauvaise catégorie

kit mal indenté

ligne orpheline

référence inconnue

✔ Propose une correction automatique
Exemples :

“Cet article semble appartenir à la famille Structure.”

“Ce kit n’a pas de sous‑lignes.”

🧪 3. Simulateur Visuel (obligatoire)
Copilot doit générer un simulateur visuel permettant :

✔ d’afficher le PDF en overlay
✔ de visualiser :
bounding boxes brutes

clusters verticaux

colonnes détectées

catégories

articles

kits

surlignages

cadres

erreurs détectées

✔ de basculer entre :
mode brut

mode corrigé

mode intelligent

mode impression

✔ de cliquer sur une ligne pour afficher :
coordonnées

cluster

famille détectée

type (catégorie / article / kit)

rectangle final

✔ d’exporter un PDF annoté pour validation
🧪 4. Livrables attendus
Copilot doit produire :

✔ Le moteur d’annotation complet
✔ Les fonctions utilitaires
✔ Le clustering vertical
✔ La détection des colonnes
✔ La détection des catégories
✔ La détection des articles
✔ La détection des kits
✔ Le mode intelligent
✔ Le simulateur visuel complet
✔ Les tests unitaires
✔ La documentation
🚀 Action
Génère maintenant :

Le moteur d’annotation structurel complet

Le mode intelligent

Le simulateur visuel

Les fonctions utilitaires

Le clustering vertical

La détection des colonnes

La détection des catégories

La détection des articles

La détection des kits

Le rendu overlay

Les tests

La documentation

Le tout sans casser l’existant, et en garantissant un surlignage parfaitement aligné, stable, et intelligent.

🏁 Fin du prompt
---

## Partie 3 — Vision Transformer (ViT) pour analyse avancée

Tu es Copilot, expert en Vision Transformer (ViT), fine‑tuning de modèles visuels, analyse de documents, segmentation de mise en page, OCR avancé, fusion Vision→PDF, et rendu vectoriel.
Ta mission : implémenter le moteur d’annotation PDF le plus avancé possible pour eM@g, basé sur un modèle Vision Transformer fine‑tuné sur les BL/BP.

Ce moteur doit fonctionner comme un humain :
→ il regarde la page
→ il comprend la structure
→ il détecte les catégories
→ il détecte les articles
→ il détecte les kits
→ il reconstruit le tableau
→ il calcule les coordonnées exactes
→ il annote parfaitement

🎯 Objectif général
Créer un moteur d’annotation PDF niveau Google/Adobe, basé sur :

Vision Transformer (ViT) fine‑tuné sur ton gabarit

Segmentation visuelle des lignes, colonnes, blocs

Classification visuelle des catégories / articles / kits

Reconstruction structurelle complète

Fusion Vision → PDF pour obtenir les coordonnées exactes

Surlignage pixel‑perfect

Mode intelligent

Simulateur visuel

Ce moteur doit être indépendant du PDF interne, indépendant de l’OCR, et indépendant des bounding boxes PDF.

🧩 1. Pipeline obligatoire (niveau industriel)
✔ Étape 1 — Vision Transformer (ViT) pré‑entraîné
Utiliser un modèle ViT (Base ou Large) pré‑entraîné sur :

Document Understanding

LayoutLMv3

DocFormer

Donut

DiT (Document Image Transformer)

Le modèle doit être fine‑tuné sur ton gabarit BL/BP.

✔ Étape 2 — Fine‑tuning sur ton gabarit
Le modèle doit apprendre à reconnaître visuellement :

l’en‑tête de 9 cm

l’en‑tête de tableau de 5 mm

les lignes de catégories (1,4 cm)

les lignes d’articles (1 cm)

les kits (indentation + style)

les colonnes (Nom, Réf, Qté, Poids, Volume)

Le modèle doit produire :

bounding boxes exactes

labels (catégorie / article / kit)

segmentation des colonnes

segmentation du tableau

structure hiérarchique

✔ Étape 3 — Reconstruction structurelle
À partir des sorties du ViT :

reconstruire la grille verticale

reconstruire les colonnes

regrouper les lignes

détecter les blocs KIT

détecter les familles métier

détecter les incohérences

✔ Étape 4 — Fusion Vision → PDF
Pour chaque ligne détectée :

convertir les coordonnées image → PDF

corriger les offsets

aligner sur la grille réelle

appliquer les hauteurs fixes (1,4 cm / 1 cm)

générer les rectangles d’annotation exacts

✔ Étape 5 — Surlignage pixel‑perfect
overlay (blendMode: multiply)

opacity: 0.30

padding: 2–3 pt

couleurs :

Structure → vert fluo

Sonorisation → bleu

Distribution → rouge

Lumière → jaune

Vidéo → rose

🧠 2. Mode d’annotation intelligent
Le moteur doit :

✔ Détecter automatiquement la famille métier
Basé sur :

catégorie visuelle

mots‑clés

référence catalogue

indentation

style visuel

contexte du tableau

✔ Détecter les incohérences
article dans mauvaise catégorie

kit sans sous‑lignes

ligne orpheline

référence inconnue

✔ Proposer des corrections
“Cet article semble appartenir à la famille Structure.”

“Ce kit n’a pas de sous‑lignes.”

🧪 3. Simulateur visuel (obligatoire)
Copilot doit générer un simulateur visuel permettant :

✔ d’afficher le PDF en fond
✔ de superposer :
segmentation ViT

bounding boxes

catégories

articles

kits

colonnes

surlignages

erreurs détectées

✔ de basculer entre :
mode brut

mode ViT

mode structurel

mode annotation finale

✔ d’inspecter une ligne :
texte

type (catégorie / article / kit)

famille détectée

coordonnées Vision

coordonnées PDF

rectangle final

✔ d’exporter un PDF annoté
🧪 4. Livrables attendus
Copilot doit produire :

✔ Le modèle ViT fine‑tuné
✔ Le pipeline complet Vision → Structure → PDF
✔ Le moteur d’annotation final
✔ Le simulateur visuel
✔ Le mode intelligent
✔ Les fonctions utilitaires
✔ Les tests unitaires
✔ La documentation complète
🚀 Action
Génère maintenant :

Le modèle Vision Transformer fine‑tuné

Le pipeline complet

Le moteur d’annotation final

Le simulateur visuel

Le mode intelligent

Les fonctions utilitaires

Les tests

La documentation

Le tout indépendant du PDF, indépendant de l’OCR, et garantissant un surlignage parfaitement aligné, stable, reproductible, et professionnel.