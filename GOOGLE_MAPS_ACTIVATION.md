# 🗺️ Activation de Google Maps API

## Problème détecté

L'erreur `ApiNotActivatedMapError` indique que votre clé API Google n'a pas l'API Maps JavaScript activée.

## ✅ Solution - Activer l'API Maps JavaScript

### Étape 1 : Accéder à Google Cloud Console

1. Allez sur https://console.cloud.google.com/
2. Sélectionnez votre projet (celui qui contient votre clé API actuelle)

### Étape 2 : Activer les APIs nécessaires

Dans la console Google Cloud, activez les APIs suivantes :

1. **Maps JavaScript API** ⭐ (OBLIGATOIRE - celle qui manque actuellement)
   - https://console.cloud.google.com/apis/library/maps-backend.googleapis.com
   
2. **Places API** (déjà activée normalement)
   - https://console.cloud.google.com/apis/library/places-backend.googleapis.com
   
3. **Distance Matrix API** (pour calcul distances)
   - https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   
4. **Geocoding API** (pour adresses)
   - https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

### Étape 3 : Vérifier la clé API

1. Allez dans **APIs & Services > Credentials**
2. Trouvez votre clé API : `AIzaSyCusqNuf0Pobi-H0kVINSFFRb33WuLzqpA`
3. Cliquez dessus pour éditer
4. Dans **API restrictions**, vérifiez que les APIs ci-dessus sont autorisées
5. Dans **Application restrictions**, ajoutez vos domaines :
   - `http://magsav.duckdns.org:4173`
   - `http://localhost:4173`
   - `http://localhost:5173`

### Étape 4 : Tester

Après activation :
1. Attendez quelques minutes (propagation)
2. Rechargez l'application
3. Ouvrez la gestion → Lieux → Modifier un lieu
4. La carte devrait s'afficher sans erreur

## 📊 État actuel

Votre clé API : `AIzaSyCusqNuf0Pobi-H0kVINSFFRb33WuLzqpA`

✅ APIs activées :
- Calendar API
- OAuth 2.0

❌ APIs manquantes :
- **Maps JavaScript API** ← À activer en priorité

## 🔧 Avertissements dans les logs

### 1. Autocomplete déprécié (non urgent)
```
google.maps.places.Autocomplete is not available to new customers
```
- **Impact** : Aucun pour l'instant
- **Action** : Migration vers `PlaceAutocompleteElement` prévue dans une future mise à jour
- **Deadline** : Au moins 12 mois de préavis avant discontinuation

### 2. Chargement synchrone (corrigé)
```
Google Maps JavaScript API has been loaded directly without loading=async
```
- **Impact** : Performance non optimale
- **Action** : Code mis à jour avec `async=true` et `defer=true`

## 💰 Facturation

Google Maps propose :
- **200$/mois de crédit gratuit** (≈ 28,000 chargements de carte)
- Si dépassement, facturation au chargement

Pour votre usage (gestion de lieux), vous resterez probablement dans la limite gratuite.

## 🆘 Dépannage

Si la carte ne s'affiche toujours pas après activation :

1. Vérifiez dans la console :
   ```
   📦 Config Google chargée - Maps API Key: AIza...
   ```

2. Vérifiez l'absence d'erreur :
   ```
   ❌ ApiNotActivatedMapError  ← Ne doit plus apparaître
   ```

3. Testez l'API directement :
   ```
   https://maps.googleapis.com/maps/api/js?key=VOTRE_CLE&callback=console.log
   ```

## 📞 Support

En cas de problème persistant :
- Documentation Google Maps : https://developers.google.com/maps/documentation
- Console Google Cloud : https://console.cloud.google.com/
