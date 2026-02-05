# Activation de l'API Google Places

## Problème
Les suggestions d'autocomplétion pour les lieux ne s'affichent pas dans LocationDialog.

## Cause probable
L'API **Places API** n'est pas activée dans votre projet Google Cloud.

## Solution

### 1. Accéder à Google Cloud Console
Allez sur : https://console.cloud.google.com/

### 2. Sélectionner votre projet
- En haut de la page, cliquez sur le sélecteur de projet
- Choisissez votre projet (celui qui contient votre clé API actuelle)

### 3. Activer Places API
1. Dans le menu de gauche, allez dans **APIs & Services** → **Library** (Bibliothèque)
2. Recherchez "**Places API**"
3. Cliquez sur "**Places API**" dans les résultats
4. Cliquez sur le bouton "**ENABLE**" (ACTIVER)

### 4. Vérifier les restrictions de clé API (optionnel mais recommandé)
1. Allez dans **APIs & Services** → **Credentials** (Identifiants)
2. Cliquez sur votre clé API
3. Dans "API restrictions" (Restrictions d'API), vérifiez que **Places API** est autorisée
4. Si vous avez des restrictions d'API, ajoutez :
   - **Places API**
   - **Maps JavaScript API** (déjà activée normalement)

### 5. Tester
Retournez dans votre application :
1. Ouvrez une réservation
2. Cliquez sur "Nouveau lieu"
3. Dans le champ "Nom du lieu", tapez "Tour Eiffel" ou "Stade de France"
4. Vous devriez voir des suggestions apparaître

## Vérification depuis le terminal

Vous pouvez tester si l'API Places fonctionne avec cette commande :

```bash
API_KEY="AIzaSyCusqNuf0Pobi-H0kVINSFFRb33WuLzqpA"
curl -s "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Tour+Eiffel&key=$API_KEY" | head -20
```

Si vous voyez `"status": "REQUEST_DENIED"`, c'est que l'API n'est pas activée.
Si vous voyez `"status": "OK"` avec des résultats, l'API fonctionne !

## APIs requises pour ce projet

Assurez-vous que ces APIs sont activées :
- ✅ **Maps JavaScript API** (pour afficher les cartes)
- ✅ **Places API** (pour l'autocomplétion des lieux)
- ✅ **Geocoding API** (pour convertir adresses ↔ coordonnées)
- ✅ **Distance Matrix API** (pour calculer les distances)

## Coûts

L'API Places a un quota gratuit de :
- **Autocomplete** : 1000 requêtes/jour gratuites
- Au-delà : ~0.003€ par requête

Pour un usage normal, vous resterez dans le quota gratuit.

## Support

Si le problème persiste après activation, vérifiez :
1. La console du navigateur (F12) pour voir les erreurs détaillées
2. Que votre clé API n'a pas de restrictions d'IP/domaine trop strictes
3. Que votre compte Google Cloud n'a pas de problème de facturation
