# Fonctionnalité : Détails des Trajets pour les Tournées

## Vue d'ensemble

Cette fonctionnalité permet de gérer les détails logistiques de chaque événement lié dans une tournée, incluant :
- 🚗 Trajets ALLER et RETOUR avec lieux de départ et d'arrivée
- ⏱️ Dates et heures de départ/arrivée
- 👤 Changements de conducteur entre événements
- ⏸️ Gestion des pauses pendant les trajets
- 🗺️ Calcul automatique de la durée via Google Maps
- 🔗 Jonction entre événements consécutifs

## Structure de la base de données

### Table `trip_details`
Stocke les informations de trajet pour chaque événement d'une tournée.

**Colonnes principales :**
- `reservation_id` : ID de la réservation parent
- `event_id` : ID de l'événement Google lié
- `event_order` : Ordre de l'événement dans la tournée
- `driver_name` : Conducteur pour ce trajet

**Trajet ALLER :**
- `departure_location` : Lieu de départ
- `departure_date` : Date de départ
- `departure_time` : Heure de départ
- `arrival_location` : Lieu d'arrivée
- `arrival_date` : Date d'arrivée
- `arrival_time` : Heure d'arrivée
- `outbound_duration` : Durée en minutes (calculée par Google Maps)

**Trajet RETOUR :**
- `return_departure_location`
- `return_departure_date`
- `return_departure_time`
- `return_arrival_location`
- `return_arrival_date`
- `return_arrival_time`
- `return_duration` : Durée en minutes

