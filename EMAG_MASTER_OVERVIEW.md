# EMAG MASTER OVERVIEW

Document de synthèse globale du système eM@g.

Portée : ce document agrège l’état observable du dépôt au 8 juillet 2026 à partir de la documentation technique, des manifests applicatifs, des workflows CI, des guides opérationnels, de la structure monorepo et des intégrations déclarées. Il est conçu pour permettre à un assistant externe de comprendre l’ensemble du produit sans accès direct au code source.

Important : certaines métriques historiques varient selon les documents et l’environnement de démarrage, notamment sur le nombre exact de tables et la volumétrie des composants. La lecture convergente du dépôt situe la base autour de 86 tables, avec une fourchette documentaire de 84 à 87 selon les migrations dynamiques et la date des rapports. Le même principe vaut pour certains comptages de routes et de composants, qui reflètent des états successifs du système.

## 1. Résumé exécutif

### Vision globale d’eM@g

eM@g est une plateforme métier intégrée destinée à une activité de prestations événementielles, techniques et logistiques. Le système unifie dans une même application la gestion de flotte, la réservation de véhicules, le personnel, les congés, le planning, les affaires, le parc d’équipements, le stock, les commandes fournisseurs, l’annuaire, la communication interne, la messagerie, le mailing, l’affichage TV, la vidéo de surveillance, le contrôle Sonos et les usages mobiles terrain.

La logique d’ensemble n’est pas celle d’un simple outil de gestion de parc. eM@g agit comme une colonne vertébrale opérationnelle qui relie personnes, matériels, événements, lieux, clients, fournisseurs et écrans d’affichage. Son point fort est la continuité métier entre les modules : une affaire peut alimenter des réservations, des missions, des tâches, des imports de bons, des commandes et de l’affichage.

### Objectifs métier

- Orchestrer des opérations événementielles multi-ressources.
- Réduire les conflits de réservation, de disponibilité et d’assignation.
- Donner une vision centralisée des affaires, du matériel, du personnel et du stock.
- Outiller le terrain via mobile, QR codes, vues planning et scans logistiques.
- Améliorer la coordination interne via notes, tâches, messagerie, affichage et Sonos.
- Sécuriser les opérations par une traçabilité forte, des contrôles d’accès et des workflows explicites.

### Positionnement technique

eM@g repose sur une architecture monorepo pragmatique : frontend React et backend Express séparés mais versionnés ensemble, base SQLite locale en mode WAL, intégrations externes pilotées côté serveur, déploiement local ou on-premise via PM2, documentation interne dense et stratégie qualité de type stabilisation continue.

Le produit n’est pas construit comme une plateforme cloud native distribuée. Il privilégie la maîtrise opérationnelle, la simplicité d’exploitation et la proximité avec les usages réels. Cela le rend particulièrement adapté à une équipe réduite et à un environnement où la réactivité métier prime sur l’industrialisation à grande échelle.

### Maturité du système

- Maturité fonctionnelle : élevée.
- Maturité documentaire : élevée.
- Maturité sécurité : intermédiaire à élevée, avec historique d’audits et corrections importantes.
- Maturité architecture lourde : intermédiaire, car plusieurs modules restent massifs et couplés.
- Maturité temps réel et offline : intermédiaire basse, encore largement fondée sur polling, cache local et roadmap.

Le système est globalement mature pour son périmètre métier, mais il entre dans une phase où la dette de structure devient le principal risque de ralentissement.

### Forces globales

- Couverture métier remarquable et cohérente pour une seule plateforme.
- Monorepo lisible avec séparation claire apps/api, apps/web, apps/tv-client.
- Documentation technique et fonctionnelle riche.
- Sécurité backend sérieuse : prepared statements, JWT, sessions persistées, rate limiting, validation, chiffrement de secrets ciblés.
- Base SQLite correctement configurée pour un contexte mono-instance ou faible concurrence : WAL, clés étrangères actives, migrations tracées.
- Design System déjà documenté, avec tokens, composants UI et conventions UX.
- Déploiement sécurisé avec rollback, smoke test santé et garde-fous CI.

### Faiblesses globales

- Modules lourds encore trop centralisés, surtout Planning, Personnel, Affaires, Équipements, Display.
- Variabilité documentaire sur certains comptages et quelques points d’implémentation.
- Plusieurs concepts métier dupliqués ou parallèles : localisation, affaires virtuelles, identités personnel versus conducteurs, stockage offline partiel.
- Absence de WebSocket et dépendance encore forte au polling pour les usages quasi temps réel.
- PWA existante mais mode offline-first non stabilisé ; service worker de production désamorcé dans l’état observable.
- Couverture accessibilité et cohérence responsive encore incomplètes à l’échelle de tous les écrans.

## 2. Architecture générale

### Monorepo

Le dépôt est organisé autour de trois applications principales.

- apps/api : backend Express, logique métier, routes REST, middlewares, SQLite, migrations, cache, intégrations Google, Sonos, vidéo, mailing.
- apps/web : frontend React principal, navigation desktop et mobile, Design System, hooks métier, client API, IndexedDB, vues d’administration et d’exploitation.
- apps/tv-client : client TV autonome et gelé, destiné aux écrans d’affichage dynamique.

Le dépôt contient également un répertoire public partagé pour les assets statiques, des scripts d’exploitation et de maintenance, des tests, une documentation extensive et des workflows GitHub Actions.

### Organisation des dossiers

- apps/api concentre les routes par domaine plutôt que par couche fine. Le découpage est fonctionnel : auth, admin, véhicules, affaires, personnel, planning, équipements, commandes, stock, annuaire, display, Sonos, vidéo, mailing, messagerie, pièces jointes, profil, Google, TOTP.
- apps/web suit une organisation orientée composants, hooks, contextes, utilitaires d’API, router custom et thèmes CSS.
- apps/tv-client reste volontairement minimal : un index HTML, un script principal, une feuille de styles et un manifest.
- public stocke les médias partagés, plans de dépôts, manifest PWA, scripts SW, pièces jointes, avatars, uploads de messagerie, logos, photos et ressources d’affichage.

### Flux de données

Le flux nominal est le suivant :

- Le frontend web dialogue avec le backend en HTTP via un client API centralisé.
- Le backend applique auth, validation, permissions, rate limiting, cache et logique métier.
- Le backend persiste dans SQLite via better-sqlite3 et des requêtes préparées.
- Les intégrations externes sont pilotées côté serveur : Google Calendar, Sonos, SMTP, MediaMTX, NVR vidéo.
- Le frontend conserve un sous-ensemble des données dans IndexedDB pour fluidifier l’expérience et supporter certaines reprises d’état.

### Communication frontend ↔ backend

Le frontend utilise un client API modulaire, avec gestion de l’authentification par cookie JWT, tentative de récupération de session, refresh silencieux et propagation d’un statut réseau vers l’interface. Les données sont consommées module par module, mais plusieurs hooks regroupent les fetchs pour réduire les allers-retours et maintenir une cohérence inter-écrans.

