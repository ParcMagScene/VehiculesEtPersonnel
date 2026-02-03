# Configuration Google Maps API

## Obtenir une clé API Google Maps

Vous utilisez déjà OAuth 2.0 pour Google Calendar. Il suffit d'ajouter les API Maps à votre projet existant.

### Étapes :

1. **Accédez à votre projet Google Cloud**
   - Rendez-vous sur [console.cloud.google.com](https://console.cloud.google.com/)
   - Sélectionnez votre projet existant (celui utilisé pour Google Calendar)

2. **Activez les API Maps nécessaires**
   - Dans le menu de navigation, allez dans "API et services" > "Bibliothèque"
   - Recherchez et activez les API suivantes :
     - **Maps JavaScript API**
     - **Places API**
     - **Distance Matrix API**
     - **Geocoding API**

3. **Créez une clé API (distincte du Client ID OAuth)**
   - Dans "API et services" > "Identifiants"
   - Cliquez sur "Créer des identifiants" > "Clé API"
   - Votre clé API sera générée

4. **Sécurisez votre clé (IMPORTANT)**
   - Cliquez sur votre clé nouvellement créée pour la modifier
   - Dans "Restrictions liées aux applications", sélectionnez "Référents HTTP"
   - Ajoutez vos domaines :
     - `http://192.168.205.75:4173/*`
     - `http://magsav.duckdns.org:4173/*`
   - Dans "Restrictions liées aux API", sélectionnez "Limiter la clé aux API sélectionnées"
   - Choisissez les 4 API Maps mentionnées ci-dessus
   - Cliquez sur "Enregistrer"

5. **Ajoutez la clé dans l'application**
   - Connectez-vous en tant qu'administrateur
   - Ouvrez le panneau de gestion (⚙️)
   - Allez dans "Config Google"
   - Collez votre clé API dans le champ "Clé API Google Maps"
   - Cliquez sur "Enregistrer"

## Facturation

Google Maps offre un crédit mensuel gratuit de 200$ qui devrait largement suffire pour une utilisation normale. 

Au-delà, les tarifs sont :
- Maps JavaScript API : ~7$ / 1000 chargements
- Places API : ~17$ / 1000 requêtes
- Distance Matrix API : ~5$ / 1000 éléments
- Geocoding API : ~5$ / 1000 requêtes

## Configuration de l'adresse de MagScène

Une fois la clé API configurée :

1. Dans le même écran "Config Google"
2. Faites défiler jusqu'à "Adresse de MagScène"
3. Entrez l'adresse complète de votre entreprise
4. Cliquez sur "Enregistrer l'adresse"

Cette adresse sera utilisée pour calculer automatiquement les distances et temps de trajet vers tous les lieux enregistrés.

## Utilisation

### Ajouter un lieu avec carte :
1. Onglet "Lieux" → Cliquez sur le bouton "+"
2. Un dialog s'ouvre avec :
   - 📝 Formulaire à gauche
   - 🗺️ Carte Google Maps à droite
3. Tapez une adresse et utilisez l'autocomplétion
4. Ou déplacez le marqueur directement sur la carte
5. Les coordonnées GPS et l'adresse se remplissent automatiquement
6. La distance et le temps depuis MagScène s'affichent instantanément

### Modifier un lieu :
1. Cliquez sur ✏️ à côté du lieu
2. Le dialog s'ouvre avec toutes les informations
3. Modifiez et sauvegardez