**Jonction :**
- `has_junction_with_next` : Boolean (enchaînement avec l'événement suivant)
- `junction_location` : Lieu de la jonction

### Table `trip_pauses`
Stocke les pauses effectuées pendant les trajets.

**Colonnes :**
- `trip_detail_id` : Référence au détail de trajet
- `pause_type` : 'outbound' ou 'return'
- `location` : Lieu de la pause
- `start_time` : Heure de début de la pause
- `duration` : Durée en minutes
- `notes` : Notes optionnelles

## API Endpoints

### GET `/api/trip-details/:reservationId`
Récupère tous les détails de trajet pour une réservation, incluant les pauses.

**Authentification :** Requise (Bearer token)

**Réponse :**
```json
[
  {
    "id": 1,
    "reservation_id": 123,
    "event_id": "google-event-id",
    "event_order": 1,
    "driver_name": "Ben",
    "departure_location": "Paris",
    "departure_date": "2024-03-15",
    "departure_time": "08:00",
    "arrival_location": "Lyon",
    "arrival_date": "2024-03-15",
    "arrival_time": "12:30",
    "outbound_duration": 270,
    "has_junction_with_next": true,
    "junction_location": "Lyon Centre",
    "pauses": [
      {
        "id": 1,
        "pause_type": "outbound",
        "location": "Aire de Repos A6",
        "start_time": "10:00",
        "duration": 15,
        "notes": "Pause café"
      }
    ]
  }
]
```

### POST `/api/trip-details`
Crée un nouveau détail de trajet avec ses pauses.

**Body :**
```json
{
  "reservationId": 123,
  "eventId": "google-event-id",
  "eventOrder": 1,
  "driverName": "Ben",
  "departureLocation": "Paris",
  "departureDate": "2024-03-15",
  "departureTime": "08:00",
  "arrivalLocation": "Lyon",
  "arrivalDate": "2024-03-15",
  "arrivalTime": "12:30",
  "outboundDuration": 270,
  "returnDepartureLocation": "Lyon",
  "returnDepartureDate": "2024-03-16",
  "returnDepartureTime": "18:00",
  "returnArrivalLocation": "Paris",
  "returnArrivalDate": "2024-03-16",
  "returnArrivalTime": "22:30",
  "returnDuration": 270,
  "hasJunctionWithNext": false,
  "junctionLocation": null,
  "pauses": [
    {
      "pauseType": "outbound",
      "location": "Aire de Repos A6",
      "startTime": "10:00",
      "duration": 15,
      "notes": "Pause café"
    }
  ]
}
```

### PUT `/api/trip-details/:id`
Met à jour un détail de trajet existant.

**Body :** Même structure que POST

### DELETE `/api/trip-details/:id`
Supprime un détail de trajet et ses pauses associées.

## Interface Utilisateur

### Accès
1. Créer ou éditer une réservation avec mode **Tournée** activé
2. Ajouter des événements liés
3. Cliquer sur le bouton **📍 Détails du trajet** sur chaque événement

### Modal TripDetailsModal

**Sections principales :**

1. **Informations de l'événement**
   - Titre et numéro d'affaire

2. **Conducteur**
   - Liste déroulante avec les conducteurs disponibles (Ben, Thom, Lucas)

3. **Trajet ALLER** (bordure bleue)
   - Lieu de départ et d'arrivée
   - Date et heure de départ/arrivée
   - Bouton **Calculer la durée** avec Google Maps
   - Affichage de la durée calculée
   - Gestion des pauses (ajouter/supprimer)

4. **Trajet RETOUR** (bordure verte)
   - Même structure que l'aller

5. **Jonction** (fond jaune)
   - Case à cocher "Enchaînement avec l'événement suivant"
   - Champ lieu de jonction (si coché)

### Gestion des Pauses

Chaque pause comprend :
- Type : ALLER ou RETOUR (automatique selon la section)
- Lieu : Nom du lieu de pause
- Heure de début : Format HH:MM
- Durée : En minutes
- Notes : Commentaires optionnels

Boutons :
- **+ Ajouter une pause** : Ajoute une nouvelle pause
- **🗑️** : Supprime une pause

## Intégration Google Maps

### Configuration
1. **Clé API Google Maps** : Stockée dans la base de données (table `config`)
2. **Endpoint** : GET `/api/config/google/maps-api-key`
3. **Chargement** : Script chargé dynamiquement au premier usage

### Calcul de Durée
- Utilise l'API Distance Matrix de Google Maps
- Mode : DRIVING (conduite)
- Résultat en minutes, arrondi
- Gère les erreurs (adresse invalide, API non disponible)

### Configuration de la clé API
1. Aller dans la configuration Google Calendar
2. Ajouter la clé API Google Maps
3. S'assurer que l'API Distance Matrix est activée dans Google Cloud Console

## Flux d'utilisation

### Création d'une tournée avec détails de trajet

1. **Créer une réservation**
   - Activer "Mode Tournée"
   - Remplir les informations de base

2. **Ajouter des événements**
   - Cliquer sur "Lier un événement Google"
   - Sélectionner les événements dans l'ordre

3. **Configurer les trajets**
   - Pour chaque événement, cliquer sur **📍 Détails du trajet**
   - Remplir les informations d'ALLER :
     * Lieu de départ
     * Date et heure de départ
     * Lieu d'arrivée
     * Date et heure d'arrivée
     * Cliquer sur "Calculer la durée" pour obtenir le temps de trajet
   - Ajouter des pauses si nécessaire
   - Remplir les informations de RETOUR
   - Si l'événement s'enchaîne avec le suivant, cocher "Jonction" et indiquer le lieu

4. **Sauvegarder**
   - Cliquer sur "Enregistrer" dans le modal de trajet
   - Les détails sont sauvegardés automatiquement
   - Répéter pour chaque événement

### Modification d'une tournée existante

1. **Ouvrir la réservation**
2. **Modifier un trajet** : Cliquer sur **📍 Détails du trajet** de l'événement
3. **Ajuster les informations** : Modifier les dates, heures, pauses, etc.
4. **Recalculer si nécessaire** : Utiliser les boutons de calcul de durée
5. **Sauvegarder** : Enregistrer les modifications

## Fichiers modifiés/créés

### Base de données
- `/server/migrations/add_trip_details.sql` - Migration SQL

### Backend
- `/server/routes.js` - Endpoints API pour trip_details

### Frontend
- `/src/components/TripDetailsModal.jsx` - Composant modal (554 lignes)
- `/src/components/TripDetailsModal.css` - Styles (330+ lignes)
- `/src/components/ReservationModal.jsx` - Intégration du modal
- `/src/components/ReservationModal.css` - Styles du bouton

## Points techniques importants

### État local vs Backend
- Les détails de trajet sont sauvegardés immédiatement lors de la fermeture du modal
- Chargés automatiquement lors de l'édition d'une réservation
- Cache local dans `tripDetails` state (keyed by eventId)

### Gestion des événements
- `eventIndex` utilisé pour calculer le `nextEvent` pour la jonction
- Tri des événements par date de début
- Chaque événement peut avoir ses propres détails de trajet indépendants

### Performance
- Chargement paresseux de Google Maps (seulement au besoin)
- Script chargé une seule fois, réutilisé pour tous les calculs
- Indexes SQL pour optimiser les requêtes

### Sécurité
- Authentification requise pour tous les endpoints
- Clé API Google Maps protégée côté backend
- Validation des données côté serveur

## Améliorations futures possibles

1. **Affichage visuel**
   - Afficher un résumé du trajet sur chaque carte d'événement
   - Badges de conducteur, durée totale

2. **Calculs avancés**
   - Calcul automatique du temps de trajet lors du changement d'adresse
   - Suggestion de pauses (tous les X km)
   - Calcul du coût carburant basé sur la distance

3. **Export**
   - Export PDF de l'itinéraire complet
   - Feuille de route pour le conducteur

4. **Notifications**
   - Alertes si temps de conduite > 4h sans pause
   - Rappel d'ajout de détails de trajet pour les tournées

5. **Historique**
   - Suivi des modifications de trajets
   - Statistiques sur les temps de trajet réels vs estimés

## Support et Debug

### Problèmes courants

**Le bouton "Calculer la durée" ne fonctionne pas**
- Vérifier que la clé API Google Maps est configurée
- S'assurer que l'API Distance Matrix est activée dans Google Cloud Console
- Vérifier la console du navigateur pour les erreurs

**Les pauses ne se sauvegardent pas**
- Vérifier que la pause a bien tous les champs remplis
- Regarder les logs du backend (`pm2 logs vehicules-backend`)

**Erreur lors du chargement des détails existants**
- Vérifier que la migration SQL a été appliquée
- Tester l'endpoint `/api/trip-details/:reservationId` dans Postman

### Logs utiles
```bash
# Logs backend
pm2 logs vehicules-backend

# Vérifier la base de données
sqlite3 vehicules.db "SELECT * FROM trip_details;"
sqlite3 vehicules.db "SELECT * FROM trip_pauses;"
```