Le backend répond majoritairement en JSON, avec un pattern homogène autour de charges utiles de type succès, données, message et erreur. Les mutations déclenchent des invalidations de cache côté serveur et des rafraîchissements ciblés côté client.

### Navigation desktop/mobile

La navigation desktop est pilotée par des paramètres d’URL de type module et vue, avec persistance partielle du dernier module utilisé. Le système évite de dépendre exclusivement au stockage local en faisant de l’URL la source de vérité principale.

La navigation mobile est distincte. Elle repose sur un routeur maison basé sur le hash, avec des écrans dédiés pour les usages terrain. Cette séparation permet de préserver des QR codes, des accès rapides et des comportements spécifiques aux terminaux mobiles, au prix d’une duplication partielle de logique de navigation.

### Architecture TV-client

Le client TV est une application web dédiée à l’affichage dynamique. Il lit un token TV depuis l’URL ou le stockage local, appelle les endpoints display au moyen d’un en-tête spécifique et maintient un cache local minimal pour survivre à une coupure réseau temporaire. Il consomme un état public enrichi contenant configuration visuelle, événements, règles de couleur, messages de bienvenue, statut Sonos, médias et signaux d’alarme.

Le TV-client n’est pas une sous-vue du frontend React principal. C’est une application séparée, volontairement simple et plus stable, mais donc exposée au risque de dérive contractuelle si l’API display évolue sans garde-fou de version.

### Architecture Google Calendar sync

L’intégration Google suit un flux OAuth2 Authorization Code piloté côté serveur.

- Le frontend déclenche l’authentification via le backend.
- Le backend gère le callback, la validation d’état anti-CSRF et l’échange de tokens.
- Les refresh tokens sont conservés côté serveur et chiffrés.
- Le frontend interroge l’état, les calendriers et les événements via le backend.
- Une synchronisation permet de tirer des événements Google vers les réservations eM@g.

L’intégration sert à la fois la lecture d’agenda, la création de liens affaire ou réservation et le rapprochement avec le planning. L’approche choisie limite l’exposition des secrets côté client.

### Architecture Sonos

L’intégration Sonos est locale au réseau du site. Le backend communique directement avec l’écosystème Sonos via UPnP et SOAP à l’aide de la bibliothèque sonos. L’adresse de l’enceinte ou du coordinateur de groupe est configurée dans la base. Le backend expose des endpoints de lecture et de contrôle. Le frontend admin fournit une interface de pilotage, tandis que le TV-client affiche un widget now playing.

Le choix est efficace et léger, mais dépend d’une topologie réseau stable et d’une configuration IP maîtrisée.

## 3. Stack technique

### Backend

- Node.js 22 en cible d’exécution.
- Express 4.18 pour l’API REST.
- better-sqlite3 pour la persistance synchrone.
- jsonwebtoken pour l’authentification JWT.
- bcrypt pour les mots de passe.
- middlewares internes pour auth, autorisation, sanitation, upload, gestion d’erreur.
- googleapis pour Google Calendar.
- sonos pour le contrôle LAN.
- nodemailer pour le mailing.
- helmet, cors, compression, express-rate-limit, multer, xss, zod.

### Frontend

- React 18.3.
- Vite 5 pour build et développement.
- Architecture par composants, hooks, contextes et client API modulaire.
- Design System documenté avec tokens, composants UI et conventions UX.
- react-router-dom présent dans les dépendances, mais la navigation observable repose aussi sur des mécanismes maison par paramètres d’URL et hash mobile.
- react-virtuoso, lucide-react, date-fns, pdfjs-dist, jspdf, html2canvas, qrcode.react, react-leaflet.

### Base de données

- SQLite en mode WAL.
- Clés étrangères activées.
- busy timeout configuré.
- checkpoint WAL configuré et checkpoint complet à la fermeture.
- Schéma métier large avec environ 86 tables opérationnelles selon l’environnement.
- 50 index ou plus selon les rapports et la phase de migration observée.
- Migrations hybrides : fichiers SQL formels plus adaptations dynamiques au démarrage.

### CI/CD

- GitHub Actions pour lint, format, tests backend, tests frontend, build, checks production et notifications.
- Husky et lint-staged pour l’hygiène locale.
- Déploiement réel géré localement par script et PM2, pas par pipeline de livraison automatisée complète.

### Sécurité

- JWT stocké en cookie httpOnly, avec SameSite et Secure en production.
- Sessions actives persistées en base.
- Auth refresh silencieux.
- Rate limiting par classe de route.
- Validation d’entrées via Zod sur les flux critiques documentés.
- Sanitisation XSS et sanitation des noms et chemins de fichiers.
- Chiffrement AES-256-GCM pour des secrets ciblés comme tokens Google ou identifiants RTSP.
- Permissions granulaires par middleware RBAC.

### Performance

- Cache LRU et TTL côté backend pour auth, listes, stats, config et iCal.
- Requêtes batch pour éviter certains N+1.
- Lazy loading React et fragmentation du bundle initial.
- IndexedDB pour réduire les rechargements à froid de certaines données.
- Plan de montée en qualité axé sur pagination cursor-based, WebSocket et refactor des modules lourds.

## 4. Modules fonctionnels

### 4.1 Véhicules

- Rôle : gérer le parc roulant, son état, ses métadonnées, ses photos, ses contrôles et son exploitation.
- Flux métier : création et maintenance du véhicule, consultation de disponibilité, rattachement aux réservations, suivi kilométrique, consultation des historiques.
- Composants clés : vues calendrier, tableaux de flotte, formulaires véhicule, fiches détail, dialogue maintenance, bannière Google Calendar liée aux réservations.
- Endpoints API : GET, POST, PUT, DELETE sur /api/vehicles ; endpoints associés de consultation dans le périmètre réservations et maintenance.
- Tables DB : vehicles, reservations, maintenances, trip_details, trip_pauses, locations, garages.
- Interactions : affaires, planning, Google Calendar, conducteurs, maintenances, mobile QR.
- Risques : structure véhicule historiquement enrichie et hétérogène ; dépendance à des champs texte pour certains liens ; arbitrage encore imparfait entre véhicules, conducteurs et personnel.

### 4.2 Réservations

- Rôle : réserver les véhicules sur une période avec gestion des conflits, des demi-journées et des liaisons métier.
- Flux métier : création ou demande de réservation, vérification de chevauchement, lien possible avec affaire, client, trajet et événements Google, mise à jour de statut, clôture ou annulation.
- Composants clés : calendrier semaine, mois, année et planning ; formulaires de réservation ; vues de conflits ; accès mobile dédiés.
- Endpoints API : GET, POST, PUT, DELETE sur /api/reservations ; endpoint de synchronisation Google vers réservations.
- Tables DB : reservations, reservation_requests, trip_details, trip_pauses.
- Interactions : véhicules, affaires, Google Calendar, planning, mobile.
- Risques : intégrité de liaisons affaire partiellement textuelle ; temps réel fondé sur rafraîchissements ; complexité des trajets et jonctions non entièrement normalisée.

