Créer un module Inventaire Mag Scène complet, moderne, cohérent avec l’architecture eM@g, disponible :

dans l’interface Desktop (React)

dans l’interface Mobile (PWA)

dans le Dashboard TV (si pertinent)

avec un thème visuel identique à VS Code (Dark+ / Light+)

Le module doit gérer :

consommables

pièces détachées

matériel individuel

fournisseurs

emplacements multi‑dépôts

alertes stock bas

moteur de prix intelligent

exports PDF/CSV/XLSX

statistiques

intégrité des données

compatibilité offline (IndexedDB)

📦 1. Analyse & Audit attendus
Copilot doit produire :

🔍 Audit technique complet
Analyse du README Inventaire AV fourni

Analyse de l’architecture eM@g (frontend + backend + DB)

Identification des points de friction, duplications, conflits, incohérences

Proposition d’un schéma DB unifié (Inventaire + Stock + Équipements)

Proposition d’une API REST cohérente avec les 15 modules existants

Proposition d’un modèle de permissions (admin / user / technicien / magasinier)

🧩 Audit d’intégration
Comment fusionner Inventaire AV avec :

stockRoutes.js

equipmentRoutes.js

ordersRoutes.js

annuaireRoutes.js

Comment éviter les doublons (fournisseurs, catégories, emplacements)

Comment intégrer le moteur de prix (IQR, score de confiance)

Comment intégrer les exports PDF/XLSX dans eM@g

🎨 2. Thème VS Code — Exigences
Copilot doit générer :

🎨 Palette complète VS Code Dark+
background, sidebar, panels, borders

couleurs syntaxiques

couleurs d’accent (bleu VS Code)

variables CSS globales

classes utilitaires

🎨 Palette Light+ (optionnelle)
même structure, couleurs adaptées

🎨 Intégration
Générer un fichier theme-vscode.css

Générer un fichier theme-vscode-mobile.css

Adapter les composants React (Cards, Tables, Panels)

Adapter les graphiques (Dashboard Inventaire)

📱 3. Intégration Mobile
Copilot doit produire :

📱 UI Mobile
Vue Inventaire

Vue Article

Vue Mouvements

Vue Fournisseurs

Vue Emplacements

Vue Alertes stock bas

Recherche instantanée

Mode offline (IndexedDB)

Synchronisation automatique

📱 API
Endpoints optimisés mobile

Pagination

Compression gzip

Cache 30–60s

🗄️ 4. Base de données — Unification
Copilot doit proposer :

🗄️ Schéma DB unifié
Fusion de :

inventaire (articles, catégories, fournisseurs, emplacements)

stock (mouvements)

équipements (UID, flightcases)

commandes (order_items)

annuaire (fournisseurs enrichis)

🗄️ Tables attendues
inventory_items

inventory_categories

inventory_locations

inventory_suppliers

inventory_movements

inventory_price_history

inventory_anomalies

inventory_stats_cache

🗄️ Contraintes
FK strictes

Index optimisés

Transactions atomiques

Migrations idempotentes

🧠 5. Moteur de prix intelligent
Copilot doit intégrer :

📊 Fonctionnalités
IQR

σ (écart-type)

Score de confiance 0–100

Détection d’anomalies

Prix bas / moyen / haut

Fusion multi-sources

📊 Implémentation
Version backend Node.js

Version frontend (fallback offline)

API REST : /api/inventory/price-engine/*

🧪 6. Génération de code attendue
Copilot doit produire :

🧪 Backend
Nouvelles routes Express

Migrations SQLite

Services métier

Validation Zod

Tests unitaires

🧪 Frontend
Composants React (Desktop + Mobile)

Hooks (useInventory, usePriceEngine)

Pages complètes

UI VS Code theme

IndexedDB stores

🧪 Scripts
Import CSV

Export PDF/XLSX

Génération de stats

🚀 7. Livrables attendus
Copilot doit fournir :

📌 1. Audit complet
📌 2. Architecture proposée
📌 3. Schéma DB unifié
📌 4. API REST complète
📌 5. Composants React Desktop
📌 6. Composants React Mobile
📌 7. Thème VS Code complet
📌 8. Moteur de prix Node.js
📌 9. Migrations SQLite
📌 10. Plan d’intégration progressif
🧭 8. Style de réponse attendu
Structuré

Hiérarchisé

Lisible

Avec code complet

Avec explications

Avec schémas si utile

Sans rien omettre

🏁 9. Action
Commence immédiatement par :

👉 un audit complet de l’intégration Inventaire AV → eM@g  
👉 puis propose l’architecture unifiée  
👉 puis génère le thème VS Code  
👉 puis génère les API + DB + UI Desktop + UI Mobile

Si tu as besoin d’informations supplémentaires, demande‑les explicitement.

Tu peux maintenant commencer.