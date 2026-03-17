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