### 4.3 Maintenances

- Rôle : suivre l’entretien, les pannes, les réparations et les contrôles techniques du parc véhicule.
- Flux métier : signalement, planification, exécution, clôture, suivi du coût, du garage et du kilométrage.
- Composants clés : écrans de maintenance, tableau de contrôles, édition des contrôles périodiques, formulaires de signalement rapide.
- Endpoints API : GET, POST, PUT, DELETE sur /api/maintenances ; flux complémentaires de contrôles périodiques selon la documentation historique.
- Tables DB : maintenances, garages, et structures de contrôle déclarées selon les états documentaires.
- Interactions : véhicules, alertes email, dashboards, mobile.
- Risques : recouvrement documentaire entre maintenance et contrôles périodiques ; qualité de modèle variable selon les évolutions successives ; risque d’enregistrements partiellement orphelins si validation métier insuffisante.

### 4.4 Planning

- Rôle : orchestrer événements, tâches, assignations, cycles d’affaires, récurrences, exports et alimenter l’affichage opérationnel.
- Flux métier : création d’événements et de tâches, affectation à des personnes, regroupement par sections métier, gestion des tâches récurrentes, rollover quotidien, export PDF, diffusion iCal, articulation avec affaires et BL.
- Composants clés : TaskPlanningPanel, édition de tâche, planning affaires, export PDF, intégration display, vues journalières et hebdomadaires.
- Endpoints API : /api/planning/display-events, /api/planning/tasks, /api/planning/recurring-tasks, /api/planning/planning-assignments, /api/planning/planning-affaires, /api/planning/stats, /api/planning/ical-calendars, /api/planning/ical-events.
- Tables DB : dynamic_display_events, task_assignments, planning_hidden_affaires, planning_affaire_status, planning_event_status, planning_assignments, bl_imports, bp_items.
- Interactions : affaires, personnel, display TV, PDF, iCal, BL, commandes, Google Calendar.
- Risques : module très dense et central ; forte dette de structure ; table task_assignments volumineuse ; mélange entre tâches métier, affichage et statuts d’affaires.

### 4.5 Personnel

- Rôle : gérer les personnes, compétences, postes, disponibilités, missions, affectations et congés.
- Flux métier : création personne, qualification par compétences, saisie des disponibilités, création de missions, affectation des personnes, suivi de statut mission, gestion de congés et soldes.
- Composants clés : PersonnelPanel, vues planning personnel, gestion des compétences, vues missions, workflows congés.
- Endpoints API : /api/persons, /api/skills, /api/positions, /api/availabilities, /api/missions, /api/assignments, /api/personnel/planning, /api/leaves selon le sous-module congés.
- Tables DB : persons, skills, person_skills ou person_competences selon l’état documentaire, positions, availabilities, missions, mission_assignments, leave_balances, leave_requests, leave_request_history, leave_votes, public_holidays.
- Interactions : affaires, planning, réservations, équipements, congés, mobile, actions personnelles à auth éphémère.
- Risques : coexistence historique de concepts conducteurs et personnel ; validations de conflits perfectibles ; calcul ou contrôle de soldes pas entièrement centralisé côté backend dans tous les cas documentés.

### 4.6 Affaires

- Rôle : structurer les dossiers métiers qui relient client, dates, opérations, réservations, personnel, bons, commandes et historiques.
- Flux métier : création affaire, enrichissement depuis les réservations, ajout de liens parent-enfant, rattachement de BL, comptage de ressources, inactivation par soft delete.
- Composants clés : AffairesPanel, détail affaire, liens inter-affaires, intégration aux tâches et aux imports.
- Endpoints API : /api/affaires, /api/affaires/:id, /api/affaires/personnel-counts, endpoints de liens affaire.
- Tables DB : affaires, affaire_links, références textuelles depuis reservations, missions, orders, bl_imports.
- Interactions : planning, commandes, personnel, équipements, Google Calendar, pièces jointes, BL/BP.
- Risques : enrichissement automatique à partir des réservations sans garantie d’une ligne affaire explicite ; intégrité référentielle partiellement applicative ; suppression logique plutôt que suppression structurelle.

### 4.7 Équipements

- Rôle : gérer les équipements individualisés, leur état, leur localisation, leurs assignations et leur SAV.
- Flux métier : création d’un équipement ou import, génération d’UID, affectation temporaire, suivi de localisation, ouverture d’un ticket SAV, résolution, conservation d’historique.
- Composants clés : EquipmentPanel, vues d’assignation, listes matérielles, comparateurs SAV, scan QR et modules de localisation.
- Endpoints API : /api/equipment, /api/equipment-categories, /api/equipment-assignments, /api/sav-tickets, /api/equipment-lists.
- Tables DB : equipment, equipment_categories, equipment_assignments, sav_tickets, equipment_serials selon les états documentaires, structures de listes d’équipement.
- Interactions : catalogue, stock, affaires, personnel, inventaire, SAV, mobile.
- Risques : coexistence de plusieurs concepts de localisation ; couplage historique entre matériel réel et catalogue ; gestion d’assignation et de disponibilité encore sensible aux conflits de règles.

### 4.8 Catalogue

- Rôle : gérer la référence descriptive du matériel et des éléments logistiques avant leur individualisation opérationnelle.
- Flux métier : création d’articles de catalogue, hiérarchisation famille-sous-famille-catégorie, gestion flight-cases, modèles de camions, import de données, rapprochement avec BL et chargement 3D.
- Composants clés : catalogues d’équipements, gestion des catégories, flight-cases, modèles de camions, deep linking de chargement.
- Endpoints API : /api/catalog, /api/supplier-catalog et sous-ensembles associés ; endpoints fournisseurs pour catalogue externe.
- Tables DB : equipment_catalog, flightcases, truck_models, equipment_to_vehicle, bp_items, supplier_articles, catalog_imports.
- Interactions : équipements, stock, commandes, imports fournisseurs, chargement 3D.
- Risques : frontière parfois floue entre article de référence, article stock, équipement individualisé et item de BP ; qualité de matching dépendante des imports et du nettoyage des données.

### 4.9 Stock

- Rôle : suivre les consommables, articles vendables et mouvements quantitatifs.
- Flux métier : création article, fixation des seuils, mouvement entrant ou sortant, ajustement, retour, alerte bas stock, import par lot, statistiques.
- Composants clés : StockPanel, historique des mouvements, alertes, imports CSV, tableaux de catégorie.
- Endpoints API : /api/stock/categories, /api/stock/items, /api/stock/movements, /api/stock/imports, /api/stock/stats.
- Tables DB : stock_categories, stock_items, stock_movements.
- Interactions : commandes fournisseurs, BP, SAV, inventaire, affaires.
- Risques : cohérence des quantités dépendante de la rigueur transactionnelle ; référentiel d’articles potentiellement recoupé avec catalogue et fournisseurs ; nécessité de sécuriser les cas limites de sortie de stock.

### 4.10 Commandes fournisseurs

- Rôle : gérer les achats, devis, demandes de matériel et documents fournisseurs.
- Flux métier : demande de matériel, revue, approbation, transformation en devis ou commande, suivi de statut, réception totale ou partielle, rattachement à une affaire.
- Composants clés : OrdersPanel, gestion de fournisseurs, lignes de commande, documents fournisseurs, vues statistiques.
- Endpoints API : /api/suppliers, /api/orders, /api/orders/:id/items, /api/quotes, /api/material-requests, /api/supplier-documents.
- Tables DB : suppliers, orders, order_items, quotes, quote_items, material_requests selon les états documentaires, supplier_documents ou équivalent documentaire.
- Interactions : annuaire fournisseurs, stock, affaires, catalogue fournisseur, PDF commande.
- Risques : dépendance aux références auto et aux transitions d’état ; couplage partiel entre demandes, devis, commandes et stock ; hétérogénéité possible entre doc et implémentation sur la réception partielle.

### 4.11 Annuaire

- Rôle : fournir une base de référence unifiée pour clients, fournisseurs, prestataires et contacts.
- Flux métier : création et mise à jour d’entités, validation SIRET et TVA, normalisation téléphone, gestion de contacts multiples, import CSV, recherche transverse.
- Composants clés : AnnuairePanel, formulaires enrichis, FTS, lookups métier, imports, liens vers affaires et fournisseurs.
- Endpoints API : /api/annuaire/clients, /api/annuaire/suppliers, /api/annuaire/prestataires, /api/annuaire/contacts, /api/annuaire/lookups, /api/annuaire/search, /api/annuaire/import.
- Tables DB : clients, suppliers, prestataires, annuaire_contacts, annuaire_legal_structures, annuaire_service_types, annuaire_activity_sectors, annuaire_contact_categories.
- Interactions : affaires, commandes, stock, mailing, communication.
- Risques : duplication assumée entre entités enrichies ; règles de code libre métier à surveiller ; validation documentaire forte mais pas forcément synchronisée avec des référentiels externes temps réel.

### 4.12 Communication

- Rôle : centraliser notes, événements, tâches d’affichage et coordination interne visible sur les écrans ou dans l’app.
- Flux métier : création d’un événement ou d’une note, définition de visibilité, intégration au planning, diffusion sur dashboard, archivage ou fermeture.
- Composants clés : CommunicationPanel, flux d’événements d’entreprise, sections tâches, intégration dashboard.
- Endpoints API : /api/communication/* dans les versions historiques ; périmètre courant fortement porté par /api/planning/display-events et /api/display/messages selon la nature de l’information.
- Tables DB : dynamic_display_events, communication_notes selon les états documentaires, display_messages, display_welcome_messages, display_color_rules.
- Interactions : planning, display, affaires, Sonos, TV-client.
- Risques : périmètre réparti entre planning et display ; risque de confusion entre événement métier, événement TV et message d’affichage.

### 4.13 Messagerie interne

- Rôle : offrir un canal interne de conversation individuelle ou de groupe avec pièces jointes.
- Flux métier : création ou récupération d’une conversation, envoi de message, envoi de pièce jointe, marquage comme lu, consultation du nombre de non lus.
- Composants clés : MessagingPanel, badge de notifications, formulaires upload, polling de lecture.
- Endpoints API : /api/messaging/conversations, /api/messaging/conversations/:id/messages, /api/messaging/conversations/:id/messages/file, /api/messaging/unread-count.
- Tables DB : conversations, conversation_participants, messages, message_attachments.
- Interactions : auth utilisateur, profils, mobile, notifications UI.
- Risques : absence de vrai temps réel bidirectionnel ; charge perçue sur polling ; pas de chiffrement bout en bout.

### 4.14 Mailing

- Rôle : gérer des modèles email, l’envoi groupé et l’historique de campagnes.
- Flux métier : création de template, choix des variables, sélection de destinataires, envoi SMTP, journalisation du résultat.
- Composants clés : MailingPanel, éditeur de template, historique d’envoi, intégration annuaire.
- Endpoints API : /api/mailing/templates, /api/mailing/send, endpoints d’historique et de configuration email.
- Tables DB : email_config, mail_templates, mail_history.
- Interactions : annuaire, auth admin, notifications, SMTP.
- Risques : sensibilité forte du contenu HTML ; dépendance à la qualité des configurations SMTP et de leur protection ; risque d’hétérogénéité UX entre rendu email et rendu applicatif.

### 4.15 Vidéo

- Rôle : exposer un module de vidéosurveillance et de contrôle caméra dans eM@g.
- Flux métier : configuration d’une caméra, stockage chiffré des secrets RTSP, ouverture de flux WebRTC via proxy, snapshot, PTZ, recherche d’enregistrements NVR, journalisation des accès.
- Composants clés : vues vidéo, flux détachés, intégration MediaMTX, recherche NVR.
- Endpoints API : /api/video/cameras, /api/video/cameras/:id/stream, /api/video/cameras/:id/snapshot, /api/video/cameras/:id/ptz, /api/video/recordings/search, /api/video/access-logs, endpoints TV vidéo dédiés.
- Tables DB : video_cameras, video_access_logs et structures associées selon l’état documentaire.
- Interactions : TV-token pour certains flux dédiés, MediaMTX, NVR Dahua, auth admin.
- Risques : module très dépendant de l’environnement réseau et des équipements externes ; supervision et tests de flux indispensables ; charge possible sur proxy vidéo.

### 4.16 Display / TV-client

- Rôle : piloter l’affichage dynamique, les écrans, les playlists, les médias, les messages, l’apparence et certains signaux d’exploitation.
- Flux métier : configuration écran, création playlist, upload média, création message, publication d’événements du jour, exposition d’un état agrégé au TV-client, test d’alarme.
- Composants clés : DisplayDashboard, SonosTab, gestion des écrans, playlists, templates, couleurs, bienvenue, widget TV.
- Endpoints API : /api/display/screens, /api/display/playlists, /api/display/media/upload, /api/display/messages, /api/display/alarm/test, /api/display/current-affaires, /api/display/tv-public-state.
- Tables DB : display_screens, display_playlists, display_playlist_items, display_templates, display_messages, display_media, display_logs, display_config, display_welcome_messages, display_color_rules, display_location_icon_rules, display_completed_events.
- Interactions : planning, Sonos, affaires, TV-token, médias statiques.
- Risques : API display large et historiquement dense ; client TV gelé ; responsabilité mêlée entre information, habillage et signal sonore.

### 4.17 Mobile

- Rôle : fournir une expérience terrain dédiée autour de la consultation rapide, du planning, des réservations, du matériel, de la messagerie et de l’administration légère.
- Flux métier : détection mobile, navigation hash, accès aux écrans spécialisés, QR codes, scans, récupération du contexte utilisateur, consultation et saisie rapides.
- Composants clés : MobileApp, MobileHome, MobilePlanning, MobileAffaires, MobileEquipment, MobileInventory, MobileMessaging, MobileDashboardAdmin et autres écrans dédiés.
- Endpoints API : réutilise les endpoints REST du frontend principal.
- Tables DB : réutilise le modèle principal ; IndexedDB apporte un stockage local partiel.
- Interactions : QR codes, manifest PWA, IndexedDB, auth, planning, équipements, messagerie.
- Risques : expérience mobile construite en parallèle du desktop ; offline-first non finalisé ; dépendance au routeur hash maison.

## 5. Base de données

### Schéma global

La base SQLite d’eM@g constitue une base métier transverse, organisée par domaines plutôt que par microservices. Elle couvre l’authentification, la flotte, les réservations, les maintenances, le personnel, les congés, les affaires, les trajets, les équipements, le SAV, le stock, les commandes, l’annuaire, la communication, l’affichage, la messagerie, le mailing, les imports, la vidéo et les tables d’utilité comme l’historique ou le journal des migrations.

### Domaines fonctionnels

- Authentification et sessions.
- Véhicules, réservations et trajets.
- Maintenance et garages.
- Personnel, compétences, positions, missions, disponibilités, congés.
- Affaires et liens d’affaires.
- Équipements, catégories, assignations, SAV, listes.
- Catalogue, flight-cases, modèles de camions, BP items.
- Stock, catégories, mouvements.
- Commandes, devis, fournisseurs, demandes de matériel.
- Annuaire enrichi et lookups métier.
- Communication, planning, BL imports, statuts display.
- Display, playlists, médias, messages, configuration.
- Messagerie et pièces jointes.
- Mailing et configuration email.
- Vidéo, accès et enregistrements selon l’environnement.

### PK, FK, index

Le schéma utilise majoritairement :

- des clés primaires entières auto-incrémentées pour les entités relationnelles classiques ;
- des identifiants texte pour certains domaines comme véhicules, réservations ou éléments de catalogue ;
- des clés étrangères actives via PRAGMA foreign_keys = ON ;
- des suppressions en cascade ou en mise à null selon les besoins ;
- des index sur les dates, statuts, références métier, liens d’assignation et champs de recherche.

La couverture d’index est bonne pour un système SQLite de cette taille, même si plusieurs chemins chauds méritent une revue continue sur planning, affaires, personnel, équipements et display.

### Tables critiques

Par criticité métier et charge transverse, les tables les plus sensibles sont :

- users et active_sessions pour l’auth.
- vehicles, reservations et maintenances pour la flotte.
- persons, missions, mission_assignments, availabilities, leave_requests pour le personnel.
- affaires et affaire_links pour la colonne vertébrale métier.
- equipment, equipment_assignments et sav_tickets pour le parc matériel.
- stock_items et stock_movements pour la cohérence quantitative.
- orders et order_items pour les achats.
- dynamic_display_events et task_assignments pour le planning opérationnel.
- display_screens, display_playlists et display_media pour l’affichage.
- conversations et messages pour la messagerie.

### Migrations formelles vs inline

Le système combine deux mécanismes.

- Migrations formelles : fichiers SQL dédiés, tracés par un journal de migration.
- Migrations inline : logique d’évolution au démarrage dans database.js, avec créations conditionnelles, ajouts de colonnes, reconstructions ponctuelles de tables et migrations de données.

Cette approche est pragmatique et a permis de faire évoluer rapidement le produit. Elle augmente toutefois le besoin de discipline documentaire et de tests de bootstrap, car la vérité du schéma n’est pas portée exclusivement par les fichiers SQL.

### Intégrité référentielle

Les forces principales sont :

- activation des clés étrangères ;
- usage fréquent de CASCADE ou SET NULL ;
- contraintes d’unicité sur de nombreux identifiants clés ;
- checks sur plusieurs enums métier.

Les limites connues sont :

- certains liens métier restent textuels pour éviter des dépendances circulaires, en particulier autour des affaires ;
- certains champs historiquement optionnels peuvent admettre des enregistrements orphelins contrôlés par logique applicative ;
- coexistence de structures dupliquées ou successives sur quelques domaines.

### Risques DB

- Divergence entre schéma documenté et schéma effectif si les migrations dynamiques prennent le dessus sans re-documentation.
- Risque d’intégrité faible sur les liens métier non FK, surtout pour affaires et certaines assignations.
- Charge croissante sur des tables larges comme task_assignments.
- Risque de duplication fonctionnelle entre drivers et persons, ou entre plusieurs systèmes de localisation.

### Optimisations possibles

- Poursuivre la rationalisation des liens texte vers des références plus explicites ou des tables de correspondance.
- Réduire la largeur conceptuelle de task_assignments par séparation de responsabilités.
- Établir un playbook de migration purement versionné pour les phases critiques.
- Ajouter des vues ou contrôles de diagnostic d’orphelins métier.
- Revoir les index des modules les plus volumineux à partir de plans de requêtes réels.

## 6. API backend

### Organisation des routes

Le backend est organisé par grands domaines métier. C’est un compromis efficace entre monolithe et microservices. Chaque routeur concentre un sous-système complet : auth, admin, véhicules, personnel, planning, équipements, commandes, stock, annuaire, display, Sonos, vidéo, messagerie, mailing, pièces jointes, profil, Google, TOTP.

Cette organisation rend l’intention métier claire, mais certains fichiers sont devenus très volumineux, notamment planningRoutes, displayRoutes, personnelRoutes, equipmentRoutes et ordersRoutes.

### Middlewares

Le pipeline transverse observable comprend :

- compression ;
- helmet ;
- cors avec allowlist ;
- cookie-parser ;
- sanitation XSS ;
- journalisation ;
- rate limiters spécifiques auth, sensibles et globaux ;
- authenticateToken ;
- middleware d’autorisation par rôle ou permission ;
- validation Zod sur flux ciblés ;
- middleware Multer centralisés selon le contexte d’upload ;
- gestionnaire d’erreur central.

### Patterns API

Les patterns dominants sont :

- REST JSON classique ;
- endpoints segmentés par domaine ;
- réponses cohérentes de type succès ou erreur ;
- filtrage par query string ;
- pagination encore majoritairement offset-based, avec cible cursor-based en roadmap ;
- invalidation de cache après mutation.

### Sécurité API

- Auth par JWT côté cookie.
- Sessions persistées en base.
- Validation des permissions par middleware sur les opérations sensibles.
- Rate limiting différencié.
- Validation et sanitation d’entrées.
- Chiffrement des secrets externes sensibles.
- Token TV dédié pour les écrans.

### Endpoints critiques

Les surfaces les plus critiques pour le fonctionnement global sont :

- auth et refresh ;
- reservations et maintenances ;
- persons, missions et availabilities ;
- affaires et planning-affaires ;
- equipment, assignments et sav-tickets ;
- stock movements ;
- orders et material-requests ;
- annuaire search et imports ;
- display tv-public-state et current-affaires ;
- sonos now-playing et commandes ;
- video stream et recordings search ;
- google auth, status, events et sync.

### Cohérence des payloads

La cohérence générale est bonne. Les réponses sont lisibles et les routes critiques sont documentées. La principale réserve porte sur l’historique du produit : certains domaines ont évolué plus vite que leur documentation, ce qui impose de raisonner avec prudence sur la structure exacte de quelques payloads secondaires.

### Erreurs et validations

Le backend utilise les codes HTTP attendus : 400, 401, 403, 404, 409, 500. Les validations fortes les mieux documentées concernent les imports, l’annuaire, l’auth, les transitions d’état SAV et les contrôles d’accès. Les transitions d’état commandes, missions, congés et SAV sont un élément important de robustesse.

### Performance API

Les leviers principaux sont :

- cache LRU/TTL ;
- requêtes batch ;
- prepared statements ;
- index métier ;
- compression ;
- limitation du polling par cache local ;
- évitement de certains N+1 sur le personnel et les affaires.

Les limites actuelles résident dans l’absence de WebSocket, l’offset pagination historique et la masse de certains routeurs.

## 7. Frontend React

### Architecture des composants

Le frontend React s’appuie sur une structure à plusieurs niveaux.

- App.jsx orchestre auth, thème, données métier, navigation, overlays, vues desktop et vues mobiles.
- Des composants lazy-loadés hébergent les modules lourds.
- Les panneaux métier structurent l’application par domaine : personnel, affaires, stock, commandes, communication, messagerie, mailing, vidéo, dashboard display.
- Le Design System fournit les briques transverses : boutons, champs, modals, drawers, tabs, cartes, tables, layouts, toasts.

### Hooks principaux

Les hooks les plus structurants sont :

- useAppData pour l’agrégation de données métier ;
- useGoogleCalendar et useGoogleSync pour le calendrier ;
- useSilentRefresh pour la session ;
- useMessagingPolling pour les non lus ;
- useSearchParamState pour la navigation URL ;
- useMobileRouter pour le hash mobile ;
- useDraggableModals pour les overlays ;
- useTheme et useVSCodeTheme pour l’habillage ;
- useFeedback et useToast pour les retours utilisateur ;
- useRefreshOnFocus pour les rafraîchissements contrôlés.

### Lazy loading

Le code splitting est largement utilisé pour réduire la charge initiale. Les gros panneaux et plusieurs overlays sont chargés à la demande. Cela améliore la perception de performance sur un périmètre applicatif dense.

### IndexedDB

Le frontend maintient un stockage local pour un ensemble de stores orientés reprise d’état et cache : auth, affaires, équipements, personnes, inventaire, synchronisation Google et autres données à forte fréquence de lecture. IndexedDB n’est pas encore le socle d’un véritable offline-first, mais sert déjà de cache de continuité.

### Navigation desktop/mobile

Le desktop utilise des paramètres d’URL, le mobile un routeur hash dédié. Cette cohabitation est fonctionnelle mais augmente la charge de maintenance. Elle reflète une adaptation progressive du produit à des usages de terrain plutôt qu’une stratégie mobile-first originelle.

### Modals et accessibilité

Le système de modals est structuré autour d’un gestionnaire central de pile et de z-index, d’un root dédié, d’un verrouillage de scroll compté et de conventions explicites pour éviter les doubles portails. La direction prise est saine et améliore à la fois la maintenabilité et l’accessibilité.

### Design System

Le Design System repose sur des tokens CSS, des thèmes light et dark, une hiérarchie de composants atomes, molécules et organismes, et des règles UX documentées. La documentation historique décrit 43 composants de référence ; la surface réelle observable dépasse ce noyau avec des wrappers et composants refactorisés.

### Patterns React

- composants fonctionnels ;
- hooks pour l’état et les effets ;
- Suspense et lazy ;
- contextes pour auth et thèmes ;
- barrières d’erreur ;
- séparation relative entre présentation, orchestration et client API.

### Points de fragilité

- duplication partielle entre desktop et mobile ;
- polling encore fréquent ;
- modules massifs côté panneau ;
- coordination complexe des refreshs et caches ;
- dépendance à plusieurs mécanismes de persistance locale ;
- a11y encore hétérogène selon les écrans.

## 8. Sécurité

### JWT + sessions

Le système combine JWT et persistance de sessions actives. Le token principal est stocké en cookie httpOnly, ce qui réduit l’exposition aux scripts côté client. Une logique de refresh silencieux soutient la reprise de session.

### OAuth2 Google

L’intégration Google est pilotée côté backend avec state anti-CSRF, stockage chiffré des refresh tokens et endpoints dédiés de statut, connexion, calendrier et événements. C’est une intégration plus robuste qu’un flux entièrement porté par le navigateur.

### Uploads

Les uploads sont contrôlés par contexte. Les règles documentées couvrent :

- types MIME autorisés ;
- tailles maximales ;
- séparation des répertoires ;
- sanitation des chemins et des noms ;
- blocage de certains formats comme SVG dans les zones sensibles.

### Rate limiting

- Auth : limite basse et spécifique.
- Endpoints sensibles : seuil intermédiaire.
- API globale : seuil plus large.

La stratégie est appropriée pour un monolithe métier exposé à peu d’utilisateurs simultanés mais à plusieurs surfaces sensibles.

### XSS, CSRF, path traversal

- XSS : bonne posture générale grâce à React, sanitisation serveur, DOMPurify sur les usages HTML ciblés et sanitation des champs.
- CSRF : le système bénéficie du cookie httpOnly et de SameSite, mais un assistant externe doit considérer qu’une revue de couverture CSRF explicite reste pertinente, surtout pour les endpoints mutationnels majeurs.
- Path traversal : des garde-fous sont documentés sur sanitizePath et les uploads. L’historique d’audit montre qu’il faut maintenir une vigilance élevée sur les routes de service de fichiers et les endpoints publics ou TV.

### Permissions RBAC

Le socle d’autorisations distingue au minimum l’admin, des permissions spécialisées et des validations contextuelles. Les suppressions et modifications sensibles sont correctement resserrées dans la plupart des domaines structurants.

### Logs sensibles

Le système cherche à réduire la verbosité en production et à ne pas exposer les secrets. Côté frontend, certains logs sont retirés au build. Côté backend, l’enjeu résiduel est de continuer à limiter la présence d’informations exploitables dans les erreurs et traces d’intégration.

### Risques résiduels

- dépendance à la discipline documentaire pour les surfaces de fichiers et de TV-token ;
- couverture CSRF explicite à confirmer et renforcer si besoin ;
- polling et multi-onglets pouvant créer des fenêtres d’incohérence plus que de compromission ;
- dépendance aux secrets d’environnement et aux clés de chiffrement locales ;
- complexité opérationnelle accrue des intégrations vidéo et Sonos sur réseau local.

### Recommandations

- Ajouter ou formaliser des tests de régression sécurité sur tous les endpoints servant des fichiers.
- Consolider la politique CSRF pour les mutations majeures si elle n’est pas déjà exhaustive côté cookies et headers.
- Uniformiser le traitement des permissions par domaine et l’exposer dans une matrice RBAC explicite.
- Généraliser les tests de démarrage et de migration sur bases réalistes.

## 9. Performance

### Backend

Les gains backend reposent sur SQLite bien configuré, des prepared statements, un cache LRU/TTL, des batch queries et des index ciblés. Les modules lourds ont déjà fait l’objet d’optimisations spécifiques, notamment sur affaires, personnel et listes.

### Frontend

Le frontend utilise lazy loading, caching local, toasts et refreshs pilotés. Les principaux risques restent les re-renders induits par la masse de données, les modules lourds en une seule surface, la duplication mobile et le polling fréquent.

### DB

La base est performante pour le contexte d’exploitation attendu, mais elle nécessite une surveillance sur :

- plans de requêtes des zones planning et affaires ;
- croissance des tables d’événements et de tâches ;
- index de filtrage sur inventaire, stock, annuaire et display ;
- cohérence des schémas quand des migrations dynamiques s’enchaînent.

### CI/CD

Le pipeline tire parti du cache Node et du cache Vite, et il sépare ce qui est bloquant de ce qui est informatif. C’est un bon compromis entre vitesse de retour et discipline. Le déploiement réel, lui, reste volontairement local pour garder la main sur la production.

### Modules lourds

Les modules les plus sensibles en charge et en maintenance sont Planning, Personnel, Affaires, Équipements, Stock et Display. Ils concentrent le plus de règles, de vues, de données et d’intégrations.

## 10. UX / UI

### Cohérence visuelle

Le produit dispose d’un socle de cohérence via son Design System, ses tokens et ses composants communs. La perception globale est celle d’un produit fonctionnel dense, avec une forte priorité donnée à l’usage métier plutôt qu’à la pure simplification visuelle.

### Flows critiques

Les parcours les plus structurants sont :

- réserver un véhicule ;
- créer ou enrichir une affaire ;
- affecter du personnel ;
- localiser ou assigner du matériel ;
- traiter une demande de congé ;
- créer une tâche ou un événement display ;
- émettre une commande fournisseur ;
- opérer via mobile ou TV-client.

Ces flows sont globalement riches et outillés, mais parfois surchargés de logique métier et de transitions implicites.

### Responsive

Le responsive est réel mais pas totalement unifié. Le mobile n’est pas simplement la réduction du desktop. Il suit une logique d’écrans dédiés. Cette décision est défendable métier, mais coûteuse en maintenance.

### Feedback utilisateur

Toasts, badges, statuts, sections, messages et overlays fournissent un feedback présent. L’interface est orientée action. Le risque principal n’est pas l’absence de feedback, mais sa densité variable selon les modules.

### Alignements

Les alignements les plus réussis sont :

- cohérence entre planning, display et tâches ;
- intégration entre affaires, commandes et réservations ;
- continuité entre équipements, localisation et inventaire.

Les alignements à consolider sont :

- affaires virtuelles versus affaires explicites ;
- localisation catalogue, inventaire et assignation ;
- double logique mobile versus desktop.

### Points de friction

- volume fonctionnel très important dans une seule application ;
- écrans lourds avec forte charge cognitive ;
- vocabulaire et transitions qui exigent une bonne acculturation métier ;
- délais de propagation entre certains modules à cause du polling et des caches.

## 11. Accessibilité

### État actuel

L’accessibilité progresse grâce au Design System, aux modals structurés, à des attributs ARIA sur plusieurs composants et à l’introduction d’outils de lint dédiés. Le niveau global reste toutefois hétérogène et encore éloigné d’une conformité homogène sur l’ensemble du périmètre.

### Problèmes connus

- couverture ARIA inégale selon les anciens modules ;
- navigation clavier à valider sur certaines vues très denses ;
- contraste et hiérarchie visuelle à vérifier dans tous les thèmes ;
- risques sur focus management dans des cascades modal plus drawer ;
- complexité des écrans planning et tables lourdes pour lecteurs d’écran.

### Règles WCAG 2.1 AA concernées

- perception du contraste ;
- navigation clavier ;
- gestion du focus ;
- alternatives textuelles ;
- structure des formulaires ;
- feedback d’erreurs ;
- robustesse des composants interactifs.

### Corrections nécessaires

- généraliser les audits clavier et lecteurs d’écran sur les modules critiques ;
- harmoniser les labels, descriptions et annonces d’erreur ;
- standardiser les patterns d’accessibilité dans le Design System et faire converger les anciens écrans ;
- vérifier systématiquement les nouveaux overlays, tableaux et composants de scan mobile.

### Priorisation

- Priorité haute : auth, modals critiques, planning, personnel, formulaires d’édition, mobile terrain.
- Priorité moyenne : stock, commandes, annuaire, mailing.
- Priorité continue : display admin, vidéo, écrans secondaires.

## 12. CI/CD & Gouvernance

### Branches

- main : branche de production protégée.
- dev : branche d’intégration principale.
- branches de travail : feature, bugfix, hotfix selon conventions.

### PR

Les pull requests vers main bénéficient d’un workflow de protection additionnel. Le dépôt recommande aussi un label safe-to-merge, utilisé comme contrôle informatif plutôt que bloquant.

### Tests

Le socle qualité observable combine :

- tests backend natifs Node ;
- tests frontend Vitest ;
- smoke boot du backend ;
- contrôles de syntaxe ;
- scripts de cohérence documentaire.

### Lint

- ESLint sur web et API.
- Prettier en check strict.
- stylelint sur le web comme mesure informative de dette UI.

### Versioning

Le versioning applicatif est encore majoritairement piloté par les packages, la roadmap et la documentation. La cible structurante est eM@g 3.0.0, pensée comme un jalon d’architecture autant que de fonctionnalités.

### Changelogs

Le dépôt possède des changelogs techniques et documentaires dédiés, ainsi qu’un changelog global. Cela renforce la traçabilité des évolutions inter-domaines.

### Workflows GitHub

- CI : lint, format, tests backend, tests frontend, build, contrôles non bloquants docs et dette UI.
- Protection production : absence de DB dans le diff, détection de secrets potentiels, rappel du label safe-to-merge.
- Notifications : restreintes aux branches critiques pour éviter le bruit opérationnel.

### Processus de release

Le déploiement de production est localement orchestré via un script sécurisé : sauvegarde du dist existant, build, vérification, redémarrage PM2, smoke test santé, rollback si nécessaire. Ce modèle privilégie la sécurité opérationnelle sur site à une CD entièrement distante.

## 13. Synthèse des risques

### Techniques

- Taille et densité de certains routeurs et panneaux.
- Schéma hybride entre migrations SQL et migrations dynamiques.
- Concepts métier parallèles sur localisation, affaires implicites et identités personnel.
- Couche mobile distincte du desktop.

### Sécurité

- Maintenir la rigueur sur toutes les routes de fichiers et de médias.
- Vérifier en continu la couverture CSRF et RBAC.
- Gérer correctement les secrets d’intégration locale.
- Éviter la réintroduction de vulnérabilités déjà traitées historiquement.

### Performance

- Tables et vues lourdes du planning et du display.
- Polling récurrent au lieu de push événementiel.
- Offset pagination sur grands volumes.
- Modules de streaming et d’affichage sensibles à la charge et au réseau.

### UX

- Charge cognitive élevée sur les modules riches.
- Cohérence responsive incomplète.
- Densité de formulaires et de workflows métier.
- Retards de rafraîchissement perceptibles sur certains cas collaboratifs.

### Organisationnels

- Dépendance forte à une bonne culture documentaire.
- Complexité de montée en version 3.0.0 si le périmètre n’est pas séquencé.
- Risque de dispersion si trop de refactors sont ouverts en parallèle.

## 14. Axes de travail recommandés

### Court terme

- Stabiliser et alléger les modules Planning, Affaires, Personnel, Équipements.
- Formaliser une matrice RBAC et une revue sécurité de régression sur fichiers et médias.
- Renforcer les tests de bootstrap DB, migrations et payloads critiques.
- Clarifier documentairement les zones de contradiction connues : nombre de tables, affaires implicites, offline, alarmes, pagination.

### Moyen terme

- Introduire l’API v2 de manière pilotée et contractuelle.
- Déployer une pagination cursor-based sur les listes volumineuses.
- Séparer davantage les responsabilités de planning, display et communication.
- Unifier les concepts de localisation et de rattachement d’équipements.
- Poursuivre la convergence du Design System et des patterns d’accessibilité.

### Long terme

- Ajouter du temps réel via WebSocket ou un mécanisme événementiel maîtrisé.
- Passer à une stratégie offline-first ciblée et robuste pour le terrain.
- Préparer l’i18n, la normalisation des textes et la gouvernance des contrats d’API.
- Réduire la dépendance aux routeurs et panneaux géants au profit de services et sous-modules plus fins.

### Priorisation stratégique

1. Fiabilité structurelle des modules lourds.
2. Sécurité et intégrité de données.
3. Performance et pagination.
4. Convergence UX, a11y et Design System.
5. Temps réel, offline-first et i18n.

## 15. Roadmap eM@g 3.0.0

### Vision

eM@g 3.0.0 doit être une version de fiabilité durable, pas seulement une addition de fonctionnalités. L’objectif est de transformer un produit fonctionnellement riche en plateforme plus contractuelle, plus prédictible, plus accessible et plus simple à faire évoluer.

### API v2

La roadmap prévoit une API v2 versionnée, documentée, rétro-compatible par étapes et centrée sur des contrats stabilisés. C’est le prérequis principal pour diminuer le couplage historique des consommateurs internes.

### WebSocket

Le temps réel est une cible explicite. Il doit servir d’abord les flux qui souffrent du polling : notifications, collaboration, statuts display, actualisation de tâches et potentiellement certains volets vidéo ou planning.

### Refactors majeurs

Les refactors prioritaires concernent :

- Planning.
- Personnel.
- Affaires.
- Équipements.
- Stock.
- Display.

Le but n’est pas cosmétique. Il s’agit de réduire la taille des unités, clarifier les responsabilités, mieux tester et rendre les évolutions plus sûres.

### PWA offline-first

La cible 3.0.0 inclut une vraie stratégie offline-first, avec service worker maîtrisé, files de synchronisation, reprise contrôlée des mutations et résolution de conflits adaptée au terrain. L’état actuel prépare ce mouvement sans l’avoir encore livré.

### i18n

L’internationalisation est identifiée comme chantier futur. Elle suppose de sortir les textes d’interface, d’unifier les messages et de contrôler davantage les conventions de rendu.

### DS complet

Le Design System doit devenir la seule source de vérité UI/UX/a11y pour l’ensemble des modules, y compris les écrans anciens et les variantes mobiles.

### Optimisation DB

Les axes attendus sont :

- revue des index et des requêtes critiques ;
- réduction des incohérences structurelles ;
- hygiène de migrations ;
- robustesse des sauvegardes et des contrôles d’invariants.

### Modules à réécrire ou à resegmenter

Les candidats principaux sont Planning, Personnel, Affaires, Équipements, Stock et Display. Le réécriture totale n’est pas toujours nécessaire ; une re-segmentation méthodique peut suffire sur certaines zones.

### Jalons

- Jalon 1 : socle qualité et stabilisation critique.
- Jalon 2 : API v2 et performance de base.
- Jalon 3 : temps réel et convergence Design System.
- Jalon 4 : mobile-first avancé, PWA et i18n préparatoire.
- Jalon 5 : consolidation finale et préparation release 3.0.0.

### Risques

- Sur-périmètre si trop de chantiers sont menés simultanément.
- Régressions dans les modules lourds sans non-régression renforcée.
- Complexité accrue si le temps réel est introduit sans contrat strict.
- Difficulté à faire converger mobile, desktop et TV sans gouvernance UI forte.

### Livrables

- API v2 documentée et gouvernée.
- Modules critiques refactorés avec critères de sortie explicites.
- Design System consolidé et imposé.
- Pipeline qualité et stabilisation continue renforcé.
- Capacités PWA offline-first ciblées.
- Préparation i18n opérationnelle.
- Observabilité et qualité produit mieux pilotées.

## Conclusion opérationnelle

eM@g est un système métier dense, ambitieux et déjà largement structuré. Sa force n’est pas seulement l’étendue fonctionnelle, mais l’intégration entre des domaines souvent traités dans des outils séparés. Sa phase actuelle n’est plus celle de la découverte produit ; c’est celle de la consolidation architecturale. Un assistant externe doit donc raisonner sur eM@g comme sur un monolithe métier documenté, robuste sur ses fondamentaux, mais engagé dans une transition vers plus de contrat, plus de découplage, plus de temps réel et plus de gouvernance technique.